# Stripe Webhook Issue Resolution

## Problem
Stripe webhook events were failing with HTTP 308 (Permanent Redirect) errors. All events including `invoice.paid`, `checkout.session.completed`, and `customer.subscription.created` were being rejected, preventing subscription upgrades from being processed.

## Root Causes Identified

### 1. Trailing Slash Redirect
**Issue**: `next.config.js` had `trailingSlash: true` which forced all routes to have a trailing slash.
- When Stripe sent POST requests to `/api/stripe/webhooks`, Next.js redirected to `/api/stripe/webhooks/`
- HTTP 308 redirects cannot preserve POST body data
- Stripe webhooks cannot follow redirects with the original payload

**Fix**: Removed `trailingSlash: true` from `next.config.js`

### 2. Middleware Interference
**Issue**: The auth middleware was processing the webhook endpoint, potentially adding overhead and causing issues.

**Fix**: Explicitly excluded `/api/stripe/webhooks` from the middleware matcher pattern in `middleware.ts`

## Changes Made

### 1. next.config.js
```javascript
// BEFORE
const nextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,  // ❌ Caused 308 redirects
  compiler: {
    removeConsole: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

// AFTER
const nextConfig = {
  images: { unoptimized: true },
  // ✅ Removed trailingSlash
  compiler: {
    removeConsole: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
```

### 2. middleware.ts
```typescript
// BEFORE
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

// AFTER
export const config = {
  matcher: [
    // ✅ Added api/stripe/webhooks to exclusion list
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 3. Enhanced Webhook Logging
Added comprehensive logging to `app/api/stripe/webhooks/route.ts`:

- Request URL, method, and headers
- Body length and signature verification
- Event type and ID
- Database function call parameters
- Detailed error messages with stack traces
- Success confirmations

This improved logging helps diagnose issues in production and provides an audit trail.

### 4. Build Fixes
Fixed missing dependencies that were blocking the build:
- Created `lib/bulk-import/template-generator.ts`
- Created `lib/bulk-import/material-matcher.ts`

## How the Webhook Works Now

### Flow
1. Stripe sends POST request to `/api/stripe/webhooks`
2. Request bypasses middleware (excluded in matcher)
3. Next.js routes directly to webhook handler (no redirect)
4. Handler verifies signature using `STRIPE_WEBHOOK_SECRET`
5. Event is processed and organization subscription is updated
6. Response 200 is sent to Stripe

### Event Handlers

#### checkout.session.completed
- Triggered when initial payment succeeds
- Retrieves subscription details from Stripe
- Calls `update_subscription_from_stripe` RPC function
- Updates organization tier and status

#### customer.subscription.updated
- Triggered when subscription changes (upgrade/downgrade)
- Finds organization by customer ID or metadata
- Updates tier based on price ID

#### customer.subscription.deleted
- Triggered when subscription is cancelled
- Downgrades organization to 'seed' (free) tier

#### invoice.payment_failed
- Triggered when payment fails
- Suspends organization subscription

#### invoice.payment_succeeded
- Triggered when payment succeeds after failure
- Reactivates suspended organizations

## Database Integration

The webhook uses the `update_subscription_from_stripe` RPC function which:
- Maps Stripe price IDs to subscription tiers (seed/blossom/canopy)
- Maps Stripe statuses to internal statuses (active/trial/suspended/cancelled)
- Updates the organizations table with:
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `subscription_tier`
  - `subscription_status`
  - `subscription_started_at`

## Testing the Fix

### In Stripe Dashboard:
1. Navigate to Webhooks section
2. Click on "elegant-harmony" endpoint
3. Click "Send test webhook"
4. Select event type (e.g., `checkout.session.completed`)
5. Check that response is 200 OK (not 308)

### In Application:
1. Complete a checkout flow to upgrade tier
2. Check that the webhook is received
3. Verify subscription tier updates in the UI
4. Verify database shows correct tier and status

### Monitoring Logs:
Check application logs for:
```
========================================
Stripe Webhook Request Received
========================================
Processing Stripe event: checkout.session.completed
SUCCESS: Organization [id] subscription activated
========================================
```

## Environment Variables Required

Ensure these are set in your deployment environment:
- `STRIPE_WEBHOOK_SECRET` - From Stripe Dashboard → Webhooks → Signing secret
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

## Next Steps

1. **Deploy**: Push these changes to production
2. **Update Webhook URL**: Ensure Stripe webhook points to correct URL (without trailing slash)
3. **Test**: Complete a test purchase and verify webhook processing
4. **Monitor**: Watch logs for successful webhook processing
5. **Optional**: Set up webhook event monitoring/alerting

## Prevention

To prevent similar issues in the future:
- Avoid using `trailingSlash: true` unless absolutely necessary
- Always exclude webhook endpoints from auth middleware
- Test webhook endpoints locally using Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhooks`
- Monitor webhook delivery success rate in Stripe Dashboard

## Support

If webhooks still fail after these changes:
1. Check Stripe Dashboard → Webhooks → Event deliveries for error details
2. Review application logs for webhook processing errors
3. Verify environment variables are set correctly
4. Ensure database RPC function exists and has correct price ID mappings
