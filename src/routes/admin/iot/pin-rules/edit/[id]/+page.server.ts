import { redirect } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import prisma from '$lib/server/prisma';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = restrict(
    async ({ params, locals, auth }) => {
        // Check if user has admin access
        if (auth.user.systemRole !== 'ADMIN') {
            throw redirect(302, '/dashboard');
        }

        try {
            // Load the pin rule
            const rule = await prisma.pinRule.findUnique({
                where: {
                    id: params.id
                },
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    account: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }
                }
            });

            if (!rule) {
                throw redirect(302, '/admin/iot/pin-rules');
            }

            return {
                rule
            };
        } catch (error) {
            console.error('Error loading pin rule:', error);
            throw redirect(302, '/admin/iot/pin-rules');
        }
    },
    ['ADMIN'] // Restrict to admin users only
);