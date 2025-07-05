import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import { validatePhoneNumber, getPhoneValidationMessage } from '$lib/utils/validation/phone';

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

export const load = restrict(
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
                where: { status: 'ACTIVE' },
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
                where: { accountId: company.accountId },
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

            return {
                form,
                company,
                accounts,
                members
            };
        } catch (err) {
            if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
                throw err;
            }
            logger.error('Error loading company:', err as Record<string, any>);
            throw error(500, 'Failed to load company details');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    updateCompany: restrict(
        async ({ request, params, locals }: RequestEvent) => {
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
        [SystemRole.ADMIN]
    ),
    removeMember: restrict(
        async ({ request, params, locals }: RequestEvent) => {
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
                await locals.prisma.accountMembership.delete({
                    where: {
                        userId_accountId: {
                            userId: form.data.itemId,
                            accountId: company.accountId
                        }
                    }
                });

                logger.info(`User ${form.data.itemId} removed from account ${company.accountId} (via company ${companyId})`);

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
        [SystemRole.ADMIN]
    )
};
