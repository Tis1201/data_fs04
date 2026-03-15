/**
 * V2 API Response Handler
 * 
 * Utility functions for handling v2 API responses consistently across the frontend.
 * All v2 APIs return a standardized response format with success/error handling.
 */

import type { ApiResponse } from '$lib/types/api';

/**
 * Handle v2 API response and extract data
 * Throws an error if the request was not successful
 */
export async function handleV2Response<T>(
    response: Response,
    operation: string = 'operation'
): Promise<T> {
    const result: ApiResponse<T> = await response.json();
    
    if (!result.success) {
        const err = result.error;
        const requestId = result.meta?.requestId;
        // Prefer details.originalError when message is generic (e.g. API returned 500 but had real reason in details)
        const displayMessage =
            err?.details?.originalError ||
            err?.message ||
            `${operation} failed`;

        console.error(`[${operation} Failed]`, {
            code: err?.code,
            message: err?.message,
            requestId,
            timestamp: new Date().toISOString()
        });

        throw new Error(displayMessage);
    }
    
    return result.data as T;
}

/**
 * Wrapper for GET requests with v2 handling
 */
export async function getV2<T = any>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        ...options
    });
    
    return handleV2Response<T>(response, 'GET ' + url);
}

/**
 * Wrapper for POST requests with v2 handling
 */
export async function postV2<T = any>(
    url: string, 
    data: any,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
        ...options
    });
    
    return handleV2Response<T>(response, 'POST ' + url);
}

/**
 * Wrapper for PUT requests with v2 handling
 */
export async function putV2<T = any>(
    url: string, 
    data: any,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
        ...options
    });
    
    return handleV2Response<T>(response, 'PUT ' + url);
}

/**
 * Wrapper for PATCH requests with v2 handling
 */
export async function patchV2<T = any>(
    url: string, 
    data: any,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
        ...options
    });
    
    return handleV2Response<T>(response, 'PATCH ' + url);
}

/**
 * Wrapper for DELETE requests with v2 handling
 */
export async function deleteV2<T = any>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        ...options
    });
    
    return handleV2Response<T>(response, 'DELETE ' + url);
}

/**
 * Get full v2 API response (including meta) without throwing on error
 * Useful when you need to handle errors manually
 */
export async function getV2Response<T = any>(
    url: string,
    options?: RequestInit
): Promise<ApiResponse<T>> {
    const response = await fetch(url, {
        credentials: 'include',
        ...options
    });
    
    return await response.json();
}

