import type { RoutingMessage, OutMessage } from '../interfaces/message';
import type { Publisher } from '../interfaces/publisher';
import { MessageFactory } from '../interfaces/message';
import { router } from './router';
import { ConnectionManager } from './connectionManager';
import { logger } from '$lib/server/logger';
import { ScopeAuthorizer } from './scopeAuthorizer';
import { AuditLogger } from './auditLogger';

export const publisher: Publisher = {
  
  async publish(message: RoutingMessage): Promise<void> {

    const { type, scope, payload, userInfo, connectionId, sudo } = message;

    // Debug log for sudo property
    logger.debug(`[Publisher] Message sudo property: ${sudo}, type: ${typeof sudo}`);
    
    // Resolve recipients
    const connectionIds = await router.resolve(userInfo, scope);

    if (connectionIds.length === 0) {
      logger.debug(`[Publisher] No recipients for scope: ${scope}`);
      return;
    }

    const isAllowed = await ScopeAuthorizer.isAllowed(scope, userInfo, type, connectionIds, sudo);
    
    logger.debug(`[Publisher] ${isAllowed ? 'Allowed' : 'Not allowed'}: (${scope})`);

    // Verify permission
    if (!isAllowed) {
      logger.warn(`[Publisher] Not authorized: ${userInfo.id} → ${scope} (${payload.type})`);
      
      // Log authorization failure for each intended recipient
      connectionIds.forEach(connId => {
        // Get recipient connection info for logging
        const recipientConn = ConnectionManager.getConnection(connId);
        const recipientEmail = recipientConn?.meta.userInfo?.email;
        
        // Add recipient email to message for logging
        const messageWithRecipient = {
          ...message,
          recipientEmail
        };
        
        AuditLogger.logAuthFailure(messageWithRecipient, connId);
      });
      
      return;
    }

    const outMessage: OutMessage = MessageFactory.toOutMessage(message);

    // Deliver to each connection
    await Promise.all(
      connectionIds.map((connId) => {
        // Get recipient connection info for logging
        const recipientConn = ConnectionManager.getConnection(connId);
        const recipientEmail = recipientConn?.meta.userInfo?.email;
        
        // Add recipient email to message for logging
        const messageWithRecipient = {
          ...message,
          recipientEmail
        };
        
        return ConnectionManager.sendTo(connId, outMessage)
          .then(() => {
            // Log successful delivery with recipient info
            AuditLogger.logSuccess(messageWithRecipient, connId);
          })
          .catch(err => {
            logger.warn(`[Publisher] Failed to send to ${connId}:`, err);
            // Log delivery error with recipient info
            AuditLogger.logDeliveryError(messageWithRecipient, connId, err);
          });
      })
    );
  }
};
