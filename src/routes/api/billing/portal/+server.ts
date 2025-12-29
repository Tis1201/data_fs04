/**
 * POST /api/billing/portal
 * 
 * Creates a Stripe Customer Portal session for managing subscription.
 * User can update payment method, view invoices, or cancel subscription.
 */

import { json, error } from '@sveltejs/kit';
import { getStripe } from '$lib/server/stripe';
import { requireAuth, requireAccount } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, url }) => {
    requireAuth(locals);
    requireAccount(locals);

    const { prisma, currentAccount } = locals;
    const accountId = currentAccount!.account.id;

    try {
        // Get subscription for this account
        const subscription = await prisma.subscription.findUnique({
            where: { accountId }
        });

        if (!subscription?.stripeCustomerId) {
            throw error(400, 'No billing information found. Please upgrade first.');
        }

        const stripe = getStripe();
        const origin = url.origin;

        // Create Portal Session
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: `${origin}/settings/billing`
        });

        return json({ url: session.url });

    } catch (err) {
        if ((err as any).status) throw err;
        console.error('Portal error:', err);
        throw error(500, 'Failed to create portal session');
    }
};
