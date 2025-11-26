# Quick Start: Staging Emission Factors

## 🚀 Get Started in 3 Steps

### Step 1: Purge Test Data (Optional)
```sql
-- Run in Supabase SQL Editor
-- Copy from: PURGE_TEST_DATA.sql
```

### Step 2: Verify Staging Factors
```sql
SELECT name, category, co2_factor, reference_unit
FROM staging_emission_factors
ORDER BY category, name;
```

Expected: 15 rows (5 packaging, 7 ingredients, 3 energy/transport)

### Step 3: Test Waterfall Lookup
Search for "sugar" in your app - should return staging factors first.

---

## 📦 What's Included

**Database:**
- `staging_emission_factors` table (15 realistic factors seeded)
- `get_emission_factor_with_fallback()` function
- RLS policies for organization-level access

**API Routes:**
- `/api/ingredients/search` - Waterfall logic implemented
- `/api/supplier-products/search` - Combined staging + supplier results

**Frontend:**
- `StagingFactorSelector` component - Dropdown with CO₂ badges

---

## 🎯 Key Features

### Waterfall Priority
1. **Staging Factors** (Local, Realistic) ← Try First
2. **Cache** (24h) ← If Not Found
3. **OpenLCA** (External) ← Fallback

### Data Sources
- **Internal Proxy**: Curated, realistic factors
- **Supplier Products**: Organization-specific EPDs
- **OpenLCA**: Global LCA database

---

## 💡 Usage Examples

### Use Staging Factor Dropdown
```tsx
<StagingFactorSelector
  category="Packaging"
  onSelect={(factor) => {
    // factor.co2_factor = 1.10
    // factor.reference_unit = "kg"
  }}
/>
```

### Query Staging Factors
```typescript
const { data } = await supabase
  .from('staging_emission_factors')
  .select('*')
  .eq('category', 'Ingredient');
```

### Use Waterfall Function
```sql
SELECT * FROM get_emission_factor_with_fallback('Glass Bottle', NULL);
```

---

## 📚 Full Documentation

- **WATERFALL_RESOLVER_GUIDE.md** - Complete architecture guide
- **SYSTEM_PURGE_AND_WATERFALL_SUMMARY.md** - Implementation summary
- **PURGE_TEST_DATA.sql** - Database cleanup script

---

## ✅ Verification Checklist

- [ ] Migration applied (check Supabase migrations table)
- [ ] 15 staging factors seeded (run SELECT query above)
- [ ] API routes return `waterfall_stage` in response
- [ ] Frontend dropdowns show staging factors
- [ ] Build completes without errors

---

## 🐛 Troubleshooting

**No staging factors returned?**
- Check RLS policies are enabled
- Verify user is authenticated
- Ensure `organization_id IS NULL` for global factors

**Waterfall not triggering?**
- Check API response for `waterfall_stage` field
- Stage 1 = staging_emission_factors
- Stage 2 = cache
- Stage 3 = OpenLCA/mock

**Build errors?**
- Run `npm run build`
- Check import paths match `getSupabaseBrowserClient()`

---

## 🎉 You're Ready!

The system now uses realistic emission factors instead of random values. All calculations are traceable and accurate.

**Next:** Execute purge script to clear test data and start fresh.
