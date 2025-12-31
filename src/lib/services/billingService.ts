/**
 * Billing Service
 * 
 * Reusable client-side functions for Stripe integration.
 * Follows DRY/KISS principles - single source of truth for billing API calls.
 */

export interface CheckoutResult {
    url: string;
}

export interface PortalResult {
    url: string;
}

export interface BillingError {
    message: string;
    status: number;
}

/**
 * Start a Stripe Checkout session for upgrading to a paid plan.
 * Redirects to Stripe Checkout on success.
 */
export async function startCheckout(planCode: string, promoCode?: string): Promise<CheckoutResult> {
    const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode, promoCode })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Checkout failed' }));
        throw new Error(error.message || `Checkout failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Open Stripe Customer Portal for managing subscription.
 * Allows viewing invoices, updating payment method, canceling.
 */
export async function openBillingPortal(): Promise<PortalResult> {
    const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Portal access failed' }));
        throw new Error(error.message || `Portal access failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Helper to redirect to Stripe URL
 */
export function redirectToStripe(url: string): void {
    window.location.href = url;
}
