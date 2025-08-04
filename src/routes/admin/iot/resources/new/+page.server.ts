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
import { getObjectUrl, uploadToS3 } from '$lib/server/s3/S3';

/**
 * Minimal MIME to extension map for fallback when file.name is missing.
 * Expand if you need more types.
 */
const MIME_EXT_MAP: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/x-sh': 'sh',
    'application/octet-stream': 'bin'
};

// Upload directory (should be configuration-driven in prod)
const UPLOAD_DIR = join(process.cwd(), 'static', 'uploads', 'iot');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
    try {
        mkdirSync(UPLOAD_DIR, { recursive: true });
        logger.info(`Created IoT upload directory: ${UPLOAD_DIR}`);
    } catch (err) {
        logger.error(`Failed to create IoT upload directory: ${String(err)}`);
    }
}

/**
 * Infer resource type and format from the uploaded file.
 */
function inferTypeAndFormatFromFile(file: File): { type: string; format: string } {
    const mime = file.type || '';
    let type = 'file';
    if (mime.startsWith('image/')) {
        type = 'image';
    } else if (mime.startsWith('video/')) {
        type = 'video';
    } else if (
        mime.startsWith('text/') ||
        mime.includes('pdf') ||
        mime.includes('document') ||
        mime.includes('spreadsheet') ||
        mime.includes('presentation')
    ) {
        type = 'document';
    }

    let format = '';
    if (file.name && file.name.includes('.')) {
        format = file.name.split('.').pop()!.toLowerCase();
    } else if (mime && MIME_EXT_MAP[mime]) {
        format = MIME_EXT_MAP[mime];
    }

    return { type, format };
}

/**
 * Persist the uploaded file locally (dev) or to S3 (prod), returning the public path/URL.
 * Infers extension from filename or MIME type if missing.
 */
async function saveFile(file: File): Promise<string> {
    const uniqueId = uuidv4();

    // Determine file extension
    let fileExt = '';
    if (file.name && file.name.includes('.')) {
        fileExt = file.name.split('.').pop() || '';
    } else if (file.type && MIME_EXT_MAP[file.type]) {
        fileExt = MIME_EXT_MAP[file.type];
    }

    const safeFileName = fileExt ? `${uniqueId}.${fileExt}` : uniqueId;
    const localPath = join(UPLOAD_DIR, safeFileName);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
            throw new Error('Uploaded file is empty (0 bytes)');
        }

        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev) {
            writeFileSync(localPath, buffer);
            logger.debug(`Saved file locally: ${localPath} (size=${buffer.length})`);
            return `/uploads/iot/${safeFileName}`;
        } else {
            await uploadToS3(safeFileName, buffer, file.type);
            const url = getObjectUrl(safeFileName);
            logger.debug(`Uploaded file to S3: ${url} (size=${buffer.length})`);
            return url;
        }
    } catch (err: any) {
        logger.error(`Error saving file: ${String(err)}`);
        throw new Error(`Failed to save file: ${err.message || String(err)}`);
    }
}

export const load = restrict(
    async (event) => {
        const { locals } = event;
        try {
            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form'
            });

            if (!form.data.accountId || form.data.accountId === 'undefined') {
                form.data.accountId = '';
            }

            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });

            const accountOptions = accounts.map(account => ({
                value: account.id,
                label: account.name
            }));

            return {
                form,
                accountOptions
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
        async (event) => {
            const { request, locals, auth } = event;

            try {
                // Read formData once
                const formData = await request.formData();
                const rawFile = formData.get('file');

                // Infer type/format if file exists and inject if missing
                if (rawFile instanceof File) {
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

                // Normalize accountId early
                let accountId = form.data.accountId;
                if (accountId === 'undefined' || accountId === undefined || accountId === null) {
                    accountId = '';
                }

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
                                createErrorResponse('Invalid account', {
                                    details: `The selected account with ID '${accountId}' does not exist.`
                                })
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
                                createErrorResponse('System account not found', {
                                    details: 'The system account does not exist. Please run the database seed to create it.'
                                })
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
                        createErrorResponse('Error verifying account', {
                            details: 'Failed to verify the selected account. Please try again.'
                        })
                    );
                }

                // Log a sanitized summary (avoid embedding file object)
                logger.debug(
                    `Form submission summary: ${JSON.stringify({
                        name: form.data.name,
                        type: form.data.type,
                        target: form.data.target,
                        version: form.data.version,
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
                    if (form.data.file && typeof form.data.file === 'object' && 'arrayBuffer' in form.data.file) {
                        const uploadedFile = form.data.file as File;

                        if (uploadedFile.size === 0) {
                            logger.warn('Uploaded file has zero size; aborting.');
                            return message(
                                form,
                                createErrorResponse('Empty file', {
                                    details: 'The uploaded file is empty (0 bytes). Please re-upload a valid file.'
                                })
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
                        logger.info(`File saved successfully: ${filePath}`);
                        form.data.file = null; // strip before persisting
                    } else {
                        logger.warn(`No file to process; form.data.file is ${String(form.data.file)}`);
                    }

                    // Create the resource
                    const resource = await locals.prisma.resource.create({
                        data: {
                            name: form.data.name,
                            description: form.data.description,
                            type: form.data.type,
                            target: form.data.target,
                            version: form.data.version,
                            format: form.data.format,
                            packageName: form.data.packageName,
                            path: form.data.path,
                            size: form.data.size,
                            accountId: accountId,
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
                    return handleFormError({
                        error: err,
                        form,
                        prisma: locals.prisma,
                        accountId,
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
