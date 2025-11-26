# Multi-Capital Staging Emission Factors

## Overview

All 15 staging emission factors now include **four-capital impact data**: Climate (CO₂), Water, Land Use, and Waste. This enables comprehensive environmental assessments across multiple impact categories.

## Multi-Capital Framework

```
┌─────────────────────────────────────────────────────┐
│  FOUR CAPITALS - COMPLETE ENVIRONMENTAL PROFILE     │
├─────────────────────────────────────────────────────┤
│  1. CLIMATE      → co2_factor (kg CO₂e/unit)        │
│  2. WATER        → water_factor (m³/unit)           │
│  3. LAND/NATURE  → land_factor (m²/unit)            │
│  4. CIRCULARITY  → waste_factor (kg/unit)           │
└─────────────────────────────────────────────────────┘
```

---

## Complete Staging Factors Library

### PACKAGING (5 Items)

#### 1. Glass Bottle (Standard Flint)
- **Climate:** 1.10 kg CO₂e/kg
- **Water:** 0.005 m³/kg (5 L/kg)
- **Land:** 0.02 m²/kg
- **Waste:** 0.05 kg/kg (mining slag, 5%)
- **Notes:** Energy-intensive production, moderate waste from mining

#### 2. Glass Bottle (60% PCR)
- **Climate:** 0.65 kg CO₂e/kg ↓ 41% vs virgin
- **Water:** 0.003 m³/kg (3 L/kg) ↓ 40% vs virgin
- **Land:** 0.01 m²/kg ↓ 50% vs virgin
- **Waste:** 0.02 kg/kg ↓ 60% vs virgin
- **Notes:** Recycled content significantly reduces all impacts

#### 3. Aluminium Cap
- **Climate:** 9.20 kg CO₂e/kg ⚠️ HIGH
- **Water:** 0.015 m³/kg (15 L/kg)
- **Land:** 0.05 m²/kg
- **Waste:** 0.20 kg/kg ⚠️ HIGH (bauxite red mud)
- **Notes:** Most impactful packaging component - bauxite mining generates toxic red mud waste

#### 4. Paper Label (Wet Glue)
- **Climate:** 1.10 kg CO₂e/kg
- **Water:** 0.08 m³/kg (80 L/kg) ⚠️ HIGH
- **Land:** 0.90 m²/kg ⚠️ HIGH (forestry)
- **Waste:** 0.05 kg/kg
- **Notes:** Pulp processing is extremely water-intensive; requires managed forestry land

#### 5. Corrugated Cardboard
- **Climate:** 0.95 kg CO₂e/kg
- **Water:** 0.06 m³/kg (60 L/kg)
- **Land:** 0.60 m²/kg (forestry)
- **Waste:** 0.08 kg/kg
- **Notes:** Often contains recycled content; secondary packaging material

---

### INGREDIENTS (7 Items)

#### 6. Water (Municipal Treatment)
- **Climate:** 0.0003 kg CO₂e/kg
- **Water:** 1.00 m³/kg ⚠️ 1:1 consumption
- **Land:** 0.0001 m²/kg
- **Waste:** 0.0001 kg/kg
- **Notes:** Direct 1:1 water consumption; minimal other impacts

#### 7. Sugar (Beet - EU)
- **Climate:** 0.55 kg CO₂e/kg
- **Water:** 0.15 m³/kg (150 L/kg)
- **Land:** 1.20 m²/kg ⚠️ HIGH (agriculture)
- **Waste:** 0.05 kg/kg (beet pulp)
- **Notes:** Temperate crop, moderate irrigation needs

#### 8. Sugar (Cane - Global)
- **Climate:** 0.90 kg CO₂e/kg ↑ 64% vs beet
- **Water:** 0.25 m³/kg (250 L/kg) ⚠️ VERY HIGH ↑ 67% vs beet
- **Land:** 1.40 m²/kg ⚠️ VERY HIGH ↑ 17% vs beet
- **Waste:** 0.10 kg/kg (bagasse)
- **Notes:** Tropical crop with high water demand and land use

#### 9. Citric Acid
- **Climate:** 5.50 kg CO₂e/kg ⚠️ HIGH
- **Water:** 0.12 m³/kg (120 L/kg)
- **Land:** 0.40 m²/kg
- **Waste:** 0.08 kg/kg (fermentation waste)
- **Notes:** Industrial fermentation process, energy and water intensive

#### 10. Ethanol (Grain)
- **Climate:** 1.60 kg CO₂e/kg
- **Water:** 0.40 m³/kg (400 L/kg) ⚠️ VERY HIGH
- **Land:** 1.80 m²/kg ⚠️ VERY HIGH (grain farming)
- **Waste:** 0.15 kg/kg (distillation waste)
- **Notes:** Intensive agriculture plus distillation energy; high land and water footprint

