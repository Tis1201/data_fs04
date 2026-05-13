/**
 * Seed Default System CronJobs
 * 
 * Run with: npx tsx scripts/seed-cron-jobs.ts
 * 
 * Seeds the database with default system cron jobs.
 * Uses upsert to avoid duplicates.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default system cron jobs
const defaultCronJobs = [
    {
        name: 'Cleanup Expired Tokens',
        functionName: 'system:cleanup-tokens',
        cronExpression: '0 0 * * *', // Daily at midnight
        timezone: 'UTC',
        status: 'ACTIVE',
        maxRetries: 3,
        args: { olderThanDays: 30 }
    },
    {
        name: 'Bundle Status Check',
        functionName: 'system:bundle-status-check',
        cronExpression: '*/15 * * * *', // Every 15 minutes
        timezone: 'UTC',
        status: 'INACTIVE', // Inactive until handler is implemented
        maxRetries: 2,
        args: null
    },
    {
        name: 'GCloud Orphan Cleanup',
        functionName: 'system:gcloud-cleanup',
        cronExpression: '0 3 * * 0', // Weekly on Sunday at 3am
        timezone: 'UTC',
        status: 'INACTIVE', // Inactive until handler is implemented
        maxRetries: 2,
        args: { dryRun: false }
    },
    {
        name: 'Device Presence Reconcile',
        functionName: 'system:device-presence-reconcile',
        cronExpression: '*/5 * * * *', // Every 5 minutes
        timezone: 'UTC',
        status: 'INACTIVE', // Inactive until handler is implemented
        maxRetries: 1,
        args: null
    }
];

async function seedCronJobs() {
    console.log('🌱 Seeding default CronJobs...');

    for (const job of defaultCronJobs) {
        const result = await prisma.cronJob.upsert({
            where: {
                // Use a composite unique - we'll match by functionName since it's unique per job type
                id: `seed-${job.functionName.replace(':', '-')}`
            },
            create: {
                id: `seed-${job.functionName.replace(':', '-')}`,
                ...job
            },
            update: {
                // Only update name and args, preserve user changes to schedule/status
                name: job.name
            }
        });
        console.log(`  ✅ ${result.name} (${result.status})`);
    }

    console.log(`\n✨ Seeded ${defaultCronJobs.length} CronJobs`);
}

seedCronJobs()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
