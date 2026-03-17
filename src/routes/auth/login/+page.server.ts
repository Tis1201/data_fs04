import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { verify, hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import lucia from '$lib/server/auth';
import type { PageServerLoad, Actions } from './$types';
import { loginSchema, forgotPasswordSchema, registerSchema } from '$lib/schemas/auth';
import { validatePassword } from '$lib/server/auth/password-validation';
import { logger } from '$lib/server/logger';
import { logSessionActivity, logFailedLogin } from '$lib/server/session-logger';
import { createSessionWithCronjob } from '$lib/server/auth/session-helper';
import { EmailService } from '$lib/server/email/emailService';
import { resetUserPassword } from '$lib/server/services/password-reset';
import prisma from '$lib/server/prisma'; // Raw Prisma client to bypass ZenStack for settings
import { createAccountSystemRule } from '$lib/server/pin-rules/createAccountSystemRule';

// Create a separate Prisma client for auth to bypass Zenstack
const authPrisma = new PrismaClient();

export const load = (async ({ locals, url }) => {
    let allowRegistration = false;
    const redirectTo = url.searchParams.get('redirectTo');
    
    try {
        // Load settings to check if registration is allowed
        const activeSettings = await prisma.setting.findFirst({
            where: { isActive: true },
            select: { data: true }
        });
        
        if (activeSettings?.data) {
            const settings = JSON.parse(activeSettings.data);
            // Check both auth and system sections for allowRegistration (migration support)
            allowRegistration = settings.auth?.allowRegistration ?? settings.system?.allowRegistration ?? false;
        }
    } catch (e) {
        logger.error('Error loading settings for registration check', { error: e });
        // Default to false if settings can't be loaded
        allowRegistration = false;
    }
    
    let session;
    try {
        session = await locals.auth.validate();
    } catch (e) {
        logger.error('Error validating session', { error: e });
        // If there's an error, just continue to login form
    }

    if (session?.user) {
        const user = await authPrisma.user.findUnique({
            where: { id: session.user.id }
        });

        if (user) {
            logger.debug('User already has valid session, redirecting', {
                userId: session.user.id,
                role: user.systemRole
            });

            const finalRedirectTo = redirectTo || (user.systemRole === 'ADMIN' ? '/admin' : '/user');
            throw redirect(302, finalRedirectTo);
        }
    }

    const form = await superValidate(zod(loginSchema));
    const forgotPasswordForm = await superValidate(zod(forgotPasswordSchema));
    const registerForm = await superValidate(zod(registerSchema));
    
    return { 
        form,
        forgotPasswordForm,
        registerForm,
        allowRegistration,
        redirectTo: redirectTo || null
    };
}) satisfies PageServerLoad;

export const actions: Actions = {
    login: async ({ request, cookies, getClientAddress, url }) => {
        // Read form data first (request body can only be consumed once)
        const formData = await request.formData();
        const redirectTo = formData.get('redirectTo')?.toString() || url.searchParams.get('redirectTo');

        // Validate form using the captured FormData
        const form = await superValidate(formData, zod(loginSchema));

        if (!form.valid) {
            logger.error('Form validation failed', { 
                errors: form.errors,
                formData: {
                    email: form.data.email,
                    hasPassword: !!form.data.password
                }
            });
            return fail(400, { form });
        }

        try {
            // Use regular prisma for auth operations
            const user = await authPrisma.user.findUnique({
                where: { email: form.data.email },
                select: {
                    id: true,
                    password: true,
                    systemRole: true,
                    rolesString: true
                }
            });

            if (!user?.password) {
                logger.debug('Invalid credentials - user not found or no password', { email: form.data.email });
                
                // Log failed login attempt
                await logFailedLogin(authPrisma, {
                    email: form.data.email,
                    reason: 'user_not_found',
                    ipAddress: getClientAddress(),
                    userAgent: request.headers.get('user-agent') || undefined
                });
                
                return fail(400, {
                    form: {
                        ...form,
                        errors: { _errors: ['Invalid email or password'] }
                    }
                });
            }

            // Verify password using Argon2
            const validPassword = await verify(user.password, form.data.password);
            if (!validPassword) {
                logger.debug('Invalid credentials - wrong password', { email: form.data.email });
                
                // Log failed login attempt
                await logFailedLogin(authPrisma, {
                    email: form.data.email,
                    reason: 'invalid_password',
                    ipAddress: getClientAddress(),
                    userAgent: request.headers.get('user-agent') || undefined,
                    accountId: await authPrisma.user.findUnique({
                        where: { id: user.id },
                        select: { primaryAccountId: true }
                    }).then(u => u?.primaryAccountId || undefined)
                });
                
                return fail(400, {
                    form: {
                        ...form,
                        errors: { _errors: ['Invalid email or password'] }
                    }
                });
            }

            // Log user details before creating session
            logger.debug('User details before creating session', { 
                userId: user.id,
                email: form.data.email,
                role: user.systemRole,
                status: await authPrisma.user.findUnique({
                    where: { id: user.id },
                    select: { status: true }
                }).then(u => u?.status),
                hasRolesString: !!user.rolesString
            });
            
            // Check if non-admin user belongs to an account
            if (user.systemRole !== 'ADMIN') {
                const userWithAccount = await authPrisma.user.findUnique({
                    where: { id: user.id },
                    select: { 
                        primaryAccountId: true,
                        accountMemberships: { take: 1 }
                    }
                });

                const hasAccount = userWithAccount?.primaryAccountId || 
                                  (userWithAccount?.accountMemberships && userWithAccount.accountMemberships.length > 0);

                if (!hasAccount) {
                    logger.warn('User without account attempted to login', { 
                        userId: user.id,
                        email: form.data.email,
                        role: user.systemRole,
                        hasPrimaryAccount: !!userWithAccount?.primaryAccountId,
                        hasMemberships: userWithAccount?.accountMemberships?.length || 0
                    });
                    
                    return fail(403, {
                        form: {
                            ...form,
                            errors: { _errors: ['Your account needs to be associated with an organization. Please contact your administrator.'] }
                        }
                    });
                }
            }
            
            try {
                // Create session with automatic expiration cronjob
                const session = await createSessionWithCronjob(user.id, {}, authPrisma);
                const sessionCookie = lucia.createSessionCookie(session.id);
                cookies.set(sessionCookie.name, sessionCookie.value, {
                    path: ".",
                    ...sessionCookie.attributes
                });

                logger.info('User logged in successfully', { 
                    userId: user.id,
                    email: form.data.email,
                    role: user.systemRole
                });
                
                // Get the user's primary account ID
                const userDetails = await authPrisma.user.findUnique({
                    where: { id: user.id },
                    select: { primaryAccountId: true }
                });
                
                // Log successful login
                await logSessionActivity(authPrisma, {
                    userId: user.id,
                    action: 'login',
                    sessionId: session.id,
                    ipAddress: getClientAddress(),
                    userAgent: request.headers.get('user-agent') || undefined,
                    deviceInfo: {
                        browser: request.headers.get('sec-ch-ua') || undefined,
                        platform: request.headers.get('sec-ch-ua-platform') || undefined,
                        mobile: request.headers.get('sec-ch-ua-mobile') || undefined
                    },
                    accountId: userDetails?.primaryAccountId || undefined
                });
            } catch (sessionError) {
                // Log detailed session creation error
                logger.error('Session creation error', { 
                    error: sessionError,
                    errorName: (sessionError as any).name,
                    errorMessage: (sessionError as any).message,
                    errorStack: (sessionError as any).stack,
                    userId: user.id,
                    role: user.systemRole
                });
                
                throw sessionError;
            }

            // Use redirectTo from URL if provided, otherwise use role-based default
            const finalRedirectTo = redirectTo || (user.systemRole === 'ADMIN' ? '/admin' : '/user');
            
            logger.info('Login successful, redirecting', { redirectTo: finalRedirectTo });
            
            // Simple server-side redirect - much simpler!
            throw redirect(302, finalRedirectTo);

        } catch (e) {
            // If this is our redirect response, rethrow so SvelteKit handles it
            if (
                e &&
                typeof e === 'object' &&
                'status' in e &&
                typeof (e as any).status === 'number' &&
                (e as any).status >= 300 &&
                (e as any).status < 400
            ) {
                throw e;
            }
            
            // Enhanced error logging
            logger.error('Login error', { 
                error: e,
                errorName: (e as any).name,
                errorMessage: (e as any).message,
                errorStack: (e as any).stack,
                errorCode: (e as any).code,
                email: form.data.email
            });
            
            return fail(500, {
                form: {
                    ...form,
                    errors: { _errors: ['An error occurred during login: ' + ((e as any).message || (e as any).code || 'Unknown error')] }
                }
            });
        }
    },

    forgotPassword: async ({ request }) => {
        const form = await superValidate(request, zod(forgotPasswordSchema));
        
        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            logger.info('Forgot password request', { email: form.data.email });

            // Always return success message for security (regardless of whether user exists)
            const securityMessage = 'If an account with that email exists, we have sent you a password reset email.';

            // Check if user exists (but don't reveal this information)
            const user = await authPrisma.user.findUnique({
                where: { email: form.data.email },
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            });

            // Only send email if user actually exists
            if (user) {
                try {
                    // Use the new password reset service
                    const result = await resetUserPassword({
                        userId: user.id,
                        userEmail: user.email,
                        userName: user.name || user.email,
                        prisma: authPrisma
                    });

                    if (result.success) {
                        logger.info(`Forgot password email sent successfully to ${user.email}`);
                    } else {
                        logger.error(`Failed to send forgot password email: ${result.message}`);
                    }
                } catch (passwordError) {
                    logger.error('Error updating password for forgot password:', passwordError as Record<string, any>);
                }
            } else {
                logger.info('Forgot password request for non-existent email', { email: form.data.email });
            }

            // Always return success for security
            return {
                form,
                success: true,
                message: securityMessage
            };

        } catch (e) {
            logger.error('Forgot password error', { 
                error: e,
                email: form.data.email
            });
            
            // Still return success message for security
            return {
                form,
                success: true,
                message: 'If an account with that email exists, we have sent you a password reset email.'
            };
        }
    },

    register: async ({ request, cookies, getClientAddress }) => {
        // Check if registration is allowed
        let allowRegistration = false;
        try {
            const activeSettings = await prisma.setting.findFirst({
                where: { isActive: true },
                select: { data: true }
            });
            if (activeSettings?.data) {
                const settings = JSON.parse(activeSettings.data);
                allowRegistration = settings.auth?.allowRegistration ?? settings.system?.allowRegistration ?? false;
            }
        } catch (e) {
            logger.error('Error loading settings during registration', { error: e as Record<string, any> });
        }

        if (!allowRegistration) {
            return fail(403, {
                registerForm: { errors: { _errors: ['Registration is currently disabled'] } }
            });
        }

        const form = await superValidate(request, zod(registerSchema));
        if (!form.valid) {
            return fail(400, { registerForm: form });
        }

        try {
            const passwordValidation = await validatePassword(form.data.password);
            if (!passwordValidation.valid) {
                return fail(400, {
                    registerForm: { ...form, errors: { password: [passwordValidation.error || 'Invalid password'] } }
                });
            }

            const existingUser = await authPrisma.user.findUnique({ where: { email: form.data.email } });
            if (existingUser) {
                return fail(400, {
                    registerForm: { ...form, errors: { email: ['An account with this email already exists'] } }
                });
            }

            const hashedPassword = await hash(form.data.password);
            const user = await authPrisma.user.create({
                data: {
                    name: form.data.name,
                    email: form.data.email,
                    password: hashedPassword,
                    systemRole: 'USER',
                    status: 'ACTIVE'
                }
            });

            const defaultAccount = await authPrisma.account.create({
                data: {
                    name: `${form.data.name}'s Account`,
                    slug: `${form.data.name.toLowerCase().replace(/\s+/g, '-')}-account`,
                    status: 'ACTIVE',
                    description: 'Default account created during registration'
                }
            });

            await authPrisma.accountMembership.create({
                data: { userId: user.id, accountId: defaultAccount.id, role: 'OWNER' }
            });

            await createAccountSystemRule(authPrisma, defaultAccount.id, user.id);

            await authPrisma.user.update({
                where: { id: user.id },
                data: { primaryAccountId: defaultAccount.id }
            });

            cookies.set('current_account_id', defaultAccount.id, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 30
            });

            const session = await createSessionWithCronjob(user.id, {}, authPrisma);
            const sessionCookie = lucia.createSessionCookie(session.id);
            cookies.set(sessionCookie.name, sessionCookie.value, {
                path: '.',
                ...sessionCookie.attributes
            });

            await logSessionActivity(authPrisma, {
                userId: user.id,
                action: 'login',
                sessionId: session.id,
                ipAddress: getClientAddress(),
                userAgent: request.headers.get('user-agent') || undefined
            });

            logger.info('User registered successfully', { userId: user.id, email: user.email });

            return { registerForm: form, success: true, redirectTo: '/user' };

        } catch (e) {
            logger.error('Registration error', { error: e as Record<string, any>, email: form.data.email });
            return fail(500, {
                registerForm: { ...form, errors: { _errors: ['An error occurred during registration. Please try again.'] } }
            });
        }
    }
};
