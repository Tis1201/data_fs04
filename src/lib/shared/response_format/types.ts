/**
 * Standardized response format system for consistent communication across all channels
 * (HTTP responses, SSE events, WebSockets, UI notifications)
 */

/**
 * Response status codes aligned with HTTP status codes for consistency
 * but extended with application-specific codes
 */
export enum ResponseStatus {
    // Success codes (2xx)
    SUCCESS = 200,
    CREATED = 201,
    ACCEPTED = 202,
    
    // Client error codes (4xx)
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    VALIDATION_ERROR = 422,
    TOO_MANY_REQUESTS = 429,
    
    // Server error codes (5xx)
    SERVER_ERROR = 500,
    NOT_IMPLEMENTED = 501,
    SERVICE_UNAVAILABLE = 503,
    
    // Application-specific codes (1xxx)
    DEVICE_OFFLINE = 1001,
    DEVICE_BUSY = 1002,
    SUBSCRIPTION_EXPIRED = 1003,
    ACCOUNT_LIMIT_REACHED = 1004,
    FEATURE_DISABLED = 1005,
    
    // Informational codes (3xx)
    REDIRECT = 302,
    REFRESH_REQUIRED = 305
}

/**
 * Response severity levels for UI presentation
 */
export enum ResponseSeverity {
    INFO = 'info',
    SUCCESS = 'success',
    WARNING = 'warning',
    ERROR = 'error',
    DEBUG = 'debug'
}

/**
 * Response categories for grouping and filtering
 */
export enum ResponseCategory {
    SYSTEM = 'system',
    AUTH = 'auth',
    DEVICE = 'device',
    USER = 'user',
    DATA = 'data',
    NOTIFICATION = 'notification'
}

/**
 * Base response interface for all application responses
 */
export interface BaseResponse {
    /**
     * Unique response identifier
     */
    id?: string;
    
    /**
     * Response timestamp (ISO string or epoch ms)
     */
    timestamp: string | number;
    
    /**
     * Response status code
     */
    status: ResponseStatus;
    
    /**
     * Response severity level
     */
    severity: ResponseSeverity;
    
    /**
     * Response category
     */
    category: ResponseCategory;
    
    /**
     * Short response title (for UI display)
     */
    title?: string;
    
    /**
     * Detailed response content
     */
    message: string;
    
    /**
     * Optional technical details (for developers, logs)
     */
    details?: string;
    
    /**
     * Optional error code for specific error types
     */
    code?: string;
    
    /**
     * Optional metadata for additional context
     */
    meta?: Record<string, any>;
}

/**
 * Data response with payload
 */
export interface DataResponse<T = any> extends BaseResponse {
    /**
     * The data payload
     */
    data: T;
}

/**
 * Error response with additional error details
 */
export interface ErrorResponse extends BaseResponse {
    /**
     * Error name/type
     */
    error: string;
    
    /**
     * Optional field-specific validation errors
     */
    validationErrors?: Record<string, string[]>;
    
    /**
     * Optional error stack (for development only)
     */
    stack?: string;
}

/**
 * System response for application events
 */
export interface SystemResponse extends BaseResponse {
    /**
     * System event type
     */
    event: string;
    
    /**
     * Whether the event requires user action
     */
    actionRequired?: boolean;
    
    /**
     * Optional action details
     */
    action?: {
        type: string;
        label: string;
        url?: string;
    };
}

/**
 * Progress response for long-running operations
 */
export interface ProgressResponse extends BaseResponse {
    /**
     * Progress percentage (0-100)
     */
    progress: number;
    
    /**
     * Optional total steps
     */
    total?: number;
    
    /**
     * Optional current step
     */
    current?: number;
    
    /**
     * Optional estimated time remaining (in seconds)
     */
    eta?: number;
}

/**
 * Type guard for DataResponse
 */
export function isDataResponse(response: BaseResponse): response is DataResponse {
    return 'data' in response;
}

/**
 * Type guard for ErrorResponse
 */
export function isErrorResponse(response: BaseResponse): response is ErrorResponse {
    return 'error' in response;
}

/**
 * Type guard for SystemResponse
 */
export function isSystemResponse(response: BaseResponse): response is SystemResponse {
    return 'event' in response;
}

/**
 * Type guard for ProgressResponse
 */
export function isProgressResponse(response: BaseResponse): response is ProgressResponse {
    return 'progress' in response;
}

/**
 * Response with backward compatibility for legacy formats
 */
export interface LegacyCompatibleResponse extends BaseResponse {
    /**
     * Legacy success flag
     * @deprecated Use status instead
     */
    success?: boolean;
    
    /**
     * Legacy error message
     * @deprecated Use message instead
     */
    error?: string;
}
