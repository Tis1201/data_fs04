# Subscription & Billing System Design

## Design Rationale

> [!NOTE]
> **Why this architecture?**
> 1. **Billing ≠ Entitlements**: Stripe is the source of truth for *payments*; your platform is the source of truth for *what users can do*. This separation lets you handle edge cases (grace periods, enterprise deals, offline licenses) without hacking Stripe.
> 2. **Database-First Entitlements**: Limits live in DB columns (`maxDevices`), not config files. Sales can create custom deals via `overrideMaxDevices` without deploying code.
> 3. **Unified Subscription Model**: Both SaaS (Stripe) and Self-Hosted (License Key) flow into the same `Subscription` table. Business logic only checks `getEntitlements()`.

---

## Overview

This document outlines the design for implementing subscriptions, plans, and entitlement enforcement for the FS04 platform. The design supports both **Hosted SaaS** (cloud) and **Self-Hosted** (on-premise/enterprise) models, utilizing **Stripe** as the payment processor and source of truth for billing.

---

## 1. High-Level Architecture

The system distinguishes between **Billing** (handling payments/invoices) and **Entitlements** (what features/limits a user has).

*   **Hosted SaaS**: Uses **Stripe Billing** directly. Plans = Stripe Products.
*   **Self-Hosted**: Uses **Signed License Keys**. The key encodes expiration and entitlements.

```mermaid
flowchart TD
    subgraph "Billing Source"
        Stripe[Stripe Billing]
        Sales[Enterprise Sales]
    end

    subgraph "Core Platform"
        Plan[Plan Definitions]
        Sub[Subscription Record]
        Entitlements[Entitlement Limits]
        Enforcement[Enforcement Logic]
    end

    Stripe -- "Webhook: checkout.completed" --> Sub
    Sales -- "Generate License Key" --> Sub
    
    Sub -- "Map to" --> Plan
    Plan -- "Define" --> Entitlements
    Entitlements -- "Check" --> Enforcement
```

---

## 2. Data Model (ERD)

```mermaid
erDiagram
    Account ||--o| Subscription : has
    Subscription }o--|| Plan : "subscribes to"
    Plan ||--o{ Subscription : "has many"
    
    Account {
        string id PK
        string name
        string slug UK
    }
    
    Plan {
        string id PK
        string code UK "free, starter, business, enterprise"
        string name
        string stripeProductId UK
        string stripePriceId
        boolean isActive
        int maxDevices
        int maxUsers
        int maxLogLinesPerMonth
        int dataRetentionDays
        json features
    }
    
    Subscription {
        string id PK
        string accountId FK,UK
        string planId FK
        string source "stripe, license"
        string status
        string stripeCustomerId
        string stripeSubscriptionId UK
        datetime currentPeriodEnd
        boolean cancelAtPeriodEnd
        datetime trialEndsAt
        string licenseKey
        datetime licenseExpiresAt
        int overrideMaxDevices
    }
```

### Prisma Schema

```prisma
// Represents a billing tier (Syncs from Stripe Product/Price)
model Plan {
  id              String   @id @default(cuid())
  code            String   @unique // 'free', 'pro', 'enterprise' - stable lookup key
  name            String   // Display name: "Free Tier", "Pro Plan"
  stripeProductId String?  @unique
  stripePriceId   String?  // Monthly price ID for Checkout
  isActive        Boolean  @default(true)
  
  // Entitlements defined by this plan
  maxDevices      Int      @default(5)
  maxUsers        Int      @default(1)
  maxLogLinesPerMonth Int  @default(10000)
  dataRetentionDays Int    @default(7)
  features        Json     @default("[]") // e.g., ["sso", "audit_logs", "white_label"]
  
  subscriptions   Subscription[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@allow('all', auth().systemRole == 'ADMIN')
  @@allow('read', auth() != null && isActive == true)
  
  @@index([isActive])
  @@index([code])
}

// Connects an Account to a Plan
model Subscription {
  id              String   @id @default(cuid())
  accountId       String   @unique // One entry per account
  account         Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  planId          String
  plan            Plan     @relation(fields: [planId], references: [id])
  
  source          String   @default("stripe") // 'stripe' | 'license'
  status          String   @default("active") // See state diagram below
  
  // Stripe Data (for SaaS, source='stripe')
  stripeCustomerId     String?
  stripeSubscriptionId String? @unique
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean @default(false)
  trialEndsAt          DateTime? // For trial periods
  
  // License Data (for Self-Hosted, source='license')
  licenseKey           String?
  licenseExpiresAt     DateTime? // Expiration for offline validation
  
  // Overrides (for custom deals)
  overrideMaxDevices   Int?
  overrideMaxUsers     Int?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@allow('all', auth().systemRole == 'ADMIN')
  @@allow('read', account.members?[userId == auth().id])
  
  @@index([status])
  @@index([planId])
  @@index([source])
}
```

