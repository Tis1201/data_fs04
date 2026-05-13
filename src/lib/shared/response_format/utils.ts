import { v4 as uuidv4 } from 'uuid';
import type { 
    BaseResponse, 
    DataResponse, 
    ErrorResponse, 
    SystemResponse, 
    ProgressResponse,
    LegacyCompatibleResponse
} from './types';
import { 
    ResponseStatus, 
    ResponseSeverity, 
    ResponseCategory 
} from './types';

/**
 * Default options for creating responses
 */
const defaultOptions = {
    includeTimestamp: true,
    includeId: true,
    generateId: true
};

/**
 * Creates a base response with common fields
 */
export function createBaseResponse(
    params: {
        status: ResponseStatus;
        message: string;
        title?: string;
        severity?: ResponseSeverity;
        category?: ResponseCategory;
        details?: string;
        code?: string;
        meta?: Record<string, any>;
        id?: string;
    },
    options = defaultOptions
): BaseResponse {
    const timestamp = options.includeTimestamp ? new Date().toISOString() : undefined;
    const id = options.includeId 
        ? (params.id || (options.generateId ? uuidv4() : undefined)) 
        : undefined;
    
    return {
        id,
        timestamp: timestamp as string,
        status: params.status,
        severity: params.severity || getSeverityFromStatus(params.status),
        category: params.category || ResponseCategory.SYSTEM,
        title: params.title,
        message: params.message,
        details: params.details,
        code: params.code,
        meta: params.meta
    };
}

/**
 * Creates a success response with data
 */
export function createSuccessResponse<T = any>(
    data: T,
    params: {
        message?: string;
        title?: string;
        category?: ResponseCategory;
        meta?: Record<string, any>;
        status?: ResponseStatus;
    } = {}
): DataResponse<T> {
    return {
        ...createBaseResponse({
            status: params.status || ResponseStatus.SUCCESS,
            message: params.message || 'Operation completed successfully',
            title: params.title || 'Success',
            category: params.category || ResponseCategory.DATA,
            severity: ResponseSeverity.SUCCESS,
            meta: params.meta
        }),
        data
    };
}

/**
 * Creates an error response
 */
