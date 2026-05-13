import { S3Client } from '@aws-sdk/client-s3';
import { logger } from '$lib/server/logger';

let r2ClientInstance: S3Client | null = null;

/**
 * Singleton getter for Cloudflare R2 S3 Client
 */
export function getR2Client(): S3Client {
    if (r2ClientInstance) {
        return r2ClientInstance;
    }

    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error('Missing Cloudflare R2 credentials in environment variables (CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY)');
    }

    const resolvedEndpoint = endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
    if (!resolvedEndpoint) {
        throw new Error('Either CLOUDFLARE_R2_ENDPOINT or CLOUDFLARE_R2_ACCOUNT_ID must be set');
    }

    logger.info(`Initializing R2 Client with endpoint: ${resolvedEndpoint}`);

    r2ClientInstance = new S3Client({
        region: 'auto',
        endpoint: resolvedEndpoint,
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });

    return r2ClientInstance;
}

/**
 * Get R2 bucket name from environment variables
 */
export function getR2BucketName(): string {
    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    if (!bucket) {
        throw new Error('CLOUDFLARE_R2_BUCKET_NAME environment variable is not set');
    }
    return bucket;
}

/**
 * Get optional R2 CDN URL if configured
 */
export function getR2CdnUrl(): string | undefined {
    // Trim trailing slash for consistency
    const url = process.env.CLOUDFLARE_R2_CDN_URL;
    return url ? url.replace(/\/$/, '') : undefined;
}