---

## 3. Subscription Status State Machine

```mermaid
stateDiagram-v2
    [*] --> active: Account Created (Free Plan)
    
    active --> trialing: Start Trial (Paid Plan)
    trialing --> active: Trial Ends + Payment Success
    trialing --> past_due: Trial Ends + Payment Failed
    
    active --> past_due: Payment Failed
    past_due --> active: Payment Retry Success
    past_due --> canceled: Max Retries Exceeded
    
    active --> canceled: User Cancels (Immediate)
    active --> pending_cancel: User Cancels (End of Period)
    pending_cancel --> canceled: Period Ends
    pending_cancel --> active: User Reactivates
    
    canceled --> active: User Resubscribes
    canceled --> [*]: Account Deleted
    
    note right of past_due: Grace period (3-7 days)
    note right of pending_cancel: cancelAtPeriodEnd = true
```

### Status Definitions

| Status | Source | Description | User Access |
|--------|--------|-------------|-------------|
| `active` | Both | Subscription is current | Full access |
| `trialing` | Both | Within trial period | Full access |
| `past_due` | Stripe | Payment failed, retrying | Full access (grace) |
| `pending_cancel` | Stripe | Will cancel at period end | Full access |
| `canceled` | Both | Subscription ended | Downgrade to Free |
| `incomplete` | Stripe | Initial payment failed | No paid access |
| `expired` | License | License expired (self-hosted) | Downgrade to Free |

### Self-Hosted Status Semantics

For `source = 'license'`:
- **Active**: `licenseExpiresAt > now()` → `status = 'active'`
- **Trialing**: License JWT contains `trial: true` → `status = 'trialing'`
- **Expired**: `licenseExpiresAt <= now()` → `status = 'expired'`, auto-downgrade to Free

> [!IMPORTANT]
> Self-hosted instances check `licenseExpiresAt` on startup and periodically. No phone-home required.

---

## 4. Sign-Up & Upgrade Flow

```mermaid
sequenceDiagram
    actor User
    participant Web as Web App
    participant DB as PostgreSQL
    participant Stripe

    Note over User,Stripe: 1. Account Registration
    User->>Web: Register Account
    Web->>DB: Create Account
    Web->>DB: Create Subscription (planId: "free", source: "stripe", status: "active")
    Web-->>User: Welcome! You're on Free Plan

    Note over User,Stripe: 2. Upgrade to Paid Plan
    User->>Web: Click "Upgrade to Pro"
    Web->>Stripe: Create Checkout Session
    Note right of Web: client_reference_id = accountId<br/>metadata.accountId = accountId
    Stripe-->>Web: Checkout URL
    Web-->>User: Redirect to Stripe Checkout
    User->>Stripe: Enter Payment Details
    Stripe-->>User: Redirect to /billing/success

    Note over User,Stripe: 3. Webhook Processing
    Stripe->>Web: POST /api/webhook/stripe (checkout.session.completed)
    Web->>Web: Verify Signature
    Web->>DB: Update Subscription (planId: "pro", stripeCustomerId, stripeSubscriptionId)
    Web->>Web: Invalidate entitlements cache
    Web-->>Stripe: 200 OK
```

---

