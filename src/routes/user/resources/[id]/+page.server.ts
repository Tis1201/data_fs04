import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../admin/users/schema';
import { logger } from '$lib/server/logger';

export const load = restrict(
    async ({ params, locals }) => {
        const { id } = params;
        
        try {
            // Fetch the resource by ID
            const resource = await locals.prisma.resource.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            
            // Also fetch the creator's information if needed
            let creator = null;
            if (resource) {
                creator = await locals.prisma.user.findUnique({
                    where: { id: resource.createdBy },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });
            }
            
            // If resource doesn't exist or user doesn't have access, throw a 404 error
            if (!resource) {
                throw error(404, {
                    message: 'Resource not found',
                    code: 'RESOURCE_NOT_FOUND'
                });
            }
            
            // Check if the user has access to this resource
            const hasAccess = await locals.prisma.accountMembership.findFirst({
                where: {
                    accountId: resource.accountId,
                    userId: locals.user.id
                }
            });
            
            if (!hasAccess) {
                throw error(403, {
                    message: 'You do not have permission to view this resource',
                    code: 'FORBIDDEN'
                });
            }
            
            return {
                resource: {
                    ...resource,
                    creator // Add the creator information to the resource
                },
                userId: locals.user.id, // Pass the user ID for permission checks
                meta: {
                    title: `Resource: ${resource.name}`,
                    description: `Viewing details for resource ${resource.name}`
                }
            };
        } catch (err) {
            logger.error(`Error loading resource ${id}:${err}`,);
            throw error(500, {
                message: 'Failed to load resource',
                code: 'RESOURCE_LOAD_ERROR'
            });
        }
    },
    [SystemRole.USER]
);
