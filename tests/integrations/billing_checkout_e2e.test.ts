/**
 * Billing Checkout & Portal API Tests
 * 
 * Tests API validation and error handling.
 * Uses Prisma directly for setup - no login required for most tests.
 * 
 * Run with: npx vitest run tests/integrations/billing_checkout_e2e.test.ts
 */

import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getAdminPrisma } from '$lib/server/prisma';
import { randomUUID } from 'crypto';

const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
const CHECKOUT_URL = `${WEB_BASE_URL}/api/billing/checkout`;
const PORTAL_URL = `${WEB_BASE_URL}/api/billing/portal`;

describe('Billing Checkout & Portal E2E', () => {
    const prisma = getAdminPrisma();
    let testAccountId: string;
    let freePlanId: string;

    beforeAll(async () => {
        // Get plan IDs from database
        const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });
        if (!freePlan) {
            throw new Error('Plans not seeded. Run: npx tsx scripts/seed-plans.ts');
        }
        freePlanId = freePlan.id;

        // Create a test account with subscription for validation tests
        const account = await prisma.account.create({
            data: {
                id: `test-checkout-${randomUUID().slice(0, 8)}`,
                name: 'Test Checkout Account',
                slug: `test-checkout-${randomUUID().slice(0, 8)}`
            }
        });
        testAccountId = account.id;

        // Create subscription for this account
        await prisma.subscription.create({
            data: {
                accountId: testAccountId,
                planId: freePlanId,
                source: 'stripe',
                status: 'active'
            }
        });

        console.log('[BillingCheckoutE2E] Setup complete', { testAccountId, freePlanId });
    }, 30_000);

    afterAll(async () => {
        // Cleanup
        try {
            await prisma.subscription.deleteMany({ where: { accountId: testAccountId } });
            await prisma.account.delete({ where: { id: testAccountId } });
        } catch (e) {
            console.warn('[BillingCheckoutE2E] Cleanup warning:', e);
        }
    });

    describe('POST /api/billing/checkout', () => {
        it('rejects unauthenticated requests with 401', async () => {
            const res = await fetch(CHECKOUT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planCode: 'pro' })
            });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/billing/portal', () => {
        it('rejects unauthenticated requests with 401', async () => {
            const res = await fetch(PORTAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            expect(res.status).toBe(401);
        });
    });

    describe('Database State', () => {
        it('test account has free plan subscription', async () => {
            const sub = await prisma.subscription.findUnique({
                where: { accountId: testAccountId },
                include: { plan: true }
            });

            expect(sub).toBeDefined();
            expect(sub?.plan.code).toBe('free');
            expect(sub?.status).toBe('active');
            expect(sub?.source).toBe('stripe');
        });

        it('plans are properly seeded', async () => {
            const plans = await prisma.plan.findMany({
                where: { isActive: true },
                orderBy: { maxDevices: 'asc' }
            });

            expect(plans.length).toBeGreaterThanOrEqual(3);

            const codes = plans.map(p => p.code);
            expect(codes).toContain('free');
            expect(codes).toContain('pro');
            expect(codes).toContain('enterprise');
        });
    });
});
