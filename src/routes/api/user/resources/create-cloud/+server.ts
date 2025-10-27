import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { inferTypeAndFormatFromFile } from '$lib/utils/FileUtils';

export const POST = restrict(
    async (event: any) => {
        const { request, locals, auth } = event;

        try {
            const body = await request.json();
            const { 
                name, 
                description, 
                type, 
                target, 
                version, 
                format, 
                packageName, 
                path, 
                size, 
                accountId 
            } = body;

            // Validate required fields
            if (!name || !path) {
                return json(createErrorResponse('Missing required fields', {
                    details: 'Name and path are required'
                }), { status: 400 });
            }

            // Validate that path is a cloud URL
            if (!path.startsWith('http')) {
                return json(createErrorResponse('Invalid path', {
                    details: 'Path must be a valid cloud storage URL'
                }), { status: 400 });
            }

            // Get the current account from auth
            if (!auth.currentAccount || !auth.currentAccount.account) {
                return json(createErrorResponse('Account not found', {
                    details: 'No current account selected. Please select an account first.'
                }), { status: 400 });
            }
            
            const currentAccount = auth.currentAccount.account;

            // Infer type/format from path if missing
            let finalType = type;
            let finalFormat = format;
            
            if (!finalType || !finalFormat) {
                // Extract filename from path, removing query parameters
                const url = new URL(path);
                const pathParts = url.pathname.split('/');
                const fileName = pathParts[pathParts.length - 1];
                
                const mockFile = {
                    name: fileName,
                    type: 'application/octet-stream'
                } as File;
                const { type: inferredType, format: inferredFormat } = inferTypeAndFormatFromFile(mockFile);
                finalType = finalType || inferredType;
                finalFormat = finalFormat || inferredFormat;
            }

            // Create the resource
            const resource = await locals.prisma.resource.create({
                data: {
                    name,
                    description: description || '',
                    type: finalType,
                    target: target || 'user',
                    version: version || '',
                    format: finalFormat,
                    packageName: packageName || '',
                    path,
                    size: size || 0,
                    accountId: currentAccount.id,
                    createdBy: auth.user.id,
                    updatedBy: auth.user.id
                }
            });

            logger.info(`Cloud resource created by user: ${resource.id}`);

            await logAudit({
                actionType: AuditActionType.INSERT,
                tableName: 'Resource',
                recordId: resource.id,
                oldData: null,
                newData: resource,
                userId: auth.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            });

            return json(createSuccessResponse('Resource created successfully', {
                details: `Resource '${resource.name}' has been created.`,
                data: { resourceId: resource.id, accountId: currentAccount.id }
            }));

        } catch (err) {
            logger.error(`Error creating cloud resource: ${String(err)}`);
            return json(createErrorResponse('Failed to create resource', {
                details: 'An unexpected error occurred while creating the resource.'
            }), { status: 500 });
        }
    },
    [SystemRole.USER]
) satisfies RequestHandler;
