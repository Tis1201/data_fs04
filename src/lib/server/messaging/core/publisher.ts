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
        AuditLogger.logAuthFailure(message, connId);
      });
      
      return;
    }

    const outMessage: OutMessage = MessageFactory.toOutMessage(message);

    // Deliver to each connection
    await Promise.all(
      connectionIds.map((connId) =>
        ConnectionManager.sendTo(connId, outMessage)
          .then(() => {
            // Log successful delivery
            AuditLogger.logSuccess(message, connId);
          })
          .catch(err => {
            logger.warn(`[Publisher] Failed to send to ${connId}:`, err);
            // Log delivery error
            AuditLogger.logDeliveryError(message, connId, err);
          })
      )
    );
  }
};
