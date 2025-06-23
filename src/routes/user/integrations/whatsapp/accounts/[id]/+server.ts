import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { logger } from '$lib/server/logger';

// DELETE endpoint for WhatsApp accounts
export const DELETE: RequestHandler = restrict(
    async ({ params, locals, auth }) => {
        const { id } = params;
        
        if (!id) {
            logger.warn('Delete API called without an ID');
            return json({ 
                success: false, 
                message: 'WhatsApp account ID is required' 
            }, { status: 400 });
        }
        
        try {
            // Get the current user's account ID from auth.currentAccount
            const accountId = auth.currentAccount?.account?.id;
            
            if (!accountId) {
                logger.warn('Delete API called without a selected account');
                return json({ 
                    success: false, 
                    message: 'No account selected. Please select an account first.' 
                }, { status: 403 });
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
                logger.warn(`WhatsApp account ${id} not found or not accessible by account ${accountId}`);
                return json({ 
                    success: false, 
                    message: 'WhatsApp account not found or you do not have permission to delete it' 
                }, { status: 404 });
            }
            
            // Disconnect the client if it's connected
            try {
                await whatsAppAccountManager.cleanupClient(id);
                logger.debug(`WhatsApp client for account ${id} disconnected successfully`);
            } catch (cleanupErr) {
                // Log the error but continue with deletion
                logger.error(`Error disconnecting WhatsApp client for account ${id}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
                if (cleanupErr instanceof Error && cleanupErr.stack) {
                    logger.debug(`Stack trace: ${cleanupErr.stack}`);
                }
            }
            
            // Delete the WhatsApp account
            await locals.prisma.whatsAppAccount.delete({
                where: { id }
            });
            
            logger.debug(`WhatsApp account ${id} deleted successfully`);
            
            return json({ 
                success: true, 
                message: 'WhatsApp account deleted successfully' 
            });
        } catch (err) {
            // Log the error with detailed information
            logger.error(`Error deleting WhatsApp account: ${err instanceof Error ? err.message : String(err)}`);
            if (err instanceof Error && err.stack) {
                logger.debug(`Stack trace: ${err.stack}`);
            }
            
            // Determine if this is an access policy violation
            let errorMessage = 'Failed to delete WhatsApp account';
            let statusCode = 500;
            
            if (err && typeof err === 'object') {
                // Check for Prisma/Zenstack specific error codes
                if ('code' in err) {
                    const prismaErr = err as { code: string };
                    if (prismaErr.code === 'P2025') {
                        errorMessage = 'WhatsApp account not found';
                        statusCode = 404;
                    } else if (prismaErr.code === 'P2003') {
                        errorMessage = 'Cannot delete this WhatsApp account because it is referenced by other records';
                        statusCode = 400;
                    }
                }
                
                // Check for HTTP errors from SvelteKit
                if ('status' in err) {
                    const httpErr = err as { status: number };
                    statusCode = httpErr.status || statusCode;
                }
            }
            
            return json({ 
                success: false, 
                message: errorMessage,
                code: err && typeof err === 'object' && 'code' in err ? (err as any).code : undefined
            }, { status: statusCode });
        }
    },
    ['USER', 'ADMIN'] // Allow both user and admin roles to access this API
);
