# alka**tera** Platform Audit Report

**Date:** 2026-04-01
**Scope:** Comprehensive analysis of all platform features, covering bugs, performance, security, calculation errors, data issues, and code improvements.
**Files reviewed:** ~500 source files across 9 parallel audit streams

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **Critical** | 10 |
| **High** | 24 |
| **Medium** | 48 |
| **Low** | 45 |
| **Total** | **127** |

The audit identified **10 critical issues** requiring immediate attention, primarily around:
1. **Systemic IDOR vulnerability** - `getSupabaseAPIClient()` returns the service role client for all authenticated requests, bypassing RLS across the entire API layer
2. **Calculation errors** - Product loss multiplier maps to wrong lifecycle stages; corporate emissions hardcoded to UK grid factors
3. **Cross-org data access** - Multiple endpoints (certifications, greenwash, advisor messages) allow any authenticated user to read/write other organisations' data
4. **Unauthenticated endpoints** - Several cost-incurring endpoints (PDF generation, Google Maps, bulk import) have no auth checks

---

## CRITICAL FINDINGS (10)

### C1. getSupabaseAPIClient Returns Service Role Client, Bypassing All RLS
- **Location:** `lib/supabase/api-client.ts:68-72`
- **Description:** When the service role key is available (production), this helper returns the service role client for ALL authenticated requests, completely bypassing Row Level Security. Every API route using this helper operates without RLS protection.
- **Impact:** This is the root cause of most IDOR findings. Security depends entirely on each route manually checking org membership, which many do not.
- **Recommendation:** Return a user-scoped client by default; create a separate `getSupabaseAdminClient()` for the rare cases needing service role access.

### C2. Advisor Messages - Complete Cross-Org Data Access
- **Location:** `app/api/advisor-messages/route.ts:14-127`
- **Description:** Uses service role client with zero authorisation checks. Any authenticated user can read all messages in any conversation, read all conversations for any org, send messages into any conversation, and mark messages as read.
- **Impact:** Complete privacy breach for all advisor conversations across all organisations.
- **Recommendation:** Verify the authenticated user is a participant in the conversation before any operation.

### C3. Greenwash Assessments - IDOR on GET and DELETE
- **Location:** `app/api/greenwash/assessments/route.ts:18-44, 133-163`
- **Description:** GET fetches any assessment by ID without org verification. DELETE removes any assessment by ID without org check. Service role client bypasses RLS.
- **Impact:** Any authenticated user can read or destroy any organisation's greenwash assessments.
- **Recommendation:** Add `.eq('organization_id', userOrgId)` to both queries.

### C4. Facility Production Volumes - IDOR via User-Supplied Org ID
- **Location:** `app/api/facility-production-volumes/route.ts:47-58, 90-115`
- **Description:** Authenticates the user but uses service role client with `organization_id` from user input. No membership check.
- **Impact:** Any authenticated user can read/write facility production data for any organisation.
- **Recommendation:** Verify org membership before executing queries.

### C5. Data Backfill Quality - No Admin Check, Operates on All Orgs
- **Location:** `app/api/data/backfill-quality/route.ts:1-113`
- **Description:** Uses module-level service role client, only verifies authentication. Operates on ALL organisations' data.
- **Impact:** Any authenticated user can trigger bulk updates across all organisations.
- **Recommendation:** Restrict to admin or CRON_SECRET authentication.

### C6. Product Loss Multiplier Maps to Wrong Lifecycle Stages
- **Location:** `lib/system-boundaries.ts:338-341`
- **Description:** `retailLossPercent` is mapped to `use_phase` (should be `distribution`), and `consumerWastePercent` is mapped to `end_of_life` (should be `use_phase`). This means `cradle-to-consumer` assessments exclude consumer waste from the loss multiplier entirely.
- **Impact:** Systematic under-reporting of upstream burden for products reaching consumers. Consumer waste (1-15%) is completely excluded from loss calculations for the most common boundary type.
- **Recommendation:** Remap: `retailLossPercent` gated on `distribution`, `consumerWastePercent` gated on `use_phase`.

