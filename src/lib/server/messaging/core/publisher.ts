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
    
    // Extra logging for device connection/disconnection events
    if (type === 'device:connection' || type === 'device:disconnection') {
      console.log('[Publisher] ===== DEVICE CONNECTION EVENT =====');
      console.log('[Publisher] Message:', { type, scope, deviceId: payload?.deviceId, connected: payload?.connected });
    }
    
    // Resolve recipients
    const connectionIds = await router.resolve(userInfo, scope);

    if (connectionIds.length === 0) {
      if (type === 'device:connection' || type === 'device:disconnection') {
        console.log('[Publisher] ERROR: No recipients found for scope:', scope);
      }
      logger.debug(`[Publisher] No recipients for scope: ${scope}`);
      return;
    }
    
    if (type === 'device:connection' || type === 'device:disconnection') {
      console.log('[Publisher] Found recipients:', connectionIds.length, 'connections:', connectionIds);
    }

    // Allow system-generated messages to publish to subscription scopes
    let isAllowed = await ScopeAuthorizer.isAllowed(scope, userInfo, type, connectionIds, sudo);
    if (!isAllowed && message.systemGenerated && scope.startsWith('subscription:')) {
      logger.debug(`[Publisher] Overriding allow for system message to ${scope}`);
      isAllowed = true;
    }
    
    logger.debug(`[Publisher] ${isAllowed ? 'Allowed' : 'Not allowed'}: (${scope})`);

    // Verify permission
    if (!isAllowed) {
      logger.warn(`[Publisher] Not authorized: ${userInfo?.id} → ${scope} (${payload.type})`);
      
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
    
    // Log requestId preservation for debugging
    if (message.requestId) {
      logger.debug(`[Publisher] OutMessage requestId: ${outMessage.requestId} (from RoutingMessage: ${message.requestId})`);
      if (!outMessage.requestId) {
        logger.error(`[Publisher] ⚠️ requestId LOST during toOutMessage conversion! Original: ${message.requestId}`);
      }
    }
    
    // By default, do not echo a message back to the exact sender connection
    // unless explicitly requested via echoToSender.
    logger.debug(`[Publisher] Filtering recipients. Total: ${connectionIds.length}, echoToSender: ${message.echoToSender}, senderConnectionId: ${message.senderConnectionId}, connectionId: ${message.connectionId}`);
    
    const filteredRecipients = connectionIds.filter(connId => {
      if (message.echoToSender === true) {
        logger.debug(`[Publisher] Including ${connId} (echoToSender=true)`);
        return true;
      }
      
      // Skip sending to the originating connection for request messages
      if (connId === (message.senderConnectionId || message.connectionId)) {
        logger.debug(`[Publisher] Excluding ${connId} (sender connection)`);
        return false;
      }
      
      // If excludeDevices is true, skip device connections
      if (message.excludeDevices) {
        const conn = ConnectionManager.getConnection(connId);
        // Device connections have deviceId === id (they connect as themselves)
        if (conn && conn.meta.deviceId === conn.meta.id) {
          logger.debug(`[Publisher] Excluding device connection ${connId} from message`);
          return false;
        }
      }
      
      logger.debug(`[Publisher] Including ${connId} (passed all filters)`);
      return true;
    });
    
    logger.debug(`[Publisher] Filtered recipients: ${filteredRecipients.length} of ${connectionIds.length}`);

    // Deliver to each connection
    logger.debug(`[Publisher] Delivering message type=${type} to ${filteredRecipients.length} recipients`);
    
    if (type === 'device:connection' || type === 'device:disconnection') {
      console.log('[Publisher] Delivering to', filteredRecipients.length, 'filtered recipients:', filteredRecipients);
    }
    
    await Promise.all(
      filteredRecipients.map((connId) => {
        // Get recipient connection info for logging
        const recipientConn = ConnectionManager.getConnection(connId);
        const recipientEmail = recipientConn?.meta.userInfo?.email;
        
        logger.debug(`[Publisher] Sending to connection: ${connId}, protocol: ${recipientConn?.meta?.protocol}, type: ${type}`);
        
        if (type === 'device:connection' || type === 'device:disconnection') {
          console.log('[Publisher] Sending to connection:', connId, 'protocol:', recipientConn?.meta?.protocol);
        }
        
        // Add recipient email to message for logging
        const messageWithRecipient = {
          ...message,
          recipientEmail
        };
        
        return ConnectionManager.sendTo(connId, outMessage)
          .then(() => {
            logger.debug(`[Publisher] Successfully delivered message type=${type} to: ${connId}`);
            
            if (type === 'device:connection' || type === 'device:disconnection') {
              console.log('[Publisher] Successfully delivered to:', connId);
            }
            // Log successful delivery with recipient info
            AuditLogger.logSuccess(messageWithRecipient, connId);
          })
          .catch(err => {
            logger.warn(`[Publisher] Failed to deliver message type=${type} to ${connId}:`, err);
            
            if (type === 'device:connection' || type === 'device:disconnection') {
              console.log('[Publisher] ERROR: Failed to deliver to:', connId, err);
            }
            logger.warn(`[Publisher] Failed to send to ${connId}:`, err);
            // Log delivery error with recipient info
            AuditLogger.logDeliveryError(messageWithRecipient, connId, err);
          });
      })
    );
  }
};