## 5. Billing Management Flow

```mermaid
sequenceDiagram
    actor User
    participant Web as Web App
    participant Stripe
    participant DB as PostgreSQL

    User->>Web: Click "Manage Billing"
    Web->>Stripe: Create Portal Session (stripeCustomerId)
    Stripe-->>Web: Portal URL
    Web-->>User: Redirect to Stripe Portal

    alt User Changes Plan
        User->>Stripe: Select new plan
        Stripe->>Web: Webhook: customer.subscription.updated
        Web->>DB: Update planId, status
        Web->>Web: Invalidate cache
    else User Updates Payment
        User->>Stripe: Update card
        Note over Stripe: No webhook needed
    else User Cancels
        User->>Stripe: Cancel subscription
        Stripe->>Web: Webhook: customer.subscription.updated
        Web->>DB: Set cancelAtPeriodEnd = true
    end
```

---

## 6. Self-Hosted License Flow

```mermaid
sequenceDiagram
    actor Admin
    participant Console as Admin Console
    participant Web as Self-Hosted Instance
    participant DB as PostgreSQL

    Note over Admin,DB: License Generation (Your Admin Console)
    Admin->>Console: Generate License for Account X
    Console->>Console: Create JWT with KID header
    Note right of Console: { sub: accountId, plan: "enterprise",<br/>maxDevices: 500, exp: unix_ts }
    Console->>Console: Sign with Private Key
    Console-->>Admin: License Key (JWT string)

    Note over Admin,DB: License Activation (Customer's Instance)
    Admin->>Web: Input License Key in /settings/license
    Web->>Web: Decode JWT, extract KID
    Web->>Web: Fetch public key from JWKS (or embedded)
    Web->>Web: Verify signature
    Web->>Web: Check exp > now()
    alt Valid License
        Web->>DB: Update Subscription (planId, source: "license", licenseExpiresAt)
        Web-->>Admin: License Activated!
    else Invalid/Expired
        Web-->>Admin: Error: Invalid License
    end

    Note over Admin,DB: Periodic Validation (No Phone-Home)
    loop On App Startup + Every Hour
        Web->>DB: Get Subscription where source = 'license'
        Web->>Web: Check licenseExpiresAt > now()
        alt Expired
            Web->>DB: Set status = 'expired', downgrade to Free
        end
    end
```

### License Key Structure (JWT)

```json
{
  "header": {
    "alg": "RS256",
    "kid": "key-2024-01"
  },
  "payload": {
    "iss": "fs04.io",
    "sub": "account_cuid123",
    "plan": "enterprise",
    "maxDevices": 500,
    "maxUsers": 100,
    "features": ["sso", "audit_logs"],
    "trial": false,
    "exp": 1735689600,
    "iat": 1704067200
  }
}
```

### License Signing Keys (JWKS)

For production-grade license validation:

| Field | Description |
|-------|-------------|
| `kid` | Key ID in JWT header (e.g., `key-2024-01`) |
| **Public Keys** | Embedded in app binary OR fetched from `https://license.fs04.io/.well-known/jwks.json` |
| **Rotation Policy** | Rotate annually; old keys remain valid for existing licenses |
| **Compromise Response** | Revoke kid, issue new licenses with new key |

---

## 7. Entitlement Enforcement

### Enforcement Architecture

```mermaid
flowchart LR
    subgraph "Request Flow"
        API[API Request]
        Auth[Auth Middleware]
        Entitlement[Entitlement Check]
        Handler[Business Logic]
    end

    subgraph "Data Sources"
        Cache[(Redis Cache)]
        DB[(PostgreSQL)]
    end

    API --> Auth
    Auth --> Entitlement
    Entitlement --> Cache
    Cache -.->|miss| DB
    Entitlement --> Handler
```

### Implementation