### C7. Allocation Engine is a Complete Stub
- **Location:** `lib/allocation-engine.ts:122-128`
- **Description:** `calculateFacilityIntensity` always returns `null` (emissions query is commented out). `calculateProductAllocation` depends on it, so also always returns `null`.
- **Impact:** Any code path relying on this module silently gets no results. Creates a trap for future developers.
- **Recommendation:** Complete the implementation or remove entirely with clear pointers to the inline allocation in `product-lca-calculator.ts`.

### C8. getCalculationPeriods Mutates Date Object
- **Location:** `lib/allocation-engine.ts:197-199`
- **Description:** `now.setMonth(now.getMonth() - 12)` mutates the shared `now` variable, and `setMonth` produces unexpected results across year boundaries.
- **Impact:** Incorrect date ranges in edge cases (e.g., calling on 31 March rolls to unexpected dates).
- **Recommendation:** Use explicit date construction: `new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())`.

### C9. Certifications - Cross-Org Data Injection via body.organization_id
- **Location:** `app/api/certifications/frameworks/route.ts:199`, `evidence/route.ts:118`, `score/route.ts:131`
- **Description:** POST endpoints accept `body.organization_id` and use it directly. Users can create certification records, evidence links, or score entries for any organisation.
- **Impact:** Any authenticated user can pollute another organisation's certification data.
- **Recommendation:** Always use the authenticated user's org; ignore `body.organization_id`.

### C10. Certifications Evidence - PUT/DELETE Not Scoped by Organisation
- **Location:** `app/api/certifications/evidence/route.ts:178-195, 241-248`
- **Description:** PUT updates and DELETE removes evidence by ID without any org filtering. `organizationId` is fetched but never used in queries.
- **Impact:** Any authenticated user can modify or delete any organisation's certification evidence.
- **Recommendation:** Add `.eq('organization_id', organizationId)` to both queries.

---

## HIGH FINDINGS (24)

### Security (14)

| # | Finding | Location |
|---|---------|----------|
| H1 | Open redirect in auth callback (`next` param not validated) | `app/auth/callback/route.ts:8-39` |
| H2 | Open redirect in auth confirm (same issue) | `app/auth/confirm/route.ts:9,41` |
| H3 | Google Maps API key exposed without authentication | `app/api/config/maps/route.ts:8-12` |
| H4 | Subscription limits fail open (return `allowed: true` on error) | `hooks/useSubscription.ts:296-420` |
| H5 | Middleware excludes ALL API routes from session refresh (intended for webhooks only) | `middleware.ts:73` |
| H6 | Greenwash PDF generation endpoint has no authentication | `app/api/greenwash/generate-pdf/route.ts:1-39` |
| H7 | Places/Geocode APIs have no authentication (open Google Maps proxy) | `app/api/places/autocomplete/route.ts` |
| H8 | Bulk import upload has no authentication | `app/api/bulk-import/upload/route.ts` |
| H9 | Extract document text has no authentication | `app/api/extract-document-text/route.ts:27-140` |
| H10 | Blog GET returns drafts when `?status=draft` passed | `app/api/blog/route.ts:5-56` |
| H11 | Contact form has no rate limiting (email flooding risk) | `app/api/contact/route.ts:1-142` |
| H12 | Cron routes use non-timing-safe string comparison (3 of 4) | `app/api/cron/*/route.ts` |
| H13 | XSS via unsanitised user input in supplier invitation emails | `app/api/invite-supplier/route.ts:198-212` |
| H14 | No token/cost controls on Rosa AI queries (unbounded context) | `lib/gaia/context-builder.ts:37-75` |

### Calculation (5)

| # | Finding | Location |
|---|---------|----------|
| H15 | Scope 3 Cat 11 uses hardcoded UK grid factor (0.207) | `lib/calculations/scope3-categories.ts:103-104` |
| H16 | Corporate Scope 2 uses hardcoded UK grid factor for all facilities | `lib/calculations/corporate-emissions.ts:70` |
| H17 | Scope 3 Cat 4/9/11 manual overheads silently overwritten by LCA values | `lib/calculations/corporate-emissions.ts:514-516` |
| H18 | Contribution analysis uses signed total as denominator (percentages exceed 100%) | `lib/lca-interpretation-engine.ts:103-104` |
| H19 | Spend-based emissions ignore currency (all treated as GBP) | `lib/xero/spend-factors.ts:62-65` |

