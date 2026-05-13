import {json} from '@sveltejs/kit';
import {restrict} from '$lib/server/security/guards';
import {SystemRole} from '$lib/types/roles';
import {createErrorResponse, createSuccessResponse} from '$lib/server/types/api';
import {handleApiError} from '$lib/server/errors/errorHandlers';

/**
 * GET handler for fetching all unique package names from Resource table
 * Returns both home_launcher and kiosk_app packages in a single response
 * Query parameters:
 * - accountId: Optional account ID to filter by account (defaults to user's account)
 */
export const GET = restrict(
    async ({ url, locals, auth }: any) => {
        try {
            if (auth.user.systemRole === SystemRole.USER) {
                const hasAccess = await locals.prisma.accountMembership.findFirst({
                    where: {
                        accountId: auth.user.primaryAccountId,
                        userId: auth.user.id
                    }
                });

                if (!hasAccess) {
                    return json(createErrorResponse('Access denied to specified account', {code: 'ACCESS_DENIED'}), {status: 403});
                }
            }
            // Fetch all unique package names from Resource table
            const resources = await locals.prisma.resource.findMany({
                where: {
                    packageName: { not: null }
                },
                select: {
                    packageName: true,
                    name: true,
                    description: true,
                    type: true,
                    format: true
                },
                distinct: ['packageName'],
                orderBy: { packageName: 'asc' }
            });

            console.log("resouce", resources)

            const allPackages = resources
                .filter((resource: any) => resource.packageName)
                .map((resource: any) => ({
                    packageName: resource.packageName!,
                    displayName: resource.name,
                    description: resource.description,
                    type: resource.type,
                    format: resource.format
                }));

            return json(createSuccessResponse({
                packages: allPackages,
                counts: {
                    total: allPackages.length,
                }
            }, {
                message: `Found ${allPackages.length} unique packages)`
            }));

        } catch (error) {
            console.error('Error fetching all packages:', error);
            return handleApiError({ error });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
