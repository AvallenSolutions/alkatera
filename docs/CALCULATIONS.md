# Sustainability Calculations Documentation

This document describes the calculation methodologies used in the AlkaTera platform for corporate and product sustainability metrics. All calculations are designed to comply with international standards and prevent double counting.

## Table of Contents

1. [International Standards Compliance](#international-standards-compliance)
2. [Carbon Emissions (GHG Protocol)](#carbon-emissions-ghg-protocol)
3. [Water Risk (AWARE Methodology)](#water-risk-aware-methodology)
4. [Nature & Biodiversity (ReCiPe 2016)](#nature--biodiversity-recipe-2016)
5. [Waste & Circularity (EU Waste Framework)](#waste--circularity-eu-waste-framework)
6. [Preventing Double Counting](#preventing-double-counting)
7. [Data Architecture](#data-architecture)

---

## International Standards Compliance

| Impact Area | Primary Standard | Supporting Standards |
|-------------|------------------|---------------------|
| Carbon Emissions | GHG Protocol Corporate Standard | ISO 14064-1:2018, CSRD ESRS E1 |
| Water | AWARE v1.3 (Boulay et al. 2018) | ISO 14046, CSRD ESRS E3 |
| Nature/Biodiversity | ReCiPe 2016 Midpoint (H) | TNFD LEAP Framework, CSRD ESRS E4 |
| Waste | EU Waste Framework Directive 2008/98/EC | DEFRA 2024, CSRD ESRS E5 |

---

## Carbon Emissions (GHG Protocol)

### Overview

Carbon emissions are calculated following the GHG Protocol Corporate Standard, which defines three scopes:

- **Scope 1**: Direct emissions from owned/controlled sources
- **Scope 2**: Indirect emissions from purchased energy
- **Scope 3**: All other indirect emissions in the value chain

### Scope 1 Calculation

**Sources:**
- Facility utility data (natural gas, diesel, LPG, heavy fuel oil, biomass, refrigerants)
- Fleet vehicles (company-owned combustion engines)

**Formula:**
```
Scope 1 = Σ(utility_quantity × emission_factor) + Σ(fleet_emissions)
```

**Emission Factors (DEFRA 2024):**
| Utility Type | Factor | Unit |
|--------------|--------|------|
| Diesel (stationary/mobile) | 2.68787 | kgCO2e/litre |
| Petrol (mobile) | 2.31 | kgCO2e/litre |
| Natural Gas | 0.18293 | kgCO2e/kWh |
| LPG | 1.55537 | kgCO2e/litre |
| Heavy Fuel Oil | 3.17740 | kgCO2e/litre |
| Biomass (solid) | 0.01551 | kgCO2e/kg |
| Refrigerant Leakage | 1430 | kgCO2e/kg (R-134a GWP) |

### Scope 2 Calculation

**Sources:**
- Purchased electricity (grid)
- Purchased heat/steam
- Fleet vehicles (company-owned electric)

**Formula:**
```
Scope 2 = Σ(electricity_kWh × grid_factor) + Σ(heat_kWh × heat_factor)
```

**Default Factors:**
| Energy Type | Factor | Unit |
|-------------|--------|------|
| Grid Electricity | 0.207 | kgCO2e/kWh |
| Purchased Heat/Steam | 0.1662 | kgCO2e/kWh |

### Scope 3 Calculation

All 15 GHG Protocol Scope 3 categories are supported:

| Category | Name | Data Source |
|----------|------|-------------|
| 1 | Purchased Goods & Services | Product LCAs × production volume |
| 2 | Capital Goods | Corporate overheads |
| 3 | Fuel & Energy Activities | (Included in S1/S2) |
| 4 | Upstream Transportation | Product LCAs (upstream_transport) |
| 5 | Waste Generated in Operations | Corporate overheads (operational_waste) |
| 6 | Business Travel | Corporate overheads + grey fleet |
| 7 | Employee Commuting | Corporate overheads |
| 8 | Upstream Leased Assets | Corporate overheads |
| 9 | Downstream Transportation | Product LCAs (downstream_transport) |
| 10 | Processing of Sold Products | (Not applicable for finished goods) |
| 11 | Use of Sold Products | Product LCAs (use_phase) |
| 12 | End-of-Life Treatment | Product LCAs |
| 13 | Downstream Leased Assets | Corporate overheads |
| 14 | Franchises | Corporate overheads |
| 15 | Investments | Corporate overheads |

**Key Implementation Detail:**
For Category 1 (Purchased Goods), we use ONLY the Scope 3 portion from product LCAs (`aggregated_impacts.breakdown.by_scope.scope3`). This prevents double counting with owned facility Scope 1 and 2 emissions.

---

## Water Risk (AWARE Methodology)

### Overview

Water impact is calculated using the AWARE (Available WAter REmaining) methodology, the consensus characterization model for water scarcity footprints.

**Reference:**
> Boulay, A.-M., et al. (2018). The WULCA consensus characterization model for water scarcity footprints: assessing impacts of water consumption based on available water remaining (AWARE). *International Journal of Life Cycle Assessment*, 23(2), 368-378.

### AWARE Factor Calculation

```
AWARE Factor = (1 / AMD_local) / (1 / AMD_world)
```

Where AMD = Available Water Remaining = Water Availability - Human Water Consumption

### Scarcity-Weighted Water

```
Scarcity-Weighted Water (m³ eq) = Water Volume (m³) × AWARE Factor
```

### Risk Level Thresholds

| Risk Level | AWARE Factor | Interpretation |
|------------|--------------|----------------|
| Low | < 1.0 | More water available than world average |
| Medium | 1.0 - 10.0 | Above world average stress |
| High | ≥ 10.0 | Severely water-stressed region |

### Water Calculations

1. **Direct Water Use**: Facility water consumption from utility data
2. **Embedded Water**: Water used in supply chain (material origins weighted by AWARE factors)
3. **Total Scarcity-Weighted**: Sum of all water × location-specific AWARE factors

**Embedded Water Formula:**
```
Embedded Water = Σ(material_kg × water_intensity × origin_country_AWARE_factor)
```

---

## Nature & Biodiversity (ReCiPe 2016)

### Overview

Nature and biodiversity impacts are calculated using ReCiPe 2016 Midpoint (Hierarchist) methodology, aligned with CSRD ESRS E4 and TNFD LEAP framework requirements.

**Reference:**
> Huijbregts, M.A.J., et al. (2017). ReCiPe2016: a harmonised life cycle impact assessment method at midpoint and endpoint level. *International Journal of Life Cycle Assessment*, 22(2), 138-147.

### Impact Categories

| Category | Unit | Reference Substance | Description |
|----------|------|---------------------|-------------|
| Land Use | m²a crop eq | Annual crop land | Land occupation + transformation |
| Terrestrial Ecotoxicity | kg 1,4-DCB eq | 1,4-dichlorobenzene | Toxic impact on soil ecosystems |
| Freshwater Eutrophication | kg P eq | Phosphorus | Nutrient loading in freshwater |
| Terrestrial Acidification | kg SO₂ eq | Sulfur dioxide | Acidifying emissions |

### Calculation Method

For each product:
```
Impact = Σ(material_kg × characterization_factor)
```

Characterization factors are sourced from:
1. Primary: Supplier EPDs and verified LCA data
2. Secondary: Ecoinvent 3.12 via material proxies
3. Fallback: Internal benchmark factors

### Performance Thresholds

Performance thresholds are **internal benchmarks** derived from:
- Published LCA studies for the beverage/food sector
- EU Product Environmental Footprint (PEF) benchmark data
- Industry best practices

**Important:** TNFD and SBTN do not prescribe specific thresholds. Companies should set their own targets per ESRS E4-4 requirements.

---

## Waste & Circularity (EU Waste Framework)

### Overview

Waste calculations follow the EU Waste Framework Directive 2008/98/EC Article 4 waste hierarchy, with emission factors from DEFRA 2024.

### Waste Hierarchy Scores

| Priority | Treatment Method | Hierarchy Score | Classification |
|----------|------------------|-----------------|----------------|
| 1 | Prevention | N/A | (Not tracked as waste) |
| 2 | Preparing for Reuse | 100 | Circular |
| 3 | Recycling | 100 | Circular |
| 4 | Other Recovery (Energy) | 50 | Partial |
| 5 | Disposal (Landfill) | 0 | Linear |

### Two Distinct Waste Streams

The platform tracks **two separate waste streams** that must not be conflated:

#### 1. Operational Waste (GHG Protocol Scope 3 Category 5)

Waste generated during **manufacturing operations**.

**Examples:**
- Production scrap and off-cuts
- Packaging waste from incoming materials
- Office waste
- Quality control rejects

**Data Sources:** `corporate_overheads` table, `facility_activity_entries`

**Calculation:**
```
Scope 3 Cat 5 Emissions = Σ(waste_kg × treatment_emission_factor)
```

#### 2. End-of-Life Product Waste (Product Lifecycle)

Waste generated when **consumers dispose of products** after use.

**Examples:**
- Empty bottles/cans going to recycling or landfill
- Packaging in consumer waste stream
- Labels and closures

**Data Sources:** `product_lcas.aggregated_impacts`

**Calculation:**
```
End-of-Life Waste = Σ(packaging_weight × (1 - recyclability) × disposal_factor)
```

### Circularity Percentage

The dashboard "Circularity %" shows the weighted average recyclability of product packaging:
```
Circularity % = Σ(product_recyclability × production_volume) / Σ(production_volume)
```

---

## Preventing Double Counting

Double counting is a critical issue in sustainability reporting. The platform implements several safeguards:

### 1. Scope Separation in Product LCAs

Product LCA impacts are broken down by GHG Protocol scope:
```json
{
  "breakdown": {
    "by_scope": {
      "scope1": 0.05,   // Owned facility direct emissions
      "scope2": 0.02,   // Owned facility purchased energy
      "scope3": 0.15    // Supply chain emissions
    }
  }
}
```

When calculating corporate Scope 3 Category 1 (Purchased Goods), we use **only** the `scope3` portion from product LCAs. This prevents owned facility Scope 1 and 2 emissions from being counted twice.

### 2. Facility Inclusion Strategy (LEFT JOIN Approach)

All facility calculations:
1. First fetch **ALL facilities** for the organization
2. Then query utility/activity data for those facilities
3. Facilities without data contribute 0 (not omitted)

This ensures:
- Complete coverage (no facilities accidentally excluded)
- Transparent reporting (facilities with missing data are visible)
- Accurate totals (no overcounting from duplicate queries)

### 3. Contract Manufacturer Allocation

For products made at contract manufacturers (CMs):
- CM facility emissions are allocated to products based on production share
- Production allocation must sum to ~100% (validated with warnings for over/under-allocation)
- Owned facility emissions are **not** allocated to CM-produced products

**Validation Rule:**
```
Σ(product_allocation_percentage) should equal 100% ± tolerance
```

### 4. Operational vs End-of-Life Waste Separation

As detailed above, operational waste (Scope 3 Cat 5) and end-of-life waste are tracked separately and never combined without explicit context.

### 5. Time Period Boundaries

All calculations respect strict time period boundaries:
- `yearStart` to `yearEnd` parameters filter all data queries
- Prevents emissions from adjacent reporting periods being included

---

## Data Architecture

### Key Tables

| Table | Purpose | Used In |
|-------|---------|---------|
| `facilities` | Organization facility master data | All facility calculations |
| `utility_data_entries` | Facility utility consumption | Scope 1, Scope 2 |
| `fleet_activities` | Vehicle emissions | Scope 1, Scope 2 |
| `corporate_overheads` | Business travel, waste, etc. | Scope 3 |
| `production_logs` | Product production volumes | Product emissions allocation |
| `product_lcas` | Product lifecycle assessments | Scope 3 Cat 1, end-of-life |
| `aware_factors` | Country/region water scarcity | Water risk calculations |
| `staging_emission_factors` | DEFRA 2024 emission factors | All emission calculations |

### Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Corporate Emissions                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐   │
│  │ Scope 1  │ + │ Scope 2  │ + │        Scope 3           │   │
│  │          │   │          │   │                          │   │
│  │ Facility │   │ Facility │   │ Cat 1: Products (S3 only)│   │
│  │ fuels    │   │ electric │   │ Cat 2-8: Overheads       │   │
│  │ + Fleet  │   │ + Fleet  │   │ Cat 9-15: Product LCA    │   │
│  └──────────┘   └──────────┘   └──────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Total Corporate Footprint                        │
│                                                                 │
│   Total = Scope 1 + Scope 2 + Scope 3                          │
│                                                                 │
│   ⚠️ NO DOUBLE COUNTING:                                        │
│   - Product S1/S2 excluded from Scope 3 Cat 1                  │
│   - Each facility counted once via LEFT JOIN approach          │
│   - CM allocations validated to sum to 100%                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing

All calculations are covered by comprehensive unit tests:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| corporate-emissions.test.ts | 24 | Scope 1, 2, 3 calculations |
| water-risk.test.ts | 25 | AWARE methodology |
| waste-circularity.test.ts | 56 | Waste hierarchy, emissions |
| nature-biodiversity.test.ts | 65 | ReCiPe 2016 categories |
| cross-surface-consistency.test.ts | 13 | Company vs product alignment |
| epr-packaging.test.ts | 54 | Extended producer responsibility |
| epr-lca-integration.test.ts | 33 | LCA integration |

Run tests with:
```bash
npm run test lib/calculations
```

---

## References

1. **GHG Protocol Corporate Standard** - https://ghgprotocol.org/corporate-standard
2. **AWARE Methodology** - https://wulca-waterlca.org/aware/
3. **ReCiPe 2016** - https://www.rivm.nl/en/life-cycle-assessment-lca/recipe
4. **EU Waste Framework Directive** - Directive 2008/98/EC
5. **DEFRA 2024 Conversion Factors** - UK Government GHG Conversion Factors
6. **CSRD ESRS Standards** - https://www.efrag.org/lab6
7. **TNFD Framework** - https://tnfd.global/