### Integration (1)

| # | Finding | Location |
|---|---------|----------|
| H20 | Stripe webhook handler lacks idempotency protection | `app/api/stripe/webhooks/route.ts:57-108` |

### Performance (3)

| # | Finding | Location |
|---|---------|----------|
| H21 | N+1 queries in useSuppliers (100+ queries for 50 suppliers) | `hooks/data/useSuppliers.ts:63-84` |
| H22 | N+1 queries in useScope3GranularData | `hooks/data/useScope3GranularData.ts:186-194` |
| H23 | useCompanyMetrics: 1,378 lines of client-side computation | `hooks/data/useCompanyMetrics.ts` |

### Frontend (1)

| # | Finding | Location |
|---|---------|----------|
| H24 | Google Fonts loaded via render-blocking CSS @import | `app/globals.css:1` |

---

## MEDIUM FINDINGS (48)

### Security (12)

| # | Finding | Location |
|---|---------|----------|
| M1 | Client-side auth gating only (no server-side route protection) | `components/layouts/AppLayout.tsx:62-106` |
| M2 | No rate limiting on password reset API | `app/api/auth/password-reset/route.ts` |
| M3 | Org ID derived from user metadata (could be stale) | `app/api/invite-supplier/route.ts:71-88` |
| M4 | SSRF bypass risk via DNS rebinding on greenwash public | `app/api/greenwash/public/route.ts:6-18` |
| M5 | Error leakage (DB schema details in error responses) | Multiple API routes |
| M6 | No input validation/Zod schemas across API routes | Systemic |
| M7 | LCA review routes have no org-scoping verification | `app/api/lca/[id]/review/route.ts` |
| M8 | Supplier invite accept does not verify caller matches user_id | `app/api/supplier-invite/accept/route.ts:61-63` |
| M9 | Supplier register accept does not authenticate caller | `app/api/supplier-register/accept/route.ts:59` |
| M10 | ESG verify does not check assessment exists or is submitted | `app/api/supplier-esg/verify/route.ts:64-78` |
| M11 | User query prompt injection risk in Rosa | `lib/gaia/context-builder.ts:59-63` |
| M12 | Certifications score GET has no org membership check | `app/api/certifications/score/route.ts:4-16` |

### Calculation (7)

| # | Finding | Location |
|---|---------|----------|
| M13 | Missing `anaerobic_digestion: 0` in EoL fallback (NaN propagation) | `lib/end-of-life-factors.ts:456-461` |
| M14 | Sensitivity analysis inconsistency (fixed 20% vs material-specific) | `lib/product-lca-aggregator.ts:822-824` |
| M15 | Natural gas double-counting risk (two entry types) | `lib/calculations/corporate-emissions.ts:128-129` |
| M16 | SY postcode area incorrectly mapped entirely to Wales | `lib/epr/constants.ts:157-163` |
| M17 | EPR validation treats net_weight_g === 0 as "missing" | `lib/epr/validation.ts:91` |
| M18 | Impact waterfall uses crude 85/15 fossil/biogenic split | `lib/impact-waterfall-resolver.ts:208-213` |
| M19 | AI classifier auto-applies at 0.7 confidence without human review | `lib/xero/sync-service.ts:481` |

### Data (4)

| # | Finding | Location |
|---|---------|----------|
| M20 | RPD Activity Name SE = "Sold via online marketplace" (should be "Sold Empty") | `lib/epr/constants.ts:55` |
| M21 | DEFRA 2025 diesel factor (2.54) needs verification | `lib/ghg-constants.ts:180` |
| M22 | Viticulture/orchard calculators have no input validation for negatives | `lib/viticulture-calculator.ts, lib/orchard-calculator.ts` |
| M23 | Temporal score boundaries inconsistent with PEDIGREE labels | `lib/data-quality-assessment.ts:279-285` |

### Performance (14)

