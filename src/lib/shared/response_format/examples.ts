/**
 * Examples of using the standardized response format system
 * This file is for documentation purposes only and is not meant to be imported
 */

import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { 
    ResponseStatus,
    ResponseSeverity,
    ResponseCategory,
    createSuccessResponse,
    createErrorResponse,
    createValidationErrorResponse,
    createSystemResponse,
    createProgressResponse,
    toResponse,
    errorToResponse
} from '.';

/**
 * Example: HTTP API endpoint using standardized responses
 */
export async function exampleApiHandler(event: RequestEvent) {
    try {
        // Example successful data response
        const data = { id: '123', name: 'Example Item' };
        
        // Create a standardized success response
        const response = createSuccessResponse(data, {
            message: 'Item retrieved successfully',
            title: 'Item Details'
        });
        
        // Convert to SvelteKit Response
        return toResponse(response);
        
        // Alternatively, for backward compatibility:
        // return json(response);
    } catch (error) {
        logger.error(`Error in example API: ${error}`);
        
        // Convert error to standardized response
        const errorResponse = errorToResponse(error as Error, {
            defaultMessage: 'Failed to retrieve item'
        });
        
        return toResponse(errorResponse);
    }
}

/**
 * Example: Validation error handling
 */
export async function exampleFormHandler(event: RequestEvent) {
    try {
        const formData = await event.request.formData();
        
        // Example validation errors
        const validationErrors = {
            'email': ['Invalid email format'],
            'password': ['Password must be at least 8 characters', 'Password must contain a number']
        };
        
        // Create validation error response
        const response = createValidationErrorResponse(validationErrors, {
            message: 'Please correct the errors in the form',
            title: 'Validation Failed'
        });
        
        return toResponse(response, { status: 422 });
    } catch (error) {
        logger.error(`Form error: ${error}`);
        return toResponse(errorToResponse(error as Error));
    }
}

/**
 * Example: SSE message formatting
 */
export function formatSSEMessage(data: any) {
    // Create a standardized response
    const response = createSuccessResponse(data, {
        message: 'New data available',
        category: ResponseCategory.NOTIFICATION
    });
    
    // Format as SSE message
    return `data: ${JSON.stringify(response)}\n\n`;
}

/**
 * Example: Progress updates for long-running operations
 */
export function sendProgressUpdate(controller: ReadableStreamDefaultController, progress: number) {
    const progressResponse = createProgressResponse(progress, {
        message: `Processing: ${progress}% complete`,
        total: 100,
        current: progress,
        eta: calculateEta(progress)
    });
    
    controller.enqueue(`data: ${JSON.stringify(progressResponse)}\n\n`);
}

/**
 * Example: System notifications
 */
export function createMaintenanceNotification() {
    return createSystemResponse({
        event: 'MAINTENANCE',
        message: 'System maintenance scheduled for tonight at 2 AM',
        title: 'Scheduled Maintenance',
        severity: ResponseSeverity.INFO,
        actionRequired: true,
        action: {
            type: 'ACKNOWLEDGE',
            label: 'Acknowledge'
        }
    });
}

/**
 * Example: Error handling with different status codes
 */
export function handleDeviceError(error: Error, deviceId: string) {
    // Determine appropriate error type
    let status: ResponseStatus;
    let message: string;
    
    if (error.message.includes('offline')) {
        status = ResponseStatus.DEVICE_OFFLINE;
        message = `Device ${deviceId} is currently offline`;
    } else if (error.message.includes('busy')) {
        status = ResponseStatus.DEVICE_BUSY;
        message = `Device ${deviceId} is currently busy`;
    } else {
        status = ResponseStatus.SERVER_ERROR;
        message = `Error communicating with device ${deviceId}`;
    }
    
    return createErrorResponse({
        error: 'DeviceError',
        message,
        status,
        category: ResponseCategory.DEVICE,
        details: error.message,
        meta: { deviceId }
    });
}

/**
 * Example: Converting legacy responses to standardized format
 */
export function convertLegacyResponse(legacyResponse: any) {
    // Example legacy response format
    // { success: true, data: {...} } or { success: false, error: '...' }
    
    if (legacyResponse.success) {
        return createSuccessResponse(legacyResponse.data, {
            message: 'Operation successful'
        });
    } else {
        return createErrorResponse({
            error: 'LegacyError',
            message: legacyResponse.error || 'Unknown error',
            status: ResponseStatus.SERVER_ERROR
        });
    }
}

// Helper function for example only
function calculateEta(progress: number): number {
    // In a real implementation, this would use actual timing data
    return Math.round((100 - progress) * 0.5); // 0.5 seconds per percent remaining
}
