# Test Data Summary - Quick Reference

## Files Created

1. **test-data-beverage-industry.sql** - Main SQL script with all test data
2. **TEST_DATA_SETUP_INSTRUCTIONS.md** - Detailed setup guide

## Quick Start

```bash
# 1. Get your organisation ID
SELECT id, name FROM organizations;

# 2. Edit the SQL file and replace YOUR_ORG_ID_HERE on line 26

# 3. Run the script in Supabase SQL Editor or via psql
```

## What Gets Created

| Category | Count | Description |
|----------|-------|-------------|
| Suppliers | 5 | UK/EU beverage industry suppliers |
| Supplier Products | 15 | Ingredients and packaging with carbon data |
| OpenLCA Cache | 20 | Pre-populated search results |
| Product LCAs | 3 | Draft, Pending, and Completed states |
| Materials | 12 | Mix of supplier and OpenLCA data |
| Results | 11 | Impact categories for completed LCA |

## The Three Test LCAs

### 1. Draft LCA - Ready for You to Build
- **Product**: Premium Elderflower Pressé 330ml
- **Status**: Draft (no materials yet)
- **Purpose**: Test creating an LCA from scratch
- **Use Case**: Add materials, test search, build complete bill of materials

### 2. Pending LCA - Ready for Calculation
- **Product**: Organic Apple & Lemon Sparkle 750ml  
- **Status**: Pending (7 materials added)
- **Materials**: 
  - 3 organic ingredients from suppliers (primary data)
  - 1 water from OpenLCA (secondary data)
  - 3 packaging items from suppliers
- **Purpose**: Test calculation trigger and monitoring
- **Use Case**: Click "Calculate" button and watch workflow

### 3. Completed LCA - Full Results
- **Product**: Classic Sparkling Lemonade 330ml
- **Status**: Completed (calculations finished)
- **Materials**: 5 materials (mix of sources)
- **Results**: 11 impact categories populated
- **Purpose**: Test results viewing and reporting
- **Use Case**: View impact data, explore visualisations, test exports

## Key Test Scenarios

### Scenario A: Dual-Path Data Entry
Search and add materials from both:
- **Supplier Network** (primary data with carbon intensity)
- **OpenLCA Database** (secondary data from ecoinvent)

### Scenario B: Material Search
Test searches for:
- `elderflower` - Returns OpenLCA botanical extracts
- `lemon` - Mix of supplier and OpenLCA results  
- `glass bottle` - Packaging options
- `sugar` - Multiple sweetener options

### Scenario C: Complete Workflow
1. Create/edit Draft LCA
2. Add 5-10 materials from mixed sources
3. Trigger calculation (moves to Pending)
4. View calculation logs
5. Review results (moves to Completed)
6. Export or share results

## Realistic Industry Data

All suppliers and products reflect actual beverage industry characteristics:

- **Carbon intensities**: Based on industry benchmarks
- **Origins**: UK-focused with EU imports (Spain, France, Mexico)
- **Certifications**: Organic, Fair Trade, FSC, Soil Association
- **Units**: Industry-standard (L for liquids, kg for solids, units for packaging)
- **Categories**: Aligned with beverage manufacturing stages

## Verification Queries

### Check all data loaded correctly
```sql
SELECT 
  (SELECT COUNT(*) FROM suppliers WHERE organization_id = 'YOUR_ORG_ID') as suppliers,
  (SELECT COUNT(*) FROM supplier_products WHERE organization_id = 'YOUR_ORG_ID') as products,
  (SELECT COUNT(*) FROM openlca_process_cache) as cache,
  (SELECT COUNT(*) FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID') as lcas,
  (SELECT COUNT(*) FROM product_lca_materials) as materials;
```

### List your LCAs
```sql
SELECT id, product_name, status, created_at 
FROM product_lcas 
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY created_at;
```

### View completed LCA results
```sql
SELECT 
  plca.product_name,
  plr.impact_category,
  plr.value,
  plr.unit
FROM product_lca_results plr
JOIN product_lcas plca ON plr.product_lca_id = plca.id
WHERE plca.status = 'completed' 
  AND plca.organization_id = 'YOUR_ORG_ID'
ORDER BY plr.impact_category;
```

## Cleanup (Reset Test Data)

If you need to start over:

```sql
-- WARNING: This deletes ALL test data for your organisation

DELETE FROM product_lca_results 
WHERE product_lca_id IN (
  SELECT id FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID'
);

DELETE FROM product_lca_calculation_logs 
WHERE product_lca_id IN (
  SELECT id FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID'
);

DELETE FROM product_lca_materials 
WHERE product_lca_id IN (
  SELECT id FROM product_lcas WHERE organization_id = 'YOUR_ORG_ID'
);

DELETE FROM product_lcas 
WHERE organization_id = 'YOUR_ORG_ID';

DELETE FROM supplier_products 
WHERE organization_id = 'YOUR_ORG_ID';

DELETE FROM supplier_engagements 
WHERE supplier_id IN (
  SELECT id FROM suppliers WHERE organization_id = 'YOUR_ORG_ID'
);

DELETE FROM suppliers 
WHERE organization_id = 'YOUR_ORG_ID';

-- Optional: Clear OpenLCA cache (shared across all orgs)
TRUNCATE openlca_process_cache;
```

## Architecture Notes

### Data Provenance
All materials track their source:
- `data_source = 'supplier'` → Primary data from supplier network
- `data_source = 'openlca'` → Secondary data from OpenLCA database
- Each has corresponding foreign key (`supplier_product_id` or `data_source_id`)

### Multi-Tenancy
All data is properly scoped to your organisation via RLS policies:
- Suppliers, products, and LCAs filtered by `organization_id`
- OpenLCA cache is shared (not org-specific)
- Test data won't interfere with other organisations

### LCA Stages
Materials are assigned to sub-stages:
- **Agricultural Production** - Raw ingredient sourcing
- **Ingredient Processing** - Processing and preparation
- **Packaging Production** - Primary packaging manufacturing
- Additional stages available for transport, use, and end-of-life

## Support & Documentation

- Setup guide: `TEST_DATA_SETUP_INSTRUCTIONS.md`
- SQL script: `test-data-beverage-industry.sql`
- Database schema: `supabase/migrations/`
- OpenLCA proxy documentation: Knowledge Base

---

**Ready to test?** Follow the setup instructions to load your test data and start exploring the LCA workflow!
