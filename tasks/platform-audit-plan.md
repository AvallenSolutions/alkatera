# alka**tera** Platform Audit Plan

**Date:** 2026-04-01
**Objective:** Comprehensive deep analysis of every feature, covering bugs, performance, security, calculation errors, data issues, and code improvements.

---

## Audit Methodology

Each audit phase will systematically review code for:
1. **Bugs & Errors** - Logic errors, unhandled edge cases, race conditions, null/undefined risks, incorrect state management
2. **Performance Issues** - N+1 queries, missing indexes, unnecessary re-renders, large bundle imports, missing caching, inefficient algorithms
3. **Security Issues** - Missing auth checks, SQL injection, XSS, CSRF, exposed secrets, insecure API routes, missing RLS, IDOR vulnerabilities
4. **Calculation Errors** - Incorrect formulas, unit mismatches, rounding errors, boundary conditions, missing conversions
5. **Data Issues** - Missing validation, data integrity gaps, orphaned records, inconsistent types, missing constraints
6. **Code Improvements** - Dead code, duplicated logic, missing error handling at boundaries, unclear abstractions, type safety gaps

---

## Phase 1: Core Infrastructure & Security

### 1.1 Authentication & Authorisation
- `middleware.ts` - Session handling, route protection
- `components/providers/AuthProvider.tsx` - Auth state management
- `lib/supabase/` - All Supabase client configurations
- `app/(auth)/` - Login, password reset, callback flows
- `hooks/useAuth.ts`, `hooks/usePermissions.ts`
- Check: Are all authenticated routes actually protected? Any bypass?

### 1.2 Organisation & Multi-tenancy
- `lib/organizationContext.tsx` - Org state, advisor access
- RLS policies across all tables - data isolation between orgs
- API routes - do they all validate org membership?
- Supplier portal - cross-org data leakage risks

### 1.3 Subscription & Access Control
- `hooks/useSubscription.ts` - Tier gating
- `lib/subscription-limits.ts`, `lib/subscription-utils.ts`
- `components/layouts/AppLayout.tsx` - Gate logic
- Stripe webhooks - race conditions, replay attacks
- Grace period cron jobs - edge cases

### 1.4 API Route Security Audit
- All 141 API routes checked for:
  - Authentication verification
  - Organisation-scoped queries
  - Input validation (Zod schemas)
  - Rate limiting
  - Error information leakage
  - HTTP method enforcement

---

## Phase 2: Calculation Engines (High Risk)

### 2.1 LCA Calculator
- `lib/product-lca-calculator.ts` - Core LCA maths
- `lib/product-lca-aggregator.ts` - Aggregation logic
- `lib/system-boundaries.ts` - Boundary definitions
- `lib/allocation-engine.ts` - Impact allocation
- Unit conversions, emission factor lookups, rounding
- ISO 14044 compliance logic

### 2.2 Viticulture & Orchard Calculators
- `lib/viticulture-calculator.ts` - Vineyard emissions
- `lib/viticulture-multi-vintage.ts` - Multi-year handling
- `lib/orchard-calculator.ts` - Orchard emissions
- `lib/orchard-multi-harvest.ts` - Multi-harvest logic
- `lib/maturation-calculator.ts` - Maturation periods
- Boundary conditions, zero-value handling, unit consistency

### 2.3 EPR Calculations
- `lib/epr/fee-calculator.ts` - Fee maths
- `lib/epr/prn-calculator.ts` - PRN obligations
- `lib/epr/nation-estimator.ts` - Nation split logic
- `lib/epr/obligation-checker.ts` - Threshold checks
- `lib/epr/drinks-container-rules.ts` - Category rules
- Government rate accuracy, rounding rules

### 2.4 Corporate Emissions & Scope 3
- `lib/calculations/corporate-emissions.ts`
- `lib/calculations/scope3-categories.ts`
- `lib/grid-emission-factors.ts`
- `lib/distribution-factors.ts`
- `lib/use-phase-factors.ts`, `lib/end-of-life-factors.ts`
- Double counting, boundary completeness

### 2.5 Impact Valuation & Scoring
- `lib/calculations/impact-valuation.ts`
- `lib/calculations/people-culture-score.ts`
- `lib/calculations/waste-circularity.ts`
- `lib/calculations/water-risk.ts`
- `lib/calculations/nature-biodiversity.ts`
- Proxy values, weighting, normalisation

### 2.6 Xero Spend-based Emissions
- `lib/xero/spend-factors.ts` - Spend factors
- `lib/xero/ai-classifier.ts` - AI classification accuracy
- `lib/xero/classifier.ts` - Rule-based classification
- `lib/xero/travel-emissions.ts` - Travel calc
- Currency handling, factor accuracy

---

## Phase 3: Data Layer & Integrity

### 3.1 Database Schema Review
- All migrations in `supabase/migrations/`
- Missing indexes on commonly queried columns
- Missing foreign key constraints
- Orphan record risks
- Data type appropriateness (e.g. numeric precision for emissions)

### 3.2 RLS Policy Audit
- Every table's RLS policies verified
- Ensure no tables are accessible without org context
- Service role usage in API routes - justified?
- Supplier portal data access boundaries

