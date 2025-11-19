/**
 * Bundle processing background job
 * Handles: Bundle auto-publish scheduler, Bundle status scheduler
 * Run with: npm run bundle:process
 */

import { logger } from "$lib/server/logger";
import prisma from "$lib/server/prisma";
import { startBundleAutoPublishScheduler } from "$lib/server/scheduler/bundleScheduler";
import { startBundleStatusScheduler } from "$lib/server/scheduler/bundleStatusScheduler";
import { publishBundleCore } from "$lib/server/bundles/bundlePublisher";

export async function initializeBundleProcess() {
    logger.info('📦 Starting bundle processing background job...');

    try {
        // Start bundle auto-publish scheduler
        try {
            startBundleAutoPublishScheduler(
                prisma as any, 
                async (bundleId: string) => {
                    await publishBundleCore(prisma as any, bundleId);
                }
            );
            logger.info('✅ Bundle auto-publish scheduler started');
        } catch (e: any) {
            logger.warn(`⚠️  Failed to start auto-publish scheduler: ${e?.message || String(e)}`);
        }

        // Start bundle status scheduler (ClickHouse or file-based polling)
        try {
            await startBundleStatusScheduler();
            logger.info('✅ Bundle status scheduler started');
        } catch (e: any) {
            logger.warn(`⚠️  Failed to start bundle status scheduler: ${e?.message || String(e)}`);
        }

        logger.info('✅ Bundle processing background job initialized successfully');
    } catch (error: unknown) {
        const e = error as any;
        logger.error('❌ Error in bundle process initialization', { 
            error: e?.message, 
            stack: e?.stack 
        });
        throw error;
    }
}

