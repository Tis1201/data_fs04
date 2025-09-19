import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, locals }) => {
    try {
        // Check authentication
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            throw redirect(302, '/auth/login');
        }

        const { id: profileId } = params;
        
        console.log('Loading profile with ID:', profileId);

        // Get profile details with settings and assignments
        const profile = await locals.prisma.deviceProfile.findUnique({
            where: { id: profileId },
            include: {
                settings: {
                    orderBy: { order: 'asc' }
                },
                assignments: {
                    include: {
                        device: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                deviceType: true,
                                status: true
                            }
                        }
                    }
                },
                account: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        console.log('Profile found:', profile ? 'Yes' : 'No');
        if (profile) {
            console.log('Profile data:', { id: profile.id, name: profile.name, accountId: profile.accountId });
        }

        if (!profile) {
            throw error(404, 'Profile not found');
        }

        // Check if user has access to this profile (user context - no admin override)
        const hasAccess = await locals.prisma.accountMembership.findFirst({
            where: {
                accountId: profile.accountId,
                userId: auth.user.id
            }
        });

        console.log('User access check:', { hasAccess: !!hasAccess });

        if (!hasAccess) {
            throw error(403, 'Access denied');
        }

        console.log('Returning profile data');
        return {
            profile
        };

    } catch (err) {
        console.error('Error loading profile:', err);
        if (err instanceof Error && 'status' in err) {
            throw err;
        }
        throw error(500, 'Failed to load profile');
    }
};
