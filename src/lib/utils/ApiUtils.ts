import { toast } from "svelte-sonner";
import type { FactoryToken } from '@prisma/client';

/**
 * Generates a unique request ID for API calls or messaging
 * @param prefix Optional prefix for the ID (default: 'req')
 * @returns A unique string ID in the format: prefix-timestamp-randomstring
 */
export function generateRequestId(prefix: string = 'req'): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    return `${prefix}-${timestamp}-${randomStr}`;
}

/**
 * Generic API response type
 */
export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};

/**
 * Generic POST request to an API endpoint
 */
export async function api_post<T = any>(
    endpoint: string,
    body: object = {},
    successMessage?: string,
    errorMessage?: string // Optional custom error message
): Promise<T> {
    try {
        // Perform the POST request
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        // Parse the response JSON
        const data = await response.json();

        // Throw an error if the request was unsuccessful
        if (!response.ok) {
            throw new Error(data.message || errorMessage || "Request failed.");
        }

        // Show a success toast if a message is provided
        if (successMessage) {
            toast.success(successMessage);
        }

        return data;
    } catch (error: any) {
        // Use the custom error message if provided, or fallback to the default
        console.error(`API POST Request Failed: ${endpoint}`, error);
        toast.error(error.message || errorMessage || "An unexpected error occurred.");
        throw error;
    }
}

/**
 * Generic DELETE request to an API endpoint
 * @param endpoint The API endpoint to send the request to
 * @param id The ID of the resource to delete
 * @param errorMessage Optional custom error message
 */
export async function api_delete<T = any>(
    endpoint: string,
    id: string,
    errorMessage?: string
): Promise<ApiResponse<T>> {
    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (!result.success && result.error) {
            throw new Error(result.error);
        }
        
        return result;
    } catch (error) {
        console.error(`API DELETE Request Failed: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Generic PATCH request to an API endpoint
 * @param endpoint The API endpoint to send the request to
 * @param data The data to send in the request body
 * @param errorMessage Optional custom error message
 */

export async function api_patch<T = any>(
    endpoint: string,
    data: object,
    errorMessage?: string
): Promise<ApiResponse<T>> {
    try {
        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!result.success && result.error) {
            throw new Error(result.error);
        }
        
        return result;
    } catch (error) {
        console.error(`API PATCH Request Failed: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Toggles status between 'ACTIVE' and 'INACTIVE'.
 * Returns the opposite status.
 */
export function getStatusBeforeToggled(status: string): { status: string } {
    return {
        status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    };
}
