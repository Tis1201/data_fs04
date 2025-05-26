import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { verify } from "@node-rs/argon2";
import { PrismaClient } from '@prisma/client';
import lucia from '$lib/server/auth';
import type { PageServerLoad, Actions } from './$types';
import { loginSchema } from '$lib/schemas/auth';
import { logger } from '$lib/server/logger';
import { logSessionActivity, logFailedLogin } from '$lib/server/session-logger';

// Create a separate Prisma client for auth to bypass Zenstack
const authPrisma = new PrismaClient();

export const load = (async ({ locals }) => {
    try {
        const session = await locals.auth.validate();
        if (session?.user) {
            // Get the user to check their role
            const user = await authPrisma.user.findUnique({
                where: { id: session.user.id }  
            });

            if (user) {
                logger.debug('User already has valid session, redirecting', { 
                    userId: session.user.id,  
                    role: user.systemRole 
                });

                // Return success with redirect path
                return {
                    form: {},
                    success: true,
                    redirectTo: user.systemRole === 'ADMIN' ? '/admin' : '/user'
                };
            }
        }
    } catch (e) {
        logger.error('Error validating session', { error: e });
        // If there's an error, just continue to login form
    }

    const form = await superValidate(zod(loginSchema));
    return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
    default: async ({ request, cookies, getClientAddress }) => {
        const form = await superValidate(request, zod(loginSchema));
        logger.debug('Login attempt', { email: form.data.email });

        if (!form.valid) {
            logger.debug('Invalid form data', { errors: form.errors });
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

            // Verify password
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
            
            try {
                // Create session
                const session = await lucia.createSession(user.id, {});
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
                    errorName: sessionError.name,
                    errorMessage: sessionError.message,
                    errorStack: sessionError.stack,
                    userId: user.id,
                    role: user.systemRole
                });
                
                throw sessionError;
            }

            // Return success with redirect path based on user's role
            return {
                form,
                success: true,
                redirectTo: user.systemRole === 'ADMIN' ? '/admin' : '/user'
            };

        } catch (e) {
            // Enhanced error logging
            logger.error('Login error', { 
                error: e,
                errorName: e.name,
                errorMessage: e.message,
                errorStack: e.stack,
                errorCode: e.code,
                email: form.data.email
            });
            
            return fail(500, {
                form: {
                    ...form,
                    errors: { _errors: ['An error occurred during login: ' + (e.message || e.code || 'Unknown error')] }
                }
            });
        }
    }
};
