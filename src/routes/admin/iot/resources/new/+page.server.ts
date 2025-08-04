import { error, fail, redirect } from '@sveltejs/kit';
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
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { getObjectUrl, uploadToS3 } from '$lib/server/s3/S3';

// Define the upload directory - in a real app, this would be configurable
const UPLOAD_DIR = join(process.cwd(), 'static', 'uploads', 'iot');

// Ensure the upload directory exists
if (!existsSync(UPLOAD_DIR)) {
    try {
        mkdirSync(UPLOAD_DIR, { recursive: true });
        logger.info(`Created IoT upload directory: ${UPLOAD_DIR}`);
    } catch (err) {
        logger.error(`Failed to create IoT upload directory: ${err}`);
    }
}

/**
 * Saves a file to the uploads directory and returns the path
 */
async function saveFile(file: File): Promise<string> {
    // Generate a unique filename to prevent collisions
    const uniqueId = uuidv4();
    const fileExt = file.name.split('.').pop() || '';
    const safeFileName = `${uniqueId}${fileExt ? '.' + fileExt : ''}`;
    
    // Create the full path where the file will be saved
    const filePath = join(UPLOAD_DIR, safeFileName);
    
    try {
        // Convert the file to an ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const dev = process.env.NODE_ENV !== 'production';

        if (dev) {
            writeFileSync(filePath, buffer);
            return `/uploads/iot/${safeFileName}`;
        } else {
            await uploadToS3(safeFileName, buffer, file.type);
            return getObjectUrl(safeFileName);
        }
    } catch (err) {
        logger.error(`Error saving file: ${err}`);
        throw new Error(`Failed to save file: ${err.message}`);
    }
}

export const load = restrict(
    async (event) => {
        const { locals } = event;
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form',
                dataType: 'json'
            });
            
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
            const accountOptions = accounts.map(account => ({
                value: account.id,
                label: account.name
            }));
            
            // Get resource types for the dropdown
            const resourceTypes = [
                { value: 'file', label: 'File' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'document', label: 'Document' },
                { value: 'binary', label: 'Binary' }
            ];
            
            return {
                form,
                accountOptions,
                resourceTypes
            };
        } catch (err) {
            logger.error(`Error loading admin resource form: ${JSON.stringify(err)}`);
            throw error(500, 'Failed to load resource form');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async (event) => {
            const { request, locals, auth } = event;

            // Validate the form data with multipart/form-data support
            const form = await superValidate(request, zod(resourceSchema), {
                dataType: 'json'
            });
            
            // Add debug logging to see what's being submitted
            logger.debug(`Form submission data: ${JSON.stringify(form.data)}`);
            
            // Check if the form is valid
            if (!form.valid) {
                return fail(400, { form });
            }
            
            // Get the account ID from the form
            let accountId = form.data.accountId;
            let account;
            let accountName = 'Unknown Account';
            // Verify that the account exists
            try {
                if (accountId) {
                    logger.debug(`Processing resource creation for account ID: ${accountId}`);
                    account = await locals.prisma.account.findUnique({
                        where: { id: accountId }
                    });
                } else {
                    logger.debug(`Processing resource creation for system account`);
                    account = await locals.prisma.account.findUnique({
                        where: { isSystem: true }
                    });
                    
                }
                
                if (!account) {
                    return message(
                        form,
                        createErrorResponse('Invalid account', {
                            details: `The ${accountId ? 'selected' : 'system'} account does not exist.`
                        })
                    );
                }
                
                accountName = account.name;
                accountId = account.id
            } catch (err) {
                logger.error(`Error verifying account: ${JSON.stringify(err)}`);
                return message(
                    form,
                    createErrorResponse('Error verifying account', {
                        details: 'Failed to verify the selected account.'
                    })
                );
            }
            
            let uploadedFile: File | null = null;
            let filePath: string | null = null;
            
            try {
                // Handle file upload if present
                if (form.data.file && typeof form.data.file === 'object' && 'arrayBuffer' in form.data.file) {
                    uploadedFile = form.data.file as File;
                    logger.info(`Processing file upload: ${uploadedFile.name}`);
                    
                    // Save the file and get the public URL path
                    filePath = await saveFile(uploadedFile);
                    
                    // Update the resource path with the file's URL
                    form.data.path = filePath;
                    
                    logger.info(`File saved successfully: ${filePath}`);
                    
                    // Remove file from form data to avoid serialization issues
                    form.data.file = null;
                }
                
                logger.debug(`Admin creating resource with account ID: ${accountId}`);
                
                // Log the data being sent to Prisma
                logger.debug(`Creating resource with data: ${JSON.stringify({
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
                })}`);
                
                // Create the resource using Prisma
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
                })
                
                // Remove file from form data to avoid serialization issues
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
                // Use the handleFormError utility to simplify error handling
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    accountId,
                    defaultMessage: 'Failed to create resource. Please try again.',
                    action: 'admin resource creation'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role for this action
    )
};
