# Test Data Setup Instructions

## Overview

This document explains how to populate your database with comprehensive test data for testing the LCA creation and calculation workflow in the beverage industry context.

## What You'll Get

Once you run this script, your database will contain:

- **5 Suppliers**: UK fruit supplier, sugar refinery, French glass manufacturer, UK label printer, and German logistics provider
- **15 Supplier Products**: Organic fruit concentrates, sweeteners, recycled glass bottles, labels, and transportation services
- **20 OpenLCA Cache Entries**: Pre-populated search results for common beverage materials (sugar, water, bottles, transport, etc.)
- **3 Product LCAs** at different stages:
  1. **Draft**: Premium Elderflower Pressé 330ml (ready for you to add materials)
  2. **Pending**: Organic Apple & Lemon Sparkle 750ml (has 7 materials, ready for calculation)
  3. **Completed**: Classic Sparkling Lemonade 330ml (full results available to view)

## Prerequisites

1. You must have an active Supabase account with your project set up
2. You must already have a user account and organisation created
3. You need your organisation UUID

## Step-by-Step Instructions

### Step 1: Get Your Organisation ID

1. Log into your Supabase dashboard
2. Navigate to the SQL Editor
3. Run this query:

```sql
SELECT id, name FROM organizations;
```

4. Copy your organisation UUID (it will look like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Step 2: Prepare the SQL Script

1. Open the file `test-data-beverage-industry.sql` in a text editor
2. Find line 26 where it says:
   ```sql
   v_org_id UUID := 'YOUR_ORG_ID_HERE'::UUID;
   ```
3. Replace `YOUR_ORG_ID_HERE` with your actual organisation UUID
4. Save the file

### Step 3: Run the Script

**Option A: Using Supabase SQL Editor (Recommended)**

1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the entire contents of `test-data-beverage-industry.sql`
4. Paste into the SQL Editor
5. Click "Run" or press Cmd/Ctrl + Enter
6. Watch the "Messages" panel for progress notifications

**Option B: Using psql Command Line**

```bash
psql "your-supabase-connection-string" -f test-data-beverage-industry.sql
```

### Step 4: Verify the Data

After running the script, you should see messages like:

```
NOTICE: Creating suppliers for beverage industry...
NOTICE: Creating supplier products...
NOTICE: Creating OpenLCA cache entries...
NOTICE: Creating Product LCAs at different stages...
NOTICE: ✓ Test data creation complete!
```

Run this verification query:

```sql
SELECT 
  (SELECT COUNT(*) FROM suppliers) as suppliers_count,
  (SELECT COUNT(*) FROM supplier_products) as products_count,
  (SELECT COUNT(*) FROM openlca_process_cache) as cache_entries_count,
  (SELECT COUNT(*) FROM product_lcas) as lcas_count,
  (SELECT COUNT(*) FROM product_lca_materials) as materials_count;
```

You should see:
- 5 suppliers
- 15 supplier products  
- 20 cache entries
- 3 LCAs
- 12 materials

## Testing Scenarios

### Scenario 1: Create a New LCA from Scratch

1. Navigate to the LCA creation page
2. Use the **Draft LCA** (Premium Elderflower Pressé 330ml)
3. Add materials by searching:
   - Try searching "elderflower" to see OpenLCA results
   - Try searching products from your supplier network
   - Mix both data sources to test the dual-path entry

### Scenario 2: Trigger a Calculation

1. Navigate to the **Pending LCA** (Organic Apple & Lemon Sparkle 750ml)
2. Review the 7 pre-loaded materials (mix of supplier and OpenLCA data)
3. Click "Calculate" to trigger the OpenLCA calculation engine
4. Monitor the calculation log

### Scenario 3: View Completed Results

1. Navigate to the **Completed LCA** (Classic Sparkling Lemonade 330ml)
2. View the 11 impact category results
3. Explore the calculation logs
4. Test report generation features

## Test Data Highlights

### Suppliers Created

1. **Premium Fruit Co-operative Ltd** (UK) - Organic fruit concentrates
2. **British Sugar Refineries** (UK) - Sugar and sweeteners
3. **EcoGlass Packaging Solutions** (France) - Recycled glass bottles
4. **GreenLabel Print Ltd** (UK) - Sustainable labels
5. **Green Freight Logistics** (Germany) - Carbon-neutral freight

### Sample Products with Primary Data

- Organic Apple Juice Concentrate (1.85 kg CO₂e/L)
- Elderflower Extract (0.95 kg CO₂e/L)
- Organic Lemon Juice (2.10 kg CO₂e/L)
- British Granulated Sugar (0.45 kg CO₂e/kg)
- Recycled Glass Bottle 330ml (0.28 kg CO₂e/unit)
- Aluminium Screw Cap (0.12 kg CO₂e/unit)

### OpenLCA Materials Available for Search

Common beverage ingredients and materials are cached:
- Apple juice, sugar, lemon juice, elderflower
- Water (tap, carbonated, deionised)
- Glass bottles (various sizes and recycled content)
- Packaging (cardboard, labels, caps, pallets)
- Transport (lorries, electric vans)
- Energy (electricity, natural gas)
- Additives (citric acid, preservatives, CO₂)

## Troubleshooting

### Error: "invalid input syntax for type uuid"

- You forgot to replace `YOUR_ORG_ID_HERE` with your actual organisation UUID
- Solution: Edit line 26 in the SQL file with your real UUID

### Error: "permission denied for table"

- Your user doesn't have permission to insert data
- Solution: Make sure you're using an account with admin/owner role in your organisation

### No results showing in the app

- Check that RLS policies are working correctly
- Verify you're logged in with the same user account
- Run the verification query to confirm data was inserted

### Want to start fresh?

Run this cleanup script to remove all test data:

```sql
-- Delete in reverse order to respect foreign keys
DELETE FROM product_lca_results WHERE product_lca_id IN (
  SELECT id FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID_HERE'
);
DELETE FROM product_lca_calculation_logs WHERE product_lca_id IN (
  SELECT id FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID_HERE'
);
DELETE FROM product_lca_materials WHERE product_lca_id IN (
  SELECT id FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID_HERE'
);
DELETE FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID_HERE';
DELETE FROM supplier_products WHERE organization_id = 'YOUR_ORG_ID_HERE';
DELETE FROM supplier_engagements WHERE supplier_id IN (
  SELECT id FROM suppliers WHERE organization_id = 'YOUR_ORG_ID_HERE'
);
DELETE FROM suppliers WHERE organization_id = 'YOUR_ORG_ID_HERE';
DELETE FROM openlca_process_cache; -- Shared across all orgs, so remove all test entries
```

Then re-run the main test data script.

## Next Steps

After successfully loading the test data:

1. Explore the three LCAs in different states
2. Test the material search functionality (both OpenLCA and supplier products)
3. Test adding new materials to the Draft LCA
4. Trigger calculations on the Pending LCA
5. View and export results from the Completed LCA
6. Test the supplier engagement tracking features
7. Verify data provenance and audit trails

## Support

If you encounter any issues not covered in this guide, check:
- Your Supabase logs for detailed error messages
- The database schema documentation
- Row Level Security (RLS) policies are enabled for all tables

---

**Note**: This test data is designed specifically for the beverage industry and includes realistic UK and EU-based suppliers with carbon intensity values appropriate for food and beverage products.
