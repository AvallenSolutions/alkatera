# Water Calculation Methodology

## Overview

AlkaTera tracks water impact through **two separate and complementary streams** to provide a complete picture of an organisation's water footprint.

## Two Water Streams

### 1. **OPERATIONAL WATER** (Direct Facility Usage)
Water directly consumed at owned or operated facilities.

**Data Sources:**
- `facility_activity_entries` table
- Categories: `water_intake`, `water_discharge`, `water_recycled`
- Unit: m³ (cubic metres)

**Metrics:**
- **Intake:** Total water withdrawn from all sources
- **Discharge:** Water returned to the environment (e.g., wastewater)
- **Net Consumption:** Intake - Discharge (water that is consumed/lost)
- **Recycled:** Water reused within the facility

**Example:**
Test Distillery facility records:
- Intake: 1,000 m³
- Discharge: 100 m³
- **Net Operational Water: 900 m³**

**Purpose:** Represents local water stress impact where facilities are located.

---

### 2. **EMBEDDED WATER** (Supply Chain Footprint)
Water consumed in the upstream production of ingredients, packaging, and materials used in products.

**Data Sources:**
- `product_lca_materials` → water footprint of each ingredient/packaging component
- `product_lca_production_sites` → product LCAs linked to facilities
- `contract_manufacturer_allocations` → water allocated from contract manufacturers

**Metrics:**
- **Total Embedded Water:** Sum of water footprints from all product materials
- Calculated per product unit, then scaled by production volume

**Example:**
Test Calvados product:
- Embedded water per unit: 0.01 m³ (includes water to grow apples, produce glass bottle, etc.)
- Production volume: 100,000 units
- **Total Embedded Water: 1,000 m³**

**Purpose:** Represents supply chain water impact (Scope 3 Category 1 - Purchased Goods & Services).

---

## Total Water Footprint

```
TOTAL WATER FOOTPRINT = OPERATIONAL WATER + EMBEDDED WATER
```

**Example for Test Distillery:**
```
Operational Net:  900 m³  (water used at facility)
Embedded:       1,000 m³  (water in ingredients/packaging)
──────────────────────
TOTAL:          1,900 m³
```

---

## No Double Counting

These streams are **complementary, not overlapping:**

| Stream | What It Captures | What It Excludes |
|--------|------------------|-------------------|
| **Operational** | Water physically used at our facilities | Water used upstream to make our inputs |
| **Embedded** | Water used to produce ingredients/packaging **before** they arrive | Water used at our facilities |

**Example:**
- **Operational:** Water used to wash, distil, and bottle the spirit at the distillery ✅
- **Embedded:** Water used to grow the apples in orchards, make glass bottles, print labels ✅
- **NOT double counted:** The same water is never counted in both streams

---

## Water Scarcity Weighting (AWARE Method)

Both streams can be weighted by local water scarcity using the **AWARE (Available WAter REmaining)** method:

```
Scarcity-Weighted Water = Water Volume × AWARE Factor
```

**AWARE Factors by Country** (m³ world-eq per m³):
- 🇫🇷 France: 20.5 (medium stress)
- 🇬🇧 UK: 8.2 (low stress)
- 🇪🇸 Spain: 54.8 (high stress)

**Important:**
- **Operational water** is weighted by the facility's location (where it's used)
- **Embedded water** is weighted by the origin of each material (where ingredients/packaging are produced)

**Risk Levels:**
- **High Risk:** AWARE > 40 (e.g., Spain, Saudi Arabia)
- **Medium Risk:** AWARE 20-40 (e.g., France, Italy)
- **Low Risk:** AWARE < 20 (e.g., UK, Ireland, Norway)

---

## UI Labeling Requirements

### ✅ CORRECT Labeling Examples

```
"Operational Water: 900 m³"
"Direct facility water consumption"

"Embedded Water: 1,000 m³"
"Supply chain water from products"

"Total Water Footprint: 1,900 m³"
"Operational (900 m³) + Embedded (1,000 m³)"
```

### ❌ INCORRECT (Ambiguous)

```
"Water Consumption: 1,900 m³"  ← Which stream?
"Total Water: 1,900 m³"       ← Unclear if operational only or total
"Water Impact"                 ← Too vague
```

---

## Dashboard Display Strategy

### Overview Cards
Show **TOTAL WATER FOOTPRINT** with breakdown:
```
💧 Total Water Footprint: 1,900 m³
   → Operational: 900 m³ (47%)
   → Embedded: 1,000 m³ (53%)
```

### Facility Detail Pages
Show **OPERATIONAL WATER** prominently (it's facility-specific):
```
🏭 Facility Operational Water
   Intake: 1,000 m³
   Discharge: 100 m³
   Net Consumption: 900 m³

📦 Product LCA Embedded Water
   Supply chain water from linked products: 1,000 m³
   Products: TEST CALVADOS
```

### Product Detail Pages
Show **EMBEDDED WATER** (it's product-specific):
```
📦 Product Water Footprint (per unit): 0.01 m³
   Ingredients: 0.006 m³
   Packaging: 0.004 m³
```

---

## Data Quality Hierarchy

1. **Primary (Best):** Direct facility meter readings → `facility_activity_entries`
2. **Secondary:** Product LCA calculations → `product_lca_materials`
3. **Tertiary:** Contract manufacturer allocations → `contract_manufacturer_allocations`
4. **Proxy:** Industry averages from `staging_emission_factors` (when no specific data)

---

## Compliance Standards

This methodology aligns with:
- **CSRD E3:** Water and marine resources disclosure
- **GRI 303:** Water and Effluents (2018)
- **CDP Water Security:** Water accounting and governance
- **ISO 14046:** Water Footprint - Principles, requirements and guidelines
- **GHG Protocol:** Scope 3 Category 1 (for embedded water in purchased goods)

---

## Implementation Notes

### Database Structure
- Operational: `facility_activity_entries` (activity_category: water_intake, water_discharge)
- Embedded LCA: `product_lca_materials` (impact_water field) → `product_lca_production_sites`
- Embedded CM: `contract_manufacturer_allocations` (allocated_water_litres field)

### Hook: `useCompanyMetrics`
Function: `fetchFacilityWaterRisks()`
- Lines 687-866
- Properly separates operational and embedded water
- Calculates scarcity-weighted metrics
- Links products to facilities

### Components to Update
- ✅ `WaterCard.tsx` - Show total with breakdown
- ✅ `WaterDeepDive.tsx` - Separate tabs for each stream
- ✅ Facility detail water sections - Label operational vs embedded
- ✅ Product detail pages - Show embedded water only

---

## Testing Verification

**Test Organization:** Test (2d86de84-e24e-458b-84b9-fd4057998bda)
**Test Facility:** Test Distillery (574aea99-f60f-4bf0-bdbc-6514bf08c1f0)
**Test Product:** TEST CALVADOS (ID: 53)

Expected Results:
```sql
-- Operational Water
SELECT activity_category, SUM(quantity) as m3
FROM facility_activity_entries
WHERE facility_id = '574aea99-f60f-4bf0-bdbc-6514bf08c1f0'
  AND activity_category IN ('water_intake', 'water_discharge')
GROUP BY activity_category;
-- Result: intake=1000, discharge=100, net=900 m³

-- Embedded Water
SELECT allocated_water_litres / 1000.0 as water_m3
FROM contract_manufacturer_allocations
WHERE facility_id = '574aea99-f60f-4bf0-bdbc-6514bf08c1f0'
  AND product_id = 53;
-- Result: 1000 m³

-- Total: 900 + 1000 = 1,900 m³
```

---

**Last Updated:** 2026-01-11
**Version:** 1.0
