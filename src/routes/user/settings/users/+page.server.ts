import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import prisma from '$lib/server/prisma'; // Import raw Prisma client directly
import { UserStatus } from '$lib/types/roles';
import { hash } from '@node-rs/argon2';
import { validatePassword } from '$lib/server/auth/password-validation';
import { logger } from '$lib/server/logger';
import { getAdminPrismaFromAuth } from '$lib/utils/database';
import { resetUserPassword } from '$lib/server/services/password-reset';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load: PageServerLoad = async ({ locals, cookies }) => {
    const loadHandler = restrictAccountRole(
        async ({ auth, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;
            
            // Get user memberships for admin Prisma client
            const userMemberships = await prisma.accountMembership.findMany({
                where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                include: {
                    account: {
                        select: { id: true, name: true, slug: true }
                    }
                }
            });

            // Create admin Prisma client
            const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

            try {
                // Get the current account info
                const currentAccount = await adminPrisma.account.findUnique({
                    where: { id: accountId },
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                });

                if (!currentAccount) {
                    throw error(404, 'Account not found');
                }

                // Get users who are members of the current account - using enhanced client with admin context
                const accountMembers = await adminPrisma.accountMembership.findMany({
                    where: { 
                        accountId: accountId,
                        userId: {
                            not: auth!.user.id // Exclude the current user from the list
                        },
                        role: { not: 'SYSTEM' }
                    },
                    select: {
                        id: true,
                        role: true,
                        createdAt: true,
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                systemRole: true,
                                status: true,
                                createdAt: true,
                                updatedAt: true,
                                _count: {
                                    select: {
                                        sessions: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: [
                        { role: 'asc' },
                        { createdAt: 'desc' }
                    ]
                });

                // Transform the data for the frontend
                const usersWithSessions = accountMembers.map(membership => ({
                    id: membership.user.id,
                    email: membership.user.email,
                    name: membership.user.name,
                    role: membership.role,
                    systemRole: membership.user.systemRole,
                    status: membership.user.status,
                    createdAt: membership.user.createdAt,
                    lastActive: membership.user.updatedAt,
                    activeSessionsCount: membership.user._count.sessions,
                    membershipId: membership.id,
                    joinedAt: membership.createdAt
                }));

                const result = {
                    users: usersWithSessions,
                    currentAccount: {
                        id: currentAccount.id,
                        name: currentAccount.name,
                        userRole: accountMembership.role
                    }
                };

                return result;
            } catch (err) {
                console.error('Error loading users:', err);
                throw error(500, 'Failed to load users');
            }
        },
        ['ADMIN', 'OWNER', 'MEMBER']
    );

    return await loadHandler({ locals, cookies } as any);
};

export const actions: Actions = {
    updateUserStatus: async ({ request, locals, cookies }) => {
        const actionHandler = restrictAccountRole(
            async ({ auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
                const { accountId } = accountMembership;
                
                // Get user memberships for admin Prisma client
                const userMemberships = await prisma.accountMembership.findMany({
                    where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                    include: {
                        account: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                });

                // Create admin Prisma client
                const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

                try {
                    const data = await request.formData();
                    const userId = data.get('userId') as string;
                    const newStatus = data.get('status') as string;

                    if (!userId || !newStatus) {
                        return fail(400, { message: 'Missing required fields' });
                    }

                    // Validate status
                    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
                    if (!validStatuses.includes(newStatus.toUpperCase())) {
                        return fail(400, { message: 'Invalid status' });
                    }

                    const user = await adminPrisma.user.findUnique({
                        where: { id: userId }
                    })

                    // Update user status using admin Prisma
                    await adminPrisma.user.update({
                        where: { id: userId },
                        data: { status: newStatus.toUpperCase() as keyof typeof UserStatus }
                    });

                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'User',
                        recordId: userId,
                        oldData: { status: user?.status },
                        newData: { status: newStatus.toUpperCase() as keyof typeof UserStatus },
                        userId: auth!.user.id,
                        ipAddress: locals.requestContext?.ip,
                        prisma: adminPrisma
                    })

                    return {
                        type: 'success',
                        message: 'User status updated successfully'
                    };
                } catch (err) {
                    console.error('Error updating user status:', err);
                    return fail(500, { message: 'Failed to update user status' });
                }
            },
            ['ADMIN', 'OWNER']
        );

        return await actionHandler({ request, locals, cookies } as any);
    },

    removeFromAccount: async ({ request, locals, cookies }) => {
        const actionHandler = restrictAccountRole(
            async ({ auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
                const { accountId } = accountMembership;
                
                // Get user memberships for admin Prisma client
                const userMemberships = await prisma.accountMembership.findMany({
                    where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                    include: {
                        account: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                });

                // Create admin Prisma client
                const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

                try {
                    const data = await request.formData();
                    const userId = data.get('userId') as string;

                    if (!userId) {
                        return fail(400, { message: 'Missing user ID' });
                    }

                    // Don't allow users to remove themselves
                    if (userId === auth!.user.id) {
                        return fail(400, { message: 'Cannot remove yourself from the account' });
                    }

                    const memberships = await adminPrisma.accountMembership.findMany({
                        where: {
                            userId: userId,
                            accountId: accountId,
                            role: { not: 'SYSTEM' }
                        }
                    })

                    // Remove user from account (delete the membership, not the user) using admin Prisma
                    await adminPrisma.accountMembership.deleteMany({
                        where: {
                            userId: userId,
                            accountId: accountId,
                            role: { not: 'SYSTEM' }
                        }
                    });
                    
                    await Promise.all(
                        memberships.map(membership =>
                            logAudit({
                                actionType: AuditActionType.DELETE,
                                tableName: 'AccountMembership',
                                recordId: membership.id,
                                oldData: membership,
                                newData: null,
                                userId: auth!.user.id,
                                ipAddress: locals.requestContext?.ip,
                                prisma: adminPrisma
                            })
                        )
                    );

                    return {
                        type: 'success',
                        message: 'User removed from account successfully'
                    };
                } catch (err) {
                    console.error('Error removing user from account:', err);
                    return fail(500, { message: 'Failed to remove user from account' });
                }
            },
            ['ADMIN', 'OWNER']
        );

        return await actionHandler({ request, locals, cookies } as any);
    },

    updateUserRole: async ({ request, locals, cookies }) => {
        const actionHandler = restrictAccountRole(
            async ({ auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
                const { accountId } = accountMembership;
                
                // Get user memberships for admin Prisma client
                const userMemberships = await prisma.accountMembership.findMany({
                    where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                    include: {
                        account: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                });

                // Create admin Prisma client
                const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

                try {
                    const data = await request.formData();
                    const userId = data.get('userId') as string;
                    const newRole = data.get('role') as string;

                    if (!userId || !newRole) {
                        return fail(400, { message: 'Missing required fields' });
                    }

                    // Validate role
                    const validRoles = ['OWNER', 'ADMIN', 'MEMBER'];
                    if (!validRoles.includes(newRole.toUpperCase())) {
                        return fail(400, { message: 'Invalid role' });
                    }

                    const memberships = await adminPrisma.accountMembership.findMany({
                        where: {
                            userId: userId,
                            accountId: accountId,
                            role: { not: 'SYSTEM' }
                        }
                    })

                    // Update account membership role using admin Prisma
                    await adminPrisma.accountMembership.updateMany({
                        where: {
                            userId: userId,
                            accountId: accountId,
                            role: { not: 'SYSTEM' }
                        },
                        data: { role: newRole.toUpperCase() }
                    });

                    await Promise.all(
                        memberships.map(membership =>
                            logAudit({
                                actionType: AuditActionType.UPDATE,
                                tableName: 'AccountMembership',
                                recordId: membership.id,
                                oldData: { role: membership.role },
                                newData: { role: newRole.toUpperCase() },
                                userId: auth!.user.id,
                                ipAddress: locals.requestContext?.ip,
                                prisma: adminPrisma
                            })
                        )
                    );

                    return {
                        type: 'success',
                        message: 'User role updated successfully'
                    };
                } catch (err) {
                    console.error('Error updating user role:', err);
                    return fail(500, { message: 'Failed to update user role' });
                }
            },
            ['ADMIN', 'OWNER']
        );

        return await actionHandler({ request, locals, cookies } as any);
    },

    /**
     * Update Password Action
     */
    updatePassword: async ({ request, locals, cookies }) => {
        const actionHandler = restrictAccountRole(
            async ({ auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
                const { accountId } = accountMembership;
                
                // Get user memberships for admin Prisma client
                const userMemberships = await prisma.accountMembership.findMany({
                    where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                    include: {
                        account: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                });

                // Create admin Prisma client
                const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

                try {
                    const data = await request.formData();
                    const userId = data.get('userId') as string;
                    const password = data.get('password') as string;

                    if (!userId) {
                        return fail(400, { success: false, message: 'User ID is required' });
                    }

                    if (!password) {
                        return fail(400, { success: false, message: 'Password is required' });
                    }

                    // Validate password based on settings
                    const passwordValidation = await validatePassword(password);
                    if (!passwordValidation.valid) {
                        return fail(400, { 
                            success: false, 
                            message: passwordValidation.error
                        });
                    }

                    // Verify the target user exists in the current account using admin Prisma
                    const targetUserMembership = await adminPrisma.accountMembership.findFirst({
                        where: {
                            accountId: accountId,
                            userId: userId,
                            role: { not: 'SYSTEM' }
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    name: true
                                }
                            }
                        }
                    });

                    if (!targetUserMembership) {
                        return fail(404, { success: false, message: 'User not found in current account' });
                    }

                    // Hash the password using Argon2
                    const hashedPassword = await hash(password);
                    logger.debug('Password hashed successfully for update', { 
                        userId,
                        passwordLength: password.length 
                    });

                    // Update the user's password using admin Prisma
                    await adminPrisma.user.update({
                        where: { id: userId },
                        data: { password: hashedPassword }
                    });

                    logger.info(`Password updated for user: ${userId} (${targetUserMembership.user.email})`);

                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'User',
                        recordId: userId,
                        oldData: null,
                        newData: null,
                        userId: auth!.user.id,
                        ipAddress: locals.requestContext?.ip,
                        prisma: adminPrisma,
                        changeSummary: "Update password"
                    })

                    return { success: true, message: 'Password updated successfully' };
                } catch (err) {
                    logger.error('Error updating password:', { error: err });
                    return fail(500, { success: false, message: 'Failed to update password' });
                }
            },
            ['ADMIN', 'OWNER']
        );

        return await actionHandler({ request, locals, cookies } as any);
    },

    /**
     * Reset Password Action
     */
    resetPassword: async ({ request, locals, cookies }) => {
        const actionHandler = restrictAccountRole(
            async ({ auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
                const { accountId } = accountMembership;
                
                // Get user memberships for admin Prisma client
                const userMemberships = await prisma.accountMembership.findMany({
                    where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                    include: {
                        account: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                });

                // Create admin Prisma client
                const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

                try {
                    const data = await request.formData();
                    const userId = data.get('userId') as string;

                    if (!userId) {
                        return fail(400, { success: false, message: 'User ID is required' });
                    }

                    // Verify the target user exists in the current account using admin Prisma
                    const targetUserMembership = await adminPrisma.accountMembership.findFirst({
                        where: {
                            accountId: accountId,
                            userId: userId,
                            role: { not: 'SYSTEM' }
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    name: true
                                }
                            }
                        }
                    });

                    if (!targetUserMembership) {
                        return fail(404, { success: false, message: 'User not found in current account' });
                    }

                    // Use the new password reset service
                    const result = await resetUserPassword({
                        userId: targetUserMembership.user.id,
                        userEmail: targetUserMembership.user.email,
                        userName: targetUserMembership.user.name || targetUserMembership.user.email,
                        prisma: adminPrisma
                    });

                    if (result.success) {
                        await logAudit({
                            actionType: AuditActionType.UPDATE,
                            tableName: 'User',
                            recordId: targetUserMembership.user.id,
                            oldData: null,
                            newData: null,
                            userId: auth!.user.id,
                            ipAddress: locals.requestContext?.ip,
                            prisma: adminPrisma,
                            changeSummary: "Reset Password"
                        })

                        return {
                            success: true,
                            message: result.message,
                            details: result.details,
                            email: result.email,
                            messageId: result.messageId
                        };
                    } else {
                        return fail(500, { 
                            success: false, 
                            message: result.message 
                        });
                    }

                } catch (error) {
                    logger.error('Error resetting password:', { error: error });
                    return fail(500, { success: false, message: 'Failed to reset password' });
                }
            },
            ['ADMIN', 'OWNER']
        );

        return await actionHandler({ request, locals, cookies } as any);
    }
};
