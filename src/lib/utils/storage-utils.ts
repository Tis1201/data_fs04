import { browser } from '$app/environment';

export type StorageMode = 'LOCAL' | 'LOCAL_CLOUD' | 'GCLOUD';

/**
 * Get the current storage mode from environment variables
 * This should be called on the server side
 */
export function getStorageMode(): StorageMode {
    // This will be replaced with actual environment variable access on the server
    return 'LOCAL'; // Default fallback
}

/**
 * Check if the current storage mode requires presigned URLs
 */
export function requiresPresignedUrl(mode: StorageMode): boolean {
    return mode === 'LOCAL_CLOUD' || mode === 'GCLOUD';
}

/**
 * Get the appropriate API endpoint for presigned URL generation
 * Migrated to v2 unified endpoint
 */
export function getPresignedUrlEndpoint(isAdmin: boolean = false): string {
    // V2 unified endpoint - no longer role-based
    return '/api/v2/upload/presigned-url';
}
