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
 */
export function getPresignedUrlEndpoint(isAdmin: boolean = false): string {
    const basePath = isAdmin ? '/api/admin/upload/presigned-url' : '/api/user/upload/presigned-url';
    return basePath;
}
