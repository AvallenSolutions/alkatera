# Complete Platform Data Deletion Guide

## Overview

This guide will help you completely reset your AlkaTera platform to a blank slate, as if you're a new user logging in for the first time. All emissions calculations will read 0, and all data lists will be empty.

## What Gets Deleted

### ✅ All Operational Data
- All products and LCA assessments
- All suppliers and supplier products
- All facilities and their activity data
- All emissions calculations (Scope 1, 2, and 3)
- All production logs and inventory records
- All calculation logs and provenance trails
- All dashboard preferences and analytics
- All pending/staging data
- All test data
- All BOM imports
- All knowledge bank items

### ✅ Preserved System Configuration
- Your organisation record
- User profiles and authentication credentials
- Organisation memberships and team roles
- RBAC system (roles, permissions)
- Reference data (emission factors, categories, LCA stages)
- System configuration (subscription tiers, limits)
- LCA methodology reference tables (EF 3.1, ecoinvent proxies)

## Expected Result

After deletion, your dashboard will display:

```
Total emissions:      0 tCO2e
├─ Scope 1:          0 tCO2e
├─ Scope 2:          0 tCO2e
└─ Scope 3:          0 tCO2e

Products assessed:    0
Facilities:           0
Suppliers:            0
```

## Step-by-Step Instructions

### 1. Access Supabase SQL Editor

1. Log in to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query** to open a blank editor

### 2. Run the Deletion Script

1. Open the file `DELETE-ALL-ORGANIZATION-DATA.sql` from this project
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Review the safety check at the top - it will display your organisation name
5. Click **Run** to execute the script

### 3. Review the Output

The script will display progress messages as it deletes data:

```
PHASE 1: Deleting LCA reports and passport data...
✓ Phase 1 complete
PHASE 2: Deleting product LCA calculations and results...
✓ Phase 2 complete
...
```

### 4. Verify Deletion

At the end, you'll see a verification summary:

```
========================================
VERIFICATION: Counting remaining records
========================================
Products remaining: 0
Facilities remaining: 0
Suppliers remaining: 0
Product LCAs remaining: 0
...
```

**All counts should be 0 for successful deletion.**

### 5. Commit or Rollback

The script runs in a transaction for safety. After reviewing the output:

- **To finalize the deletion:** Run `COMMIT;` in the SQL editor
- **To undo the deletion:** Run `ROLLBACK;` in the SQL editor

⚠️ **Important:** If you close the SQL editor without running `COMMIT` or `ROLLBACK`, the transaction will automatically rollback and no data will be deleted.

### 6. Verify in the Application

1. Log in to your AlkaTera application
2. Navigate to the Dashboard
3. Confirm that all metrics show 0
4. Check that Products, Facilities, and Suppliers pages are empty

## Safety Features

### Transaction Wrapped
All deletions occur within a database transaction, allowing you to rollback if needed.

### Organisation Scoped
All deletions are automatically scoped to your current organisation via Row Level Security (RLS). You cannot accidentally delete data from other organisations.

### Detailed Logging
The script provides detailed progress updates and final verification counts so you know exactly what was deleted.

### Preserves System Data
Reference tables, emission factors, and system configuration are intentionally preserved so the platform remains fully functional.

## Troubleshooting

### Error: "No organization context found"

**Cause:** You're not logged in or RLS cannot determine your organisation.

**Solution:**
1. Make sure you're logged in to Supabase
2. Try running this query first to verify your organisation:
```sql
SELECT get_current_organization_id();
```

### Some Counts Are Not Zero

**Cause:** There may be foreign key constraints preventing deletion or the script encountered an error.

**Solution:**
1. Review the error messages in the SQL editor output
2. Run the verification queries manually to identify which records remain:
```sql
SELECT * FROM public.products WHERE organization_id = get_current_organization_id();
SELECT * FROM public.facilities WHERE organization_id = get_current_organization_id();
```
3. Delete any remaining records manually if needed

### Dashboard Still Shows Data After Deletion

**Cause:** Frontend cache may not have refreshed.

**Solution:**
1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear your browser cache
3. Log out and log back in
4. Check the database directly to confirm data is gone

## What's Next?

After successfully deleting all data, you're ready to create fresh test data:

1. **Create realistic test facilities** with actual energy and fuel consumption data
2. **Add test products** with proper bill of materials
3. **Set up supplier relationships** with products and evidence
4. **Log production volumes** to enable proper allocation calculations
5. **Calculate LCAs** and verify results

This gives you a clean foundation to properly test all calculation pathways in the platform.

## Recovery

⚠️ **Warning:** This deletion is permanent once committed. There is no built-in recovery mechanism.

**Best Practice:** Before running the deletion:
1. Export any data you might need later
2. Take screenshots of your current dashboard for comparison
3. Document any important calculations or configurations

If you accidentally delete data and need to recover:
1. Run `ROLLBACK;` immediately if you haven't yet run `COMMIT;`
2. Contact your database administrator for point-in-time recovery options
3. Restore from your Supabase project backup (if available)

## Support

If you encounter issues or have questions:
1. Review the detailed comments in `DELETE-ALL-ORGANIZATION-DATA.sql`
2. Check the Supabase logs for error details
3. Contact your platform administrator
4. Open an issue in the project repository

---

**Last Updated:** 16 December 2024