export function createErrorResponse(
    params: {
        error: string;
        message: string;
        title?: string;
        details?: string;
        code?: string;
        status?: ResponseStatus;
        category?: ResponseCategory;
        validationErrors?: Record<string, string[]>;
        stack?: string;
        meta?: Record<string, any>;
    }
): ErrorResponse {
    return {
        ...createBaseResponse({
            status: params.status || ResponseStatus.SERVER_ERROR,
            message: params.message,
            title: params.title || 'Error',
            category: params.category || ResponseCategory.SYSTEM,
            severity: ResponseSeverity.ERROR,
            details: params.details,
            code: params.code,
            meta: params.meta
        }),
        error: params.error,
        validationErrors: params.validationErrors,
        stack: params.stack
    };
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(
    validationErrors: Record<string, string[]>,
    params: {
        message?: string;
        title?: string;
        details?: string;
        meta?: Record<string, any>;
    } = {}
): ErrorResponse {
    return createErrorResponse({
        error: 'ValidationError',
        message: params.message || 'Validation failed',
        title: params.title || 'Validation Error',
        status: ResponseStatus.VALIDATION_ERROR,
        category: ResponseCategory.DATA,
        details: params.details,
        validationErrors,
        meta: params.meta
    });
}

/**
 * Creates a system notification response
 */
export function createSystemResponse(
    params: {
        event: string;
        message: string;
        title?: string;
        status?: ResponseStatus;
        severity?: ResponseSeverity;
        actionRequired?: boolean;
        action?: {
            type: string;
            label: string;
            url?: string;
        };
        meta?: Record<string, any>;
    }
): SystemResponse {
    return {
        ...createBaseResponse({
            status: params.status || ResponseStatus.SUCCESS,
            message: params.message,
            title: params.title,
            severity: params.severity || ResponseSeverity.INFO,
            category: ResponseCategory.SYSTEM,
            meta: params.meta
        }),
        event: params.event,
        actionRequired: params.actionRequired,
        action: params.action
    };
}

/**
 * Creates a progress response for long-running operations
 */
export function createProgressResponse(
    progress: number,
    params: {
        message?: string;
        title?: string;
        total?: number;
        current?: number;
        eta?: number;
        meta?: Record<string, any>;
    } = {}
): ProgressResponse {
    return {
        ...createBaseResponse({
            status: ResponseStatus.ACCEPTED,
            message: params.message || `Progress: ${progress}%`,
            title: params.title || 'Operation in Progress',
            severity: ResponseSeverity.INFO,
            category: ResponseCategory.SYSTEM,
            meta: params.meta
        }),
        progress,
        total: params.total,
        current: params.current,
        eta: params.eta
    };
}

/**
 * Creates a backward-compatible response that works with legacy code
 */
export function createLegacyCompatibleResponse(
    params: {
        success: boolean;
        message: string;
        data?: any;
        error?: string;
        status?: ResponseStatus;
        meta?: Record<string, any>;
    }
): LegacyCompatibleResponse {
    const status = params.status || (params.success ? ResponseStatus.SUCCESS : ResponseStatus.SERVER_ERROR);
    const severity = getSeverityFromStatus(status);
    
    return {
        ...createBaseResponse({
            status,
            message: params.message,
            severity,
            category: params.data ? ResponseCategory.DATA : ResponseCategory.SYSTEM,
            meta: params.meta
        }),
        success: params.success,
        error: params.error,
        ...(params.data ? { data: params.data } : {})
    } as LegacyCompatibleResponse;
}

/**
 * Converts a standard response to a SvelteKit Response object
 */
export function toResponse(
    response: BaseResponse,
    options: {
        status?: number;
        headers?: Record<string, string>;
    } = {}
): Response {
    // Use the response status if it's a standard HTTP status code (< 1000)
    const httpStatus = options.status || 
        (response.status < 1000 ? response.status : mapApplicationStatusToHttp(response.status));
    
    return new Response(
        JSON.stringify(response),
        {
            status: httpStatus,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        }
    );
}

/**
 * Converts an Error object to a standardized ErrorResponse
 */
export function errorToResponse(
    error: Error & { status?: number; code?: string },
    options: {
        includeStack?: boolean;
        defaultMessage?: string;
        defaultStatus?: ResponseStatus;
    } = {}
): ErrorResponse {
    const isDev = process.env.NODE_ENV === 'development';
    
    return createErrorResponse({
        error: error.name,
        message: error.message || options.defaultMessage || 'An unexpected error occurred',
        status: error.status as ResponseStatus || options.defaultStatus || ResponseStatus.SERVER_ERROR,
        code: error.code,
        stack: (isDev || options.includeStack) ? error.stack : undefined
    });
}

/**
 * Maps application-specific status codes to HTTP status codes
 */
function mapApplicationStatusToHttp(status: ResponseStatus): number {
    // Map application-specific codes to appropriate HTTP status codes
    const statusMap: Record<number, number> = {
        [ResponseStatus.DEVICE_OFFLINE]: 503,
        [ResponseStatus.DEVICE_BUSY]: 503,
        [ResponseStatus.SUBSCRIPTION_EXPIRED]: 402,
        [ResponseStatus.ACCOUNT_LIMIT_REACHED]: 403,
        [ResponseStatus.FEATURE_DISABLED]: 403
    };
    
    return statusMap[status] || 500;
}

/**
 * Determines the appropriate severity based on status code
 */
function getSeverityFromStatus(status: ResponseStatus): ResponseSeverity {
    if (status >= 200 && status < 300) {
        return ResponseSeverity.SUCCESS;
    } else if (status >= 400 && status < 500) {
        return ResponseSeverity.WARNING;
    } else if (status >= 500 || (status >= 1000 && status < 2000)) {
        return ResponseSeverity.ERROR;
    } else {
        return ResponseSeverity.INFO;
    }
}
