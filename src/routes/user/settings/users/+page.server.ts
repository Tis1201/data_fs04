import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import prisma from '$lib/server/prisma';
import { UserStatus } from '$lib/types/roles';
import { hash } from '@node-rs/argon2';
import { validatePassword } from '$lib/server/auth/password-validation';
import { logger } from '$lib/server/logger';
import { getAdminPrismaFromAuth } from '$lib/utils/database';
import { resetUserPassword } from '$lib/server/services/password-reset';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { checkUserLimit, LimitExceededError } from '$lib/server/entitlements';
import { createUserSchema } from './new/schema';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
    const loadHandler = restrictAccountRole(
        async ({ auth, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;

            const page = Math.max(1, parseInt(url.searchParams.get('page') || String(DEFAULT_PAGE), 10));
            const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(url.searchParams.get('per_page') || String(DEFAULT_PER_PAGE), 10)));
            const search = (url.searchParams.get('search') || '').trim();
            const hasExplicitSort = url.searchParams.has('sort_field') && url.searchParams.has('sort_order');
            const sortField = url.searchParams.get('sort_field') || 'name';
            const sortOrder = (url.searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';

            const userMemberships = await prisma.accountMembership.findMany({
                where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                include: {
                    account: { select: { id: true, name: true, slug: true } }
                }
            });

            const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

            try {
                const currentAccount = await adminPrisma.account.findUnique({
                    where: { id: accountId },
                    select: { id: true, name: true, slug: true }
                });

                if (!currentAccount) {
                    throw error(404, 'Account not found');
                }

                const where: {
                    accountId: string;
                    userId: { not: string };
                    role: { not: string };
                    user?: { OR: Array<{ name?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' } }> };
                } = {
                    accountId,
                    userId: { not: auth!.user.id },
                    role: { not: 'SYSTEM' }
                };

                if (search) {
                    where.user = {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } }
                        ]
                    };
                }

                const validSortFields = ['name', 'email', 'createdAt', 'status', 'role', 'session'];
                const orderByField = validSortFields.includes(sortField) ? sortField : 'name';
                const skip = (page - 1) * perPage;

                type OrderByClause = {
                    createdAt?: 'asc' | 'desc';
                    user?: { name?: 'asc' | 'desc'; email?: 'asc' | 'desc'; status?: 'asc' | 'desc'; sessions?: { _count: 'asc' | 'desc' } };
                    role?: 'asc' | 'desc';
                };
                let orderBy: OrderByClause = { createdAt: 'desc' };
                if (orderByField === 'createdAt') orderBy = { createdAt: sortOrder };
                else if (orderByField === 'name') orderBy = { user: { name: sortOrder } };
                else if (orderByField === 'email') orderBy = { user: { email: sortOrder } };
                else if (orderByField === 'status') orderBy = { user: { status: sortOrder } };
                else if (orderByField === 'role') orderBy = { role: sortOrder };
                else if (orderByField === 'session') orderBy = { user: { sessions: { _count: sortOrder } } };

                const [accountMembers, total] = await Promise.all([
                    adminPrisma.accountMembership.findMany({
                        where,
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
                                    _count: { select: { sessions: true } }
                                }
                            }
                        },
                        orderBy,
                        skip,
                        take: perPage
                    }),
                    adminPrisma.accountMembership.count({ where })
                ]);

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

                const totalPages = Math.ceil(total / perPage);

                return {
                    users: usersWithSessions,
                    currentAccount: {
                        id: currentAccount.id,
                        name: currentAccount.name,
                        userRole: accountMembership.role
                    },
                    meta: {
                        totalItems: total,
                        itemsPerPage: perPage,
                        totalPages,
                        currentPage: page
                    },
                    sort: hasExplicitSort ? { field: orderByField, order: sortOrder } : { field: '', order: '' }
                };
            } catch (err) {
                console.error('Error loading users:', err);
                throw error(500, 'Failed to load users');
            }
        },
        ['ADMIN', 'OWNER', 'MEMBER']
    );

    return await loadHandler({ locals, cookies, url } as any);
};