```typescript
// lib/server/entitlements.ts
import { redis } from '$lib/server/redis';
import { prisma } from '$lib/server/prisma';

interface AccountEntitlements {
  planCode: string;
  maxDevices: number;
  maxUsers: number;
  features: string[];
  status: string;
  source: 'stripe' | 'license';
}

const CACHE_TTL = 300; // 5 minutes

// Cache the free plan baseline to avoid hardcoding defaults
let freePlanCache: { maxDevices: number; maxUsers: number } | null = null;

async function getFreePlanDefaults() {
  if (freePlanCache) return freePlanCache;
  const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });
  freePlanCache = {
    maxDevices: freePlan?.maxDevices ?? 5,
    maxUsers: freePlan?.maxUsers ?? 1
  };
  return freePlanCache;
}

export async function getEntitlements(accountId: string): Promise<AccountEntitlements> {
  const cacheKey = `entitlements:${accountId}`;
  
  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Fetch from DB
  const sub = await prisma.subscription.findUnique({
    where: { accountId },
    include: { plan: true }
  });
  
  if (!sub) {
    // Default to free tier (fetch from DB, not hardcoded)
    const defaults = await getFreePlanDefaults();
    return { 
      planCode: 'free', 
      maxDevices: defaults.maxDevices, 
      maxUsers: defaults.maxUsers, 
      features: [], 
      status: 'active',
      source: 'stripe'
    };
  }
  
  const entitlements: AccountEntitlements = {
    planCode: sub.plan.code,
    maxDevices: sub.overrideMaxDevices ?? sub.plan.maxDevices,
    maxUsers: sub.overrideMaxUsers ?? sub.plan.maxUsers,
    features: sub.plan.features as string[],
    status: sub.status,
    source: sub.source as 'stripe' | 'license'
  };
  
  // Cache result
  await redis.set(cacheKey, JSON.stringify(entitlements), 'EX', CACHE_TTL);
  
  return entitlements;
}

export async function checkFeature(accountId: string, feature: string): Promise<boolean> {
  const entitlements = await getEntitlements(accountId);
  const validStatuses = ['active', 'trialing', 'past_due', 'pending_cancel'];
  if (!validStatuses.includes(entitlements.status)) return false;
  return entitlements.features.includes(feature);
}

export async function checkDeviceLimit(accountId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const entitlements = await getEntitlements(accountId);
  const current = await prisma.device.count({ where: { accountId } });
  return {
    allowed: current < entitlements.maxDevices,
    current,
    max: entitlements.maxDevices
  };
}

export async function checkUserLimit(accountId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const entitlements = await getEntitlements(accountId);
  const current = await prisma.accountMembership.count({ where: { accountId } });
  return {
    allowed: current < entitlements.maxUsers,
    current,
    max: entitlements.maxUsers
  };
}

// Invalidate cache when subscription changes
export async function invalidateEntitlements(accountId: string): Promise<void> {
  await redis.del(`entitlements:${accountId}`);
}
```

### Usage Examples

```typescript
// In device creation API
const { allowed, current, max } = await checkDeviceLimit(accountId);
if (!allowed) {
  throw error(403, `Device limit reached (${current}/${max}). Please upgrade your plan.`);
}

// In user invitation flow
const { allowed } = await checkUserLimit(accountId);
if (!allowed) {
  throw error(403, 'User limit reached. Please upgrade to add more team members.');
}

// In SSO login check
const hasSSO = await checkFeature(accountId, 'sso');
if (!hasSSO) {
  throw redirect(302, '/settings/billing?upgrade=sso');
}
```

---

## 8. Webhook Security & Handling

> [!IMPORTANT]
> Always verify Stripe webhook signatures to prevent spoofing attacks.

### Stripe Binding Best Practice

Always set these when creating Checkout Sessions:
```typescript
const session = await stripe.checkout.sessions.create({
  client_reference_id: accountId,  // For webhook matching
  customer_email: user.email,
  metadata: { accountId },         // For reconciliation from Stripe Dashboard
  subscription_data: {
    metadata: { accountId }        // Also on the subscription object
  },
  // ...
});
```

### Webhook Handler

