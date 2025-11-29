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
                version, 
                versionCode,
                signature,
                releaseType,
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

            // Normalize accountId
            let normalizedAccountId = accountId;
            if (normalizedAccountId === 'undefined' || normalizedAccountId === undefined || normalizedAccountId === null) {
                normalizedAccountId = '';
            }

            // Resolve account (specific or system)
            let account;
            let accountName = 'Unknown Account';

            try {
                if (normalizedAccountId && normalizedAccountId !== '') {
                    logger.debug(`Processing cloud resource creation for account ID: ${normalizedAccountId}`);
                    account = await locals.prisma.account.findUnique({
                        where: { id: normalizedAccountId }
                    });
                    if (!account) {
                        return json(createErrorResponse('Invalid account', {
                            details: `The selected account with ID '${normalizedAccountId}' does not exist.`
                        }), { status: 400 });
                    }
                } else {
                    logger.debug(`Processing cloud resource creation for system account`);
                    account = await locals.prisma.account.findFirst({
                        where: { isSystem: true }
                    });
                    if (!account) {
                        logger.error('System account not found in database');
                        return json(createErrorResponse('System account not found', {
                            details: 'The system account does not exist. Please run the database seed to create it.'
                        }), { status: 500 });
                    }
                }

                accountName = account.name;
                normalizedAccountId = account.id;
                logger.debug(`Using account: ${accountName} (ID: ${normalizedAccountId})`);
            } catch (acctErr) {
                logger.error(`Error verifying account: ${String(acctErr)}`);
                return json(createErrorResponse('Error verifying account', {
                    details: 'Failed to verify the selected account. Please try again.'
                }), { status: 500 });
            }

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
                    version: version || '',
                    versionCode: versionCode ?? null,
                    signature: signature ?? null,
                    releaseType: releaseType || 'Production',
                    format: finalFormat,
                    packageName: packageName || '',
                    path,
                    size: size || 0,
                    accountId: normalizedAccountId || undefined,
                    createdBy: auth.user.id,
                    updatedBy: auth.user.id
                }
            });

            logger.info(`Cloud resource created by admin: ${resource.id}`);

            await logAudit({
                actionType: AuditActionType.INSERT,
                tableName: 'Resource',
                recordId: resource.id,
                oldData: null,
                newData: resource,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            });

            return json(createSuccessResponse('Resource created successfully', {
                details: `Resource '${resource.name}' has been created in ${accountName}.`,
                data: { resourceId: resource.id, accountId: normalizedAccountId }
            }));

        } catch (err) {
            logger.error(`Error creating cloud resource: ${String(err)}`);
            return json(createErrorResponse('Failed to create resource', {
                details: 'An unexpected error occurred while creating the resource.'
            }), { status: 500 });
        }
    },
    [SystemRole.ADMIN]
) satisfies RequestHandler;

