import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { resourceSchema } from './resource';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { inferTypeAndFormatFromFile, saveFile } from '$lib/utils/FileUtils';
import {
    getStorageConfig,
    ensureResourceInResourcesFolder,
    parseGCloudUrl,
    isGCloudUrl
} from '$lib/server/storage';

export const load = restrict(
    async (event: AuthenticatedLoadEvent) => {
        const { locals, auth } = event;
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form'
            });
            
            // Get resource types for the dropdown
            const resourceTypes = [
                { value: 'file', label: 'File' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'document', label: 'Document' }
            ];
            
            // Get storage configuration
            const storageConfig = getStorageConfig();

            return {
                form,
                resourceTypes,
                storageConfig
            };
        } catch (err) {
            logger.error(`Error loading resource form: ${err}`);
            throw error(500, 'Failed to load resource form');
        }
    },
    [SystemRole.USER] // Allow user role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals, auth } = event;
            // Hard guard to satisfy TS nullability and provide clear error
            if (!auth) {
                throw error(401, 'Authentication required');
            }
            try {
                // Get the current account from auth
                if (!auth.currentAccount || !auth.currentAccount.account) {
                    // No current account found, throw an error
                    throw error(400, 'No current account selected. Please select an account first.');
                }
                
                const accountId = auth.currentAccount.account.id;
                const accountName = auth.currentAccount.account.name;
                logger.debug(`Using current account: ${accountName} (${accountId})`);

                // Read formData once
                const formData = await request.formData();
                const rawFile = formData.get('file');

                // Infer type/format if file exists and inject if missing
                if (rawFile instanceof File) {
                    // Validate file extension first
                    const allowedExtensions = ['.zip', '.cpk', '.apk', '.deb'];
                    const fileName = rawFile.name.toLowerCase();
                    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
                    
                    if (!hasValidExtension) {
                        logger.warn(`Invalid file extension: ${rawFile.name}`);
                        const form = await superValidate(zod(resourceSchema));
                        return message(
                            form,
                            createErrorResponse(
                                'Invalid file format',
                                'VALIDATION_ERROR',
                                { details: 'Only .zip, .cpk, .deb and .apk files are allowed' }
                            )
                        );
                    }
                    
                    const { type: inferredType, format: inferredFormat } = inferTypeAndFormatFromFile(rawFile);
                    if (!formData.get('type')) {
                        formData.set('type', inferredType);
                    }
                    if (!formData.get('format')) {
                        formData.set('format', inferredFormat);
                    }
                }

                // Rebuild headers excluding content-type so the correct boundary is set automatically
                const headers = new Headers();
                for (const [key, value] of request.headers) {
                    if (key.toLowerCase() === 'content-type') continue;
                    headers.append(key, value);
                }

                // Build a synthetic request for validation with the possibly augmented formData
                const validateRequest = new Request(request.url, {
                    method: request.method,
                    headers,
                    body: formData
                });

                const form = await superValidate(validateRequest, zod(resourceSchema));

                // Attach the file object
                if (rawFile instanceof File) {
                    form.data.file = rawFile;
                    logger.debug(`Received file: name="${rawFile.name}", type="${rawFile.type}", size=${rawFile.size}`);
                } else {
                    form.data.file = null;
                    logger.debug(`No valid file in formData.file; value: ${String(rawFile)}`);
                }

                // Fallback: if name is empty but file exists, derive name from filename
                if ((!form.data.name || form.data.name.trim() === '') && rawFile instanceof File) {
                    const base = rawFile.name.includes('.')
                        ? rawFile.name.split('.').slice(0, -1).join('.')
                        : rawFile.name;
                    form.data.name = base;
                    logger.debug(`Inferred resource name from file: ${form.data.name}`);
                }

                // Log a sanitized summary (avoid embedding file object)
                logger.debug(
                    `Form submission summary: ${JSON.stringify({
                        name: form.data.name,
                        type: form.data.type,
                        target: form.data.target,
                        version: form.data.version,
                        versionCode: form.data.versionCode,
                        signature: form.data.signature,
                        format: form.data.format,
                        packageName: form.data.packageName,
                        path: form.data.path,
                        size: form.data.size,
                        accountId: accountId,
                        file: form.data.file ? (form.data.file as File).name : null
                    })}`
                );

                let filePath: string | null = null;

                try {
                    // Check if file has already been uploaded to cloud storage
                    if (form.data.path && isGCloudUrl(form.data.path)) {
                        logger.info(`File already uploaded to cloud storage: ${form.data.path}`);
                        const config = getStorageConfig();
                        if (
                            (config.mode === 'LOCAL_CLOUD' || config.mode === 'GCLOUD') &&
                            config.bucket
                        ) {
                            const parsed = parseGCloudUrl(form.data.path);
                            if (parsed) {
                                const newObjectPath = await ensureResourceInResourcesFolder(
                                    parsed.bucket,
                                    parsed.objectPath
                                );
                                const finalPath = `https://storage.googleapis.com/${parsed.bucket}/${newObjectPath}`;
                                form.data.path = finalPath;
                                logger.info(`[create] Resource path ensured in resources folder: ${finalPath}`);
                            }
                        }
                        filePath = form.data.path;
                    } else if (
                        form.data.file &&
                        typeof form.data.file === 'object' &&
                        'arrayBuffer' in form.data.file
                    ) {
                        const uploadedFile = form.data.file as File;

                        if (uploadedFile.size === 0) {
                            logger.warn('Uploaded file has zero size; aborting.');
                            return message(
                                form,
                                createErrorResponse(
                                    'Empty file',
                                    'VALIDATION_ERROR',
                                    {
                                        details: 'The uploaded file is empty (0 bytes). Please re-upload a valid file.'
                                    }
                                )
                            );
                        }

                        // If for some reason type/format were not populated earlier, infer again
                        if (!form.data.type || !form.data.format) {
                            const { type: inferredType, format: inferredFormat } = inferTypeAndFormatFromFile(uploadedFile);
                            form.data.type = form.data.type || inferredType;
                            form.data.format = form.data.format || inferredFormat;
                        }

                        logger.info(`Processing file upload: ${uploadedFile.name || '<no name>'}`);
                        filePath = await saveFile(uploadedFile);
                        form.data.path = filePath;
                        form.data.size = uploadedFile.size;
                        logger.info(`File saved successfully: ${filePath}`);
                        form.data.file = null; // strip before persisting
                    } else {
                        logger.warn(`No file to process; form.data.file is ${String(form.data.file)}`);
                    }

                    const userContext = {
                        id: auth.user.id,
                        systemRole: auth.user.systemRole,
                        accountMemberships: auth.memberships
                    };

                    logger.debug(`Creating enhanced Prisma client with user context`);
                
                    // Create a new enhanced Prisma client with the proper user context
                    // Enable query logging for debugging
                    const enhancedPrisma = getEnhancedPrisma(userContext, { logPrismaQuery: true });
                    
                    // Create the resource using the enhanced Prisma client
                    const resource = await enhancedPrisma.resource.create({
                        data: {
                            name: form.data.name,
                            description: form.data.description,
                            type: form.data.type,
                            target: form.data.target,
                            version: form.data.version,
                            versionCode: form.data.versionCode ?? null,
                            signature: form.data.signature ?? null,
                            releaseType: form.data.releaseType || 'Production',
                            format: form.data.format,
                            packageName: form.data.packageName,
                            path: form.data.path,
                            size: form.data.size,
                            accountId: accountId,
                            createdBy: auth.user.id,
                            updatedBy: auth.user.id
                        } as any // Type assertion needed due to enhanced Prisma client type limitations
                    });
                    
                    logger.info(`Resource created: ${resource.id}`);

                    await logAudit({
                        actionType: AuditActionType.INSERT,
                        tableName: 'Resource',
                        recordId: resource.id,
                        oldData: null,
                        newData: resource,
                        userId: auth.user.id,
                        ipAddress: event.getClientAddress(),
                        prisma: enhancedPrisma
                    })

                    // Clean the form state so superforms returns type: "success" (path was set server-side)
                    const cleanForm = { ...form };
                    cleanForm.data = { ...form.data };
                    delete (cleanForm.data as Record<string, unknown>).file;
                    cleanForm.errors = {};
                    cleanForm.valid = true;

                    return message(
                        cleanForm,
                        createSuccessResponse('Resource created successfully', {
                            details: `Resource '${resource.name}' has been created in ${accountName}.`,
                            data: { resourceId: resource.id, accountId: accountId }
                        })
                    );
                } catch (err) {
                    return handleFormError({
                        error: err,
                        form,
                        prisma: locals.prisma,
                        accountId,
                        defaultMessage: 'Failed to create resource. Please try again.',
                        action: 'user resource creation'
                    });
                }
            } catch (err) {
                logger.error(`Unexpected error in resource creation: ${String(err)}`);
                return fail(500, {
                    message: 'An unexpected error occurred while creating the resource.',
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        },
        [SystemRole.USER]
    )
};
