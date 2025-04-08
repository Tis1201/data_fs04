import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GlobalThisWSS, type ExtendedGlobal } from '$lib/server/websocket/WebSocketUtils';
import { restrict } from '$lib/server/security/guards';
import { validateAndGetUserId } from '$lib/server/security/auth-utils';
import { eventRouter, EventType } from '$lib/server/event';
import { logger } from '$lib/server/logger';
import { EventDestination, EventScope, type EventData } from '$lib/server/event/EventRouter';
import { WebSocketManager } from '$lib/server/websocket/WebSocketManager';

// Restrict to admin users only
const handler = restrict(async ({ request, locals }) => {
    let message: string;
    let type: string;
    let userId: string;
    
    // try {
        const body = await request.json();
        ({ message, type = 'broadcast' } = body);

        if (!message) {
            return json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        // Get user ID in one step - validates auth and gets ID
        userId = await validateAndGetUserId(locals);
        
        logger.debug('Broadcasting message', {
            userId,
            messageType: type,
            messageLength: message.length,
            timestamp: new Date().toISOString()
        });      
                      
        // Send the message to the user
        try {
            eventRouter.route_private_ws(userId, message);
            logger.debug('Message routed successfully', {
                userId,
                messageType: type,
                messageLength: message.length,
                timestamp: new Date().toISOString()
            }); 
        } catch (routeError) {       
            logger.error('Error routing message', {   
                error: {
                    message: routeError.message,
                    stack: routeError.stack,
                    name: routeError.name,
                    type: routeError.constructor.name
                }, 
                metadata: {
                    userId,
                    messageType: type,
                    messageLength: message.length
                }
            });
            throw routeError;
        }

        return json({ 
            success: true, 
            message: 'Message broadcasted successfully',
            clientCount: WebSocketManager.getInstance().getClientCount()
        });
    // } catch (error) {
    //     logger.error('Error broadcasting message', { 
    //         error: {
    //             message: error.message,
    //             stack: error.stack,
    //             name: error.name,
    //             type: error.constructor.name
    //         },
    //         timestamp: new Date().toISOString(),
    //         metadata: {
    //             message: message,
    //             userId: userId,
    //             type: type
    //         }
    //     });

    //     // Return detailed error information in development
    //     const errorResponse = {
    //         error: error.message,
    //         details: process.env.NODE_ENV === 'development' ? {
    //             stack: error.stack,
    //             name: error.name,
    //             type: error.constructor.name
    //         } : null
    //     };

    //     return json({ 
    //         success: false, 
    //         ...errorResponse 
    //     }, { status: error instanceof Error ? error.status : 500 });
    // }
}, ['ADMIN']);

export const POST = handler satisfies RequestHandler;
