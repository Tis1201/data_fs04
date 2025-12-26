/**
 * Job Worker E2E Test
 * 
 * Tests the background job system including:
 * - Job registry
 * - Adding jobs to queue
 * - Worker processing
 * - CronJob sync
 */

import 'dotenv/config';
import { beforeAll, describe, expect, it, afterAll, vi, beforeEach } from 'vitest';
import { getAdminPrisma } from '$lib/server/prisma';
import { registerJob, getHandler, hasHandler, listRegisteredJobs } from '$lib/server/jobs/registry';
import { addJob, getJobById, getQueue } from '$lib/server/jobs/client';
import { syncCronJobs } from '$lib/server/jobs/cron-sync';
import type { Job } from 'bullmq';

// Skip tests if Redis is not available
const hasRedis = !!process.env.REDIS_HOST || !!process.env.REDIS_URL;

describe.skipIf(!hasRedis)('Job Worker E2E', () => {
    const prisma = getAdminPrisma();
    let testCronJobId: string;

    beforeAll(async () => {
        // Clean up any leftover test data
        await prisma.cronJob.deleteMany({
            where: { name: { startsWith: 'Test Job' } }
        });
    });

    afterAll(async () => {
        // Cleanup
        try {
            if (testCronJobId) {
                await prisma.cronJob.delete({ where: { id: testCronJobId } });
            }
            // Drain the test queue
            const queue = getQueue();
            await queue.drain();
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe('Registry', () => {
        it('should register and retrieve a job handler', () => {
            const testHandler = async (data: { msg: string }, job: Job) => {
                return { echo: data.msg };
            };

            registerJob('test:registry-test', testHandler, 'Test handler');

            expect(hasHandler('test:registry-test')).toBe(true);
            expect(hasHandler('nonexistent:job')).toBe(false);

            const handler = getHandler('test:registry-test');
            expect(handler).toBe(testHandler);
        });

        it('should list all registered jobs', () => {
            const jobs = listRegisteredJobs();
            expect(Array.isArray(jobs)).toBe(true);
            expect(jobs.length).toBeGreaterThan(0);

            // Check that our test handler is listed
            const testJob = jobs.find(j => j.name === 'test:registry-test');
            expect(testJob).toBeDefined();
            expect(testJob?.description).toBe('Test handler');
        });

        it('should have system handlers pre-registered', () => {
            expect(hasHandler('system:cleanup-tokens')).toBe(true);
            expect(hasHandler('test:example')).toBe(true);
        });
    });

    describe('Queue Client', () => {
        it('should add a job to the queue', async () => {
            const job = await addJob('test:example', { message: 'Hello from test' });

            expect(job).toBeDefined();
            expect(job.id).toBeDefined();
            expect(job.name).toBe('test:example');
            expect(job.data).toEqual({ message: 'Hello from test' });
        });

        it('should retrieve job by ID', async () => {
            const addedJob = await addJob('test:example', { message: 'test retrieve' });

            const retrieved = await getJobById(addedJob.id!);
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(addedJob.id);
            expect(retrieved?.data).toEqual({ message: 'test retrieve' });
        });
    });

    describe('CronJob Sync', () => {
        it('should create a CronJob in DB', async () => {
            const cronJob = await prisma.cronJob.create({
                data: {
                    name: 'Test Job - E2E',
                    functionName: 'test:example',
                    cronExpression: '0 0 1 1 *', // Once a year (to avoid triggering)
                    status: 'ACTIVE',
                    args: { message: 'scheduled test' }
                }
            });
            testCronJobId = cronJob.id;

            expect(cronJob.id).toBeDefined();
            expect(cronJob.status).toBe('ACTIVE');
        });

        it('should sync CronJobs to BullMQ', async () => {
            // This should not throw
            await syncCronJobs();

            // Verify the scheduler was created
            const queue = getQueue();
            const schedulers = await queue.getJobSchedulers();

            // BullMQ stores scheduler ID in the 'key' property
            const ourScheduler = schedulers.find(s => s.key === testCronJobId);
            expect(ourScheduler).toBeDefined();
            expect(ourScheduler?.name).toBe('test:example');
        });

        it('should remove inactive CronJob from scheduler', async () => {
            // Mark as inactive
            await prisma.cronJob.update({
                where: { id: testCronJobId },
                data: { status: 'INACTIVE' }
            });

            // Sync again
            await syncCronJobs();

            // Verify scheduler was removed
            const queue = getQueue();
            const schedulers = await queue.getJobSchedulers();

            const ourScheduler = schedulers.find(s => s.id === testCronJobId);
            expect(ourScheduler).toBeUndefined();
        });
    });
});