export const actions: Actions = {
    create: async ({ request, locals, cookies }) => {
        const actionHandler = restrictAccountRole(
            async ({ auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
                const { accountId } = accountMembership;
                const userMemberships = await prisma.accountMembership.findMany({
                    where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                    include: { account: { select: { id: true, name: true, slug: true } } }
                });
                const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);
                const enhancedPrisma = getEnhancedPrisma(auth!.user);

                const formData = await request.formData();
                const name = (formData.get('name') as string)?.trim();
                const email = ((formData.get('email') || formData.get('contactEmail')) as string)?.trim();
                const accountRole = (formData.get('accountRole') as string) || 'MEMBER';
                const status = (formData.get('status') as string) || 'ACTIVE';
                const password = (formData.get('password') as string) || '';

                const parsed = createUserSchema.safeParse({
                    name: name || '',
                    email: email || '',
                    accountRole: ['MEMBER', 'ADMIN'].includes(accountRole) ? accountRole : 'MEMBER',
                    status: ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
                    password
                });

                if (!parsed.success) {
                    const first = parsed.error.flatten().fieldErrors;
                    const msg = first.name?.[0] || first.email?.[0] || first.password?.[0] || 'Validation failed';
                    return fail(400, { error: msg, createError: true });
                }

                try {
                    await checkUserLimit(accountId);
                } catch (e) {
                    if (e instanceof LimitExceededError) {
                        return fail(403, { error: `User limit reached (${e.current}/${e.max}). Upgrade your plan to add more users.`, createError: true });
                    }
                    throw e;
                }

                const passwordValidation = await validatePassword(parsed.data.password);
                if (!passwordValidation.valid) {
                    return fail(400, { error: passwordValidation.error || 'Password does not meet requirements', createError: true });
                }

                const existingUser = await enhancedPrisma.user.findUnique({ where: { email: parsed.data.email } });
                if (existingUser) {
                    return fail(400, { error: 'A user with this email already exists', createError: true });
                }

                const hashedPassword = await hash(parsed.data.password);
                const newUser = await enhancedPrisma.user.create({
                    data: {
                        email: parsed.data.email,
                        name: parsed.data.name,
                        systemRole: 'USER',
                        status: parsed.data.status,
                        password: hashedPassword
                    },
                    select: { id: true, email: true, name: true, systemRole: true, status: true, createdAt: true }
                });

                const membership = await adminPrisma.accountMembership.create({
                    data: { userId: newUser.id, accountId, role: parsed.data.accountRole }
                });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'User',
                    recordId: newUser.id,
                    oldData: null,
                    newData: newUser,
                    userId: auth!.user.id,
                    ipAddress: locals.requestContext?.ip,
                    prisma: adminPrisma
                });
                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'AccountMembership',
                    recordId: membership.id,
                    oldData: null,
                    newData: membership,
                    userId: auth!.user.id,
                    ipAddress: locals.requestContext?.ip,
                    prisma: adminPrisma
                });

                return { type: 'success', message: 'Member added successfully' };
            },
            ['ADMIN', 'OWNER']
        );
        return await actionHandler({ request, locals, cookies } as any);
    },

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
     * Update member profile (name, email, role, status) from listing Edit modal.
     */
    updateMember: async ({ request, locals, cookies }) => {
        const actionHandler = restrictAccountRole(
            async ({ auth, accountMembership, locals }: AccountAuthenticatedEvent) => {
                const { accountId } = accountMembership;

                const userMemberships = await prisma.accountMembership.findMany({
                    where: { userId: auth!.user.id, role: { not: 'SYSTEM' } },
                    include: {
                        account: { select: { id: true, name: true, slug: true } }
                    }
                });

                const adminPrisma = getAdminPrismaFromAuth(auth!, userMemberships);

                try {
                    const data = await request.formData();
                    const userId = (data.get('userId') as string)?.trim();
                    const name = (data.get('name') as string)?.trim();
                    const email = (data.get('email') as string)?.trim().toLowerCase();
                    const accountRole = (data.get('accountRole') as string) || 'MEMBER';
                    const status = (data.get('status') as string) || 'ACTIVE';
                    const newPassword = (data.get('password') as string)?.trim();

                    if (!userId || !name || !email) {
                        return fail(400, { message: 'User ID, name and email are required' });
                    }

                    const validRoles = ['OWNER', 'ADMIN', 'MEMBER'];
                    if (!validRoles.includes(accountRole.toUpperCase())) {
                        return fail(400, { message: 'Invalid role' });
                    }

                    const validStatuses = ['ACTIVE', 'INACTIVE'];
                    if (!validStatuses.includes(status.toUpperCase())) {
                        return fail(400, { message: 'Invalid status' });
                    }

                    if (newPassword) {
                        const passwordValidation = await validatePassword(newPassword);
                        if (!passwordValidation.valid) {
                            return fail(400, { message: passwordValidation.error || 'Password does not meet requirements' });
                        }
                    }

                    const targetMembership = await adminPrisma.accountMembership.findFirst({
                        where: {
                            accountId,
                            userId,
                            role: { not: 'SYSTEM' }
                        },
                        include: { user: { select: { id: true, name: true, email: true, status: true } } }
                    });

                    if (!targetMembership) {
                        return fail(404, { message: 'User not found in current account' });
                    }

                    const userUpdateData: { name: string; email: string; status: UserStatus; password?: string } = {
                        name,
                        email,
                        status: status.toUpperCase() as UserStatus
                    };
                    if (newPassword) {
                        userUpdateData.password = await hash(newPassword);
                    }

                    await adminPrisma.user.update({
                        where: { id: userId },
                        data: userUpdateData
                    });

                    await adminPrisma.accountMembership.updateMany({
                        where: { accountId, userId, role: { not: 'SYSTEM' } },
                        data: { role: accountRole.toUpperCase() }
                    });

                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'User',
                        recordId: userId,
                        oldData: targetMembership.user,
                        newData: { name, email, status: status.toUpperCase() },
                        userId: auth!.user.id,
                        ipAddress: locals.requestContext?.ip,
                        prisma: adminPrisma
                    });

                    return { type: 'success', message: 'Member updated successfully' };
                } catch (err) {
                    logger.error('Error updating member:', { error: err });
                    return fail(500, { message: 'Failed to update member' });
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
