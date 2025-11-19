import { json, fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms/server';
import { generateId } from 'lucia';
import { z } from 'zod';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';
import type { RequestHandler } from './$types';
import { handleApiError } from '$lib/server/errors/errorHandlers';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

// Define the API key schema
const apiKeySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional()
});

// List API keys
export const GET = restrict(
    async ({ locals, auth }: any) => {
        try {
            if (!auth?.user?.id) {
                throw new Error('User not authenticated');
            }
            
            const userId = auth.user.id;
            
            // Log the user ID for debugging
            console.log(`Fetching API keys for user: ${userId}`);
            
            const apiKeys = await locals.prisma.apiKey.findMany({
                where: { userId },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    key: true,
                    createdAt: true,
                    lastUsedAt: true,
                    expiresAt: true,
                    active: true
                },
                orderBy: { createdAt: 'desc' }
            });

            console.log(`Found ${apiKeys.length} API keys for user ${userId}`);

            // Mask the API keys for security (show first 4 and last 4 characters)
            const maskedApiKeys = apiKeys.map((key: any) => ({
                ...key,
                key: key.key.length > 8 
                    ? `${key.key.substring(0, 4)}${'•'.repeat(key.key.length - 8)}${key.key.substring(key.key.length - 4)}`
                    : key.key
            }));

            return json(createSuccessResponse(maskedApiKeys, {
                message: 'API keys retrieved successfully'
            }));
        } catch (error) {
            console.error('Error fetching API keys:', error);
            return json(createErrorResponse(error instanceof Error ? error : new Error('Failed to retrieve API keys'), {
                code: 'API_KEYS_FETCH_ERROR',
                details: error instanceof Error ? error.message : 'Unknown error occurred'
            }), { status: 500 });
        }
    },
    [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

// Create new API key
export const POST = restrict(
    async ({ request, locals, auth }: any) => {
        try {
            // Parse the request body directly
            const data = await request.json();
            
            // Basic validation
            if (!data.name) {
                return json(createErrorResponse(new Error('Name is required'), {
                    code: 'VALIDATION_ERROR'
                }), { status: 400 });
            }

            const userId = auth.user.id;
            const { name, description = '' } = data;

            // Check if user already has 10 or more API keys
            const existingKeysCount = await locals.prisma.apiKey.count({
                where: { userId }
            });

            if (existingKeysCount >= 10) {
                return json(createErrorResponse(new Error('You have reached the maximum limit of 10 API keys'), {
                    code: 'API_KEY_LIMIT_REACHED'
                }), { status: 400 });
            }

            // Generate a new API key
            const apiKey = generateId(32);
           
            // Store the API key in the database
            const newKey = await locals.prisma.apiKey.create({
                data: {
                    name,
                    description,
                    key: apiKey,
                    userId,
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
                },
                select: {
                    id: true,
                    name: true,
                    key: true,
                    createdAt: true,
                    expiresAt: true
                }
            });

            await logAudit({
                actionType: AuditActionType.INSERT,
                tableName: 'ApiKey',
                recordId: newKey.id,
                oldData: null,
                newData: newKey,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            })

            return json(createSuccessResponse(newKey, {
                message: 'API key created successfully'
            }));
        } catch (error:any) {
            return handleApiError({
                error,
                prisma: locals.prisma,
                defaultMessage: 'Failed to process request',
                action: 'processing data',
                status: 500 // Optional HTTP status code
              });
        }
    },
    [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

// Delete API key
export const DELETE = restrict(
    async ({ request, locals, auth }: any) => {
        try {
            // Parse the request body to get the API key ID
            const data = await request.json();
            
            if (!data.id) {
                throw new Error('API key ID is required');
            }

            const userId = auth.user.id;
            const { id } = data;

            // Check if the API key exists and belongs to the user
            const apiKey = await locals.prisma.apiKey.findUnique({
                where: { id, userId }
            });

            if (!apiKey) {
                const error = new Error('API key not found or does not belong to you');
                (error as any).status = 404;
                (error as any).code = 'NOT_FOUND';
                throw error;
            }

            // Delete the API key
            await locals.prisma.apiKey.delete({
                where: { id }
            });

            await logAudit({
                actionType: AuditActionType.DELETE,
                tableName: 'ApiKey',
                recordId: apiKey.id,
                oldData: apiKey,
                newData: null,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            })

            return json(createSuccessResponse(null, {
                message: 'API key deleted successfully'
            }));
        } catch (error: any) {
            return handleApiError({
                error,
                prisma: locals.prisma,
                defaultMessage: 'Failed to process request',
                action: 'processing data',
                status: 400 // Optional HTTP status code
              });
        }
    },
    [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);