| # | Finding | Location |
|---|---------|----------|
| M24 | N+1 queries in useKnowledgeBankItems (60+ extra round trips) | `hooks/data/useKnowledgeBank.ts:175-213` |
| M25 | N+1 queries in useKnowledgeBankCategories | `hooks/data/useKnowledgeBank.ts:87-99` |
| M26 | No query caching/deduplication layer (no TanStack Query/SWR) | All hooks in `hooks/data/` |
| M27 | Xero sync N+1 classification updates (2,000 sequential queries) | `lib/xero/sync-service.ts:427-433` |
| M28 | Password reset lists ALL users for lookup | `app/api/auth/password-reset/route.ts:54-56` |
| M29 | Dashboard widget reorder fires N sequential queries | `hooks/data/useDashboardPreferences.ts:182-189` |
| M30 | useImpactValueWidget triggers 4 redundant parallel hook fetches | `hooks/data/useImpactValueWidget.ts:21-25` |
| M31 | useGapAnalysis bulk update triggers N refetches | `hooks/data/useGapAnalysis.ts:115-130` |
| M32 | Data retrieval fetches all records without pagination | `lib/gaia/data-retrieval.ts:101-172` |
| M33 | In-memory AI caches have no size limit | Multiple Claude assistant files |
| M34 | PDFShift client has no timeout configuration | `lib/pdf/pdfshift-client.ts:99-152` |
| M35 | Sync classification limit of 2,000 silently ignores overflow | `lib/xero/sync-service.ts:388-389` |
| M36 | Framer-motion not in optimizePackageImports | `next.config.js` |
| M37 | Grunt is an unused dependency (~2MB) | `package.json:76-77` |

### Bugs (8)

| # | Finding | Location |
|---|---------|----------|
| M38 | useKnowledgeBankCategories refetch is a no-op | `hooks/data/useKnowledgeBank.ts:114` |
| M39 | Inconsistent Supabase client usage across hooks | ~30 hooks |
| M40 | Stale closure risk in useEPRWizard saveState | `hooks/data/useEPRWizard.ts:96-105` |
| M41 | useSupplierEsgAssessment debounce timer not cleaned up on unmount | `hooks/data/useSupplierEsgAssessment.ts:13,97-116` |
| M42 | useXeroTransactions swallows query errors silently | `hooks/useXeroTransactions.ts:76-86` |
| M43 | usePackagingTemplates does not auto-fetch on mount (inconsistent) | `hooks/data/usePackagingTemplates.ts:125-148` |
| M44 | Xero token refresh race condition (no concurrency protection) | `lib/xero/client.ts:69-101` |
| M45 | EPR submission line replacement not atomic (data loss on partial failure) | `app/api/epr/generate-submission/route.ts:288-291` |

### Improvements (3)

| # | Finding | Location |
|---|---------|----------|
| M46 | Embedding zero-padding (768 to 1536) degrades search quality | `lib/gaia/knowledge-indexing.ts:586-599` |
| M47 | AI-generated financial claims have no validation guardrails | `lib/claude/impact-valuation-assistant.ts:100-111` |
| M48 | DOCX text extraction uses unreliable XML regex on ZIP binary | `lib/gaia/knowledge-indexing.ts:310-420` |

---

## LOW FINDINGS (45)

### Security (8)
- L1: Session tokens in localStorage for iframe context (`lib/supabase/browser-client.ts:43-46`)
- L2: Debug auth endpoint active in non-production envs (`app/api/debug-auth/route.ts:10-14`)
- L3: In-memory rate limiters reset on cold start (systemic across 6+ routes)
- L4: Xero OAuth tokens stored in plaintext cookie for 10 min (`app/api/xero/callback/route.ts:121-128`)
- L5: Supplier delete relies solely on RLS (`app/(authenticated)/suppliers/[id]/page.tsx:72-76`)
- L6: Gaia conversation fetch has no org check (`lib/gaia/index.ts:209-233`)
- L7: DOM selector injection via Rosa action handler (`lib/gaia/action-handlers.ts:278-296`)
- L8: Stripe downgrade/proration endpoints missing admin role check (`app/api/stripe/`)

