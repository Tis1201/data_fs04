import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { SystemRole } from '$lib/types/roles';

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
        recentLogins,
        recentFailedLogins,
        loginsByDay,
        failedLoginsByDay
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
        }),
        
        // Recent failed logins (last 7 days)
        locals.prisma.failedLoginLog.count({
            where: {
                attemptedAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            }
        }),
        
        // Get login data by day for the past 7 days
        (async () => {
            const days = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Create array of dates for the past 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                days.push(date);
            }
            
            // Get login counts for each day
            const loginsByDay = await Promise.all(
                days.map(async (day) => {
                    const nextDay = new Date(day);
                    nextDay.setDate(nextDay.getDate() + 1);
                    
                    const count = await locals.prisma.session.count({
                        where: {
                            createdAt: {
                                gte: day,
                                lt: nextDay
                            }
                        }
                    });
                    
                    return {
                        date: day.toISOString().split('T')[0],  // Format as YYYY-MM-DD
                        count: count
                    };
                })
            );
            
            return loginsByDay;
        })(),
        
        // Get failed login data by day for the past 7 days
        (async () => {
            const days = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Create array of dates for the past 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                days.push(date);
            }
            
            // Get failed login counts for each day
            const failedLoginsByDay = await Promise.all(
                days.map(async (day) => {
                    const nextDay = new Date(day);
                    nextDay.setDate(nextDay.getDate() + 1);
                    
                    const count = await locals.prisma.failedLoginLog.count({
                        where: {
                            attemptedAt: {
                                gte: day,
                                lt: nextDay
                            }
                        }
                    });
                    
                    return {
                        date: day.toISOString().split('T')[0],  // Format as YYYY-MM-DD
                        count: count
                    };
                })
            );
            
            return failedLoginsByDay;
        })()
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
            recentLogins,
            recentFailedLogins,
            loginsByDay,
            failedLoginsByDay
        }
    };
};
