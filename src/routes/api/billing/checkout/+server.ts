/**
 * POST /api/billing/checkout
 * 
 * Creates a Stripe Checkout Session for upgrading to a paid plan.
 * Requires authentication and current account context.
 */

import { json, error } from '@sveltejs/kit';
import { getStripe } from '$lib/server/stripe';
import { requireAuth, requireAccount } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
    requireAuth(locals);
    requireAccount(locals);

    const { prisma, currentAccount, user } = locals;
    const accountId = currentAccount!.account.id;

    try {
        const { planCode, promoCode } = await request.json();

        if (!planCode) {
            throw error(400, 'planCode is required');
        }

        // Find the plan
        const plan = await prisma.plan.findUnique({
            where: { code: planCode }
        });

        if (!plan) {
            throw error(404, `Plan '${planCode}' not found`);
        }

        if (!plan.stripePriceId) {
            throw error(400, `Plan '${planCode}' is not available for purchase`);
        }

        const stripe = getStripe();
        const origin = url.origin;

        // Look up promotion code if provided
        let discounts: { promotion_code: string }[] = [];
        if (promoCode) {
            const promoCodes = await stripe.promotionCodes.list({
                code: promoCode,
                active: true
            });
            if (promoCodes.data.length > 0) {
                discounts = [{ promotion_code: promoCodes.data[0].id }];
            }
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            client_reference_id: accountId, // For webhook reconciliation
            customer_email: user!.email,
            metadata: { accountId }, // Backup binding
            subscription_data: {
                metadata: { accountId } // Also on subscription object
            },
            line_items: [{ price: plan.stripePriceId, quantity: 1 }],
            discounts: discounts.length > 0 ? discounts : undefined,
            allow_promotion_codes: discounts.length === 0, // Show input if no pre-filled code
            success_url: `${origin}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/settings/billing?canceled=true`
        });

        return json({ url: session.url });

    } catch (err) {
        if ((err as any).status) throw err; // Re-throw SvelteKit errors
        console.error('Checkout error:', err);
        throw error(500, 'Failed to create checkout session');
    }
};
