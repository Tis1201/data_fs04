import { execSync } from 'child_process';

interface SeedOptions {
    skipTestData?: boolean;
    skipRadarLogs?: boolean;
    skipCronJobs?: boolean;
    skipPinRules?: boolean;
    skipGroups?: boolean;
    dryRun?: boolean;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SeedOptions = {
    skipTestData: args.includes('--skip-test-data'),
    skipRadarLogs: args.includes('--skip-radar-logs'),
    skipCronJobs: args.includes('--skip-cron-jobs'),
    skipPinRules: args.includes('--skip-pin-rules'),
    skipGroups: args.includes('--skip-groups'),
    dryRun: args.includes('--dry-run')
};

function runScript(scriptPath: string, description: string, allowFailure = false) {
    if (options.dryRun) {
        console.log(`[DRY RUN] Would execute: ${scriptPath}`);
        return;
    }

    try {
        execSync(`tsx ${scriptPath}`, { 
            stdio: 'inherit',
            env: { ...process.env }
        });
        return true;
    } catch (error) {
        if (allowFailure) {
            console.warn(`\n⚠️  ${description} failed (non-critical, continuing...)`);
            console.warn(`   This is usually because ClickHouse is not running or not configured.`);
            return false;
        } else {
            console.error(`\n❌ Failed to run: ${description}`);
            throw error;
        }
    }
}

async function main() {
    console.log('🚀 Starting full database seed...\n');

    if (options.dryRun) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    const startTime = Date.now();
    const steps: Array<{ name: string; script: string; skip?: boolean; allowFailure?: boolean }> = [
        { name: 'System & Admin', script: 'prisma/seed.ts' },
        { name: 'Plans', script: 'scripts/seed-plans.ts' },
        { name: 'Users & Accounts', script: 'scripts/seed-users.ts' },
        { name: 'Groups & Permissions', script: 'scripts/seed-groups-permissions.ts', skip: options.skipGroups },
        { name: 'Test Data', script: 'scripts/seed-test-data.ts', skip: options.skipTestData },
        { name: 'Cron Jobs', script: 'scripts/seed-cron-jobs.ts', skip: options.skipCronJobs },
        { name: 'Pin Rules', script: 'scripts/seed-pin-rules.ts', skip: options.skipPinRules },
        { name: 'Radar Logs (ClickHouse)', script: 'scripts/seed-radar-logs.ts --hours 24 --clean', skip: options.skipRadarLogs, allowFailure: true }
    ];

    let stepNumber = 1;
    const totalSteps = steps.filter(s => !s.skip).length;

    try {
        for (const step of steps) {
            if (step.skip) {
                console.log(`\n--- ${stepNumber}. ${step.name} --- [SKIPPED]`);
                continue;
            }

            console.log(`\n--- ${stepNumber}/${totalSteps}. Seeding ${step.name} ---`);
            const success = runScript(step.script, step.name, step.allowFailure);
            if (success !== undefined && !success && !step.allowFailure) {
                throw new Error(`Failed to seed ${step.name}`);
            }
            stepNumber++;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('\n' + '='.repeat(60));
        console.log('✅✅✅ Full seed completed successfully! ✅✅✅');
        console.log(`⏱️  Total time: ${duration}s`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ Seed failed!');
        console.error('='.repeat(60));
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx scripts/seed-all.ts [options]

Options:
  --skip-test-data      Skip seeding test data (devices, controllers, etc.)
  --skip-radar-logs     Skip seeding radar logs
  --skip-cron-jobs      Skip seeding cron jobs
  --skip-pin-rules      Skip seeding pin rules
  --skip-groups         Skip seeding groups and permissions
  --dry-run             Show what would be executed without running
  --help, -h            Show this help message

Examples:
  tsx scripts/seed-all.ts
  tsx scripts/seed-all.ts --skip-test-data --skip-radar-logs
  tsx scripts/seed-all.ts --dry-run
`);
    process.exit(0);
}

main();
