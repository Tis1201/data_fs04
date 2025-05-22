import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { SystemRole } from '../users/schema';
import os from 'os';
import { fail } from '@sveltejs/kit';

// Helper function to convert bytes to GB
const bytesToGB = (bytes: number) => {
    return parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(2));
};

// Helper function to get CPU usage
const getCpuUsage = async (): Promise<number> => {
    return new Promise((resolve) => {
        const startUsage = process.cpuUsage();
        
        // Wait 100ms to measure CPU usage
        setTimeout(() => {
            const endUsage = process.cpuUsage(startUsage);
            const userCPUUsage = endUsage.user / 1000; // microseconds to milliseconds
            const systemCPUUsage = endUsage.system / 1000;
            const totalCPUUsage = userCPUUsage + systemCPUUsage;
            
            // Convert to percentage (100ms period)
            const cpuPercentage = (totalCPUUsage / 100) * 100 / os.cpus().length;
            resolve(Math.min(100, Math.max(0, cpuPercentage))); // Ensure value is between 0-100
        }, 100);
    });
};

// Helper function to format uptime
const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds -= days * 24 * 60 * 60;
    const hours = Math.floor(seconds / (60 * 60));
    seconds -= hours * 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    seconds = Math.floor(seconds);
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0 || days > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    
    return result;
};

// Helper function to get network interfaces
const getNetworkInterfaces = () => {
    const interfaces = os.networkInterfaces();
    const result = [];
    
    for (const [name, netInterface] of Object.entries(interfaces)) {
        if (netInterface) {
            result.push({
                name,
                addresses: netInterface.map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    netmask: addr.netmask
                }))
            });
        }
    }
    
    return result;
};

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

    // Collect system information
    const cpuUsage = await getCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;
    
    // Get process memory usage
    const processMemoryUsage = process.memoryUsage();
    
    // Get system uptime
    const uptime = os.uptime();
    
    // Get CPU info
    const cpus = os.cpus();
    const cpuInfo = cpus.length > 0 ? cpus[0].model : 'Unknown';
    const cpuCount = cpus.length;
    
    // Get OS info
    const osInfo = {
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        arch: os.arch()
    };
    
    // Get hostname
    const hostname = os.hostname();
    
    // Get network interfaces (excluding internal ones)
    const networkInterfaces = Object.entries(os.networkInterfaces() || {})
        .filter(([name, interfaces]) => !name.includes('lo') && interfaces)
        .map(([name, interfaces]) => ({
            name,
            addresses: interfaces?.map(iface => ({
                address: iface.address,
                family: iface.family,
                internal: iface.internal
            })) || []
        }));
    
    // Get load averages (1, 5, and 15 minute averages)
    const loadAvg = os.loadavg();
    
    // Get session statistics
    const [
        totalSessions,
        activeSessions,
        failedLogins
    ] = await Promise.all([
        // Total sessions count
        locals.prisma.session.count(),
        
        // Active sessions (created in the last 24 hours)
        locals.prisma.session.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        }),
        
        // Failed login attempts (last 24 hours)
        locals.prisma.failedLoginLog.count({
            where: {
                attemptedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        })
    ]);
    
    // Get login activity over time (last 7 days)
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
    const loginActivity = await Promise.all(
        days.map(async (day) => {
            const nextDay = new Date(day);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const [successCount, failedCount] = await Promise.all([
                // Successful logins
                locals.prisma.userSessionLog.count({
                    where: {
                        action: 'login',
                        timestamp: {
                            gte: day,
                            lt: nextDay
                        }
                    }
                }),
                
                // Failed logins
                locals.prisma.failedLoginLog.count({
                    where: {
                        attemptedAt: {
                            gte: day,
                            lt: nextDay
                        }
                    }
                })
            ]);
            
            return {
                date: day.toISOString().split('T')[0],  // Format as YYYY-MM-DD
                successful: successCount,
                failed: failedCount
            };
        })
    );
    
    // Reverse to get chronological order
    loginActivity.reverse();
    
    return {
        user,
        system: {
            cpu: {
                usage: cpuUsage.toFixed(1),
                model: cpuInfo,
                count: cpuCount,
                loadAvg: os.loadavg()
            },
            memory: {
                total: bytesToGB(totalMem),
                free: bytesToGB(freeMem),
                used: bytesToGB(usedMem),
                usagePercentage: memoryUsage.toFixed(1)
            },
            process: {
                rss: bytesToGB(processMemoryUsage.rss),
                heapTotal: bytesToGB(processMemoryUsage.heapTotal),
                heapUsed: bytesToGB(processMemoryUsage.heapUsed),
                external: bytesToGB(processMemoryUsage.external || 0)
            },
            uptime: {
                seconds: uptime,
                formatted: formatUptime(uptime)
            },
            os: {
                type: os.type(),
                platform: os.platform(),
                release: os.release(),
                arch: os.arch()
            },
            hostname: os.hostname(),
            network: getNetworkInterfaces()
        },
        sessions: {
            active: activeSessions,
            total: totalSessions,
            failedLogins,
            loginActivity
        }
    };
};

export const actions: Actions = {
    getSystemStats: async ({ locals }) => {
        // Validate user is admin
        const session = await locals.auth.validate();
        if (!session?.user) {
            return fail(401, { error: 'Unauthorized' });
        }
        
        const user = await locals.prisma.user.findUnique({
            where: { id: session.user.id },
            select: { systemRole: true }
        });
        
        if (!user || user.systemRole !== SystemRole.ADMIN) {
            return fail(403, { error: 'Forbidden' });
        }
        
        // Get current CPU usage
        const cpuUsage = await getCpuUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = (usedMem / totalMem) * 100;
        
        return {
            success: true,
            cpu: {
                usage: parseFloat(cpuUsage.toFixed(1))
            },
            memory: {
                total: bytesToGB(totalMem),
                free: bytesToGB(freeMem),
                used: bytesToGB(usedMem),
                usagePercentage: parseFloat(memoryUsage.toFixed(1))
            }
        };
    }
};