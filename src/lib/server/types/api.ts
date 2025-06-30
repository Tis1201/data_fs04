import type { Prisma } from '@prisma/client';

/**
 * Base interface for all API responses
 * @template T - Type of the data payload
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;
  
  /** Response data (for successful responses) */
  data?: T;
  
  /** Optional message describing the result */
  message?: string;
  
  /** Unique request identifier for tracing */
  requestId?: string;
  
  /** ISO timestamp of when the response was generated */
  timestamp?: string;
}

/**
 * Interface for successful API responses
 * @template T - Type of the data payload
 */
export interface ApiSuccessResponse<T = unknown> extends Omit<ApiResponse<T>, 'success'> {
  success: true;
  
  /** Response data */
  data: T;
  
  /** Optional success message */
  message?: string;
}

/**
 * Interface for error API responses
 */
export interface ApiErrorResponse extends Omit<ApiResponse<never>, 'success'> {
  success: false;
  
  /** Error details */
  error: {
    /** Machine-readable error code */
    code: string;
    
    /** Human-readable error message */
    message: string;
    
    /** Additional error details (only in development) */
    details?: unknown;
    
    /** Stack trace (only in development) */
    stack?: string;
  };
}

/**
 * Creates a success response object
 * @param data - The response data
 * @param options - Additional response options
 * @returns A properly typed success response
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    message?: string;
    requestId?: string;
  } = {}
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message: options.message,
    requestId: options.requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates an error response object
 * @param error - The error object or message
 * @param options - Additional error options
 * @returns A properly typed error response
 */
export function createErrorResponse(
  error: Error | string,
  options: {
    code?: string;
    details?: unknown;
    requestId?: string;
    includeStack?: boolean;
  } = {}
): ApiErrorResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? new Error(error).stack : error.stack;

  return {
    success: false,
    error: {
      code: options.code || 'INTERNAL_ERROR',
      message: errorMessage,
      ...(isDev && options.details !== undefined && { details: options.details }),
      ...(isDev && options.includeStack && errorStack && { stack: errorStack })
    },
    requestId: options.requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Type guard to check if a value is an API error response
 * @param response - The response to check
 * @returns True if the response is an error response
 */
export function isErrorResponse(
  response: ApiResponse
): response is ApiErrorResponse {
  return !response.success;
}

/**
 * Type guard to check if a value is an API success response
 * @param response - The response to check
 * @returns True if the response is a success response
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type for Prisma error codes
 */
export type PrismaErrorCode = Prisma.PrismaClientKnownRequestError['code'];

/**
 * Common error codes used in the API
 */
export const ErrorCode = {
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Business logic errors
  INVALID_OPERATION: 'INVALID_OPERATION',
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  
  // Authentication & Authorization
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // Prisma error codes (prefixed with PRISMA_)
  PRISMA_UNIQUE_CONSTRAINT: 'P2002',
  PRISMA_RECORD_NOT_FOUND: 'P2025',
  PRISMA_FOREIGN_KEY_CONSTRAINT: 'P2003'
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];
