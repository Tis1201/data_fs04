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
// Pricing: Free, Starter $199/mo, Business $499/mo, Enterprise (contact sales)
const defaultPlans = [
    {
        code: 'free',
        name: 'Free',
        stripeProductId: null, // No Stripe product for free tier
        stripePriceId: null,
        isActive: true,
        maxDevices: 5,
        maxUsers: 5,
        maxLogLinesPerMonth: 10000, // 10K logs/month
        dataRetentionDays: 7,
        features: ['basic_support']
    },
    {
        code: 'starter',
        name: 'Starter',
        stripeProductId: null, // To be filled after Stripe setup: $199/mo
        stripePriceId: null,
        isActive: true,
        maxDevices: 50,
        maxUsers: 10,
        maxLogLinesPerMonth: 500000, // 500K logs/month
        dataRetentionDays: 14,
        features: ['priority_support', 'email_alerts', 'api_access']
    },
    {
        code: 'business',
        name: 'Business',
        stripeProductId: null, // To be filled after Stripe setup: $499/mo
        stripePriceId: null,
        isActive: true,
        maxDevices: 1000,
        maxUsers: 50,
        maxLogLinesPerMonth: 5000000, // 5M logs/month
        dataRetentionDays: 30,
        features: ['priority_support', 'email_alerts', 'api_access', 'phone_support', 'custom_integrations']
    },
    {
        code: 'enterprise',
        name: 'Enterprise',
        stripeProductId: null, // Contact sales - custom pricing
        stripePriceId: null,
        isActive: true,
        maxDevices: 999999, // Unlimited
        maxUsers: 999999, // Unlimited
        maxLogLinesPerMonth: 999999999, // Unlimited
        dataRetentionDays: 365,
        features: ['sso', 'audit_logs', 'sla', 'white_label', 'dedicated_support', 'custom_integrations', 'on_premise']
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
                maxLogLinesPerMonth: plan.maxLogLinesPerMonth,
                dataRetentionDays: plan.dataRetentionDays,
                features: JSON.stringify(plan.features)
            },
            update: {
                // Update limits and features on re-run, keep code/name stable
                name: plan.name,
                maxDevices: plan.maxDevices,
                maxUsers: plan.maxUsers,
                maxLogLinesPerMonth: plan.maxLogLinesPerMonth,
                dataRetentionDays: plan.dataRetentionDays,
                features: JSON.stringify(plan.features)
            }
        });
        console.log(`  ✅ ${result.code}: ${result.name} (Devices: ${result.maxDevices}, Users: ${result.maxUsers}, Logs: ${result.maxLogLinesPerMonth}/mo)`);
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
