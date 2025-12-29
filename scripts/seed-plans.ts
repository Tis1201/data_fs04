/**
 * Seed Default Subscription Plans
 * 
 * Run with: npx tsx scripts/seed-plans.ts
 * 
 * Seeds the database with default billing plans.
 * Uses upsert by `code` to ensure idempotent execution.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default plans - use stable `code` as lookup key (never use display name for logic)
const defaultPlans = [
    {
        code: 'free',
        name: 'Free Tier',
        stripeProductId: null, // No Stripe product for free tier
        stripePriceId: null,
        isActive: true,
        maxDevices: 5,
        maxUsers: 1,
        dataRetentionDays: 7,
        features: ['basic_support']
    },
    {
        code: 'pro',
        name: 'Pro Plan',
        stripeProductId: null, // To be filled after Stripe setup
        stripePriceId: null,
        isActive: true,
        maxDevices: 50,
        maxUsers: 5,
        dataRetentionDays: 30,
        features: ['priority_support', 'email_alerts']
    },
    {
        code: 'enterprise',
        name: 'Enterprise',
        stripeProductId: null, // To be filled after Stripe setup
        stripePriceId: null,
        isActive: true,
        maxDevices: 999999, // Unlimited
        maxUsers: 999999, // Unlimited
        dataRetentionDays: 365,
        features: ['sso', 'audit_logs', 'sla', 'white_label']
    }
];

async function seedPlans() {
    console.log('🌱 Seeding default Plans...');

    for (const plan of defaultPlans) {
        const result = await prisma.plan.upsert({
            where: { code: plan.code },
            create: {
                code: plan.code,
                name: plan.name,
                stripeProductId: plan.stripeProductId,
                stripePriceId: plan.stripePriceId,
                isActive: plan.isActive,
                maxDevices: plan.maxDevices,
                maxUsers: plan.maxUsers,
                dataRetentionDays: plan.dataRetentionDays,
                features: JSON.stringify(plan.features)
            },
            update: {
                // Update limits and features on re-run, keep code/name stable
                name: plan.name,
                maxDevices: plan.maxDevices,
                maxUsers: plan.maxUsers,
                dataRetentionDays: plan.dataRetentionDays,
                features: JSON.stringify(plan.features)
            }
        });
        console.log(`  ✅ ${result.code}: ${result.name} (Devices: ${result.maxDevices}, Users: ${result.maxUsers})`);
    }

    console.log(`\n✨ Seeded ${defaultPlans.length} Plans`);
}

seedPlans()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
