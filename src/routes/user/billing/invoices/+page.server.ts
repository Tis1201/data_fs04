import type { PageServerLoad } from './$types';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';
import { getStripe } from '$lib/server/stripe';
import { error } from '@sveltejs/kit';

export const load = restrictAccountRole(
    async ({ locals, accountMembership }: AccountAuthenticatedEvent) => {
        const { prisma } = locals;
        const { accountId } = accountMembership;

        // Get subscription to find stripeCustomerId
        const subscription = await prisma.subscription.findUnique({
            where: { accountId }
        });

        if (!subscription?.stripeCustomerId) {
            return { invoices: [] };
        }

        const stripe = getStripe();
        try {
            const invoices = await stripe.invoices.list({
                customer: subscription.stripeCustomerId,
                limit: 24,
                expand: ['data.subscription']
            });

            return {
                invoices: invoices.data.map(i => ({
                    id: i.id,
                    amount_due: i.amount_due,
                    amount_paid: i.amount_paid,
                    currency: i.currency,
                    status: i.status,
                    created: i.created,
                    hosted_invoice_url: i.hosted_invoice_url,
                    pdf: i.invoice_pdf,
                    number: i.number
                }))
            };
        } catch (e) {
            console.error('Failed to fetch user invoices:', e);
            throw error(500, 'Failed to fetch invoices');
        }
    },
    ['OWNER'] // Only owners can see invoices
) satisfies PageServerLoad;
