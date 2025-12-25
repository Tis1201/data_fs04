/**
 * Example Job Handler (for testing)
 * 
 * Simple job that logs a message and returns a result.
 */

import type { Job } from 'bullmq';
import { logger } from '$lib/server/logger';

export interface ExampleJobData {
    message?: string;
    delayMs?: number;
}

export interface ExampleJobResult {
    received: string;
    processedAt: string;
}

export async function exampleJob(
    data: ExampleJobData,
    job: Job<ExampleJobData, ExampleJobResult>
): Promise<ExampleJobResult> {
    const message = data.message ?? 'Hello from example job!';
    const delayMs = data.delayMs ?? 0;

    logger.info(`[Jobs/example] Processing job ${job.id}: "${message}"`);

    // Simulate work
    if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const result: ExampleJobResult = {
        received: message,
        processedAt: new Date().toISOString(),
    };

    logger.info(`[Jobs/example] Completed job ${job.id}`);
    return result;
}
