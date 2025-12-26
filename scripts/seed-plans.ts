/**
 * Seed Default Subscription Plans
 * 
 * Run with: npx tsx scripts/seed-plans.ts
 * 
 * Seeds the database with default billing plans.
 * Uses upsert to avoid duplicates.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default plans
const defaultPlans = [
    {
        name: 'Free Tier',
        stripeProductId: 'prod_free_placeholder',
        isActive: true,
        maxDevices: 5,
        maxUsers: 1,
        dataRetentionDays: 7,
        features: ['basic_support']
    },
    {
        name: 'Pro Tier',
        stripeProductId: null, // To be filled after Stripe setup
        isActive: true,
        maxDevices: 50,
        maxUsers: 5,
        dataRetentionDays: 30,
        features: ['priority_support', 'email_alerts']
    },
    {
        name: 'Enterprise',
        stripeProductId: null, // To be filled after Stripe setup
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
        // We use name as a pseudo-unique key for seeding if stripeProductId is null
        // Ideally, in prod, we match by stripeProductId

        // Find existing plan by name to get ID, or create new
        const existing = await prisma.plan.findFirst({
            where: { name: plan.name }
        });

        const result = await prisma.plan.upsert({
            where: {
                id: existing?.id ?? `seed-${plan.name.replace(/\s+/g, '-').toLowerCase()}`
            },
            create: {
                id: `seed-${plan.name.replace(/\s+/g, '-').toLowerCase()}`,
                name: plan.name,
                stripeProductId: plan.stripeProductId,
                isActive: plan.isActive,
                maxDevices: plan.maxDevices,
                maxUsers: plan.maxUsers,
                dataRetentionDays: plan.dataRetentionDays,
                features: JSON.stringify(plan.features)
            },
            update: {
                // Update limits and features, but keep ID stable
                maxDevices: plan.maxDevices,
                maxUsers: plan.maxUsers,
                dataRetentionDays: plan.dataRetentionDays,
                features: JSON.stringify(plan.features)
            }
        });
        console.log(`  ✅ ${result.name} (Devices: ${result.maxDevices})`);
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
