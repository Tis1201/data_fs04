
import { getClickHouseClient } from './client';
import { logger } from '$lib/server/logger';
import { createHash } from 'crypto';
import {
    generatePresignedUrl,
    handleFileUpload,
    getFileMetadataFromCloudUrl,
    getStorageConfig,
    convertGCloudUrlToSignedDownloadUrl
} from '$lib/server/storage';

export interface LogQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    level?: string;
    deviceId?: string;
    accountId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    format?: 'json' | 'csv';
}

export interface LogEntry {
    timestamp: Date;
    level: string;
    message: string;
    device_id: string;
    account_id: string;
    user_id: string;
    metadata: Record<string, any>;
    [key: string]: any; // Allow for other columns in the wide table
}

export class LogService {
    private _client: ReturnType<typeof getClickHouseClient> | null = null;

    private get client() {
        if (!this._client) {
            this._client = getClickHouseClient();
        }
        return this._client;
    }

    /**
     * Get logs with pagination and filtering
     */
    async getLogs(params: LogQueryParams): Promise<{ logs: LogEntry[], total: number }> {
        const { query, queryParams } = this.buildQuery(params);
        const limit = params.limit || 50;
        const offset = ((params.page || 1) - 1) * limit;

        // Count total matching (approximate for efficiency if needed, but standard count here)
        // Check if we should use a materialized view based on columns used?
        // For now, assume 'logs_raw' or a view 'mv_device_logs'

        // We'll use a standardized table name - assumes 'mv_device_logs' exists or uses 'logs_raw'
        // User mentioned "materialized tables are used to split them into different types"
        // robustly falling back to logs_raw could be safer, but let's try a view if filtering by device
        const table = 'logs_raw';

        const countQuery = `SELECT count() as total FROM ${table} ${query}`;

        try {
            const [countResult, logsResult] = await Promise.all([
                this.client.query({ query: countQuery, query_params: queryParams }).then(r => r.json()),
                this.client.query({
                    query: `SELECT * FROM ${table} ${query} ORDER BY ${params.sortBy || 'timestamp'} ${params.sortOrder?.toUpperCase() || 'DESC'} LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
                    query_params: { ...queryParams, limit, offset }
                }).then(r => r.json())
            ]);

            const total = Number((countResult as any).data[0].total);
            const logs = (logsResult as any).data as LogEntry[];

            return { logs, total };
        } catch (error) {
            logger.error(`[LogService] Failed to query logs: ${error}`);
            throw error;
        }
    }

    /**
     * Export logs with caching strategy
     * Returns a download URL (proxy for R2/HMAC, direct for LOCAL)
     * @param baseUrl - Origin URL (e.g. url.origin) for building proxy URL when R2
     */
    async exportLogs(params: LogQueryParams & { baseUrl?: string }): Promise<string> {
        // 1. Validate Date Range (Sync limit: 30 days)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const range = (params.endTime?.getTime() || Date.now()) - (params.startTime?.getTime() || 0);
        if (range > 30 * ONE_DAY) {
            // TODO: Implement Async Job submission here
            throw new Error('Date range too large for synchronous export (Max 30 days). Please narrow your range.');
        }

        // 2. Generate Cache Key
        const cacheKey = this.generateCacheKey(params);
        const format = params.format || 'csv';
        const objectPath = `exports/logs/${cacheKey}.${format}`;

        // 3. Check Cache
        try {
            // Try to generate a download URL - if it succeeds, the file likely exists?
            const config = getStorageConfig();

            // simpler: try to get metadata
            if (config.mode === 'R2' && config.r2Bucket) {
                const metadata = await getFileMetadataFromCloudUrl(`https://${config.r2Bucket}/${objectPath}`);

                if (metadata) {
                    logger.info(`[LogService] Cache hit for ${objectPath}`);
                    return this.buildExportDownloadUrl(objectPath, format, cacheKey, params.baseUrl);
                }
            }
        } catch (e) {
            logger.warn(`[LogService] Cache check failed`, e);
        }

        // 4. Cache Miss - Query ClickHouse
        logger.info(`[LogService] Cache miss for ${objectPath}, querying ClickHouse...`);
        const { query, queryParams } = this.buildQuery(params);
        const table = 'logs_raw';

        // Use streaming output format usually, but here we buffer for simplicity in MVP 
        // (Note: For strictly massive exports, we should stream directly to GCS, but client.query returns full set. 
        //  The user mentioned 30 days limit, so buffering might be okayish if row count isn't millions. 
        //  If millions, we need streams.)

        let formatSuffix = 'JSON';
        if (format === 'csv') formatSuffix = 'CSVWithNames';

        const result = await this.client.query({
            query: `SELECT * FROM ${table} ${query} ORDER BY ${params.sortBy || 'timestamp'} ${params.sortOrder?.toUpperCase() || 'DESC'} FORMAT ${formatSuffix}`,
            query_params: queryParams,
            format: formatSuffix as any // Format is handled by the query string in some clients, but here we hint it
        });

        // 5. Upload to R2
        const stream = result.stream(); // Use stream to pipeline to R2
        const config = getStorageConfig();

        if (config.mode !== 'R2' || !config.r2Bucket) throw new Error('R2 Bucket not configured');

        // Upload utility handles streaming, multipart uploads, and retries for large exports
        const { Upload } = await import('@aws-sdk/lib-storage');
        const { getR2Client } = await import('$lib/server/storage/r2Client');

        const upload = new Upload({
            client: getR2Client(),
            params: {
                Bucket: config.r2Bucket,
                Key: objectPath,
                Body: stream,
                ContentType: format === 'csv' ? 'text/csv' : 'application/json'
            }
        });

        await upload.done();

        logger.info(`[LogService] Export uploaded to ${objectPath}`);

        // 6. Return download URL (proxy for R2, direct for LOCAL)
        return this.buildExportDownloadUrl(objectPath, format, cacheKey, params.baseUrl);
    }

    private async buildExportDownloadUrl(objectPath: string, format: string, cacheKey: string, baseUrl?: string): Promise<string> {
        const result = await convertGCloudUrlToSignedDownloadUrl(objectPath, 3600, `logs-${cacheKey}.${format}`);
        if (!result) throw new Error('HMAC required for R2. Set CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC.');
        if (result.downloadAuth && baseUrl) {
            return `${baseUrl.replace(/\/$/, '')}/api/exports/proxy?objectPath=${encodeURIComponent(objectPath)}`;
        }
        return result.downloadUrl;
    }

    private buildQuery(params: LogQueryParams): { query: string, queryParams: any } {
        const conditions: string[] = [];
        const queryParams: any = {};

        if (params.search) {
            conditions.push(`(message ILIKE {search:String})`);
            queryParams.search = `%${params.search}%`;
        }

        if (params.level) {
            conditions.push(`level = {level:String}`);
            queryParams.level = params.level;
        }

        if (params.deviceId) {
            conditions.push(`device_id = {deviceId:String}`);
            queryParams.deviceId = params.deviceId;
        }

        if (params.accountId) {
            conditions.push(`account_id = {accountId:String}`);
            queryParams.accountId = params.accountId;
        }

        if (params.userId) {
            conditions.push(`user_id = {userId:String}`);
            queryParams.userId = params.userId;
        }

        if (params.startTime) {
            conditions.push(`timestamp >= {startTime:DateTime}`);
            queryParams.startTime = Math.floor(params.startTime.getTime() / 1000); // ClickHouse DateTime is seconds typically, or DateTime64
        }

        if (params.endTime) {
            conditions.push(`timestamp <= {endTime:DateTime}`);
            queryParams.endTime = Math.floor(params.endTime.getTime() / 1000);
        }

        const query = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return { query, queryParams };
    }

    private generateCacheKey(params: LogQueryParams): string {
        // Normalize params to ensure consistent keys
        const keyParts = [
            params.search || '',
            params.level || '',
            params.deviceId || '',
            params.accountId || '',
            params.userId || '',
            params.startTime?.toISOString() || '',
            params.endTime?.toISOString() || '',
            params.sortBy || '',
            params.sortOrder || '',
            params.format || 'csv'
        ];
        return createHash('sha256').update(JSON.stringify(keyParts)).digest('hex');
    }
}

export const logService = new LogService();