```typescript
// routes/api/webhook/stripe/+server.ts
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import { prisma } from '$lib/server/prisma';
import { invalidateEntitlements } from '$lib/server/entitlements';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export async function POST({ request }) {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');
  
  // 1. Verify signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig!, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }
  
  // 2. Idempotency check
  const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (existing) {
    return new Response('Already processed', { status: 200 });
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
    }
    
    // 4. Mark as processed (with event type for debugging)
    await prisma.webhookEvent.create({ 
      data: { 
        id: event.id, 
        type: event.type,
        objectId: (event.data.object as any).id
      } 
    });
    
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Handler error', { status: 500 });
  }
  
  return new Response('OK', { status: 200 });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const accountId = session.client_reference_id ?? session.metadata?.accountId;
  if (!accountId) throw new Error('No accountId in session');
  
  const subscriptionId = session.subscription as string;
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSub.items.data[0].price.id;
  
  // Find matching plan by stable code or priceId
  const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
  if (!plan) throw new Error(`No plan found for price ${priceId}`);
  
  await prisma.subscription.update({
    where: { accountId },
    data: {
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
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id }
  });
  if (!sub) return;
  
  const priceId = stripeSub.items.data[0].price.id;
  const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
  
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      planId: plan?.id ?? sub.planId,
      status: stripeSub.cancel_at_period_end ? 'pending_cancel' : stripeSub.status,
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end
    }
  });
  
  await invalidateEntitlements(sub.accountId);
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id }
  });
  if (!sub) return;
  
  // Downgrade to free using stable code lookup
  const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });
  
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      planId: freePlan?.id ?? sub.planId,
      status: 'canceled',
      stripeSubscriptionId: null
    }
  });
  
  await invalidateEntitlements(sub.accountId);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.warn('Payment failed for invoice:', invoice.id, invoice.customer);
  // TODO: Send notification email to account owner
}
```

---

## 9. Menu Structure & Navigation

### Admin Dashboard
Located under `Settings > Billing`.

| Menu Item | Route | Description |
|-----------|-------|-------------|
| Plans | `/admin/billing/plans` | View/Sync plans from Stripe |
| Subscriptions | `/admin/billing/subscriptions` | List customer subscriptions, status, overrides |
| Invoices | `/admin/billing/invoices` | Link to Stripe Dashboard |

### Customer Portal
Located under `Account Settings`.

| Menu Item | Route | Description |
|-----------|-------|-------------|
| Billing | `/user/settings/billing` | Current Plan, Usage, Payment Method, "Manage" button |

---

## 10. Coupons & Promotion Codes

Stripe handles coupon logic entirely. Your platform just needs to:
1. Allow users to enter a promo code at checkout.
2. Optionally display applied discounts in the billing UI.

### How It Works

```mermaid
sequenceDiagram
    actor User
    participant Web as Web App
    participant Stripe

    User->>Web: Enter promo code "LAUNCH50"
    Web->>Stripe: Create Checkout Session with discounts
    Note right of Web: discounts: [{ promotion_code: "promo_xxx" }]
    Stripe->>Stripe: Validate code, apply discount
    Stripe-->>User: Checkout shows discounted price
    User->>Stripe: Complete payment
    Stripe->>Web: Webhook: checkout.session.completed
    Note right of Web: session.discount contains coupon details
```

### Creating Coupons (Stripe Dashboard or API)

| Coupon Type | Use Case | Example |
|-------------|----------|---------|
| **Percent Off** | "50% off first 3 months" | `percent_off: 50, duration: 'repeating', duration_in_months: 3` |
| **Amount Off** | "$20 off forever" | `amount_off: 2000, currency: 'usd', duration: 'forever'` |
| **One-Time** | "Free first month" | `percent_off: 100, duration: 'once'` |

### Promotion Codes vs Coupons

| Concept | Description |
|---------|-------------|
| **Coupon** | The discount definition (internal ID like `coupon_abc123`) |
| **Promotion Code** | The user-facing code (e.g., `"LAUNCH50"`) that maps to a Coupon |

> [!TIP]
> Create Promotion Codes in Stripe Dashboard under **Products > Coupons > + New promotion code**.

### Implementation

