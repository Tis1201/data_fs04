import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';
import { handleApiError } from '$lib/server/errors/errorHandlers';

/**
 * GET handler for fetching unique package names from Resource table
 * Query parameters:
 * - type: "home_launcher" or "kiosk_app" to filter by resource type
 * - accountId: Optional account ID to filter by account (defaults to user's account)
 */
export const GET = restrict(
    async ({ url, locals, auth }: any) => {
        try {
            const searchParams = url.searchParams;
            const type = searchParams.get('type');
            const accountId = searchParams.get('accountId');

            // Validate type parameter
            if (!type || !['home_launcher', 'kiosk_app'].includes(type)) {
                return json(createErrorResponse('Invalid or missing type parameter. Must be "home_launcher" or "kiosk_app"', { code: 'INVALID_TYPE' }), { status: 400 });
            }

            // Admin users can access any account, regular users need account access
            let targetAccountId = accountId;
            
            if (auth.user.systemRole === SystemRole.ADMIN) {
                // Admin can access any account, use provided accountId or fetch all if none provided
                if (!targetAccountId) {
                    // If no accountId provided for admin, we'll fetch from all accounts
                    targetAccountId = null; // Will be handled in the query
                }
            } else {
                // Regular users need to use their primary account
                if (!targetAccountId) {
                    const user = await locals.prisma.user.findUnique({
                        where: { id: auth.user.id },
                        select: { primaryAccountId: true }
                    });
                    
                    if (!user?.primaryAccountId) {
                        return json(createErrorResponse('User has no primary account', { code: 'NO_ACCOUNT' }), { status: 400 });
                    }
                    
                    targetAccountId = user.primaryAccountId;
                } else {
                    // Check if user has access to the specified account
                    const hasAccess = await locals.prisma.accountMembership.findFirst({
                        where: {
                            accountId: targetAccountId,
                            userId: auth.user.id
                        }
                    });

                    if (!hasAccess) {
                        return json(createErrorResponse('Access denied to specified account', { code: 'ACCESS_DENIED' }), { status: 403 });
                    }
                }
            }

            // Fetch unique package names from Resource table
            const resources = await locals.prisma.resource.findMany({
                where: {
                    // Only filter by accountId if it's provided (admin can choose specific account or all accounts)
                    ...(targetAccountId && { accountId: targetAccountId }),
                    packageName: { not: null },
                    // Filter by type if specified
                    ...(type === 'home_launcher' && { 
                        OR: [
                            { type: 'binary' },
                            { format: 'apk' },
                            { name: { contains: 'launcher', mode: 'insensitive' } }
                        ]
                    }),
                    ...(type === 'kiosk_app' && { 
                        OR: [
                            { type: 'binary' },
                            { format: 'apk' },
                            { name: { contains: 'kiosk', mode: 'insensitive' } }
                        ]
                    })
                },
                select: {
                    packageName: true,
                    name: true,
                    description: true
                },
                distinct: ['packageName'],
                orderBy: { packageName: 'asc' }
            });

            // Transform data for frontend
            const packages = resources
                .filter((resource: any) => resource.packageName) // Ensure packageName exists
                .map((resource: any) => ({
                    packageName: resource.packageName!,
                    displayName: resource.name,
                    description: resource.description
                }));

            return json(createSuccessResponse(packages, {
                message: `Found ${packages.length} unique ${type} packages`
            }));

        } catch (error) {
            console.error('Error fetching packages:', error);
            return handleApiError({ error });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
