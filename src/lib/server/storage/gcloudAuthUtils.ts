/**
 * GCloud Authentication Utilities
 * Shared functions for getting access tokens via gcloud CLI with service account impersonation
 */

import { logger } from '$lib/server/logger';
import { execSync } from 'child_process';

/**
 * Get GCloud access token using gcloud CLI with service account impersonation
 * Useful when the SDK impersonation path is flaky in local dev.
 * 
 * @param targetServiceAccount - Service account to impersonate
 * @returns Access token string
 * @throws Error if token cannot be obtained
 */
export function getGCloudAccessToken(targetServiceAccount: string): string {
    try {
        logger.debug(`[GCloudAuth] Getting access token for service account: ${targetServiceAccount}`);
        
        const gcloudCommand = `gcloud auth print-access-token --impersonate-service-account=${targetServiceAccount}`;
        
        const accessToken = execSync(gcloudCommand, { 
            encoding: 'utf8',
            timeout: 10000,
            env: { 
                ...process.env
            }
        }).trim();
        
        if (!accessToken) {
            throw new Error('Empty access token received from gcloud CLI');
        }
        
        logger.debug(`[GCloudAuth] Successfully obtained access token`);
        return accessToken;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[GCloudAuth] Failed to get access token: ${errorMessage}`);
        
        // Check if it's a credential error
        if (errorMessage.includes('invalid_rapt') || 
            errorMessage.includes('invalid_grant') || 
            errorMessage.includes('reauth')) {
            throw new Error(`Credentials need refresh. Please run 'gcloud auth application-default login': ${errorMessage}`);
        }
        
        throw new Error(`Failed to get GCloud access token: ${errorMessage}`);
    }
}

/**
 * Check if an error is a credential-related error that requires user action
 */
export function isCredentialError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorMessage.includes('invalid_rapt') || 
           errorMessage.includes('invalid_grant') || 
           errorMessage.includes('reauth') ||
           errorMessage.includes('Credentials need refresh');
}