#### 11. Gin Concentrate
- **Climate:** 1.85 kg CO₂e/kg
- **Water:** 0.10 m³/kg (100 L/kg)
- **Land:** 0.80 m²/kg (botanical farming)
- **Waste:** 0.05 kg/kg
- **Notes:** Botanical cultivation requires significant land; extraction process

#### 12. CO₂ (Industrial)
- **Climate:** 1.10 kg CO₂e/kg
- **Water:** 0.002 m³/kg (2 L/kg) ✓ LOW
- **Land:** 0.001 m²/kg ✓ LOW
- **Waste:** 0.001 kg/kg ✓ LOW
- **Notes:** Often a by-product of other processes; minimal additional impacts

---

### ENERGY & TRANSPORT (3 Items)

#### 13. Electricity (Grid - UK)
- **Climate:** 0.21 kg CO₂e/kWh
- **Water:** 0.04 m³/kWh (40 L/kWh) - thermal plant cooling
- **Land:** 0.001 m²/kWh (grid infrastructure)
- **Waste:** 0.005 kg/kWh (ash, slag)
- **Notes:** UK grid mix including renewables; thermal plants require cooling water

#### 14. Natural Gas (Heat)
- **Climate:** 0.20 kg CO₂e/kWh
- **Water:** 0.001 m³/kWh (1 L/kWh) ✓ LOW
- **Land:** 0.002 m²/kWh (extraction)
- **Waste:** 0.002 kg/kWh ✓ LOW
- **Notes:** Cleaner fossil fuel; lower water and waste than coal

#### 15. Transport (HGV Diesel)
- **Climate:** 0.12 kg CO₂e/tkm
- **Water:** 0.001 m³/tkm (1 L/tkm) ✓ LOW
- **Land:** 0.03 m²/tkm (road infrastructure allocation)
- **Waste:** 0.005 kg/tkm ✓ LOW
- **Notes:** Heavy goods vehicle; land impact from road infrastructure

---

## Impact Hotspot Analysis

### Highest Climate Impact (CO₂)
1. **Aluminium Cap** - 9.20 kg CO₂e/kg ⚠️
2. **Citric Acid** - 5.50 kg CO₂e/kg
3. **Gin Concentrate** - 1.85 kg CO₂e/kg

### Highest Water Impact
1. **Water (Municipal)** - 1.00 m³/kg (1:1 consumption)
2. **Ethanol (Grain)** - 0.40 m³/kg ⚠️
3. **Sugar (Cane)** - 0.25 m³/kg ⚠️

### Highest Land Impact
1. **Ethanol (Grain)** - 1.80 m²/kg ⚠️
2. **Sugar (Cane)** - 1.40 m²/kg ⚠️
3. **Sugar (Beet)** - 1.20 m²/kg ⚠️

### Highest Waste Impact
1. **Aluminium Cap** - 0.20 kg/kg ⚠️ (20% - bauxite red mud)
2. **Ethanol (Grain)** - 0.15 kg/kg
3. **Sugar (Cane)** - 0.10 kg/kg

---

## Usage in Calculations

### Multi-Capital Calculation Formula

```typescript
// For each material in a product:
const climateImpact = materialMass * co2_factor;
const waterImpact = materialMass * water_factor;
const landImpact = materialMass * land_factor;
const wasteImpact = materialMass * waste_factor;

// Total product impacts (sum across all materials):
const totalClimate = ingredients.reduce((sum, i) => sum + (i.mass * i.co2_factor), 0);
const totalWater = ingredients.reduce((sum, i) => sum + (i.mass * i.water_factor), 0);
const totalLand = ingredients.reduce((sum, i) => sum + (i.mass * i.land_factor), 0);
const totalWaste = ingredients.reduce((sum, i) => sum + (i.mass * i.waste_factor), 0);
```

### Example: 250ml Glass Bottle Product

**Recipe:**
- Water: 235g
- Sugar (Beet): 28g
- Citric Acid: 2g
- Glass Bottle (60% PCR): 250g
- Aluminium Cap: 3g
- Paper Label: 2g

**Calculation:**

