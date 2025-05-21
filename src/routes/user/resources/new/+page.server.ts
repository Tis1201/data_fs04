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
    async (event) => {
        const { locals, auth } = event;
        try {
            // Get the current account from auth
            let userAccount = null;
            
            // Check if there's a current account ID in the cookies
            const currentAccountId = event.cookies.get('current_account_id');
            
            // logger.debug(`Current account ID: ${currentAccountId}`)

            // if (currentAccountId) {
            //     // Find the account in the user's memberships
            //     const membership = auth.memberships.find(m => m.account.id === currentAccountId);
            //     if (membership) {
            //         userAccount = membership.account;
            //     }
            // }
            
            // // If no current account, try the primary account
            // if (!userAccount && auth.user.primaryAccountId) {
            //     const membership = auth.memberships.find(m => m.account.id === auth.user.primaryAccountId);
            //     if (membership) {
            //         userAccount = membership.account;
            //     }
            // }
            
            // // If still no account, get the first account with appropriate role
            // if (!userAccount) {
            //     const editorMembership = auth.memberships.find(m => 
            //         ['OWNER', 'ADMIN', 'EDITOR'].includes(m.role)
            //     );
                
            //     if (editorMembership) {
            //         userAccount = editorMembership.account;
            //     } else if (auth.memberships.length > 0) {
            //         // Just use the first membership if no appropriate role
            //         userAccount = auth.memberships[0].account;
            //     }
            // }
            
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
            let accountId = '';
            let accountName = '';
            
            // First check if there's a currentAccount in auth
            if (auth.currentAccount && auth.currentAccount.account) {
                accountId = auth.currentAccount.account.id;
                accountName = auth.currentAccount.account.name;
                logger.debug(`Using current account: ${accountName} (${accountId})`);
            } 
            // If no current account, try to get it from memberships
            else if (auth.memberships && auth.memberships.length > 0) {
                // Use the first membership
                accountId = auth.memberships[0].account.id;
                accountName = auth.memberships[0].account.name;
                logger.debug(`Using first membership account: ${accountName} (${accountId})`);
            }
            
            // Verify we have a valid account ID
            if (!accountId) {
                const cleanForm = { ...form };
                cleanForm.data = { ...form.data };
                delete cleanForm.data.file;
                
                return message(
                    cleanForm,
                    createErrorResponse('No valid account found. Please create or join an account first.', {
                        code: 'NO_ACCOUNT'
                    }),
                    { status: 400 }
                );
            }

            
            // If no account ID provided, get it from cookies or auth
            // if (!accountId) {
            //     // First try from cookies
            //     accountId = event.cookies.get('current_account_id') || '';
                
            //     // If not in cookies, try from primary account
            //     if (!accountId && auth.user.primaryAccountId) {
            //         accountId = auth.user.primaryAccountId;
            //     }
                
            //     // If still no account ID, get the first account with appropriate role
            //     if (!accountId) {
            //         const editorMembership = auth.memberships.find(m => 
            //             ['OWNER', 'ADMIN', 'EDITOR'].includes(m.role)
            //         );
                    
            //         if (editorMembership) {
            //             accountId = editorMembership.account.id;
            //         } else if (auth.memberships.length > 0) {
            //             // Just use the first membership
            //             accountId = auth.memberships[0].account.id;
            //         }
            //     }
                
            //     // Update the form data with the account ID
            //     form.data.accountId = accountId;
            // }
            
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
                // Since we've already verified the account ID and simplified the access policies,
                // we can proceed directly to creating the resource
                
                logger.debug(`Creating resource with account ID: ${accountId}`);
                
                // We need to create a properly enhanced Prisma client with the correct user context
                // The issue was that the membershipMap wasn't being created correctly
                
                // Import the enhance function from Zenstack
                const { enhance } = await import('@zenstackhq/runtime');
                
                // Create a properly formatted user context for Zenstack
                // Extract account IDs and roles from memberships for easier access policy checks
                const membershipMap = {};
                if (auth.memberships && auth.memberships.length > 0) {
                    auth.memberships.forEach(membership => {
                        if (membership.accountId && membership.role) {
                            membershipMap[membership.accountId] = membership.role;
                        } else if (membership.account?.id && membership.role) {
                            membershipMap[membership.account.id] = membership.role;
                        }
                    });
                }
                
                // Create the user context with just the necessary information for policy evaluation
                // For the policy: creator == auth() and auth().systemRole == 'ADMIN'
                // We only need the user ID and systemRole
                const userContext = {
                    id: auth.user.id,
                    systemRole: auth.user.systemRole
                };
                
                logger.debug(`Enhanced user context: ${JSON.stringify(userContext)}`);
                
                // Create a new enhanced Prisma client with the proper user context
                const enhancedPrisma = enhance(locals.prisma, { user: userContext }, { logPrismaQuery: true });
                
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
                // Use our catch-all form error handler
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    accountId: accountId,
                    defaultMessage: 'Failed to create resource. Please try again.',
                    action: 'resource creation'
                });
            }
        },
        [SystemRole.USER]
    )
};
