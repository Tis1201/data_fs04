
import { getClickHouseClient } from './client';
import { logger } from '$lib/server/logger';
import { createHash } from 'crypto';
import {
    generatePresignedUrl,
    handleFileUpload,
    getFileMetadataFromGcsUrl,
    getStorageConfig,
    generateDownloadUrl
} from '$lib/server/storage';
import { Storage } from '@google-cloud/storage';

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
    private client = getClickHouseClient();

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

            const total = Number(countResult.data[0].total);
            const logs = logsResult.data as LogEntry[];

            return { logs, total };
        } catch (error) {
            logger.error(`[LogService] Failed to query logs: ${error}`);
            throw error;
        }
    }

    /**
     * Export logs with caching strategy
     * Returns a signed URL to the file in GCS
     */
    async exportLogs(params: LogQueryParams): Promise<string> {
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
            // Actually storage/index.ts generateDownloadUrl doesn't strictly check existence for GCLOUD mode in all paths depending on impl
            // But getFileMetadataFromGcsUrl DOES check existence.
            const config = getStorageConfig();

            // We need to construct the full GCS URL to use the helper, or just use the object path with the helper if we modify it
            // Let's use the low-level GCS check if possible or reuse existing helpers
            // simpler: try to get metadata
            if (config.mode === 'GCLOUD' && config.bucket) {
                const storage = new Storage({ projectId: config.projectId });
                const file = storage.bucket(config.bucket).file(objectPath);
                const [exists] = await file.exists();

                if (exists) {
                    logger.info(`[LogService] Cache hit for ${objectPath}`);
                    const { url } = await generateDownloadUrl(objectPath, 3600, `logs-${cacheKey}.${format}`);
                    return url;
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

        // 5. Upload to GCS
        const stream = result.stream(); // Use stream to pipeline to GCS
        const config = getStorageConfig();

        if (!config.bucket) throw new Error('GCS Bucket not configured');

        await new Promise<void>((resolve, reject) => {
            const storage = new Storage({ projectId: config.projectId });
            const file = storage.bucket(config.bucket!).file(objectPath);
            const writeStream = file.createWriteStream({
                contentType: format === 'csv' ? 'text/csv' : 'application/json'
            });

            stream.pipe(writeStream)
                .on('finish', resolve)
                .on('error', reject);
        });

        logger.info(`[LogService] Export uploaded to ${objectPath}`);

        // 6. Return Signed URL
        const { url } = await generateDownloadUrl(objectPath, 3600, `logs-${new Date().toISOString()}.${format}`);
        return url;
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
