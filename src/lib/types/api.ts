/**
 * Shared API types for standardized communication between client and server
 */

/**
 * Standard error response format for the application
 * Used for both client-side and server-side error handling
 */
export type ApiErrorResponse = {
    type: 'error' | 'info' | 'success' | 'warning';
    text: string;
    details?: string;
    code?: string;
    requestId?: string;
    timestamp?: string;
    stack?: string; // Only included in development mode
};

/**
 * Standard success response format for the application
 */
export type ApiSuccessResponse = {
    type: 'success';
    text: string;
    details?: string;
    data?: any;
    timestamp?: string;
};

/**
 * Union type for all API responses
 */
export type ApiResponse = ApiErrorResponse | ApiSuccessResponse;

/**
 * Helper function to create a standardized error response
 */
export function createErrorResponse(
    text: string, 
    options?: {
        details?: string;
        code?: string;
        requestId?: string;
        type?: 'error' | 'info' | 'warning';
        stack?: string;
    }
): ApiErrorResponse {
    return {
        type: options?.type || 'error',
        text,
        details: options?.details,
        code: options?.code,
        requestId: options?.requestId,
        timestamp: new Date().toISOString(),
        stack: options?.stack
    };
}

/**
 * Helper function to create a standardized success response
 */
export function createSuccessResponse(
    text: string,
    options?: {
        details?: string;
        data?: any;
    }
): ApiSuccessResponse {
    return {
        type: 'success',
        text,
        details: options?.details,
        data: options?.data,
        timestamp: new Date().toISOString()
    };
}
