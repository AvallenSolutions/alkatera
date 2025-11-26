# Waterfall Resolver System

## Overview

The Waterfall Resolver is a three-stage lookup system that prioritises local, realistic emission factors before falling back to external databases.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  STAGE 1: staging_emission_factors              │
│  • Highest Priority                             │
│  • Curated, verified factors                    │
│  • Realistic values for beverage industry       │
│  • Organization-specific + global factors       │
└─────────────────────────────────────────────────┘
                     ↓ (if not found)
┌─────────────────────────────────────────────────┐
│  STAGE 2: Cache (openlca_process_cache)        │
│  • Previously searched OpenLCA results          │
│  • 24-hour TTL                                  │
│  • Faster response time                         │
└─────────────────────────────────────────────────┘
                     ↓ (if not found)
┌─────────────────────────────────────────────────┐
│  STAGE 3: OpenLCA Server / Mock Data            │
│  • External database query                      │
│  • Fallback if local factors unavailable        │
│  • Mock data if OpenLCA not configured          │
└─────────────────────────────────────────────────┘
```

## Database Schema

### `staging_emission_factors` Table

```sql
CREATE TABLE staging_emission_factors (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  category text CHECK (category IN ('Ingredient', 'Packaging', 'Energy', 'Transport', 'Waste')),
  co2_factor numeric NOT NULL CHECK (co2_factor >= 0),
  reference_unit text NOT NULL,
  source text DEFAULT 'Internal Proxy',
  uuid_ref text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Current Seed Data (Beverage Industry Tech Pack)

#### Packaging (5 factors)
- **Glass Bottle (Standard Flint)**: 1.10 kg CO₂e/kg
- **Glass Bottle (60% PCR)**: 0.65 kg CO₂e/kg
- **Aluminium Cap**: 9.20 kg CO₂e/kg
- **Paper Label (Wet Glue)**: 1.10 kg CO₂e/kg
- **Corrugated Cardboard**: 0.95 kg CO₂e/kg

#### Ingredients (7 factors)
- **Water (Municipal Treatment)**: 0.0003 kg CO₂e/kg
- **Sugar (Beet - EU)**: 0.55 kg CO₂e/kg
- **Sugar (Cane - Global)**: 0.90 kg CO₂e/kg
- **Citric Acid**: 5.50 kg CO₂e/kg
- **Ethanol (Grain)**: 1.60 kg CO₂e/kg
- **Gin Concentrate**: 1.85 kg CO₂e/kg
- **CO₂ (Industrial)**: 1.10 kg CO₂e/kg

#### Energy & Transport (3 factors)
- **Electricity (Grid - UK)**: 0.21 kg CO₂e/kWh
- **Natural Gas (Heat)**: 0.20 kg CO₂e/kWh
- **Transport (HGV Diesel)**: 0.12 kg CO₂e/tkm

## API Implementation

### Ingredient Search Route
**File:** `app/api/ingredients/search/route.ts`

**Waterfall Logic:**
1. Query `staging_emission_factors` with `ILIKE` search
2. If found: Return immediately with `waterfall_stage: 1`
3. If not found: Check cache
4. If cache miss: Query OpenLCA server
5. Return with appropriate `waterfall_stage` indicator

**Response Format:**
```json
{
  "results": [...],
  "waterfall_stage": 1,
  "source": "staging_emission_factors",
  "note": "Using local staging library (highest priority)"
}
```

### Supplier Products Search Route
**File:** `app/api/supplier-products/search/route.ts`

**Waterfall Logic:**
1. Query `staging_emission_factors` first
2. Also query `supplier_products` in parallel
3. Combine results with staging factors first (priority order)
4. Return combined list with `waterfall_stage: 1`

**Response Format:**
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "Glass Bottle (Standard Flint)",
      "supplier_name": "Internal Proxy Library",
      "category": "Packaging",
      "unit": "kg",
      "carbon_intensity": 1.10,
      "product_code": "STAGING-abc12345",
      "_source": "staging_emission_factors"
    },
    ...supplier products...
  ],
  "waterfall_stage": 1,
  "note": "Staging factors shown first (highest priority), followed by supplier products"
}
```

## Frontend Components

### StagingFactorSelector Component
**File:** `components/lca/StagingFactorSelector.tsx`

**Usage:**
```tsx
<StagingFactorSelector
  category="Packaging"
  value={selectedId}
  onSelect={(factor) => {
    console.log('Selected:', factor.name);
    console.log('CO₂ Factor:', factor.co2_factor);
    console.log('Unit:', factor.reference_unit);
  }}
  placeholder="Select packaging material..."
