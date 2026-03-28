import { error } from '@sveltejs/kit';
import {
	canAccessResourceFields,
	getResourceAccessLevelFields,
	normalizeResourceAccessInput
} from '$lib/server/api/unifiedEndpoint';
import type { SystemRole } from '$lib/server/features/flags';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createResourceTableOptions } from './resourceTableOptions';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';

/**
 * Load resource list data
 * Per structural standard: load{Resource}List pattern
 */
export async function loadResourceList(
    locals: any,
    url: URL,
    options?: {
        checkOwnership?: boolean;
    }
) {
    try {
        // Create table options
        const tableOptions = createResourceTableOptions(options);

        // Fetch table data with the appropriate options
        const result = await fetchTableData(locals, url, tableOptions);

        return {
            resources: result.records,
            meta: result.meta
        };
    } catch (e) {
        logger.error(`Error loading resources: ${JSON.stringify(e)}`);
        throw error(500, 'Failed to load resources');
    }
}

/**
 * Load resource detail data
 * Per structural standard: load{Resource}Detail pattern
 */
export async function loadResourceDetail(
    locals: any,
    resourceId: string,
    options?: {
        checkOwnership?: boolean;
        includeFormData?: boolean;
        includeAccountOptions?: boolean;
        includeResourceTypes?: boolean;
    }
) {
    try {
        const resource = await locals.prisma.resource.findUnique({
            where: { id: resourceId },
            include: {
                account: {
                    select: { id: true, name: true }
                },
                sharedWithAccounts: { select: { accountId: true } }
            }
        });

        if (!resource) {
            throw error(404, 'Resource not found');
        }

        if (!locals.user) {
            throw error(401, 'Unauthorized');
        }

        const accessInput = normalizeResourceAccessInput(resource as Record<string, unknown>);
        const accessParams = {
            systemRole: locals.user.systemRole as SystemRole,
            userId: locals.user.id,
            accountId: locals.currentAccount?.account?.id
        };
        if (!canAccessResourceFields(accessParams, accessInput)) {
            throw error(404, 'Resource not found');
        }

        const accessLevel = getResourceAccessLevelFields(accessParams, accessInput)!;

        const { sharedWithAccounts: _sw, ...resourceWithoutShares } = resource as typeof resource & {
            sharedWithAccounts?: unknown;
        };
        const resourceForClient: Record<string, unknown> = {
            ...(resourceWithoutShares as Record<string, unknown>),
            access: accessLevel
        };
        if (accessLevel === 'shared_read') {
            delete resourceForClient.path;
        }
        if (accessLevel === 'admin') {
            resourceForClient.sharedWithAccountIds = (resource.sharedWithAccounts ?? []).map(
                (s: { accountId: string }) => s.accountId
            );
        }

        const result: any = {
            resource: resourceForClient,
            meta: {
                title: `Resource: ${resource.name || resource.id}`,
                description: `Details for resource ${resource.name || resource.id}`
            }
        };

        // Include additional data if requested (for edit pages)
        if (options?.includeFormData || options?.includeAccountOptions || options?.includeResourceTypes) {
            // Fetch user information for createdBy and updatedBy
            const [createdByUser, updatedByUser] = await Promise.all([
                locals.prisma.user.findUnique({
                    where: { id: resource.createdBy },
                    select: { email: true }
                }),
                locals.prisma.user.findUnique({
                    where: { id: resource.updatedBy },
                    select: { email: true }
                })
            ]);

            result.createdByUser = createdByUser;
            result.updatedByUser = updatedByUser;

            // Create form with existing data if requested
            if (options?.includeFormData) {
                // Import resourceSchema from admin route
                const { resourceSchema } = await import('../../../routes/admin/iot/resources/new/resource');
                const form = await superValidate(zod(resourceSchema), {
                    id: 'resource-form'
                });

                // Populate form with existing resource data
                form.data = {
                    name: resource.name,
                    description: resource.description || '',
                    type: resource.type,
                    version: resource.version || '1.0.0',
                    versionCode: resource.versionCode ?? null,
                    signature: resource.signature ?? null,
                    releaseType: resource.releaseType || 'Production',
                    format: resource.format || '',
                    packageName: resource.packageName || '',
                    path: accessLevel === 'shared_read' ? '' : resource.path,
                    size: resource.size,
                    accountId: resource.accountId || '',
                    file: null // Don't populate file field for editing
                };

                // Ensure accountId is properly set for the form
                if (!resource.accountId || resource.accountId === '') {
                    form.data.accountId = ''; // System account
                } else {
                    form.data.accountId = resource.accountId;
                }

                result.form = form;
            }
        }

        if (options?.includeAccountOptions) {
            // Get all accounts for admin selection
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Format accounts for dropdown
            let accountOptions = accounts.map((account: { id: string; name: string }) => ({
                value: account.id,
                label: account.name
            }));

            // Add current account if it's not in the list (e.g., system account)
            if (resource.account && !accountOptions.find((opt: any) => opt.value === resource.accountId)) {
                accountOptions.push({
                    value: resource.accountId,
                    label: resource.account.name
                });
            }

            result.accountOptions = accountOptions;
        }

        if (options?.includeResourceTypes) {
            // Get resource types for the dropdown
            result.resourceTypes = [
                { value: 'file', label: 'File' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'document', label: 'Document' },
                { value: 'binary', label: 'Binary' }
            ];
        }

        return result;
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // Re-throw SvelteKit errors
        }
        logger.error(`Error loading resource ${resourceId}: ${JSON.stringify(err)}`);
        throw error(500, 'Failed to load resource details');
    }
}

