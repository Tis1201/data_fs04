import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
            name: true,
            systemRole: true,
            primaryAccountId: true,
            accountMemberships: {
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true,
                            status: true
                        }
                    }
                }
            }
        }
    });

    if (!user) {
        throw redirect(302, '/auth/login');
    }

    // Fetch dashboard statistics for the user
    const [
        totalDevices,
        activeDevices,
        totalApiKeys,
        recentSessions,
        accountMemberships,
        totalPreclaims,
        devicesByDay
    ] = await Promise.all([
        // Total devices owned by the user
        locals.prisma.device.count({
            where: { createdBy: user.id }
        }),
        
        // Active devices (connected in the last 24 hours)
        locals.prisma.device.count({
            where: {
                createdBy: user.id,
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
        
        // Total API keys
        locals.prisma.apiKey.count({
            where: { userId: user.id }
        }),
        
        // Recent sessions (last 7 days)
        locals.prisma.session.count({
            where: {
                userId: user.id,
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            }
        }),
        
        // Account memberships count
        locals.prisma.accountMembership.count({
            where: { userId: user.id }
        }),
        
        // Total preclaims
        locals.prisma.preclaimSet.count({
            where: { createdBy: user.id }
        }),
        
        // Get device connection data by day for the past 7 days
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
            
            // Get device connection counts for each day
            const devicesByDay = await Promise.all(
                days.map(async (day) => {
                    const nextDay = new Date(day);
                    nextDay.setDate(nextDay.getDate() + 1);
                    
                    const count = await locals.prisma.device.count({
                        where: {
                            createdBy: user.id,
                            connectedAt: {
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
            
            return devicesByDay;
        })()
    ]);

    // Get recent devices
    const recentDevices = await locals.prisma.device.findMany({
        where: { createdBy: user.id },
        orderBy: { lastUsedAt: 'desc' },
        take: 5,
        select: {
            id: true,
            name: true,
            connected: true,
            lastUsedAt: true,
            connectedAt: true,
            deviceType: true,
            osVersion: true
        }
    });

    // Get recent API keys
    const recentApiKeys = await locals.prisma.apiKey.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsedAt: true,
            active: true
        }
    });

    return {
        user,
        stats: {
            totalDevices,
            activeDevices,
            totalApiKeys,
            recentSessions,
            accountMemberships,
            totalPreclaims,
            devicesByDay
        },
        recentDevices,
        recentApiKeys
    };
};

