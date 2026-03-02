import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { resourceSchema } from './resource';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
// Removed unused S3 import
import { inferTypeAndFormatFromFile, saveFile } from '$lib/utils/FileUtils';
import { getStorageConfig } from '$lib/server/storage';

export const load = restrict(
    async (event: any) => {
        const { locals } = event;
        try {
            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form'
            });

            // For admin, set accountId to system account
            const systemAccount = await locals.prisma.account.findFirst({
                where: { isSystem: true }
            });

            if (systemAccount) {
                form.data.accountId = systemAccount.id;
            } else {
                form.data.accountId = '';
            }

            // Get storage configuration
            const storageConfig = getStorageConfig();

            return {
                form,
                storageConfig
            };
        } catch (err) {
            logger.error(`Error loading admin resource form: ${String(err)}`);
            throw error(500, 'Failed to load resource form');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async (event: any) => {
            const { request, locals, auth } = event;

            try {
                // Read formData once
                const formData = await request.formData();
                const rawFile = formData.get('file');

                // Check if this is a cloud upload (path starts with http) or local file
                const isCloudUpload = formData.get('path') && String(formData.get('path')).startsWith('http');
                
                // Only validate file extension for local uploads
                if (rawFile instanceof File && !isCloudUpload) {
                    // Validate file extension first
                    const allowedExtensions = ['.zip', '.cpk', '.apk', '.deb', '.exe'];
                    const fileName = rawFile.name.toLowerCase();
                    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
                    
                    if (!hasValidExtension) {
                        logger.warn(`Invalid file extension: ${rawFile.name}`);
                        const errorForm = await superValidate(zod(resourceSchema), {
                            id: 'resource-form'
                        });
                        return message(
                            errorForm,
                            createErrorResponse(
                                'Invalid file format',
                                'VALIDATION_ERROR',
                                { details: 'Only .zip, .cpk, .deb, .apk, and .exe files are allowed' }
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
                } else if (isCloudUpload) {
                    // For cloud uploads, infer type/format from the path if missing
                    const path = String(formData.get('path'));
                    const pathParts = path.split('/');
                    const fileName = pathParts[pathParts.length - 1];
                    
                    if (!formData.get('type') || !formData.get('format')) {
                        const mockFile = {
                            name: fileName,
                            type: 'application/octet-stream'
                        } as File;
                        const { type: inferredType, format: inferredFormat } = inferTypeAndFormatFromFile(mockFile);
                        if (!formData.get('type')) {
                            formData.set('type', inferredType);
                        }
                        if (!formData.get('format')) {
                            formData.set('format', inferredFormat);
                        }
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

                // Normalize accountId early
                let accountId = form.data.accountId;
                if (accountId === 'undefined' || accountId === undefined || accountId === null) {
                    accountId = '';
                }

                // Attach the file object (only for local uploads)
                if (rawFile instanceof File && !isCloudUpload) {
                    form.data.file = rawFile;
                    logger.debug(`Received local file: name="${rawFile.name}", type="${rawFile.type}", size=${rawFile.size}`);
                } else if (isCloudUpload) {
                    form.data.file = null;
                    logger.debug(`Cloud upload detected, no local file needed. Path: ${formData.get('path')}`);
                } else {
                    form.data.file = null;
                    logger.debug(`No valid file in formData.file; value: ${String(rawFile)}`);
                }

                // Fallback: if name is empty, derive name from filename (local or cloud)
                if (!form.data.name || form.data.name.trim() === '') {
                    let fileName = '';
                    if (rawFile instanceof File && !isCloudUpload) {
                        // Local file
                        fileName = rawFile.name;
                    } else if (isCloudUpload && form.data.path) {
                        // Cloud upload - extract filename from path
                        const pathParts = form.data.path.split('/');
                        fileName = pathParts[pathParts.length - 1];
                    }
                    
                    if (fileName) {
                        const base = fileName.includes('.')
                            ? fileName.split('.').slice(0, -1).join('.')
                            : fileName;
                        form.data.name = base;
                        logger.debug(`Inferred resource name from file: ${form.data.name}`);
                    }
                }

                // Resolve account (specific or system)
                let account;
                let accountName = 'Unknown Account';

                try {
                    if (accountId && accountId !== '') {
                        logger.debug(`Processing resource creation for account ID: ${accountId}`);
                        account = await locals.prisma.account.findUnique({
                            where: { id: accountId }
                        });
                        if (!account) {
                            return message(
                                form,
                                createErrorResponse(
                                    'Invalid account',
                                    'INVALID_ACCOUNT',
                                    { details: `The selected account with ID '${accountId}' does not exist.` }
                                )
                            );
                        }
                    } else {
                        logger.debug(`Processing resource creation for system account (accountId was: ${accountId})`);
                        account = await locals.prisma.account.findFirst({
                            where: { isSystem: true }
                        });
                        if (!account) {
                            logger.error('System account not found in database');
                            return message(
                                form,
                                createErrorResponse(
                                    'System account not found',
                                    'SYSTEM_ACCOUNT_NOT_FOUND',
                                    {
                                        details: 'The system account does not exist. Please run the database seed to create it.'
                                    }
                                )
                            );
                        }
                    }

                    accountName = account.name;
                    accountId = account.id; // canonicalize
                    logger.debug(`Using account: ${accountName} (ID: ${accountId})`);
                } catch (acctErr) {
                    logger.error(`Error verifying account: ${String(acctErr)}`);
                    return message(
                        form,
                        createErrorResponse(
                            'Error verifying account',
                            'ACCOUNT_VERIFY_ERROR',
                            { details: 'Failed to verify the selected account. Please try again.' }
                        )
                    );
                }

                // Log a sanitized summary (avoid embedding file object)
                logger.debug(
                    `Form submission summary: ${JSON.stringify({
                        name: form.data.name,
                        type: form.data.type,
                        version: form.data.version,
                        versionCode: form.data.versionCode,
                        signature: form.data.signature ? `${form.data.signature.substring(0, 16)}...` : null,
                        releaseType: form.data.releaseType,
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
                // Check if file is already uploaded (cloud upload mode)
                if (form.data.path && form.data.path.startsWith('http')) {
                    logger.info(`File already uploaded to cloud storage: ${form.data.path}`);
                    filePath = form.data.path;
                    form.data.file = null; // strip before persisting
                    
                    // For cloud uploads, we still need to infer type/format if missing
                    if (!form.data.type || !form.data.format) {
                        // Try to infer from the file path extension
                        const pathParts = form.data.path.split('/');
                        const fileName = pathParts[pathParts.length - 1];
                        const mockFile = {
                            name: fileName,
                            type: 'application/octet-stream' // Default type
                        } as File;
                        const { type: inferredType, format: inferredFormat } = inferTypeAndFormatFromFile(mockFile);
                        form.data.type = form.data.type || inferredType;
                        form.data.format = form.data.format || inferredFormat;
                    }
                } else if (form.data.file && typeof form.data.file === 'object' && 'arrayBuffer' in form.data.file) {
                        const uploadedFile = form.data.file as File;

                        if (uploadedFile.size === 0) {
                            logger.warn('Uploaded file has zero size; aborting.');
                            return message(
                                form,
                                createErrorResponse(
                                    'Empty file',
                                    'EMPTY_FILE',
                                    { details: 'The uploaded file is empty (0 bytes). Please re-upload a valid file.' }
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
                        
                        // Upload file first, before creating database record
                        try {
                            filePath = await saveFile(uploadedFile);
                            form.data.path = filePath;
                            logger.info(`File saved successfully: ${filePath}`);
                        } catch (uploadError) {
                            logger.error(`File upload failed: ${uploadError}`);
                            return message(
                                form,
                                createErrorResponse(
                                    'File upload failed',
                                    'FILE_UPLOAD_FAILED',
                                    { details: 'Failed to upload file to storage. Please try again.' }
                                )
                            );
                        }
                        
                        form.data.file = null; // strip before persisting
                    } else {
                        logger.warn(`No file to process; form.data.file is ${String(form.data.file)}`);
                    }

                    // Create the resource (only after successful file upload)
                    const resource = await locals.prisma.resource.create({
                        data: {
                            name: form.data.name,
                            description: form.data.description,
                            type: form.data.type,
                            version: form.data.version,
                            versionCode: form.data.versionCode ?? null,
                            signature: form.data.signature ?? null,
                            format: form.data.format,
                            packageName: form.data.packageName,
                            path: form.data.path,
                            size: form.data.size,
                            releaseType: form.data.releaseType,
                            accountId: accountId || undefined,
                            createdBy: auth.user.id,
                            updatedBy: auth.user.id
                        }
                    });

                    logger.info(`Resource created by admin: ${resource.id}`);

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

                    // Clean the form state
                    const cleanForm = { ...form };
                    cleanForm.data = { ...form.data };
                    delete cleanForm.data.file;

                    return message(
                        cleanForm,
                        createSuccessResponse('Resource created successfully', {
                            details: `Resource '${resource.name}' has been created in ${accountName}.`,
                            data: { resourceId: resource.id, accountId: accountId }
                        })
                    );
                } catch (err) {
                    // If we created a resource but something failed, clean it up
                    if (filePath && filePath.startsWith('http')) {
                        try {
                            logger.warn(`Cleaning up failed resource creation. File path: ${filePath}`);
                            // Note: In a production system, you might want to implement
                            // a background job to clean up orphaned files from storage
                        } catch (cleanupErr) {
                            logger.error(`Failed to cleanup after error: ${cleanupErr}`);
                        }
                    }
                    
                    return handleFormError({
                        error: err,
                        form,
                        prisma: locals.prisma,
                        accountId: accountId || undefined,
                        defaultMessage: 'Failed to create resource. Please try again.',
                        action: 'admin resource creation'
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
        [SystemRole.ADMIN]
    )

};