```typescript
// POST /api/billing/checkout
export async function POST({ request, locals }) {
  const { priceId, promoCode } = await request.json();
  const accountId = locals.session.accountId;
  
  // Look up promotion code if provided
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
  if (promoCode) {
    const promoCodes = await stripe.promotionCodes.list({ code: promoCode, active: true });
    if (promoCodes.data.length > 0) {
      discounts = [{ promotion_code: promoCodes.data[0].id }];
    }
  }
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: accountId,
    metadata: { accountId },
    line_items: [{ price: priceId, quantity: 1 }],
    discounts,  // Apply promo code
    allow_promotion_codes: !promoCode,  // Show promo input if not pre-filled
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing/cancel`,
  });
  
  return json({ url: session.url });
}
```

### Displaying Applied Discounts

After checkout, you can show the user their active discount:

```typescript
// In billing page load function
const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
  expand: ['discount.coupon']
});

if (sub.discount?.coupon) {
  const coupon = sub.discount.coupon;
  const discountText = coupon.percent_off 
    ? `${coupon.percent_off}% off` 
    : `$${(coupon.amount_off! / 100).toFixed(2)} off`;
  // Display: "You have LAUNCH50 applied: 50% off for 3 months"
}
```

### Admin Coupon Management

Coupons are managed entirely in **Stripe Dashboard**. No need to sync to local DB.

| Admin Action | Where |
|--------------|-------|
| Create coupon | Stripe Dashboard > Products > Coupons |
| Create promo code | Stripe Dashboard > Products > Coupons > [Coupon] > Promotion codes |
| View redemptions | Stripe Dashboard > Customers > [Customer] > Invoices |

---

## 11. Plan Evolution Strategy

### A. The "Generous Global Lift" (Value Change)
*   **Action**: Update `maxDevices` in the `Plan` table row.
*   **Effect**: All users on that plan instantly get the new limit.
*   **Use Case**: Minor improvements, inflation adjustments.

### B. The "Legacy Plan" Pattern (New Definition)
*   **Action**: Mark old plan `isActive: false`, create new `Plan` record with new `code`.
*   **Effect**: Existing users grandfathered. New users see new plan.
*   **Use Case**: Price increases, breaking changes.

---

## 12. Implementation Checklist

### Phase 1: Foundation (Completed)
- [x] Add `Plan` and `Subscription` models to `schema.zmodel`
- [x] Add `WebhookEvent` model for idempotency
- [x] Run `npx zenstack generate && npx prisma db push`
- [x] Create `scripts/seed-plans.ts` with Free, Starter, Business, Enterprise
- [x] Run seed script

### Phase 2: Stripe Integration (In Progress)
- [x] Set up Stripe account (Test Mode)
- [ ] Create Products and Prices in Stripe Dashboard (Starter: $199, Business: $499)
- [ ] Update `Plan` records with `stripeProductId` and `stripePriceId`
- [x] Implement `POST /api/billing/checkout` (with `metadata.accountId`)
- [x] Implement `POST /api/billing/portal`
- [x] Implement `POST /api/webhook/stripe` with signature verification
- [x] Test webhook locally with Stripe CLI

### Phase 3: Entitlements (Completed)
- [x] Implement `lib/server/entitlements.ts` with Redis caching
- [x] Add `checkDeviceLimit()` call to Device creation API
- [x] Add `checkUserLimit()` call to User invitation flow
- [x] Add `maxLogLinesPerMonth` logic

### Phase 4: Frontend (Completed)
- [x] Build `/user/settings/billing` page
- [x] Wire up "Upgrade" buttons to Checkout API (via `billingService.ts`)
- [x] Wire up "Manage Billing" to Portal API (via `billingService.ts`)
- [x] Build `/admin/billing/plans` page
- [x] Build `/admin/billing/subscriptions` page

### Phase 5: Self-Hosted (Optional)
- [ ] Create license generation script with JWKS support
- [ ] Build `/settings/license` page
- [ ] Implement license validation middleware
- [ ] Add periodic license expiry check (cron job)

---

## 13. User Interface & Experience

### User Billing Portal
![User Billing Portal](/Users/bernard/.gemini/antigravity/brain/29a59016-bd61-4084-969d-34d4f2a99dbf/user_billing_portal_mockup_1766633083968.png)

### Admin Plan Manager
![Admin Plan Management](/Users/bernard/.gemini/antigravity/brain/29a59016-bd61-4084-969d-34d4f2a99dbf/admin_plan_manager_mockup_1766633105810.png)

---

## 14. Best Practices & Reference

| Topic | Recommendation |
|-------|----------------|
| **Idempotency** | Store `event.id` + `objectId` in DB to prevent double-processing |
| **Grace Periods** | Handle `past_due` gracefully - warn 3 days before locking out |
| **Signature Verification** | Always verify Stripe webhook signatures |
| **Caching** | Cache entitlements in Redis (5 min TTL), invalidate on sub change |
| **Trial Abuse** | Limit one trial per email/payment method |
| **Plan Lookup** | Use `code` field, never display `name` for logic |
| **Stripe Metadata** | Always set `accountId` in session, customer, and subscription metadata |

### Comparison with Industry Leaders
*   **Supabase / Vercel**: Usage-based billing. We start with flat tiers (simpler).
*   **PostHog (Open Core)**: Features locked behind license keys. We follow this for self-hosted.

---

## 15. Future Considerations (V2+)

- [ ] **Per-Seat Pricing**: Charge per `maxUsers` instead of flat.
- [ ] **Usage-Based Billing**: Meter API calls or device-hours via Stripe Metered Billing.
- [ ] **Coupons/Discounts**: Handle promo codes via Stripe Coupons API.
- [ ] **Multi-Currency**: Support regional pricing with Stripe Price localization.
- [ ] **Annual Billing**: Offer discounted yearly plans (separate `stripePriceId`).
- [ ] **Invoicing for Enterprise**: Wire transfer + manual invoice via Stripe Invoicing.

---

## Appendix A: WebhookEvent Model

Add this to `schema.zmodel` for idempotency:

```prisma
model WebhookEvent {
  id        String   @id // Stripe event ID
  type      String
  objectId  String?  // For debugging (e.g., subscription ID)
  createdAt DateTime @default(now())
  
  @@allow('all', auth().systemRole == 'ADMIN')
  @@index([type])
}
```

---

## Appendix B: Default Plans Seed

```typescript
// scripts/seed-plans.ts
const defaultPlans = [
  { 
    code: 'free', 
    name: 'Free', 
    maxDevices: 5, 
    maxUsers: 5, 
    maxLogLinesPerMonth: 10000,
    dataRetentionDays: 7, 
    features: ['basic_support'] 
  },
  { 
    code: 'starter', 
    name: 'Starter', 
    maxDevices: 50, 
    maxUsers: 10, 
    maxLogLinesPerMonth: 500000,
    dataRetentionDays: 30, 
    features: ['priority_support', 'email_alerts', 'api_access'] 
  },
  { 
    code: 'business', 
    name: 'Business', 
    maxDevices: 1000, 
    maxUsers: 50, 
    maxLogLinesPerMonth: 5000000,
    dataRetentionDays: 90, 
    features: ['priority_support', 'email_alerts', 'api_access', 'phone_support', 'custom_integrations'] 
  },
  { 
    code: 'enterprise', 
    name: 'Enterprise', 
    maxDevices: 999999, 
    maxUsers: 999999, 
    maxLogLinesPerMonth: 999999999,
    dataRetentionDays: 365, 
    features: ['sso', 'audit_logs', 'sla', 'white_label', 'dedicated_support', 'custom_integrations', 'on_premise'] 
  }
];

for (const plan of defaultPlans) {
  await prisma.plan.upsert({
    where: { code: plan.code },
    create: { ...plan, features: JSON.stringify(plan.features) },
    update: { name: plan.name, maxDevices: plan.maxDevices, maxUsers: plan.maxUsers, dataRetentionDays: plan.dataRetentionDays }
  });
}
```
