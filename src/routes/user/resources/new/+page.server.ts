import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../admin/users/schema';
import { logger } from '$lib/server/logger';
import { resourceSchema } from './resource';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define the upload directory - in a real app, this would be configurable
const UPLOAD_DIR = join(process.cwd(), 'static', 'uploads');

// Ensure the upload directory exists
if (!existsSync(UPLOAD_DIR)) {
    try {
        mkdirSync(UPLOAD_DIR, { recursive: true });
        logger.info(`Created upload directory: ${UPLOAD_DIR}`);
    } catch (err) {
        logger.error(`Failed to create upload directory: ${err}`);
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
        
        // Write the file to disk
        writeFileSync(filePath, buffer);
        
        // Return the public URL path
        return `/uploads/${safeFileName}`;
    } catch (err) {
        logger.error(`Error saving file: ${err}`);
        throw new Error(`Failed to save file: ${err.message}`);
    }
}

export const load = restrict(
    async ({ locals }) => {
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form',
                dataType: 'json'
            });
            
            // Get user's accounts for the dropdown
            // Only fetch accounts the user is a member of
            const userAccounts = await locals.prisma.accountMembership.findMany({
                where: {
                    userId: locals.user.id
                },
                select: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            
            const accounts = userAccounts.map(membership => membership.account);
            
            // Get resource types for the dropdown
            const resourceTypes = [
                { value: 'file', label: 'File' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'document', label: 'Document' }
            ];
            
            return {
                form,
                accounts,
                resourceTypes
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
        async ({ request, locals }) => {
            // Validate the form data with multipart/form-data support
            // Use json dataType for handling file uploads
            const form = await superValidate(request, zod(resourceSchema), {
                dataType: 'json'
            });
            
            if (!form.valid) {
                // Create a clean copy without the file for serialization
                const cleanForm = { ...form };
                cleanForm.data = { ...form.data };
                delete cleanForm.data.file;
                
                return message(cleanForm, createErrorResponse('Please correct the errors in the form'));
            }
            
            // Store file reference before processing
            let uploadedFile: File | null = null;
            let filePath: string | null = null;
            
            // Handle file upload if present
            if (form.data.file && typeof form.data.file === 'object' && 'arrayBuffer' in form.data.file) {
                try {
                    uploadedFile = form.data.file as File;
                    logger.info(`Processing file upload: ${uploadedFile.name}`);
                    
                    // Save the file and get the public URL path
                    filePath = await saveFile(uploadedFile);
                    
                    // Update the resource path with the file's URL
                    form.data.path = filePath;
                    
                    logger.info(`File saved successfully: ${filePath}`);
                    
                    // Remove file from form data to avoid serialization issues
                    form.data.file = null;
                } catch (err) {
                    logger.error(`File upload failed: ${err}`);
                    
                    // Remove file from form data to avoid serialization issues
                    const cleanForm = { ...form };
                    cleanForm.data = { ...form.data };
                    delete cleanForm.data.file;
                    
                    return message(cleanForm, createErrorResponse('Failed to upload file. Please try again.', {
                        details: err instanceof Error ? err.message : String(err)
                    }));
                }
            }
            
            try {
                // First, check if the account exists and user has access to it
                const accountMembership = await locals.prisma.accountMembership.findFirst({
                    where: { 
                        userId: locals.user.id,
                        accountId: form.data.accountId
                    }
                });
                
                if (!accountMembership) {
                    // Remove file from form data to avoid serialization issues
                    const cleanForm = { ...form };
                    cleanForm.data = { ...form.data };
                    delete cleanForm.data.file;
                    
                    return message(
                        cleanForm,
                        createErrorResponse('You do not have access to the selected account', {
                            code: 'ACCESS_DENIED'
                        }),
                        {
                            status: 400
                        }
                    );
                }
                
                // Create the resource
                const resource = await locals.prisma.resource.create({
                    data: {
                        name: form.data.name,
                        type: form.data.type,
                        path: form.data.path,
                        size: form.data.size,
                        accountId: form.data.accountId,
                        createdBy: locals.user.id,
                        updatedBy: locals.user.id
                    }
                });
                
                logger.info(`Resource created: ${resource.id}`);
                
                // Remove file from form data to avoid serialization issues
                const cleanForm = { ...form };
                cleanForm.data = { ...form.data };
                delete cleanForm.data.file;
                
                return message(
                    cleanForm,
                    createSuccessResponse('Resource created successfully', {
                        details: `Resource '${resource.name}' has been created.`,
                        data: { resourceId: resource.id }
                    })
                );
            } catch (err) {
                // Use our catch-all form error handler
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    accountId: form.data.accountId,
                    defaultMessage: 'Failed to create resource. Please try again.',
                    action: 'resource creation'
                });
            }
        },
        [SystemRole.USER]
    )
};
