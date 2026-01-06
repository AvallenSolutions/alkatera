# Stripe Subscription Integration - Implementation Guide

## ✅ What Has Been Implemented

This document outlines the complete Stripe subscription integration that has been implemented for the AlkaTera platform.

### 1. Database Schema ✅
**File:** `supabase/migrations/20260106000000_add_stripe_fields_to_organizations.sql`

Added fields to `organizations` table:
- `stripe_customer_id` - Stores Stripe customer ID
- `stripe_subscription_id` - Stores active subscription ID
- Indexes for performance
- Helper functions:
  - `get_organization_by_stripe_customer()` - Find org by Stripe customer ID
  - `update_subscription_from_stripe()` - Update subscription from webhook data

### 2. Stripe Configuration ✅
**File:** `lib/stripe-config.ts`

- Stripe client initialization
- Tier pricing definitions for all 3 tiers:
  - **Seed**: £149/month, £1,490/year
  - **Blossom**: £399/month, £3,990/year
  - **Canopy**: £899/month, £8,990/year
- Price ID mappings (monthly configured, annual TODOs marked)
- Helper functions for tier/price conversions
- Limits and features for each tier

### 3. Subscription Limits Library ✅
**File:** `lib/subscription-limits.ts`

Functions to check and enforce limits:
- `checkProductLimit()` - Check if org can create products
- `checkLCALimit()` - Check if org can create LCAs
- `checkReportLimit()` - Check if org can generate reports
- `checkFeatureAccess()` - Check if org has access to a feature
- `getOrganizationUsage()` - Get complete usage summary
- `incrementProductCount()` - Increment usage counters
- Helper functions for UI display

### 4. API Routes ✅

#### Checkout Session Creation
**File:** `app/api/stripe/create-checkout-session/route.ts`

- Creates Stripe Checkout session
- Validates user permissions (admin/owner only)
- Creates or retrieves Stripe customer
- Stores metadata for webhook processing
- Supports monthly billing (annual pending price IDs)

#### Webhooks Handler
**File:** `app/api/stripe/webhooks/route.ts`

Handles Stripe webhook events:
- ✅ `checkout.session.completed` → Activate subscription
- ✅ `customer.subscription.updated` → Update tier/status
- ✅ `customer.subscription.deleted` → Downgrade to seed (free)
- ✅ `invoice.payment_failed` → Suspend subscription
- ✅ `invoice.payment_succeeded` → Reactivate after payment

### 5. Billing Settings Page ✅
**File:** `app/(authenticated)/settings/billing/page.tsx`

Complete billing management UI:
- **Current Subscription Section:**
  - Display current tier and status
  - Show billing interval and start date
  - "Manage Payment Method" button

- **Usage Section:**
  - Visual progress bars for all limits
  - Color-coded (green/yellow/red)
  - Warnings when approaching limits

- **Upgrade/Downgrade Section:**
  - 3 tier cards with pricing
  - Monthly/Annual toggle
  - Feature lists
  - Upgrade buttons

- **Invoice History Section:**
  - Placeholder for future implementation

### 6. Subscription Enforcement Middleware ✅
**File:** `middleware/subscription-check.ts`

Middleware functions for API routes:
- `enforceProductLimit()` - Block product creation if limit exceeded
- `enforceLCALimit()` - Block LCA creation if limit exceeded
- `enforceReportLimit()` - Block report generation if limit exceeded
- `enforceFeatureAccess()` - Block feature usage if not available

Includes usage examples in comments.

### 7. Environment Variables ✅
**File:** `.env.example`

Added:
```bash
STRIPE_SECRET_KEY=mk_1SACycS6ESxgnZl292m4JQN3
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=mk_1R3brxS6ESxgnZl2njSaBGWK
STRIPE_WEBHOOK_SECRET=whsec_YUmwJkxoySFhppLlF1c0xAK1DGUurqtB
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## 🚀 Next Steps - Required Actions

### 1. Create Annual Price IDs in Stripe Dashboard

Currently, only monthly prices are configured. To enable annual billing:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Products
3. For each tier (Seed, Blossom, Canopy), create an annual price:
   - **Seed Annual**: £1,490/year (£149/month × 10)
   - **Blossom Annual**: £3,990/year (£399/month × 10)
   - **Canopy Annual**: £8,990/year (£899/month × 10)
4. Update `lib/stripe-config.ts`:
   ```typescript
   seed: {
     // ...
     annualPriceId: 'price_YOUR_ANNUAL_SEED_PRICE_ID',
   },
   blossom: {
     // ...
     annualPriceId: 'price_YOUR_ANNUAL_BLOSSOM_PRICE_ID',
   },
   canopy: {
     // ...
     annualPriceId: 'price_YOUR_ANNUAL_CANOPY_PRICE_ID',
   }
   ```

### 2. Run Database Migration

Apply the migration to add Stripe fields:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually through Supabase Dashboard
# Upload: supabase/migrations/20260106000000_add_stripe_fields_to_organizations.sql
```

