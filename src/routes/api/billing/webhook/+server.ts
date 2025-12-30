/**
 * POST /api/billing/webhook
 * 
 * Handles Stripe webhook events for subscription lifecycle.
 * Verifies signature, ensures idempotency, and updates local database.
 */

import { json } from '@sveltejs/kit';
import type Stripe from 'stripe';
import { getStripe, getWebhookSecret } from '$lib/server/stripe';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import redis from '$lib/server/redis';
import type { RequestEvent } from '@sveltejs/kit';

// Cache TTL for entitlements (5 minutes)
const CACHE_TTL = 300;

/**
 * Invalidate entitlement cache when subscription changes
 */
async function invalidateEntitlements(accountId: string): Promise<void> {
    if (redis) {
        await redis.del(`entitlements:${accountId}`);
        logger.info(`Invalidated entitlements cache for account ${accountId}`);
    }
}

/**
 * Handle checkout.session.completed - New subscription created
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const accountId = session.client_reference_id ?? session.metadata?.accountId;

    if (!accountId) {
        logger.error('checkout.session.completed: No accountId found', { sessionId: session.id });
        throw new Error('No accountId in session');
    }

    const stripe = getStripe();
    const subscriptionId = session.subscription as string;

    if (!subscriptionId) {
        logger.warn('checkout.session.completed: No subscription (one-time payment?)', { sessionId: session.id });
        return;
    }

    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = stripeSub.items.data[0].price.id;

    // Find matching plan by price ID
    const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });

    if (!plan) {
        logger.error('checkout.session.completed: No plan found for price', { priceId });
        throw new Error(`No plan found for price ${priceId}`);
    }

    // Upsert subscription (create if not exists, update if exists)
    await prisma.subscription.upsert({
        where: { accountId },
        create: {
            accountId,
            planId: plan.id,
            source: 'stripe',
            status: stripeSub.status,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null
        },
        update: {
            planId: plan.id,
            source: 'stripe',
            status: stripeSub.status,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null
        }
    });

    await invalidateEntitlements(accountId);
    logger.info('checkout.session.completed: Subscription activated', { accountId, planCode: plan.code });
}

/**
 * Handle customer.subscription.updated - Plan change, cancellation, etc.
 */
async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id }
    });

    if (!sub) {
        logger.warn('subscription.updated: No local subscription found', { stripeSubId: stripeSub.id });
        return;
    }

    const priceId = stripeSub.items.data[0].price.id;
    const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });

    // Determine status (pending_cancel is our custom status for cancel_at_period_end)
    const status = stripeSub.cancel_at_period_end ? 'pending_cancel' : stripeSub.status;

    await prisma.subscription.update({
        where: { id: sub.id },
        data: {
            planId: plan?.id ?? sub.planId,
            status,
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null
        }
    });

    await invalidateEntitlements(sub.accountId);
    logger.info('subscription.updated: Subscription updated', { accountId: sub.accountId, status });
}

/**
 * Handle customer.subscription.deleted - Subscription ended
 */
async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
    const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id }
    });

    if (!sub) {
        logger.warn('subscription.deleted: No local subscription found', { stripeSubId: stripeSub.id });
        return;
    }

    // Downgrade to free plan
    const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });

    await prisma.subscription.update({
        where: { id: sub.id },
        data: {
            planId: freePlan?.id ?? sub.planId,
            status: 'canceled',
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false
        }
    });

    await invalidateEntitlements(sub.accountId);
    logger.info('subscription.deleted: Downgraded to free', { accountId: sub.accountId });
}

/**
 * Handle invoice.payment_failed - Payment issue
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.warn('invoice.payment_failed', {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amountDue: invoice.amount_due
    });
    // TODO: Send notification email to account owner
}

export const POST = async ({ request }: RequestEvent) => {
    const stripe = getStripe();
    const payload = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig) {
        logger.warn('Webhook: Missing stripe-signature header');
        return json({ error: 'Missing signature' }, { status: 400 });
    }

    // 1. Verify signature
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(payload, sig, getWebhookSecret());
    } catch (err) {
        logger.error('Webhook signature verification failed', { error: (err as Error).message });
        return json({ error: 'Invalid signature' }, { status: 400 });
    }

    // 2. Idempotency check - prevent double-processing
    const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
    if (existing) {
        logger.debug('Webhook: Already processed', { eventId: event.id });
        return json({ received: true, message: 'Already processed' });
    }

    // 3. Handle event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;
            default:
                logger.debug('Webhook: Unhandled event type', { type: event.type });
        }

        // 4. Mark as processed
        await prisma.webhookEvent.create({
            data: {
                id: event.id,
                type: event.type,
                objectId: (event.data.object as any).id
            }
        });

    } catch (err) {
        logger.error('Webhook handler error', {
            eventType: event.type,
            error: (err as Error).message
        });
        return json({ error: 'Handler error' }, { status: 500 });
    }

    return json({ received: true });
};
