import type { PageServerLoad } from './$types';
import prisma from '$lib/server/prisma';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { error } from '@sveltejs/kit';

export const load = restrict(
    async ({ params }: AuthenticatedEvent) => {
        const subscription = await prisma.subscription.findUnique({
            where: { id: params.id },
            include: {
                plan: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        maxDevices: true,
                        maxUsers: true,
                        maxLogLinesPerMonth: true,
                        dataRetentionDays: true,
                        features: true
                    }
                },
                account: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        status: true,
                        createdAt: true,
                        _count: {
                            select: {
                                members: true,
                                devices: true
                            }
                        }
                    }
                }
            }
        });

        if (!subscription) {
            throw error(404, 'Subscription not found');
        }

        // Fetch billing history / invoices from Stripe if available
        let invoices: any[] = [];
        if (subscription.stripeCustomerId) {
            try {
                // Import Stripe and fetch invoices
                const { default: Stripe } = await import('stripe');
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
                    apiVersion: '2025-02-24.acacia'
                });

                const stripeInvoices = await stripe.invoices.list({
                    customer: subscription.stripeCustomerId,
                    limit: 10
                });

                invoices = stripeInvoices.data.map(inv => ({
                    id: inv.id,
                    number: inv.number,
                    status: inv.status,
                    amount: inv.amount_paid / 100, // Convert from cents
                    currency: inv.currency?.toUpperCase() || 'USD',
                    paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : null,
                    periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
                    periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
                    hostedUrl: inv.hosted_invoice_url,
                    pdfUrl: inv.invoice_pdf
                }));
            } catch (e) {
                console.error('Failed to fetch Stripe invoices:', e);
                // Continue without invoices
            }
        }

        // Calculate effective limits (with overrides)
        const effectiveLimits = {
            maxDevices: subscription.overrideMaxDevices ?? subscription.plan.maxDevices,
            maxUsers: subscription.overrideMaxUsers ?? subscription.plan.maxUsers,
            maxLogLinesPerMonth: subscription.plan.maxLogLinesPerMonth,
            dataRetentionDays: subscription.plan.dataRetentionDays
        };

        return {
            subscription: {
                id: subscription.id,
                status: subscription.status,
                source: subscription.source,
                createdAt: subscription.createdAt,
                updatedAt: subscription.updatedAt,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                trialEndsAt: subscription.trialEndsAt,
                licenseKey: subscription.licenseKey,
                licenseExpiresAt: subscription.licenseExpiresAt,
                stripeCustomerId: subscription.stripeCustomerId,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                overrideMaxDevices: subscription.overrideMaxDevices,
                overrideMaxUsers: subscription.overrideMaxUsers
            },
            account: {
                id: subscription.account.id,
                name: subscription.account.name,
                slug: subscription.account.slug,
                status: subscription.account.status,
                createdAt: subscription.account.createdAt,
                memberCount: subscription.account._count.members,
                deviceCount: subscription.account._count.devices
            },
            plan: {
                id: subscription.plan.id,
                code: subscription.plan.code,
                name: subscription.plan.name,
                maxDevices: subscription.plan.maxDevices,
                maxUsers: subscription.plan.maxUsers,
                maxLogLinesPerMonth: subscription.plan.maxLogLinesPerMonth,
                dataRetentionDays: subscription.plan.dataRetentionDays,
                features: subscription.plan.features as string[]
            },
            effectiveLimits,
            invoices
        };
    },
    ['ADMIN']
) satisfies PageServerLoad;