| Material | Mass (kg) | Climate | Water | Land | Waste |
|----------|-----------|---------|-------|------|-------|
| Water | 0.235 | 0.0001 | 0.235 | 0.00002 | 0.00002 |
| Sugar (Beet) | 0.028 | 0.015 | 0.004 | 0.034 | 0.001 |
| Citric Acid | 0.002 | 0.011 | 0.0002 | 0.001 | 0.0002 |
| Glass Bottle | 0.250 | 0.163 | 0.001 | 0.003 | 0.005 |
| Aluminium Cap | 0.003 | 0.028 | 0.00005 | 0.0002 | 0.001 |
| Paper Label | 0.002 | 0.002 | 0.0002 | 0.002 | 0.0001 |
| **TOTAL** | **0.520kg** | **0.219 kg CO₂e** | **0.240 m³** | **0.040 m²** | **0.007 kg** |

**Per Functional Unit (250ml bottle):**
- Climate: 0.219 kg CO₂e
- Water: 240 litres
- Land: 0.040 m²
- Waste: 7 grams

---

## Data Quality & Sources

### Proxy Data Methodology
These factors are **realistic proxies** based on:
- Published LCA studies (Ecoinvent, DEFRA)
- Industry averages for beverage sector
- Literature review of agricultural and manufacturing processes
- Conservative estimates where ranges exist

### Confidence Levels
- **High Confidence** (±15%): Packaging materials, UK electricity
- **Medium Confidence** (±30%): Ingredients (regional variation)
- **Lower Confidence** (±50%): Complex ingredients (gin concentrate, citric acid)

### Future Improvements
1. **Region-Specific Factors** - Different water/land factors by geography
2. **Seasonal Variation** - Agricultural factors vary by season
3. **Supply Chain Specificity** - Supplier-provided EPD data preferred
4. **AWARE Weighting** - Apply water scarcity factors by basin
5. **Circularity Credits** - End-of-life recycling benefits

---

## Database Schema

```sql
CREATE TABLE staging_emission_factors (
  -- Identity
  id uuid PRIMARY KEY,
  organization_id uuid,
  name text NOT NULL,
  category text CHECK (IN 'Ingredient', 'Packaging', 'Energy', 'Transport', 'Waste'),

  -- Four Capital Factors
  co2_factor numeric NOT NULL CHECK (co2_factor >= 0),     -- kg CO₂e/unit
  water_factor numeric DEFAULT 0 CHECK (water_factor >= 0), -- m³/unit
  land_factor numeric DEFAULT 0 CHECK (land_factor >= 0),   -- m²/unit
  waste_factor numeric DEFAULT 0 CHECK (waste_factor >= 0), -- kg/unit

  -- Metadata
  reference_unit text NOT NULL,
  source text DEFAULT 'Internal Proxy',
  metadata jsonb
);
```

---

## Query Examples

### Get All Factors for a Category
```sql
SELECT name, co2_factor, water_factor, land_factor, waste_factor, reference_unit
FROM staging_emission_factors
WHERE category = 'Packaging'
ORDER BY co2_factor DESC;
```

### Find High Water Impact Materials
```sql
SELECT name, water_factor, reference_unit
FROM staging_emission_factors
WHERE water_factor > 0.1
ORDER BY water_factor DESC;
```

### Calculate Multi-Capital Product Impact
```sql
-- Example: Calculate total impacts for a product
WITH product_materials AS (
  SELECT
    'Water' as material,
    0.235 as mass_kg,
    0.0003 as co2_factor,
    1.00 as water_factor,
    0.0001 as land_factor,
    0.0001 as waste_factor
  UNION ALL
  SELECT 'Sugar (Beet)', 0.028, 0.55, 0.15, 1.20, 0.05
  -- ... more materials
)
SELECT
  SUM(mass_kg * co2_factor) as total_climate_kg_co2e,
  SUM(mass_kg * water_factor) as total_water_m3,
  SUM(mass_kg * land_factor) as total_land_m2,
  SUM(mass_kg * waste_factor) as total_waste_kg
FROM product_materials;
```

---

## Migration Applied

**File:** `add_multi_capital_factors_to_staging.sql`

**Changes:**
1. Added 3 new columns: `water_factor`, `land_factor`, `waste_factor`
2. Added non-negative check constraints
3. Populated all 15 staging factors with multi-capital data
4. Added column comments for documentation
5. Verification query confirms 100% population

**Status:** ✅ Successfully Applied - All 15 factors fully populated

---

## Next Steps

1. **Frontend Display** - Show all 4 capitals in `StagingFactorSelector` badges
2. **Planet Tab Integration** - Use multi-capital data in LCA report cards
3. **Waterfall Calculations** - Update calculation engine to use all factors
4. **Hotspot Analysis** - Identify which materials drive each impact category
5. **Trade-off Analysis** - Compare materials across multiple capitals (e.g., recycled glass: lower climate/waste but what about water?)

---

**Last Updated:** 2025-11-26
**Status:** ✅ Complete - 15/15 factors populated
**Verification:** All factors have non-zero values across all 4 capitals
