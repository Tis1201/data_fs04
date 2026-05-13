/**
 * Standardized API Response Types
 * 
 * This module provides consistent response formats for all API endpoints.
 * All API endpoints should use these types to ensure consistency across the application.
 * 
 * @see docs/local/ROUTES_API_MAPPING.md - Section 9: Standardize API Response Format
 */

/**
 * Standard API error object
 */
export interface ApiError {
	code: string;
	message: string;
	details?: any;
	field?: string;
}

/**
 * Standard API response metadata
 */
export interface ApiMeta {
	page?: number;
	pageSize?: number;
	total?: number;
	totalPages?: number;
	timestamp?: string;
	requestId?: string;
	[key: string]: any;
}

/**
 * Standard API response wrapper
 * 
 * @template T - The type of data returned in successful responses
 */
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: ApiError;
	errors?: ApiError[];
	meta?: ApiMeta;
}

/**
 * Type alias for success responses (for backward compatibility)
 */
export type ApiSuccessResponse<T = any> = ApiResponse<T> & {
	success: true;
	data: T;
};

/**
 * Type alias for error responses (for backward compatibility)
 */
export type ApiErrorResponse = ApiResponse & {
	success: false;
	error: ApiError;
};

/**
 * Paginated response data
 */
export interface PaginatedData<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

/**
 * Creates a successful API response
 * 
 * @param data - The data to return
 * @param meta - Optional metadata
 * @returns Standardized success response
 * 
 * @example
 * ```typescript
 * return json(successResponse({ id: 1, name: 'Device 1' }));
 * ```
 */
export function successResponse<T>(data: T, meta?: Partial<ApiMeta>): ApiResponse<T> {
	return {
		success: true,
		data,
		meta: {
			timestamp: new Date().toISOString(),
			...meta
		}
	};
}

/**
 * Creates an error API response
 * 
 * @param message - Error message
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param details - Optional additional error details
 * @param field - Optional field name for validation errors
 * @returns Standardized error response
 * 
 * @example
 * ```typescript
 * return json(errorResponse('Device not found', 'NOT_FOUND'), { status: 404 });
 * ```
 */
export function errorResponse(
	message: string,
	code: string = 'ERROR',
	details?: any,
	field?: string
): ApiResponse {
	return {
		success: false,
		error: {
			code,
			message,
			...(details && { details }),
			...(field && { field })
		},
		meta: {
			timestamp: new Date().toISOString()
		}
	};
}

/**
 * Creates a validation error response with multiple errors
 * 
 * @param errors - Array of validation errors
 * @returns Standardized validation error response
 * 
 * @example
 * ```typescript
 * return json(validationErrorResponse([
 *   { code: 'REQUIRED', message: 'Name is required', field: 'name' },
 *   { code: 'INVALID', message: 'Email is invalid', field: 'email' }
 * ]), { status: 422 });
 * ```
 */
export function validationErrorResponse(errors: ApiError[]): ApiResponse {
	return {
		success: false,
		errors,
		meta: {
			timestamp: new Date().toISOString()
		}
	};
}

/**
 * Creates a paginated success response
 * 
 * @param items - Array of items for current page
 * @param total - Total number of items
 * @param page - Current page number (1-indexed)
 * @param pageSize - Number of items per page
 * @param additionalMeta - Optional additional metadata
 * @returns Standardized paginated response
 * 
 * @example
 * ```typescript
 * const devices = await getDevices(page, pageSize);
 * return json(paginatedResponse(devices, totalCount, page, pageSize));
 * ```
 */
export function paginatedResponse<T>(
	items: T[],
	total: number,
	page: number = 1,
	pageSize: number = 20,
	additionalMeta?: Partial<ApiMeta>
): ApiResponse<PaginatedData<T>> {
	const totalPages = Math.ceil(total / pageSize);

	return {
		success: true,
		data: {
			items,
			total,
			page,
			pageSize,
			totalPages
		},
		meta: {
			timestamp: new Date().toISOString(),
			...additionalMeta
		}
	};
}

/**
 * Common error codes used across the application
 */
export const ErrorCodes = {
	// Authentication & Authorization
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	INVALID_TOKEN: 'INVALID_TOKEN',
	TOKEN_EXPIRED: 'TOKEN_EXPIRED',
	
	// Resource errors
	NOT_FOUND: 'NOT_FOUND',
	ALREADY_EXISTS: 'ALREADY_EXISTS',
	CONFLICT: 'CONFLICT',
	
	// Validation errors
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	INVALID_INPUT: 'INVALID_INPUT',
	REQUIRED_FIELD: 'REQUIRED_FIELD',
	
	// Business logic errors
	OPERATION_FAILED: 'OPERATION_FAILED',
	INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
	RESOURCE_LOCKED: 'RESOURCE_LOCKED',
	QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
	
	// System errors
	INTERNAL_ERROR: 'INTERNAL_ERROR',
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
	DATABASE_ERROR: 'DATABASE_ERROR',
	EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
	
	// Device-specific errors
	DEVICE_OFFLINE: 'DEVICE_OFFLINE',
	DEVICE_BUSY: 'DEVICE_BUSY',
	OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
	UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION'
} as const;

/**
 * Type helper to extract the data type from an ApiResponse
 */
export type UnwrapApiResponse<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
	return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: ApiResponse): response is ApiResponse & { error: ApiError } {
	return response.success === false && response.error !== undefined;
}

/**
 * Alternative name for successResponse (for backward compatibility)
 */
export function createSuccessResponse<T>(data: T, meta?: Partial<ApiMeta>): ApiResponse<T> {
	return successResponse(data, meta);
}

/**
 * Alternative name for errorResponse (for backward compatibility)
 */
export function createErrorResponse(
	message: string,
	code: string = 'ERROR',
	details?: any,
	field?: string
): ApiResponse {
	return errorResponse(message, code, details, field);
}