/>
```

**Features:**
- Dropdown with search functionality
- Shows CO₂ factor badge next to each option
- Displays metadata (description, typical mass)
- Visual indicator of data source (Internal Proxy)

## Database Helper Function

### `get_emission_factor_with_fallback()`

**Purpose:** Server-side function for waterfall lookup

**Usage:**
```sql
SELECT * FROM get_emission_factor_with_fallback('Glass Bottle', 'org-uuid-here');
```

**Returns:**
```
factor_id    | uuid
factor_name  | text
factor_value | numeric
factor_unit  | text
factor_source | text
```

**Logic:**
1. Check `staging_emission_factors` (org-specific first, then global)
2. If not found, check `emissions_factors` (OpenLCA/DEFRA)
3. Return first match

## Data Purge

### Manual Purge Script
**File:** `PURGE_TEST_DATA.sql`

**Purpose:** Clear all test data whilst preserving users and organisations

**Preserves:**
- Users (`auth.users`)
- Organizations (`organizations`)
- Organization Members (`organization_members`)
- Emission Factors (`emissions_factors`, `staging_emission_factors`)

**Deletes:**
- All Products and Product LCAs
- All Materials (Ingredients & Packaging)
- All Activity Data
- All Production Logs
- All Calculation Logs

**Execute:**
```sql
-- Run in Supabase SQL Editor
-- Copy contents of PURGE_TEST_DATA.sql
```

## Benefits

1. **Realistic Calculations**: No more random or placeholder values
2. **Fast Lookups**: Local data queried first before external APIs
3. **Data Quality**: Curated, verified emission factors
4. **User Experience**: Dropdown selection instead of free text input
5. **Flexibility**: Organization-specific factors override global ones
6. **Traceability**: Source tracking on all factors

## Adding New Factors

### Via SQL
```sql
INSERT INTO staging_emission_factors (
  organization_id,
  name,
  category,
  co2_factor,
  reference_unit,
  source,
  metadata
) VALUES (
  NULL,  -- NULL for global factors
  'New Material Name',
  'Ingredient',  -- or 'Packaging', 'Energy', 'Transport'
  1.23,  -- CO₂e factor
  'kg',  -- reference unit
  'Internal Proxy',
  '{"description": "Material description"}'
);
```

### Via Admin UI (Future)
- Navigate to Settings → Emission Factors
- Click "Add Custom Factor"
- Fill in details and save
- Factor becomes available organization-wide

## Testing the Waterfall

### Test Stage 1 (Staging Factors)
```bash
curl -X GET "http://localhost:3000/api/ingredients/search?q=sugar" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "results": [...],
  "waterfall_stage": 1,
  "source": "staging_emission_factors"
}
```

### Test Stage 3 (OpenLCA Fallback)
```bash
curl -X GET "http://localhost:3000/api/ingredients/search?q=nonexistent_material" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "results": [...],
  "waterfall_stage": 3,
  "source": "openlca_server"
}
```

## Migration Applied

**File:** `20251126100000_create_staging_emission_factors_and_purge.sql`

**Changes:**
- Created `staging_emission_factors` table
- Added RLS policies (organization-level access)
- Seeded 15 initial factors (beverage industry)
- Created `get_emission_factor_with_fallback()` function
- Added indexes for performance

## Next Steps

1. Execute purge script to clear test data
2. Test waterfall lookup with real queries
3. Verify staging factors appear first in dropdowns
4. Add more industry-specific factors as needed
5. Build admin UI for factor management
