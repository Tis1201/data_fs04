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
import { getEnhancedPrisma } from '$lib/server/prisma';

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
    async (event) => {
        const { locals, auth } = event;
        try {
            // Get the current account from auth
            let userAccount = null;
            
            // Check if there's a current account ID in the cookies
            const currentAccountId = event.cookies.get('current_account_id');
            
            
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form',
                dataType: 'json'
            });
            
            // Pre-fill the account ID if we have a user account
            if (userAccount) {
                form.data.accountId = userAccount.id;
            }
            
            // Get resource types for the dropdown
            const resourceTypes = [
                { value: 'file', label: 'File' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'document', label: 'Document' }
            ];
            
            return {
                form,
                userAccount,
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
        async (event) => {
            const { request, locals, auth } = event;

            // logger.debug(`auth: ${JSON.stringify(auth)}`)


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
            
            // Get the current account from auth
            if (!auth.currentAccount || !auth.currentAccount.account) {
                // No current account found, throw an error
                throw error(400, 'No current account selected. Please select an account first.');
            }
            
            const accountId = auth.currentAccount.account.id;
            const accountName = auth.currentAccount.account.name;
            logger.debug(`Using current account: ${accountName} (${accountId})`);

            // Store file reference before processing
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
                
                // Since we've already verified the account ID and simplified the access policies,
                // we can proceed directly to creating the resource
                
                logger.debug(`Creating resource with account ID: ${accountId}`);
                
                // Use the getEnhancedPrisma function to create a properly enhanced Prisma client
                
                // Log the user info for debugging
                logger.debug(`User info: ${JSON.stringify({
                    id: auth.user.id,
                    systemRole: auth.user.systemRole,
                    memberships: auth.memberships.length
                })}`);
                
                // Create a user context with the necessary information for policy evaluation
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
                        type: form.data.type,
                        path: form.data.path,
                        size: form.data.size,
                        accountId: accountId,
                        createdBy: auth.user.id,
                        updatedBy: auth.user.id
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
                    action: 'resource creation'
                });
            }
        },
        [SystemRole.USER]
    )
};
