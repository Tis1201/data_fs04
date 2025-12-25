/**
 * Background Job System - Type Definitions
 * 
 * Shared types for job handlers, registry, and worker.
 */

import type { Job as BullJob } from 'bullmq';

/** Handler function signature for all job types */
export type JobHandler<TData = unknown, TResult = unknown> = (
    data: TData,
    job: BullJob<TData, TResult>
) => Promise<TResult>;

/** Registry entry with metadata */
export interface RegisteredJob<TData = unknown, TResult = unknown> {
    handler: JobHandler<TData, TResult>;
    description?: string;
}

/** Job status for API responses (simplified) */
export type JobStatus = 'pending' | 'active' | 'completed' | 'failed';

/** API response for job status polling */
export interface JobStatusResponse {
    id: string;
    status: JobStatus;
    progress?: number;
    result?: unknown;
    error?: string;
    createdAt?: Date;
    finishedAt?: Date;
}

/** Options for adding async jobs */
export interface AddJobOptions {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete?: boolean | { age: number } | { count: number };
    removeOnFail?: boolean | { count: number };
}

/** CronJob sync data passed to the job */
export interface CronJobData {
    cronJobId: string;
    args?: Record<string, unknown>;
}
