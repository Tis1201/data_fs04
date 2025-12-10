import {error, fail, type RequestEvent} from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { hash, verify } from '@node-rs/argon2';
import prisma from '$lib/server/prisma';
import { userAccountSchema, notificationSchema, passwordSchema, companyCreateSchema, relationshipSchema } from './schema';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

/**
 * Load user account settings data
 */
export const load = restrictAccountRole(
    async ({ auth, accountMembership }: AccountAuthenticatedEvent) => {
        try {
            const { accountId } = accountMembership;

            // Get current user data
            const user = await prisma.user.findUnique({
                where: { id: auth!.user.id },
                include: {
                    sessions: {
                        select: {
                            id: true,
                            createdAt: true,
                            expiresAt: true
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 10
                    }
                }
            });

            if (!user) {
                return fail(404, { error: 'User not found' });
            }

            // Get current account
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                include: {
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    name: true,
                                    sessions: {
                                        select: {
                                            id: true,
                                            createdAt: true,
                                            expiresAt: true
                                        },
                                        orderBy: { createdAt: 'desc' },
                                        take: 10
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!account) {
                return fail(404, { error: 'Account not found' });
            }

            // Get all session IDs for users in the current account
            const accountUserSessionIds = account.members.flatMap(member => 
                member.user.sessions.map(userSession => userSession.id)
            );

            console.log("accountUserSessionIds",accountUserSessionIds)

            // Get session logs for users in the current account
            const sessionLogs = await prisma.userSessionLog.findMany({
                where: {
                    action: 'login',
                    sessionId: {
                        in: [...accountUserSessionIds, ...user.sessions.map(s => s.id)]
                    }
                },
                orderBy: { timestamp: 'desc' },
                take: 20
            });

            console.log("sessionLogs", sessionLogs)

            // Create a map of sessionId to session log for quick lookup
            const sessionLogMap = new Map(
                sessionLogs.map((log: any) => [log.sessionId, log])
            );

            console.log("sessionLogMap", sessionLogMap)

            // Get companies for the current account - following admin pattern exactly
            const companies = await prisma.company.findMany({
                where: { accountId: accountId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    _count: {
                        select: {
                            devices: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            });

            // Debug logging for companies query
            logger.info('Companies query debug:', {
                accountId,
                companiesFound: companies.length,
                companies: companies.map(c => ({
                    id: c.id,
                    name: c.name,
                    status: c.status
                }))
            });

            // Initialize forms with proper error handling
            const getValidEmail = (email: string | null | undefined): string => {
                if (!email) return 'user@example.com';
                // Check if it's a valid email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(email) ? email : 'user@example.com';
            };

            const accountForm = await superValidate({
                name: account.name || '',
                slug: account.slug || '',
                description: account.description || ''
            }, zod(userAccountSchema));

            const notificationForm = await superValidate({
                email: true,
                newsletter: false,
                security: true
            }, zod(notificationSchema));

            const passwordForm = await superValidate(zod(passwordSchema));

            // Parse user agent for device info
            const parseUserAgent = (userAgent: string) => {
                if (!userAgent) return { name: 'Unknown Device', browser: 'Unknown' };
                
                let deviceName = 'Unknown Device';
                let browser = 'Unknown Browser';
                
                if (userAgent.includes('iPhone')) deviceName = 'iPhone';
                else if (userAgent.includes('iPad')) deviceName = 'iPad';
                else if (userAgent.includes('Android')) deviceName = 'Android Device';
                else if (userAgent.includes('Mac')) deviceName = 'Mac';
                else if (userAgent.includes('Windows')) deviceName = 'Windows PC';
                else if (userAgent.includes('Linux')) deviceName = 'Linux';
                
                if (userAgent.includes('Chrome')) browser = 'Chrome';
                else if (userAgent.includes('Firefox')) browser = 'Firefox';
                else if (userAgent.includes('Safari')) browser = 'Safari';
                else if (userAgent.includes('Edge')) browser = 'Edge';
                
                return { name: `${deviceName} (${browser})`, browser };
            };

            // Format sessions for display - show all users' sessions in the account
            const allAccountSessions = account.members.flatMap(member => {
                const memberUser = member.user as any; // Type assertion to handle complex Prisma types
                return memberUser.sessions?.map((userSession: any) => ({
                    ...userSession,
                    userId: memberUser.id,
                    userEmail: memberUser.email || 'Unknown',
                    userName: memberUser.name || 'Unknown User'
                })) || [];
            });

            // Include current user sessions if not already included
            const currentUserSessions = user.sessions.map((userSession: any) => ({
                ...userSession,
                userId: user.id,
                userEmail: user.email,
                userName: user.name || 'Current User'
            }));

            // Combine and deduplicate sessions
            const allSessions = [
                ...allAccountSessions,
                ...currentUserSessions.filter(cs => 
                    !allAccountSessions.some(as => as.id === cs.id)
                )
            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            console.log("allSessions", allSessions)
            console.log("sessionLogMap", sessionLogMap)
            const activeSessions = allSessions.map((userSession: any) => {
                const sessionLog = sessionLogMap.get(userSession.id) as any;
                console.log("sessionLog", sessionLog)
                return {
                    id: userSession.id,
                    name: sessionLog ? parseUserAgent(sessionLog.userAgent || '').name : 'Browser Session',
                    location: sessionLog?.ipAddress || 'Unknown',
                    lastUsed: userSession.createdAt,
                    isCurrentSession: userSession.id === auth!.session?.id,
                    expiresAt: userSession.expiresAt,
                    userId: userSession.userId,
                    userEmail: userSession.userEmail,
                    userName: userSession.userName
                };
            });

            console.log("activeSessions", activeSessions)

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    status: user.status,
                    createdAt: user.createdAt,
                    lastLogin: user.sessions[0]?.createdAt || user.createdAt
                },
                account: {
                    id: account.id,
                    name: account.name,
                    slug: account.slug,
                    status: account.status,
                    description: account.description
                },
                currentAccount: {
                    id: account.id,
                    name: account.name,
                    slug: account.slug,
                    role: accountMembership.role,
                    userRole: accountMembership.role // For compatibility with permissions utility
                },
                settings: {
                    emailNotifications: true,
                    newsletterSubscription: false,
                    securityAlerts: true,
                    twoFactorEnabled: false
                },
                activeSessions,
                relationships: {
                    companies
                },
                forms: {
                    account: accountForm,
                    notifications: notificationForm,
                    password: passwordForm
                }
            };
        } catch (err) {
            logger.error('Error loading user settings:', err as Record<string, any>);
            return fail(500, { error: 'Failed to load user settings' });
        }
    },
    ['ADMIN', 'OWNER', 'MEMBER'] // Allow all members to view account settings
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update account/company information
     */
    updateAccount: restrictAccountRole(
        async ({ request, auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;

            const form = await superValidate(request, zod(userAccountSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Get user's membership in the current account
                const user = await prisma.user.findUnique({
                    where: { id: auth!.user.id },
                    include: {
                        accountMemberships: {
                            include: { account: true },
                            where: { accountId: accountId }
                        }
                    }
                });

                if (!user?.accountMemberships[0]) {
                    return fail(404, { form, error: 'Account membership not found' });
                }

                const account = user.accountMemberships[0].account;

                // Check if user has permission to update account info
                const membership = user.accountMemberships[0];
                if (!['OWNER', 'ADMIN'].includes(membership.role)) {
                    return fail(403, { form, error: 'Insufficient permissions to update account information' });
                }

                // Update account information
                const updatedAccount = await prisma.account.update({
                    where: { id: account.id },
                    data: {
                        name: form.data.name,
                        slug: form.data.slug,
                        description: form.data.description || null
                    }
                });

                logger.info('Account information updated', { 
                    userId: auth!.user.id, 
                    accountId: account.id 
                });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Account',
                    recordId: account.id,
                    oldData: account,
                    newData: updatedAccount,
                    userId: auth!.user.id,
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: prisma
                })

                return message(form, {
                    type: 'success',
                    text: 'Account information updated successfully'
                });
            } catch (err) {
                logger.error('Error updating account:', err as Record<string, any>);
                return message(form, {
                    type: 'error',
                    text: 'Failed to update account information'
                }, { status: 500 });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Update notification preferences
     */
    updateNotifications: restrictAccountRole(
        async ({ request, auth }: AccountAuthenticatedEvent) => {
            const form = await superValidate(request, zod(notificationSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // For now, just return success since we don't have user settings table
                // In the future, you might want to add a UserSettings table to the schema
                logger.info('Notification preferences updated', { userId: auth!.user.id });

                return message(form, {
                    type: 'success',
                    text: 'Notification preferences updated successfully'
                });
            } catch (err) {
                logger.error('Error updating notifications:', err as Record<string, any>);
                return message(form, {
                    type: 'error',
                    text: 'Failed to update notification preferences'
                }, { status: 500 });
            }
        },
        ['ADMIN', 'OWNER', 'MEMBER']
    ),

    /**
     * Update password
     */
    updatePassword: restrictAccountRole(
        async ({ request, auth, locals }: AccountAuthenticatedEvent) => {
            const form = await superValidate(request, zod(passwordSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Get user with current password
                const user = await prisma.user.findUnique({
                    where: { id: auth!.user.id },
                    select: { id: true, password: true }
                });

                if (!user) {
                    return fail(404, { form, error: 'User not found' });
                }

                // Verify current password
                const validPassword = await verify(user.password, form.data.currentPassword);
                if (!validPassword) {
                    return message(form, {
                        type: 'error',
                        text: 'Current password is incorrect'
                    }, { status: 400 });
                }

                // Hash new password
                const hashedPassword = await hash(form.data.newPassword);

                // Update password
                await prisma.user.update({
                    where: { id: auth!.user.id },
                    data: { password: hashedPassword }
                });

                logger.info('Password updated', { userId: auth!.user.id });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Account',
                    recordId: auth!.user.id,
                    oldData: null,
                    newData: null,
                    userId: auth!.user.id,
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: prisma,
                    changeSummary: "Update password"
                })

                return message(form, {
                    type: 'success',
                    text: 'Password updated successfully'
                });
            } catch (err) {
                logger.error('Error updating password:', err as Record<string, any>);
                return message(form, {
                    type: 'error',
                    text: 'Failed to update password'
                }, { status: 500 });
            }
        },
        ['ADMIN', 'OWNER', 'MEMBER']
    ),

    /**
     * Sign out from a specific session
     */
    signOutSession: restrictAccountRole(
        async ({ request, auth, locals }: AccountAuthenticatedEvent) => {
            try {
                const formData = await request.formData();
                const sessionId = formData.get('sessionId')?.toString();

                if (!sessionId) {
                    return fail(400, { error: 'Session ID is required' });
                }

                // Don't allow signing out current session
                if (sessionId === auth!.session?.id) {
                    return fail(400, { error: 'Cannot sign out current session' });
                }

                // Verify session belongs to user
                const sessionToDelete = await prisma.session.findFirst({
                    where: { 
                        id: sessionId,
                        userId: auth!.user.id
                    }
                });

                if (!sessionToDelete) {
                    return fail(404, { error: 'Session not found' });
                }

                // Delete the session
                await prisma.session.delete({
                    where: { id: sessionId }
                });

                logger.info('Session signed out', { 
                    userId: auth!.user.id, 
                    sessionId 
                });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Session',
                    recordId: sessionId,
                    oldData: sessionToDelete,
                    newData: null,
                    userId: auth!.user.id,
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: prisma,
                    changeSummary: "Signout session"
                })

                return { success: true, message: 'Session signed out successfully' };
            } catch (err) {
                logger.error('Error signing out session:', err as Record<string, any>);
                return fail(500, { error: 'Failed to sign out session' });
            }
        },
        ['ADMIN', 'OWNER', 'MEMBER']
    ),

    /**
     * Create company - following admin accounts pattern
     */
    createCompany: restrictAccountRole(
        async ({ request, auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;

            const form = await superValidate(request, zod(companyCreateSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Get user's membership in the current account
                const user = await prisma.user.findUnique({
                    where: { id: auth!.user.id },
                    include: {
                        accountMemberships: {
                            include: { account: true },
                            where: { accountId: accountId }
                        }
                    }
                });

                if (!user?.accountMemberships[0]) {
                    return fail(404, { form, error: 'No account membership found' });
                }

                const account = user.accountMemberships[0].account;

                // Check if user has permission to create company
                const membership = user.accountMemberships[0];
                if (!['OWNER', 'ADMIN'].includes(membership.role)) {
                    return fail(403, { form, error: 'Insufficient permissions to create company' });
                }

                // Create the company following admin accounts pattern
                const company = await prisma.company.create({
                    data: {
                        name: form.data.name,
                        contactEmail: form.data.contactEmail,
                        contactPhone: form.data.contactPhone || null,
                        address: form.data.address || null,
                        description: form.data.description || null,
                        status: form.data.status,
                        accountId: account.id
                    },
                    select: {
                        id: true,
                        name: true,
                        contactEmail: true,
                        status: true,
                        createdAt: true
                    }
                });

                logger.info(`Company created: ${company.id} (${company.name}) -> ${account.id}`, {
                    userId: auth!.user.id,
                    accountId: account.id,
                    companyId: company.id
                });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Company',
                    recordId: company.id,
                    oldData: null,
                    newData: company,
                    userId: auth!.user.id,
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: prisma
                })

                return message(form, {
                    type: 'success',
                    text: 'Company created successfully',
                    data: company
                });
            } catch (err) {
                logger.error('Error creating company:', err as Record<string, any>);
                return message(form, {
                    type: 'error',
                    text: 'Failed to create company'
                }, { status: 500 });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Remove company - following admin accounts pattern
     */
    removeCompany: restrictAccountRole(
        async ({ request, auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;

            const form = await superValidate(request, zod(relationshipSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Get user's membership in the current account
                const user = await prisma.user.findUnique({
                    where: { id: auth!.user.id },
                    include: {
                        accountMemberships: {
                            include: { account: true },
                            where: { accountId: accountId }
                        }
                    }
                });

                if (!user?.accountMemberships[0]) {
                    return fail(404, { error: 'No account membership found' });
                }

                const account = user.accountMemberships[0].account;

                // Check if user has permission to remove company
                const membership = user.accountMemberships[0];
                if (!['OWNER', 'ADMIN'].includes(membership.role)) {
                    return fail(403, { error: 'Insufficient permissions to remove company' });
                }

                // Check if company exists and belongs to this account
                const company = await prisma.company.findFirst({
                    where: {
                        id: form.data.itemId,
                        accountId: accountId
                    }
                });

                if (!company) {
                    return message(form, {
                        type: 'error',
                        text: 'Company not found or not associated with this account',
                        code: 'COMPANY_NOT_FOUND'
                    }, { status: 404 });
                }

                // Delete the company
                await prisma.company.delete({
                    where: {
                        id: form.data.itemId
                    }
                });

                logger.info(`Company ${form.data.itemId} removed from account ${accountId}`, {
                    userId: auth!.user.id,
                    accountId: account.id,
                    companyId: form.data.itemId
                });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Company',
                    recordId: company.id,
                    oldData: company,
                    newData: null,
                    userId: auth!.user.id,
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: prisma
                })

                return message(form, {
                    type: 'success',
                    text: 'Company removed successfully'
                });
            } catch (err) {
                logger.error('Error removing company:', err as Record<string, any>);
                return message(form, {
                    type: 'error',
                    text: 'Failed to remove company',
                    code: 'REMOVE_FAILED'
                }, { status: 500 });
            }
        },
        ['ADMIN', 'OWNER']
    )
};