### Calculation (7)
- L9: EoL pathway percentages not validated to sum to 100 (`lib/end-of-life-factors.ts:413-419`)
- L10: Mass balance validation is a no-op (always returns valid) (`lib/lca-interpretation-engine.ts:399-401`)
- L11: Carbonation factors duplicated between modules (`lib/use-phase-factors.ts` vs `lib/calculations/scope3-categories.ts`)
- L12: UK-centric 300km distribution distance default (`lib/calculations/scope3-categories.ts:335`)
- L13: Missing categories in CATEGORY_TO_GROUP vs CONSUMER_WASTE_DATA (`lib/industry-benchmarks.ts` vs `lib/system-boundaries.ts`)
- L14: Multi-vintage median averaging for land use is questionable (`lib/viticulture-multi-vintage.ts:128`)
- L15: Mixed fertiliser organic portion assumes manure only (`lib/viticulture-calculator.ts:163-164`)

### Data (6)
- L16: RPD CSV Math.round could produce 0 for sub-0.5kg weights (`lib/epr/csv-generator.ts:46`)
- L17: DRS exclusion date not enforced (applies before scheme starts) (`lib/epr/drinks-container-rules.ts:27`)
- L18: EPR fee calculator defaults to red rate without warning (`lib/epr/fee-calculator.ts:52-54`)
- L19: ESG scoring treats all-NA section as 0% score (`lib/supplier-esg/scoring.ts:50`)
- L20: Impact valuation grand_total equals net_impact (naming misleading) (`lib/calculations/impact-valuation.ts:189`)
- L21: Living wage gap proxy application semantically unclear (`lib/calculations/impact-valuation.ts:130`)

### Performance (5)
- L22: Deprecated jsPDF still in dependencies (~400KB) (`package.json`)
- L23: Google Maps components not dynamically imported (~50KB) (component files)
- L24: Policies/stakeholders recalculate metrics on every render (`hooks/data/usePolicies.ts`)
- L25: Xero no API rate limit handling (429 not caught) (`lib/xero/sync-service.ts`)
- L26: No Xero duplicate transaction detection (economic duplicates) (`lib/xero/duplicate-detector.ts`)

### Bugs (7)
- L27: Stripe webhook returns 500 on permanent failures (causes retry storms) (`app/api/stripe/webhooks/route.ts:101-107`)
- L28: Stripe subscription deletion does not clear price ID (`app/api/stripe/webhooks/route.ts:382-392`)
- L29: Onboarding state race condition (async in setState) (`lib/onboarding/OnboardingContext.tsx:178-191`)
- L30: useReportProgress polling stale response risk (`hooks/useReportProgress.ts:73-76`)
- L31: useCompanyFootprint redundant useEffect dependencies (`hooks/data/useCompanyFootprint.ts:84-90`)
- L32: Greenwash analysis fire-and-forget with no error recovery (`lib/greenwash/index.ts:108-124`)
- L33: Claude assistants use dynamic require() instead of ES imports (`lib/claude/*.ts`)

### Improvements (12)
- L34: Middleware client module is unused/redundant (`lib/supabase/middleware-client.ts`)
- L35: Verbose auth logging in production (console.log with emails/IDs) (`components/providers/AuthProvider.tsx`, `lib/organizationContext.tsx`)
- L36: OrganizationContext value object causes unnecessary re-renders (`lib/organizationContext.tsx:338-346`)
- L37: 185 `any` type usages across 50 files (worst: LCA calculator at 27)
- L38: 360 console.log statements (server-side ones NOT stripped in production)
- L39: Error boundaries only used on dashboard page (`components/ErrorBoundary.tsx`)
- L40: Limited ARIA labelling (35 instances across 250+ components)
- L41: 7 TODO/FIXME comments including subscription check stub (`middleware/subscription-check.ts:207`)
- L42: Passport PDF still uses deprecated jsPDF approach (`lib/passport-pdf-generator.ts`)
- L43: Document extraction uses hardcoded confidence scores (`lib/gaia/document-extraction.ts:364-397`)
- L44: Proxy advisor does not validate suggestions against DB (`lib/claude/proxy-advisor.ts:380-387`)
- L45: Maturation angel's share uses fixed 63% ABV (`lib/maturation-calculator.ts:46`)

---

