/**
 * Stripe Client Configuration (Singleton)
 * 
 * Provides a configured Stripe client instance for server-side operations.
 * Uses environment variables for configuration.
 */

import Stripe from 'stripe';
import { logger } from '$lib/server/logger';

// Use Node.js environment check
const dev = process.env.NODE_ENV !== 'production';

// Global instance for development to prevent multiple connections
declare global {
    var stripeClient: Stripe | undefined;
}

function createStripeClient(): Stripe | null {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        logger.warn('Stripe client not created - STRIPE_SECRET_KEY not found');
        return null;
    }

    logger.info('Creating Stripe client');

    return new Stripe(secretKey, {
        typescript: true
    });
}

// Use singleton pattern
const stripe = global.stripeClient || createStripeClient();

// In development, save to global to prevent multiple instances
if (dev && stripe) {
    global.stripeClient = stripe;
}

export default stripe;

/**
 * Get the Stripe client, throwing if not configured
 */
export function getStripe(): Stripe {
    if (!stripe) {
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }
    return stripe;
}

/**
 * Webhook secret for signature verification
 */
export function getWebhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return secret;
}
