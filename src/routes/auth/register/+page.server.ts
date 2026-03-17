import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import lucia from '$lib/server/auth';
import type { PageServerLoad, Actions } from './$types';
import { registerSchema } from '$lib/schemas/auth';
import { logger } from '$lib/server/logger';
import { logSessionActivity } from '$lib/server/session-logger';
import { createSessionWithCronjob } from '$lib/server/auth/session-helper';
import prisma from '$lib/server/prisma'; // Raw Prisma client to bypass ZenStack for settings
import { validatePassword } from '$lib/server/auth/password-validation';
import { createAccountSystemRule } from '$lib/server/pin-rules/createAccountSystemRule';

// Create a separate Prisma client for auth to bypass Zenstack
const authPrisma = new PrismaClient();

export const load = (async ({ locals }) => {
    let allowRegistration = false;
    
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
        logger.error('Error loading settings for registration check', { error: e as Record<string, any> });
        // Default to false if settings can't be loaded
        allowRegistration = false;
    }
    
    // If registration is not allowed, redirect to login
    if (!allowRegistration) {
        throw redirect(302, '/auth/login');
    }
    
    let session;
    try {
        session = await locals.auth.validate();
    } catch (e) {
        logger.error('Error validating session', { error: e as Record<string, any> });
        // If there's an error, just continue to registration form
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

            throw redirect(302, user.systemRole === 'ADMIN' ? '/admin' : '/user');
        }
    }

    const form = await superValidate(zod(registerSchema));
    return { 
        form,
        allowRegistration
    };
}) satisfies PageServerLoad;

export const actions: Actions = {
    default: async ({ request, cookies, getClientAddress }) => {
        // First check if registration is allowed
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
                form: {
                    errors: { _errors: ['Registration is currently disabled'] }
                }
            });
        }

        const form = await superValidate(request, zod(registerSchema));
        logger.debug('Registration attempt', { email: form.data.email });

        if (!form.valid) {
            logger.debug('Invalid registration form data', { errors: form.errors });
            return fail(400, { form });
        }

        try {
            // Validate password based on settings
            const passwordValidation = await validatePassword(form.data.password);
            if (!passwordValidation.valid) {
                return fail(400, {
                    form: {
                        ...form,
                        errors: { password: [passwordValidation.error || 'Invalid password'] }
                    }
                });
            }

            // Check if user already exists
            const existingUser = await authPrisma.user.findUnique({
                where: { email: form.data.email }
            });

            if (existingUser) {
                logger.debug('Registration attempt with existing email', { email: form.data.email });
                return fail(400, {
                    form: {
                        ...form,
                        errors: { email: ['An account with this email already exists'] }
                    }
                });
            }

            // Hash password
            const hashedPassword = await hash(form.data.password);

            // Create user
            const user = await authPrisma.user.create({
                data: {
                    name: form.data.name,
                    email: form.data.email,
                    password: hashedPassword,
                    systemRole: 'USER',
                    status: 'ACTIVE'
                }
            });

            // Create a default account for the new user
            const defaultAccount = await authPrisma.account.create({
                data: {
                    name: `${form.data.name}'s Account`,
                    slug: `${form.data.name.toLowerCase().replace(/\s+/g, '-')}-account`,
                    status: 'ACTIVE',
                    description: 'Default account created during registration'
                }
            });

            // Create account membership with OWNER role
            await authPrisma.accountMembership.create({
                data: {
                    userId: user.id,
                    accountId: defaultAccount.id,
                    role: 'OWNER'
                }
            });

            // Create per-account system rule (always active, cannot delete)
            await createAccountSystemRule(authPrisma, defaultAccount.id, user.id);

            // Set this as the user's primary account
            await authPrisma.user.update({
                where: { id: user.id },
                data: { primaryAccountId: defaultAccount.id }
            });

            // Set the current account cookie so user is automatically in their account
            cookies.set('current_account_id', defaultAccount.id, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 30 // 30 days
            });

            logger.info('User registered successfully with default account', { 
                userId: user.id,
                email: user.email,
                name: user.name,
                accountId: defaultAccount.id,
                accountName: defaultAccount.name
            });

            // Create session for the new user with automatic expiration cronjob
            const session = await createSessionWithCronjob(user.id, {}, authPrisma);
            const sessionCookie = lucia.createSessionCookie(session.id);
            cookies.set(sessionCookie.name, sessionCookie.value, {
                path: ".",
                ...sessionCookie.attributes
            });

            // Log successful registration and login
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
                }
            });

            // Return success with redirect path
            return {
                form,
                success: true,
                redirectTo: '/user' // New users go to user dashboard
            };

        } catch (e) {
            logger.error('Registration error', { 
                error: e as Record<string, any>,
                errorName: e instanceof Error ? e.name : 'Unknown',
                errorMessage: e instanceof Error ? e.message : 'Unknown error',
                errorStack: e instanceof Error ? e.stack : undefined,
                email: form.data.email
            });
            
            return fail(500, {
                form: {
                    ...form,
                    errors: { _errors: ['An error occurred during registration. Please try again.'] }
                }
            });
        }
    }
};