## POSITIVE FINDINGS

The audit also identified well-implemented areas:
- **GWP values correct** (IPCC AR6): CO2=1, CH4=27.9, N2O=273 (`lib/ghg-constants.ts`)
- **N2O conversion chain scientifically correct** (`lib/viticulture-calculator.ts:428-445`)
- **Stripe webhook signature verification** properly implemented
- **Xero OAuth CSRF protection** with state parameter and cookie validation
- **Admin routes** consistently check `is_alkatera_admin`
- **HTML escaping** consistently applied in PDF templates (LCA, Greenwash)
- **PostHog lazy loading** via requestIdleCallback (excellent pattern)
- **next.config.js** has good optimisation settings (console removal, package optimisation)
- **Refrigeration energy factors** well-derived and documented
- **PRN fulfilment tolerance** correctly handles floating-point arithmetic

---

## RECOMMENDED ACTION PLAN

### Immediate (This Week) - Critical Security

1. **Fix `getSupabaseAPIClient`** to return user-scoped client by default (fixes C1, C2, C3, C4, M7 systemically)
2. **Add org membership checks** to certifications endpoints (C9, C10)
3. **Add authentication** to unauthenticated endpoints: greenwash PDF (H6), Maps (H3), Places (H7), bulk import (H8), document extract (H9)
4. **Fix open redirects** in auth callback/confirm (H1, H2)
5. **Add org scoping** to advisor messages (C2) and data backfill (C5)

### Short-term (Next 2 Weeks) - Calculation Accuracy

6. **Fix product loss multiplier stage mapping** (C6)
7. **Replace hardcoded UK grid factor** in corporate Scope 2 and Scope 3 Cat 11 (H15, H16)
8. **Fix manual overhead overwrite** in corporate emissions (H17)
9. **Add currency conversion** for Xero spend-based emissions (H19)
10. **Add anaerobic_digestion to EoL fallback** (M13)
11. **Fix SY postcode mapping** for EPR nation estimation (M16)

### Medium-term (Next Month) - Performance & Reliability

12. **Adopt TanStack Query/SWR** for data hooks (fixes M26, deduplication, caching)
13. **Fix N+1 query patterns** in useSuppliers, useKnowledgeBank, useScope3GranularData (H21, H22, M24, M25)
14. **Move useCompanyMetrics aggregation server-side** (H23)
15. **Add Stripe webhook idempotency** (H20)
16. **Replace Google Fonts CSS @import** with next/font/google (H24)
17. **Add Zod validation** to API route inputs (M6)
18. **Sanitise supplier email HTML** (H13)

### Long-term (Next Quarter) - Code Quality & UX

19. **Add error boundaries** to all complex pages
20. **Improve accessibility** (ARIA labels, keyboard navigation)
21. **Remove deprecated jsPDF** and complete PDFShift migration
22. **Fix embedding dimension** (use 768 natively, not zero-padded 1536)
23. **Add AI cost controls** and token budgets
24. **Implement proper server-side logging** (replace console.log in API routes)
25. **Reduce `any` types** in core calculation files
26. **Explore Server Components** for read-heavy pages

---

## Methodology

This audit was conducted by 9 specialised analysis agents running in parallel, each reviewing source code against the following criteria:

1. **Auth & Middleware Security** - Authentication, session handling, org isolation, subscription gating
2. **API Route Security** - All 141 endpoints checked for auth, IDOR, input validation, error leakage
3. **LCA Calculation Engine** - Core maths, emission factors, unit conversions, boundary conditions
4. **EPR, Viticulture & Impact Calcs** - Fees, agriculture emissions, scoring algorithms
5. **Xero & Stripe Integrations** - OAuth security, webhooks, spend emissions, payments
6. **Data Hooks** - All 76 data hooks for caching, race conditions, performance
7. **AI & PDF Generation** - Prompt injection, document security, cost controls
8. **Suppliers, EPR & Features** - Invitation flows, cross-org access, wizard state
9. **Frontend Performance & UX** - Bundle size, accessibility, state management, code quality

~500 source files were reviewed across ~60 route files, 76 data hooks, 15 calculation modules, 6 integration modules, and dozens of components.