### 3.3 Data Hooks Review
- All 76 data hooks in `hooks/data/`
- SWR/fetch patterns - stale data risks
- Error handling and loading states
- Cache invalidation after mutations
- Unnecessary refetches, missing deduplication

---

## Phase 4: Feature-by-Feature Audit

### 4.1 Products & Materials
- Product CRUD, materials composition, recipe editor
- Bulk import (`lib/bulk-import/`) - validation, error handling
- BOM parsing (`lib/bom/`) - edge cases
- Product categories and type handling

### 4.2 LCA Reports & PDF Generation
- `lib/pdf/render-lca-html.ts` - HTML template correctness
- `lib/pdf/pdfshift-client.ts` - API error handling
- `components/lca/` - Wizard flow, state management
- Public LCA report page - data exposure

### 4.3 Supplier Management
- Invitation flow (email, token handling)
- Supplier portal (`app/(authenticated)/supplier-portal/`)
- ESG assessment (`lib/supplier-esg/`)
- Supplier verification admin flow
- Cross-org supplier visibility

### 4.4 EPR Module
- Wizard flow and state persistence
- Submission generation and CSV export
- HMRC integration endpoints
- Audit log completeness
- Fee calculation accuracy vs. gov rates

### 4.5 ESG & Social Impact
- Community impact tracking (donations, volunteering, stories)
- Governance module (board, policies, stakeholders)
- People & Culture (DEI, wellbeing, training, fair work)
- Score calculations across all modules

### 4.6 Company Operations
- Facilities management and geocoding
- Fleet tracking
- Data logging and scope 1-2 entries
- Production allocation logic

### 4.7 Reporting Engine
- Report builder - custom report generation
- Company footprint reports
- Sustainability report generation (SlideSpeak, PDFShift)
- Impact valuation reports
- Chart rendering (QuickChart, CSS charts)

### 4.8 Knowledge Bank
- CRUD operations and categorisation
- Signed URL generation for file access
- Content search functionality

### 4.9 Greenwash Guardian
- Assessment logic and scoring
- PDF report generation
- Legislation knowledge base accuracy
- Bulk assessment handling

### 4.10 Certifications
- Framework definitions and gap analysis
- Evidence tracking and audit packages
- Score calculations

### 4.11 Vineyards & Orchards
- CRUD, growing profiles, evidence
- Dashboard metrics and calculations
- Template generation for bulk import

### 4.12 GAIA AI Assistant
- System prompt security (injection risks)
- Context building - data exposure
- Action handlers - permission checks
- Knowledge search and indexing

### 4.13 Settings & Billing
- Team management and invitations
- Billing portal (Stripe integration)
- Feedback system
- Messaging system

### 4.14 Admin Panel
- Platform analytics
- Emission factor management
- Beta access controls
- Blog management
- Approval workflows

### 4.15 Onboarding Wizard
- 5-phase, 14-step flow
- State persistence and resumability
- Dismissal and re-entry logic

---

## Phase 5: Frontend & UX

### 5.1 Component Quality
- Type safety across all 443 components
- Accessibility (ARIA, keyboard navigation, screen readers)
- Loading and error states
- Responsive design issues

### 5.2 Performance
- Bundle size analysis (large imports)
- Unnecessary re-renders (missing memo/useMemo)
- Image optimisation
- Client-side data fetching waterfalls

### 5.3 State Management
- Context provider nesting and re-render cascade
- Form state management consistency
- URL state synchronisation

---

## Phase 6: External Integrations

### 6.1 Stripe
- Webhook signature verification
- Subscription state sync reliability
- Edge cases: failed payments, downgrades, cancellations

### 6.2 Xero
- OAuth token refresh handling
- Token encryption security
- Sync reliability and error recovery
- Duplicate detection accuracy

### 6.3 OpenLCA
- Connection resilience
- Factor resolution accuracy
- Fallback when OpenLCA is unavailable

### 6.4 AI Services (Anthropic, Google)
- API key security
- Error handling and fallbacks
- Cost controls (token limits)
- Prompt injection in user inputs

### 6.5 PDFShift / SlideSpeak / QuickChart
- Error handling and retries
- Timeout handling
- HTML injection in generated documents

### 6.6 Google Maps
- API key protection (runtime serving)
- Geocoding error handling

---

## Phase 7: DevOps & Deployment

### 7.1 Netlify Configuration
- Security headers completeness
- CSP policy coverage
- Cache configuration
- Build optimisation

### 7.2 Cron Jobs
- 4 cron endpoints - reliability, error handling
- Idempotency (safe to re-run?)
- Monitoring and alerting

### 7.3 Environment Variables
- All required vars documented?
- Any hardcoded secrets in code?
- Development vs. production configuration

---

## Execution Strategy

Each phase will be executed by dedicated subagents reading the actual source code, analysing it against the criteria above, and producing findings in a structured format:

```
### Finding: [Title]
- **Category:** Bug | Performance | Security | Calculation | Data | Improvement
- **Severity:** Critical | High | Medium | Low
- **Location:** file:line
- **Description:** What the issue is
- **Impact:** What could go wrong
- **Recommendation:** How to fix it
```

The final report will consolidate all findings, sorted by severity, with actionable recommendations.

---

## Estimated Scope
- ~500 source files to review
- 141 API endpoints
- 120+ database migrations
- 86 custom hooks
- 6 calculation engines
- 6 external integrations
