# Calculation Verifier - Test Data Setup Guide

## Overview

The Calculation Verifier feature requires real test data in the database to function properly. This guide explains how to set up and clean up test data for verification testing.

## Prerequisites

1. You must be logged into Supabase
2. You must have an active organization
3. Access to Supabase SQL Editor

## Setup Steps

### Step 1: Seed Test Data

1. Navigate to your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `seed-calculation-verifier-test-data.sql`
5. Click **Run** to execute the script

**What gets created:**

- ✅ **1 Test Facility**: `[TEST DATA] Calculation Verifier Test Facility`
- ✅ **5 Test Emission Sources**: Natural Gas, Diesel, Refrigerant, Electricity, District Heat
- ✅ **5 Facility Activity Records**: Scope 1 and Scope 2 emissions data
- ✅ **5 Corporate Overhead Records**: Scope 3 emissions data (waste, travel, commuting)

### Step 2: Verify Setup

After running the seed script, you should see a summary output showing:

```
TEST FACILITY: 1 record
TEST EMISSION SOURCES: 5 records
TEST ACTIVITY DATA: 5 records
TEST CORPORATE OVERHEADS: 5 records
```

### Step 3: Use the Calculation Verifier

1. Navigate to **Development → Calculation Verifier** in the sidebar
2. Click the **"Company Footprint Test"** tab
3. Click **"Run Test"**
4. View the complete breakdown of emissions calculations

## Expected Results

When you run the Company Footprint Test with the seed data, you should see:

### Scope 1 (Direct Emissions)
- **Natural Gas**: 12,500 kWh × 0.18385 = **2,298.13 kg CO₂e**
- **Diesel Vehicles**: 8,750 km × 0.17078 = **1,494.33 kg CO₂e**
- **Refrigerant**: 2.5 kg × 1,430 = **3,575.00 kg CO₂e**
- **Scope 1 Total**: **7,367.46 kg CO₂e**

### Scope 2 (Energy Emissions)
- **Electricity**: 65,000 kWh × 0.23314 = **15,154.10 kg CO₂e**
- **District Heat**: 18,000 kWh × 0.21986 = **3,957.48 kg CO₂e**
- **Scope 2 Total**: **19,111.58 kg CO₂e**

### Scope 3 (Value Chain Emissions)
- **Waste to Landfill**: 450 kg × 0.54 = **243.00 kg CO₂e**
- **Recycling**: 180 kg × 0.021 = **3.78 kg CO₂e**
- **Flights**: 2,500 km × 0.24587 = **614.68 kg CO₂e**
- **Rail**: 1,200 km × 0.03549 = **42.59 kg CO₂e**
- **Commuting**: 8,500 km × 0.17078 = **1,451.63 kg CO₂e**
- **Scope 3 Total**: **2,355.68 kg CO₂e**

### Grand Total
**28,834.72 kg CO₂e (28.83 tonnes CO₂e)**

## Cleanup

Once you've verified that calculations are working correctly, you can delete all test data:

### Delete Test Data

1. Navigate to Supabase SQL Editor
2. Create a new query
3. Copy and paste the contents of `DELETE-calculation-verifier-test-data.sql`
4. Review the script carefully
5. Click **Run** to execute

**What gets deleted:**

- All facility activity data linked to test facility
- The test facility record
- All test emission sources (only if not referenced elsewhere)
- All test corporate overhead records with "[TEST DATA]" prefix

### Verify Deletion

The deletion script includes verification queries that will confirm all test data has been removed. All counts should return **0**.

## Important Notes

⚠️ **All test data is clearly labelled** with `[TEST DATA]` prefixes to make it easy to identify and remove.

⚠️ **Only run the deletion script when you're ready** to remove all test data. There is no undo.

✅ **The test data is isolated** to your organization only and won't affect other users.

✅ **Emission factors are from DEFRA 2025** UK Government database for accuracy.

## Troubleshooting

### Error: "No facilities found"
**Solution**: Run the seed script first. Make sure you're logged in and have an active organization.

### Error: "No activity data found"
**Solution**: The seed script may have failed. Check the Supabase SQL logs for errors. You may need to run the deletion script first, then re-run the seed script.

### Calculations show zero emissions
**Solution**: Check that emission sources were created correctly. Run this query:
```sql
SELECT * FROM scope_1_2_emission_sources WHERE source_name LIKE '[TEST DATA]%';
```

### Test facility not appearing
**Solution**: Verify your organization context:
```sql
SELECT get_current_organization_id();
```

## Files Reference

- **`seed-calculation-verifier-test-data.sql`** - Creates all test data
- **`DELETE-calculation-verifier-test-data.sql`** - Removes all test data
- **`CALCULATION-VERIFIER-SETUP.md`** - This guide

## Support

If you encounter issues:

1. Check the Supabase SQL logs for detailed error messages
2. Verify you have the necessary RLS permissions
3. Ensure all database migrations have been run
4. Try running the deletion script and starting fresh

---

**Last Updated**: 2024-12-01
