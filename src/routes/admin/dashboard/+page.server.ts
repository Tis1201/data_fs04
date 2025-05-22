import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { SystemRole } from '../users/schema';

export const load: PageServerLoad = async ({ locals }) => {
    const session = await locals.auth.validate();
    if (!session?.user) {
        throw redirect(302, '/auth/login');
    }

    // Get user data
    const user = await locals.prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            email: true,
            systemRole: true
        }
    });

    if (!user) {
        throw redirect(302, '/auth/login');
    }

    if (!user.systemRole || user.systemRole !== SystemRole.ADMIN) {
        throw redirect(302, '/');
    }

    // Fetch dashboard statistics
    const [
        totalUsers,
        totalAccounts,
        totalGroups,
        totalDevices,
        activeSessions,
        activeDevices,
        recentLogins
    ] = await Promise.all([
        // Total users count
        locals.prisma.user.count(),
        
        // Total accounts count
        locals.prisma.account.count(),
        
        // Total groups count
        locals.prisma.group.count(),
        
        // Total devices count
        locals.prisma.device.count(),
        
        // Active sessions (sessions created in the last 24 hours)
        locals.prisma.session.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        }),
        
        // Active devices (devices that have connected in the last 24 hours)
        locals.prisma.device.count({
            where: {
                OR: [
                    {
                        connectedAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                        }
                    },
                    {
                        lastUsedAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                        }
                    }
                ],
                connected: true
            }
        }),
        
        // Recent logins (last 7 days)
        locals.prisma.session.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            }
        })
    ]);

    return {
        user,
        stats: {
            totalUsers,
            totalAccounts,
            totalGroups,
            totalDevices,
            activeSessions,
            activeDevices,
            recentLogins
        }
    };
};
