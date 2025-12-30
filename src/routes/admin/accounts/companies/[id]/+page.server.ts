import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrictModule, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import { validatePhoneNumber, getPhoneValidationMessage } from '$lib/utils/validation/phone';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

// Define the company schema - UPDATED with international phone validation
const companySchema = z.object({
    name: z.string()
        .min(2, { message: "Name must be at least 2 characters" })
        .max(100, { message: "Name must be less than 100 characters" }),
    status: z.enum(["ACTIVE", "INACTIVE", "PENDING"]).default("ACTIVE"), // Fixed: proper enum with default
    address: z.string().optional(),
    contactEmail: z.string()
        .min(1, { message: "Contact email is required" })
        .email({ message: "Invalid email address" }),
    contactPhone: z.string()
        .refine(validatePhoneNumber, { message: getPhoneValidationMessage() })
        .optional(),
    description: z.string().optional(),
    accountId: z.string().min(1, { message: "Account is required" })
});

export const load = restrictModule(
    async ({ params, locals }: RequestEvent) => {
        const { id } = params;
        
        try {
            // Fetch the company by ID
            const company = await locals.prisma.company.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            
            // If company doesn't exist, throw a 404 error
            if (!company) {
                throw error(404, 'Company not found');
            }
            
            // Get all accounts for the dropdown
            const accounts = await locals.prisma.account.findMany({
                where: { status: 'ACTIVE', isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            
            // Fetch users who are members of the same account as this company
            const accountMembers = await locals.prisma.accountMembership.findMany({
                where: { accountId: company.accountId, role: { not: 'SYSTEM' } },
                select: {
                    id: true,
                    role: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            status: true,
                            systemRole: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            
            // Transform account members to match the relationship format
            // The RelationshipManager expects a flat structure with user data at the top level
            const members = accountMembers.map(membership => {
                const user = membership.user;
                // Prioritize name, then email, then a shortened ID as fallback
                const displayName = user.name || user.email || `User ${user.id.slice(-8)}`;
                
                return {
                    id: user.id, 
                    name: displayName, 
                    email: user.email, 
                    role: membership.role, 
                    status: user.status, 
                    createdAt: membership.createdAt,
                    systemRole: user.systemRole,
                    description: `${membership.role} • ${user.systemRole || 'USER'}`, 
                    membershipId: membership.id
                };
            });

            // Initialize the form with the company data
            const form = await superValidate(
                {
                    name: company.name,
                    status: company.status as "ACTIVE" | "INACTIVE" | "PENDING" || 'ACTIVE',
                    address: company.address || '',
                    contactEmail: company.contactEmail || '',
                    contactPhone: company.contactPhone || '',
                    description: company.description || '',
                    accountId: company.accountId
                },
                zod(companySchema)
            );

            // Get module permissions for frontend
            let modulePermissions = (locals as any).modulePermissions || {};
            const currentAccountId = (locals as any).currentAccount?.account?.id;
            if (Object.keys(modulePermissions).length === 0 && currentAccountId && locals.user?.id) {
                try {
                    modulePermissions = await getUserModulePermissions(locals.user.id, currentAccountId);
                } catch (e) { /* ignore */ }
            }

            return {
                form,
                company,
                accounts,
                members,
                modulePermissions,
                user: locals.user
            };
        } catch (err) {
            if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
                throw err;
            }
            logger.error('Error loading company:', err as Record<string, any>);
            throw error(500, 'Failed to load company details');
        }
    },
    'COMPANIES',
    { action: 'VIEW' }
) satisfies PageServerLoad;

export const actions: Actions = {
    updateCompany: restrictModule(
        async ({ request, params, locals, auth, getClientAddress }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            
            const form = await superValidate(request, zod(companySchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if the company exists
                const existingCompany = await locals.prisma.company.findUnique({
                    where: { id }
                });

                if (!existingCompany) {
                    return message(form, {
                        type: 'error',
                        text: 'Company not found',
                        details: `No company found with ID: ${id}`,
                        code: 'COMPANY_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }
                
                // Check if the account exists and is accessible
                const account = await locals.prisma.account.findUnique({
                    where: { id: form.data.accountId }
                });

                if (!account) {
                    return message(form, {
                        type: 'error',
                        text: 'Invalid account selection',
                        details: 'The selected account does not exist or is not accessible',
                        code: 'ACCOUNT_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 400 });
                }

                // Check for duplicate company name within the same account
                const duplicateCompany = await locals.prisma.company.findFirst({
                    where: {
                        name: form.data.name,
                        accountId: form.data.accountId,
                        id: { not: id } // Exclude current company
                    }
                });

                if (duplicateCompany) {
                    return message(form, {
                        type: 'error',
                        text: 'Company name already exists',
                        details: `A company named "${form.data.name}" already exists in this account`,
                        code: 'DUPLICATE_COMPANY_NAME',
                        timestamp: new Date().toISOString()
                    }, { status: 400 });
                }

                // Update the company
                const updatedCompany = await locals.prisma.company.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        status: form.data.status,
                        address: form.data.address || null,
                        contactEmail: form.data.contactEmail || null,
                        contactPhone: form.data.contactPhone || null,
                        description: form.data.description || null,
                        accountId: form.data.accountId
                    },
                    include: {
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });

                logger.info(`Company updated: ${updatedCompany.id} (${updatedCompany.name}) - Status: ${updatedCompany.status}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Company',
                    recordId: updatedCompany.id,
                    oldData: existingCompany,
                    newData: updatedCompany,
                    userId: auth?.user?.id ?? '',
                    ipAddress: getClientAddress(),
                    prisma: locals.prisma
                })

                // Create a clean, serializable response
                const cleanCompany = {
                    id: updatedCompany.id,
                    name: updatedCompany.name,
                    status: updatedCompany.status,
                    address: updatedCompany.address,
                    contactEmail: updatedCompany.contactEmail,
                    contactPhone: updatedCompany.contactPhone,
                    description: updatedCompany.description,
                    accountId: updatedCompany.accountId,
                    createdAt: updatedCompany.createdAt.toISOString(),
                    updatedAt: updatedCompany.updatedAt.toISOString(),
                    account: updatedCompany.account ? {
                        id: updatedCompany.account.id,
                        name: updatedCompany.account.name
                    } : null
                };

                // Return the updated form data to reset the form state
                return message(form, {
                    type: 'success',
                    text: 'Company updated successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                logger.error('Error updating company:', err as Record<string, any>);
                
                // Categorize different types of errors
                let errorMessage = 'Failed to update company';
                let errorDetails = 'An unexpected error occurred';
                let errorCode = 'UPDATE_FAILED';

                if (err instanceof Error) {
                    // Handle Prisma errors
                    if (err.message.includes('Unique constraint')) {
                        errorMessage = 'Duplicate data detected';
                        errorDetails = 'A company with this information already exists';
                        errorCode = 'DUPLICATE_CONSTRAINT';
                        
                        return message(form, {
                            type: 'error',
                            text: errorMessage,
                            details: errorDetails,
                            code: errorCode,
                            timestamp: new Date().toISOString()
                        }, { status: 400 });
                    } else if (err.message.includes('Foreign key constraint')) {
                        errorMessage = 'Invalid reference data';
                        errorDetails = 'The selected account or related data is invalid';
                        errorCode = 'FOREIGN_KEY_CONSTRAINT';
                        
                        return message(form, {
                            type: 'error',
                            text: errorMessage,
                            details: errorDetails,
                            code: errorCode,
                            timestamp: new Date().toISOString()
                        }, { status: 400 });
                    } else if (err.message.includes('timeout')) {
                        errorMessage = 'Request timeout';
                        errorDetails = 'The operation took too long to complete. Please try again.';
                        errorCode = 'TIMEOUT_ERROR';
                        
                        return message(form, {
                            type: 'error',
                            text: errorMessage,
                            details: errorDetails,
                            code: errorCode,
                            timestamp: new Date().toISOString()
                        }, { status: 408 });
                    } else {
                        errorDetails = err.message;
                    }
                }
                
                return message(form, {
                    type: 'error',
                    text: errorMessage,
                    details: errorDetails,
                    code: errorCode,
                    timestamp: new Date().toISOString()
                }, { status: 500 });
            }
        },
        'COMPANIES',
        { action: 'EDIT' }
    ),
    removeMember: restrictModule(
        async ({ request, params, locals, auth, getClientAddress }: ModuleAuthenticatedEvent) => {
            const { id: companyId } = params;
            
            // Create a simple schema for the remove action
            const removeSchema = z.object({
                itemId: z.string().min(1, { message: "User ID is required" })
            });
            
            const form = await superValidate(request, zod(removeSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if the company exists
                const company = await locals.prisma.company.findUnique({
                    where: { id: companyId }
                });

                if (!company) {
                    return message(form, {
                        type: 'error',
                        text: 'Company not found',
                        details: `No company found with ID: ${companyId}`,
                        code: 'COMPANY_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }

                // Remove the user from the account membership
                const membership = await locals.prisma.accountMembership.delete({
                    where: {
                        userId_accountId: {
                            userId: form.data.itemId,
                            accountId: company.accountId
                        },
                        role: { not: 'SYSTEM' }
                    }
                });

                logger.info(`User ${form.data.itemId} removed from account ${company.accountId} (via company ${companyId})`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'AccountMembership',
                    recordId: membership.id,
                    oldData: membership,
                    newData: null,
                    userId: auth?.user?.id ?? '',
                    ipAddress: getClientAddress(),
                    prisma: locals.prisma
                })

                return message(form, {
                    type: 'success',
                    text: 'Member removed successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                logger.error('Error removing member from account:', err as Record<string, any>);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to remove member',
                    details: 'An error occurred while removing the member from the account',
                    code: 'REMOVE_FAILED',
                    timestamp: new Date().toISOString()
                }, { status: 500 });
            }
        },
        'COMPANIES',
        { action: 'EDIT' }
    ),

    // Delete company action
    deleteCompany: restrictModule(
        async ({ request, params, locals, auth, getClientAddress }: ModuleAuthenticatedEvent) => {
            const { id } = params;

            if (!id) {
                return fail(400, { error: 'Company ID is required' });
            }

            try {
                logger.info(`Starting company deletion process for ID: ${id}`);

                // Check if company exists first
                const existingCompany = await locals.prisma.company.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        accountId: true,
                        _count: {
                            select: {
                                devices: true
                            }
                        }
                    }
                });

                if (!existingCompany) {
                    logger.warn(`Company not found: ${id}`);
                    return fail(404, { error: 'Company not found' });
                }

                logger.info(`Found company: ${existingCompany.name} (${existingCompany.id})`);

                // Check if company has dependencies that would prevent deletion
                const hasDevices = existingCompany._count.devices > 0;

                if (hasDevices) {
                    const errorMsg = `Cannot delete company with existing dependencies: ${existingCompany._count.devices} devices. Please remove all dependencies first.`;
                    logger.warn(`Deletion blocked for company ${id}: ${errorMsg}`);
                    
                    return fail(400, { error: errorMsg });
                }

                logger.info(`No dependencies found, proceeding with deletion of company: ${id}`);

                // Delete the company
                const deletedCompany = await locals.prisma.company.delete({
                    where: { id }
                });

                logger.info(`Company successfully deleted from database: ${deletedCompany.id} (${deletedCompany.name})`);

                // Audit logging with better error handling
                try {
                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'Company',
                        recordId: id,
                        oldData: deletedCompany,
                        newData: null,
                        userId: auth?.user?.id || 'unknown',
                        ipAddress: getClientAddress() || 'unknown',
                        prisma: locals.prisma
                    });
                    logger.info(`Audit log entry created for company deletion: ${id}`);
                } catch (auditError) {
                    // Don't fail the deletion if audit logging fails
                    logger.error('Failed to create audit log entry:', auditError as Record<string, any>);
                }

                logger.info(`Company deletion completed successfully: ${id}`);
                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                const stackTrace = err instanceof Error ? err.stack : undefined;
                
                logger.error(`Error deleting company ${id}:`, { 
                    message: errorMsg, 
                    stack: stackTrace,
                    companyId: id
                });
                
                // Provide more specific error messages based on the error type
                if (errorMsg.includes('Foreign key constraint')) {
                    return fail(400, { error: 'Cannot delete company - it is still referenced by other records. Please remove all related data first.' });
                } else if (errorMsg.includes('Record to delete does not exist')) {
                    return fail(404, { error: 'Company not found or already deleted.' });
                } else {
                    return fail(500, { error: `Failed to delete company: ${errorMsg}` });
                }
            }
        },
        'COMPANIES',
        { action: 'DELETE' }
    )
};
