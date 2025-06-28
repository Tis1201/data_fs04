import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { logger } from '$lib/server/logger';
import { handleApiError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';

// DELETE handler for WhatsApp accounts
export const DELETE = restrict(
    async ({ request, locals, auth }: any) => {
        try {
            // Parse the request to get the account ID
            const requestData = await request.json().catch(() => ({}));
            const id = requestData.id;
            
            if (!id) {
                throw error(400, 'WhatsApp account ID is required');
            }
            
            // Get the current user's account ID
            const accountId = auth.currentAccount?.account?.id;
            
            if (!accountId) {
                throw error(403, 'No account selected. Please select an account first.');
            }
            
            logger.debug(`Deleting WhatsApp account ${id} for account ${accountId}`);
            
            // First check if the account exists and belongs to the user's account
            const whatsAppAccount = await locals.prisma.whatsAppAccount.findFirst({
                where: {
                    id,
                    accountId
                }
            });
            
            if (!whatsAppAccount) {
                throw error(404, 'WhatsApp account not found or you do not have permission to delete it');
            }
            
            // Disconnect the client if it's connected
            try {
                await whatsAppAccountManager.cleanupClient(id);
                logger.debug(`WhatsApp client for account ${id} disconnected successfully`);
            } catch (cleanupErr) {
                // Log the error but continue with deletion
                logger.error(`Error disconnecting WhatsApp client for account ${id}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
            }
            
            // Delete the WhatsApp account
            await locals.prisma.whatsAppAccount.delete({
                where: { id }
            });
            
            logger.debug(`WhatsApp account ${id} deleted successfully`);
            
            // Use standardized success response format
            return json(createSuccessResponse('WhatsApp account deleted successfully'));
        } catch (err) {
            return handleApiError({
                error: err,
                prisma: locals.prisma,
                accountId: auth.currentAccount?.account?.id,
                defaultMessage: 'Failed to delete WhatsApp account',
                action: 'delete_whatsapp_account'
            });
        }
    },
    ['USER', 'ADMIN'] // Allow both user and admin roles to access this API
);