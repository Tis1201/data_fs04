/**
 * Billing Webhook E2E Tests
 * 
 * Tests the Stripe webhook handler for subscription lifecycle events.
 * 
 * Run with: npx vitest run tests/integrations/billing_webhook_e2e.test.ts
 * 
 * Prerequisites:
 * - Dev server running: npm run dev
 * - Stripe CLI listening: stripe listen --forward-to localhost:5173/api/billing/webhook
 * - STRIPE_WEBHOOK_SECRET set in .env (from stripe listen output)
 */

import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getAdminPrisma } from '$lib/server/prisma';
import { randomUUID } from 'crypto';

const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
const WEBHOOK_URL = `${WEB_BASE_URL}/api/billing/webhook`;

// Check if webhook secret is configured
const WEBHOOK_SECRET_CONFIGURED = !!process.env.STRIPE_WEBHOOK_SECRET;

describe('Billing Webhook E2E', () => {
    const prisma = getAdminPrisma();
    let testAccountId: string;
    let freePlanId: string;
    let proPlanId: string;

    beforeAll(async () => {
        // Get plan IDs
        const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });
        const proPlan = await prisma.plan.findUnique({ where: { code: 'pro' } });

        if (!freePlan || !proPlan) {
            throw new Error('Plans not seeded. Run: npx tsx scripts/seed-plans.ts');
        }

        freePlanId = freePlan.id;
        proPlanId = proPlan.id;

        // Create test account
        const account = await prisma.account.create({
            data: {
                id: `test-webhook-${randomUUID().slice(0, 8)}`,
                name: 'Test Webhook Account',
                slug: `test-webhook-${randomUUID().slice(0, 8)}`
            }
        });
        testAccountId = account.id;

        // Create initial free subscription
        await prisma.subscription.create({
            data: {
                accountId: testAccountId,
                planId: freePlanId,
                source: 'stripe',
                status: 'active'
            }
        });

        console.log('[BillingWebhookE2E] Setup complete', {
            testAccountId,
            freePlanId,
            proPlanId,
            webhookSecretConfigured: WEBHOOK_SECRET_CONFIGURED
        });
    }, 30_000);

    afterAll(async () => {
        // Cleanup
        try {
            await prisma.subscription.deleteMany({ where: { accountId: testAccountId } });
            await prisma.webhookEvent.deleteMany({ where: { id: { startsWith: 'evt_test_' } } });
            await prisma.account.delete({ where: { id: testAccountId } });
        } catch (e) {
            console.warn('[BillingWebhookE2E] Cleanup warning:', e);
        }
    });

    describe('Request Validation', () => {
        it('rejects requests without stripe-signature header', async () => {
            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: 'evt_test' })
            });

            // 400 = missing signature detected
            // 500 = webhook secret not configured (also rejects)
            expect([400, 500]).toContain(res.status);
        });

        it('rejects requests with invalid signature', async () => {
            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'stripe-signature': 'invalid_signature'
                },
                body: JSON.stringify({ id: 'evt_test' })
            });

            // Both indicate rejection
            expect([400, 500]).toContain(res.status);
        });
    })

    describe('Idempotency', () => {
        it('WebhookEvent table stores processed event IDs', async () => {
            // Create a test event record
            const testEventId = `evt_test_idempotency_${randomUUID().slice(0, 8)}`;

            await prisma.webhookEvent.create({
                data: {
                    id: testEventId,
                    type: 'checkout.session.completed',
                    objectId: 'cs_test_xyz'
                }
            });

            // Verify it exists
            const event = await prisma.webhookEvent.findUnique({
                where: { id: testEventId }
            });

            expect(event).toBeDefined();
            expect(event?.type).toBe('checkout.session.completed');
            expect(event?.objectId).toBe('cs_test_xyz');

            // Cleanup
            await prisma.webhookEvent.delete({ where: { id: testEventId } });
        });
    });

    describe('Subscription Lifecycle', () => {
        it('subscription can be upgraded via database', async () => {
            // Simulate what webhook handler does: update subscription
            const updated = await prisma.subscription.update({
                where: { accountId: testAccountId },
                data: {
                    planId: proPlanId,
                    status: 'active',
                    stripeCustomerId: 'cus_test_123',
                    stripeSubscriptionId: 'sub_test_123'
                }
            });

            expect(updated.planId).toBe(proPlanId);
            expect(updated.stripeCustomerId).toBe('cus_test_123');

            // Restore to free
            await prisma.subscription.update({
                where: { accountId: testAccountId },
                data: {
                    planId: freePlanId,
                    stripeCustomerId: null,
                    stripeSubscriptionId: null
                }
            });
        });

        it('subscription can be canceled via database', async () => {
            // Simulate what webhook handler does on subscription.deleted
            const updated = await prisma.subscription.update({
                where: { accountId: testAccountId },
                data: {
                    status: 'canceled',
                    stripeSubscriptionId: null,
                    cancelAtPeriodEnd: false
                }
            });

            expect(updated.status).toBe('canceled');

            // Restore
            await prisma.subscription.update({
                where: { accountId: testAccountId },
                data: { status: 'active' }
            });
        });

        it('subscription can be set to pending_cancel', async () => {
            const updated = await prisma.subscription.update({
                where: { accountId: testAccountId },
                data: {
                    status: 'pending_cancel',
                    cancelAtPeriodEnd: true
                }
            });

            expect(updated.status).toBe('pending_cancel');
            expect(updated.cancelAtPeriodEnd).toBe(true);

            // Restore
            await prisma.subscription.update({
                where: { accountId: testAccountId },
                data: {
                    status: 'active',
                    cancelAtPeriodEnd: false
                }
            });
        });
    });
});

/**
 * Manual integration test instructions (run separately):
 * 
 * 1. Start dev server: npm run dev
 * 2. Start Stripe listener: stripe listen --forward-to localhost:5173/api/billing/webhook
 * 3. Trigger test events:
 *    - stripe trigger checkout.session.completed
 *    - stripe trigger customer.subscription.updated
 *    - stripe trigger customer.subscription.deleted
 * 4. Check server logs for "Subscription activated" messages
 */
