import { browser } from '$app/environment';

/** Supported storage backends: local disk or Cloudflare R2 (S3-compatible). */
export type StorageMode = 'LOCAL' | 'R2';

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
    return mode === 'R2';
}

/**
 * Get the appropriate API endpoint for presigned URL generation
 * Migrated to v2 unified endpoint
 */
export function getPresignedUrlEndpoint(isAdmin: boolean = false): string {
    // V2 unified endpoint - no longer role-based
    return '/api/v2/upload/presigned-url';
}
