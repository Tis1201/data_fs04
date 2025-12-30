import { execSync } from 'child_process';

console.log('🚀 Starting full database seed...');

try {
    // 1. Core System & Admin (prisma/seed.ts)
    console.log('\n--- 1. Seeding System & Admin ---');
    execSync('tsx prisma/seed.ts', { stdio: 'inherit' });

    // 2. Plans (seed-plans.ts)
    console.log('\n--- 2. Seeding Plans ---');
    execSync('tsx scripts/seed-plans.ts', { stdio: 'inherit' });

    // 3. Users & Accounts (seed-users.ts)
    console.log('\n--- 3. Seeding Users & Accounts ---');
    execSync('tsx scripts/seed-users.ts', { stdio: 'inherit' });

    // 4. Cron Jobs (seed-cron-jobs.ts)
    console.log('\n--- 4. Seeding Cron Jobs ---');
    execSync('tsx scripts/seed-cron-jobs.ts', { stdio: 'inherit' });

    // 5. Pin Rules (seed-pin-rules.ts)
    console.log('\n--- 5. Seeding Pin Rules ---');
    execSync('tsx scripts/seed-pin-rules.ts', { stdio: 'inherit' });

    // 6. ClickHouse Radar Logs (seed-radar-logs.ts)
    console.log('\n--- 6. Seeding Radar Logs (ClickHouse) ---');
    // Using --clean to remove old data first
    execSync('tsx scripts/seed-radar-logs.ts --hours 24 --clean', { stdio: 'inherit' });

    console.log('\n✅✅✅ Full seed completed successfully! ✅✅✅');

} catch (error) {
    console.error('\n❌ Seed failed!');
    process.exit(1);
}