### 3. Set Up Stripe Webhook

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL: `https://yourdomain.com/api/stripe/webhooks`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Copy the webhook signing secret
6. Update your environment variables with the webhook secret

### 4. Configure Environment Variables

Create a `.env.local` file (NOT committed to git):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://dfcezkyaejrxmbwunhry.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Stripe
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_... # from webhook setup

# Other existing vars...
```

**⚠️ IMPORTANT:** Get your Supabase Service Role Key from:
Supabase Dashboard → Settings → API → Service Role Key

### 5. Implement Stripe Customer Portal (Optional but Recommended)

To allow users to manage payment methods and view invoices, create a portal session endpoint:

**File:** `app/api/stripe/create-portal-session/route.ts`

```typescript
import { stripe } from '@/lib/stripe-config';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { customerId } = await request.json();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${request.nextUrl.origin}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
```

Then update the "Manage Payment Method" button in `billing/page.tsx`.

### 6. Add Enforcement to Existing API Routes

Add limit checks to your product/LCA creation routes:

**Example for product creation:**
```typescript
// app/api/products/route.ts
import { enforceProductLimit } from '@/middleware/subscription-check';
import { incrementProductCount } from '@/lib/subscription-limits';

export async function POST(request: NextRequest) {
  // ... get organizationId from request ...

  // Check limit
  const limitCheck = await enforceProductLimit(organizationId);
  if (limitCheck) return limitCheck;

  // Create product
  const product = await createProduct(productData);

  // Increment counter
  await incrementProductCount(organizationId, userId);

  return NextResponse.json(product);
}
```

### 7. Test the Integration

1. **Test Checkout Flow:**
   - Navigate to `/settings/billing`
   - Click upgrade on a tier
   - Complete test checkout with Stripe test card: `4242 4242 4242 4242`
   - Verify subscription activates

2. **Test Webhooks Locally:**
   ```bash
   # Install Stripe CLI
   stripe listen --forward-to localhost:3000/api/stripe/webhooks

   # Trigger test events
   stripe trigger checkout.session.completed
   stripe trigger customer.subscription.updated
   ```

3. **Test Limits:**
   - Create products/LCAs up to the limit
   - Verify blocking works when limit reached
   - Verify upgrade message displays

---

## 📝 Implementation Notes

### Price ID Configuration
- Monthly prices are configured with your provided IDs
- Annual prices need to be created in Stripe (see Next Steps #1)
- Annual pricing gives 2 months free (10 months price for 12 months service)

### Webhook Security
- Webhooks verify signature using `STRIPE_WEBHOOK_SECRET`
- Uses Supabase Service Role Key for admin operations
- All events logged for debugging

### Subscription Status Flow
```
[New] → [Trial/Active] → [Suspended] → [Cancelled] → [Seed (free)]
                ↓
        [Payment Success] → [Active]
```

### Database Functions Used
The integration uses these existing Supabase RPC functions:
- `check_product_limit()`
- `check_lca_limit()`
- `check_report_limit()`
- `check_feature_access()`
- `get_organization_usage()`
- `increment_product_count()`
- `increment_lca_count()`
- `increment_report_count()`

---

## 🐛 Troubleshooting

### Webhooks Not Working
1. Check webhook endpoint is accessible publicly
2. Verify `STRIPE_WEBHOOK_SECRET` is correct
3. Check Stripe dashboard for webhook delivery failures
4. Verify `SUPABASE_SERVICE_ROLE_KEY` is set

### Checkout Session Creation Fails
1. Verify `STRIPE_SECRET_KEY` is valid
2. Check user has admin/owner role for organization
3. Verify price IDs are correct

### Limits Not Enforcing
1. Run database migration to add usage tracking columns
2. Verify RPC functions exist in database
3. Check enforcement middleware is called in API routes

---

## 📞 Support

If you encounter issues:
1. Check Stripe Dashboard → Developers → Logs
2. Check Supabase Dashboard → Logs
3. Check Next.js console logs
4. Review this documentation

---

**Implementation Date:** January 6, 2026
**Stripe API Version:** 2024-12-18.acacia
**Status:** ✅ Ready for Testing
