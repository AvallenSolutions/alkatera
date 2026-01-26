# Company Vitality Scoring System

## Overview

The Company Vitality Score is a weighted composite score that measures sustainability performance across four environmental pillars. The overall score is calculated as:

```
Overall Score = Climate (30%) + Water (25%) + Circularity (25%) + Nature (20%)
```

## Pillar Scoring Breakdown

### 1. Climate Score (30% weight)

The Climate score measures carbon emissions performance relative to an industry benchmark.

**Input Data:**
- `emissionsIntensity`: Total CO2 emissions divided by number of products assessed
- `industryBenchmark`: Set at 50,000 kg CO2eq, divided by number of products assessed

**Calculation Logic:**
```
ratio = emissionsIntensity / industryBenchmark

if ratio <= 0.70  → Score: 90 (Excellent)
if ratio <= 0.85  → Score: 80 (Very Good)
if ratio <= 1.00  → Score: 70 (Good - at benchmark)
if ratio <= 1.15  → Score: 55 (Fair)
if ratio <= 1.30  → Score: 40 (Needs Improvement)
if ratio >  1.30  → Score: 25 (Poor)

Default (no data): 50
```

**Data Sources:**
- Corporate emissions calculator (Scope 1, 2, 3)
- Product LCA assessments (climate_change_gwp100)

---

### 2. Water Score (25% weight)

The Water score measures water-related risk exposure across facilities.

**Input Data:**
- `waterRiskLevel`: Categorical value ('high', 'medium', 'low') derived from facility water data

**Calculation Logic:**
```
if waterRiskLevel == 'low'    → Score: 85
if waterRiskLevel == 'medium' → Score: 60
if waterRiskLevel == 'high'   → Score: 35

Default (no data): 50
```

**Data Sources:**
- Facility water intake records
- Water scarcity indices from geographic location
- Product LCA water consumption data

---

### 3. Circularity Score (25% weight)

The Circularity score measures waste diversion and circular economy performance.

**Input Data:**
- `circularityRate`: Percentage of waste diverted from landfill (0-100)

**Calculation Logic:**
```
if circularityRate >= 80  → Score: 95 (Excellent)
if circularityRate >= 60  → Score: 80 (Very Good)
if circularityRate >= 40  → Score: 60 (Good)
if circularityRate >= 20  → Score: 40 (Fair)
if circularityRate <  20  → Score: 20 (Poor)

Default (no data): 50
```

**Data Sources:**
- Waste metrics (waste_diversion_rate)
- Product metrics (circularity_percentage)

---

### 4. Nature Score (20% weight)

The Nature score measures biodiversity and land use impact.

**Input Data:**
- `biodiversityRisk`: Categorical value ('high', 'medium', 'low') derived from nature metrics

**Calculation Logic:**
```
if biodiversityRisk == 'low'    → Score: 80
if biodiversityRisk == 'medium' → Score: 55
if biodiversityRisk == 'high'   → Score: 30

Default (no data): 50
```

**Biodiversity Risk Derivation:**
```
impactScore = land_use + terrestrial_ecotoxicity

if impactScore > 1000 → 'high'
if impactScore > 100  → 'medium'
else                  → 'low'
```

**Data Sources:**
- Product LCA land use data (land_use - m2a crop eq)
- Terrestrial ecotoxicity metrics

---

## Known Issue: Misleading Scores When No Data Exists

### Problem Description

When the system has no underlying data, it can display misleading scores:

| Pillar | Expected (No Data) | Actual Display | Reason |
|--------|-------------------|----------------|--------|
| Climate | Should indicate "No Data" | **90** | Zero emissions / benchmark = 0, triggers "excellent" threshold |
| Water | 50 (default) | 50 | Correct default behavior |
| Circularity | Should indicate "No Data" | **20** | circularityRate = 0 triggers lowest bracket |
| Nature | 50 (default) | 50 | Correct default behavior |

### Root Cause Analysis

1. **Climate Score Issue:**
   - When `totalCO2 = 0` and there are no products, `emissionsIntensity = 0`
   - `ratio = 0 / 50000 = 0`
   - Since 0 <= 0.70, the system assigns score 90 (excellent)
   - This falsely indicates excellent performance when there's actually no data

2. **Circularity Score Issue:**
   - When `circularityRate = 0` (from `wasteMetrics?.waste_diversion_rate || metrics?.circularity_percentage || 0`)
   - The condition `if (data.circularityRate !== undefined)` is TRUE (0 !== undefined)
   - Since 0 < 20, score becomes 20
   - This falsely indicates poor performance when there's actually no data

### Fix Implemented

The scoring system has been updated to:
1. Check for actual data presence before calculating scores
2. Return `null` for scores when insufficient data exists
3. The UI displays "No Data" or "Awaiting Data" instead of misleading numeric scores

**Changes Made:**
- `calculateVitalityScores()` now requires `hasProductData` and `hasWasteData` flags
- Climate score only calculated when `totalEmissions > 0`
- Circularity score only calculated when `circularityRate > 0` AND `hasWasteData` is true
- All UI components updated to handle null scores gracefully
- Overall score calculated only when at least one pillar has valid data
- Weight redistribution: when some pillars have no data, weights are proportionally redistributed among available pillars

---

## Overall Score Rating Bands

| Score Range | Label | Description |
|-------------|-------|-------------|
| 85-100 | EXCELLENT | Organisation is a sustainability leader |
| 70-84 | HEALTHY | Performing well across all pillars |
| 50-69 | DEVELOPING | Good progress, opportunities for improvement |
| 30-49 | EMERGING | Early stage, focused action can drive quick gains |
| 0-29 | NEEDS ATTENTION | Significant opportunities to improve |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Sources                                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Product LCAs    │ Facility Data   │ Waste Metrics               │
│ (Supabase)      │ (Supabase)      │ (Supabase)                  │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│               Hooks (React Query)                                │
│  useCompanyMetrics | useFacilityWaterData | useWasteMetrics     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              calculateVitalityScores()                           │
│  (components/vitality/VitalityScoreHero.tsx:255)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               VitalityScoreHero Component                        │
│  Displays overall score + 4 pillar scores                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Locations

- **Scoring Logic:** `/components/vitality/VitalityScoreHero.tsx` (line 255)
- **Performance Page:** `/app/(authenticated)/performance/page.tsx`
- **Data Hooks:**
  - `/hooks/data/useCompanyMetrics.ts`
  - `/hooks/data/useFacilityWaterData.ts`
  - `/hooks/data/useWasteMetrics.ts`
  - `/hooks/data/useCompanyFootprint.ts`
