# BOLT V2 FIX PROMPT: Fix Scope 1-2 Data Entry UI

## Context

The Scope 1-2 data entry page (`app/(authenticated)/data/scope-1-2/page.tsx`) has **6 critical UI issues** preventing users from entering emissions data after the Netlify deployment.

**Affected Page**: `/data/scope-1-2` (Company Emissions)

---

## Issues Identified

### Issue #1: Limited Scope 1 Sources (Only 3 of 12 showing) ❌
**Root Cause**: Line 345-349 queries `emissions_factors` table instead of `scope_1_2_emission_sources` and filters to only stationary combustion.

**Current Code** (lines 345-349):
```typescript
const { data, error } = await supabase
  .from('emissions_factors')
  .select('name')
  .eq('category', 'Scope 1')
  .like('type', 'Stationary Combustion%')
  .order('name', { ascending: true });
```

**Problem**:
- Queries wrong table (`emissions_factors` instead of `scope_1_2_emission_sources`)
- Filters to only stationary combustion (missing mobile combustion and fugitive emissions)
- Only returns 3 sources: Gas Oil, Natural Gas, LPG

**Expected**: Should return all 12 Scope 1 sources from `scope_1_2_emission_sources`

---

### Issue #2: Limited Scope 2 Options (Only Electricity) ❌
**Root Cause**: Line 617 hardcodes Scope 2 to "Electricity" only, ignoring user selection.

**Current Code** (line 617):
```typescript
const activityName = `${facility?.name} - Electricity`;
```

**Problem**: Always sends "Electricity" regardless of what user selected

**Expected**: Should allow District Heating, District Cooling, Purchased Steam

---

### Issue #3: Unit Not Auto-Selected ❌
**Root Cause**: No logic to auto-select unit when fuel type changes. Lines 1067-1084 show hardcoded dropdown.

**Current**: User must manually select unit after choosing fuel type

**Expected**:
- Select "Natural Gas" → Unit auto-fills "kWh"
- Select "Diesel (Owned Fleet)" → Unit auto-fills "litres"
- Select "Refrigerant R134a" → Unit auto-fills "kg"

---

### Issue #4: Data Entry Not Saving ❌
**Root Cause**: Form submission (line 563-577) calls `ingest-activity-data` edge function which may not be configured to save to `facility_activity_data` table.

**Current Flow**:
```
Form → Edge Function (ingest-activity-data) → ??? → facility_activity_data
```

**Problem**: Edge function may not exist or not configured to save Scope 1-2 data correctly

**Expected Flow**:
```
Form → Direct INSERT to facility_activity_data table
```

---

### Issue #5: Run Calculations Not Working ❌
**Root Cause**: Line 707-736 calls `invoke-scope1-2-calculations` edge function which may not exist or not handle data correctly.

**Current**: Button exists but may not trigger calculations properly

---

### Issue #6: Annual Footprint Shows "No Data" ❌
**Root Cause**: Lines 888-890 and 903-905 show `scope1CO2e` and `scope2CO2e` are 0 despite data being entered.

**Possible Causes**:
- `fetchScope1Emissions()` and `fetchScope2Emissions()` not querying `facility_activity_data` correctly
- Data not being calculated after entry
- Wrong table being queried for emissions totals

---

## Required Fixes

### Fix #1: Load All Scope 1 & 2 Sources from Correct Table

**Replace lines 338-363** with:

```typescript
const fetchEmissionSources = async () => {
  setIsLoadingFuelTypes(true);
  try {
    const browserSupabase = getSupabaseBrowserClient();

    // Load Scope 1 sources
    const { data: scope1Data, error: scope1Error } = await browserSupabase
      .from('scope_1_2_emission_sources')
      .select('id, source_name, scope, category, default_unit, emission_factor_id')
      .eq('scope', 'Scope 1')
      .order('category', { ascending: true })
      .order('source_name', { ascending: true });

    if (scope1Error) {
      console.error('Error fetching Scope 1 sources:', scope1Error);
    } else {
      setScope1Sources(scope1Data || []);
      // Extract unique names for backward compatibility with fuelTypes
      const uniqueNames = Array.from(new Set(scope1Data?.map(s => s.source_name) || []));
      setFuelTypes(uniqueNames);
    }

    // Load Scope 2 sources
    const { data: scope2Data, error: scope2Error } = await browserSupabase
      .from('scope_1_2_emission_sources')
      .select('id, source_name, scope, category, default_unit, emission_factor_id')
      .eq('scope', 'Scope 2')
      .order('source_name', { ascending: true });

    if (scope2Error) {
      console.error('Error fetching Scope 2 sources:', scope2Error);
    } else {
      setScope2Sources(scope2Data || []);
    }
  } catch (error) {
    console.error('Error fetching emission sources:', error);
  } finally {
    setIsLoadingFuelTypes(false);
  }
};
```

**Add State Variables** (after line 139):
```typescript
const [scope1Sources, setScope1Sources] = useState<any[]>([]);
const [scope2Sources, setScope2Sources] = useState<any[]>([]);
```

---

### Fix #2: Update Form Submission to Save Directly to facility_activity_data

**Replace Scope 1 submission (lines 544-598)** with:

```typescript
const onSubmitScope1 = async (data: Scope1FormValues) => {
  if (!currentOrganization?.id) {
    toast.error('No organisation selected');
    return;
  }

  setIsSubmitting(true);

  try {
    const browserSupabase = getSupabaseBrowserClient();

    // Find the selected source
    const selectedSource = scope1Sources.find(s => s.source_name === data.fuel_type);

    if (!selectedSource) {
      toast.error('Invalid fuel type selected');
      return;
    }

    // Insert into facility_activity_data
    const { data: insertedData, error } = await browserSupabase
      .from('facility_activity_data')
      .insert({
        facility_id: data.facility_id,
        emission_source_id: selectedSource.id,
        quantity: parseFloat(data.amount),
        unit: data.unit,
        reporting_period_start: data.activity_date,
        reporting_period_end: data.activity_date,
        organization_id: currentOrganization.id,
      })
      .select();

    if (error) {
      console.error('Insert error:', error);
      toast.error(`Failed to save: ${error.message}`);
      return;
    }

    toast.success('Scope 1 activity data submitted successfully');
    scope1Form.reset();
    await fetchRecentData();
    await fetchScope1Emissions();
  } catch (error) {
    console.error('Error submitting Scope 1 data:', error);
    toast.error(
      error instanceof Error ? error.message : 'Failed to submit Scope 1 data'
    );
  } finally {
    setIsSubmitting(false);
  }
};
```

**Replace Scope 2 submission (lines 600-654)** with:

```typescript
const onSubmitScope2 = async (data: Scope2FormValues) => {
  if (!currentOrganization?.id) {
    toast.error('No organisation selected');
    return;
  }

  setIsSubmitting(true);

  try {
    const browserSupabase = getSupabaseBrowserClient();

    // Find the selected Scope 2 source (add source_type field to form)
    const selectedSource = scope2Sources.find(s => s.source_name === data.source_type);

    if (!selectedSource) {
      toast.error('Invalid source type selected');
      return;
    }

    // Insert into facility_activity_data
    const { data: insertedData, error } = await browserSupabase
      .from('facility_activity_data')
      .insert({
        facility_id: data.facility_id,
        emission_source_id: selectedSource.id,
        quantity: parseFloat(data.amount),
        unit: data.unit,
        reporting_period_start: data.activity_date,
        reporting_period_end: data.activity_date,
        organization_id: currentOrganization.id,
      })
      .select();

    if (error) {
      console.error('Insert error:', error);
      toast.error(`Failed to save: ${error.message}`);
      return;
    }

    toast.success('Scope 2 activity data submitted successfully');
    scope2Form.reset();
    await fetchRecentData();
    await fetchScope2Emissions();
  } catch (error) {
    console.error('Error submitting Scope 2 data:', error);
    toast.error(
      error instanceof Error ? error.message : 'Failed to submit Scope 2 data'
    );
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### Fix #3: Add Unit Auto-Selection

**Add handler function** (after line 363):

```typescript
const handleScope1FuelTypeChange = (fuelTypeName: string) => {
  scope1Form.setValue('fuel_type', fuelTypeName, { shouldValidate: true });

  // Auto-select unit based on source
  const source = scope1Sources.find(s => s.source_name === fuelTypeName);
  if (source?.default_unit) {
    scope1Form.setValue('unit', source.default_unit, { shouldValidate: true });
  }
};

const handleScope2SourceChange = (sourceName: string) => {
  scope2Form.setValue('source_type', sourceName, { shouldValidate: true });

  // Auto-select unit based on source
  const source = scope2Sources.find(s => s.source_name === sourceName);
  if (source?.default_unit) {
    scope2Form.setValue('unit', source.default_unit, { shouldValidate: true });
  }
};
```

**Update Scope 1 fuel type dropdown** (lines 1013-1044):

```typescript
<div className="space-y-2">
  <Label htmlFor="scope1-fuel-type">Fuel Type</Label>
  <Select
    value={scope1Form.watch('fuel_type')}
    onValueChange={handleScope1FuelTypeChange}
    disabled={isLoadingFuelTypes || scope1Sources.length === 0}
  >
    <SelectTrigger id="scope1-fuel-type">
      <SelectValue placeholder="Select fuel type" />
    </SelectTrigger>
    <SelectContent>
      {/* Group by category */}
      <SelectGroup>
        <SelectLabel>Stationary Combustion</SelectLabel>
        {scope1Sources
          .filter(s => s.category === 'Stationary Combustion')
          .map((source) => (
            <SelectItem key={source.id} value={source.source_name}>
              {source.source_name} ({source.default_unit})
            </SelectItem>
          ))}
      </SelectGroup>

      <SelectGroup>
        <SelectLabel>Mobile Combustion</SelectLabel>
        {scope1Sources
          .filter(s => s.category === 'Mobile Combustion')
          .map((source) => (
            <SelectItem key={source.id} value={source.source_name}>
              {source.source_name} ({source.default_unit})
            </SelectItem>
          ))}
      </SelectGroup>

      <SelectGroup>
        <SelectLabel>Fugitive Emissions</SelectLabel>
        {scope1Sources
          .filter(s => s.category === 'Fugitive Emissions')
          .map((source) => (
            <SelectItem key={source.id} value={source.source_name}>
              {source.source_name} ({source.default_unit})
            </SelectItem>
          ))}
      </SelectGroup>
    </SelectContent>
  </Select>
  {scope1Form.formState.errors.fuel_type && (
    <p className="text-sm text-red-600">
      {scope1Form.formState.errors.fuel_type.message}
    </p>
  )}
  {!isLoadingFuelTypes && scope1Sources.length === 0 && (
    <p className="text-sm text-amber-600">
      No emission sources available. Please contact support.
    </p>
  )}
</div>
```

---

### Fix #4: Add Scope 2 Source Type Dropdown

**Add to Scope 2 Form Schema** (around line 120):

```typescript
const scope2FormSchema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  source_type: z.string().min(1, 'Source type is required'), // NEW
  amount: z.string().min(1, 'Amount is required'),
  unit: z.enum(['kWh', 'MWh']),
  activity_date: z.string().min(1, 'Activity date is required'),
});
```

**Add Scope 2 source dropdown** (in Scope 2 tab, after facility selector):

```typescript
<div className="space-y-2">
  <Label htmlFor="scope2-source-type">Source Type</Label>
  <Select
    value={scope2Form.watch('source_type')}
    onValueChange={handleScope2SourceChange}
    disabled={isLoadingFuelTypes || scope2Sources.length === 0}
  >
    <SelectTrigger id="scope2-source-type">
      <SelectValue placeholder="Select source type" />
    </SelectTrigger>
    <SelectContent>
      {scope2Sources.map((source) => (
        <SelectItem key={source.id} value={source.source_name}>
          {source.source_name} ({source.default_unit})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  {scope2Form.formState.errors.source_type && (
    <p className="text-sm text-red-600">
      {scope2Form.formState.errors.source_type.message}
    </p>
  )}
</div>
```

---

### Fix #5: Update Run Calculations to Query facility_activity_data

**Replace handleRunCalculations** (lines 691-737):

```typescript
const handleRunCalculations = async () => {
  if (!currentOrganization?.id) {
    toast.error('No organisation selected');
    return;
  }

  setIsCalculating(true);

  try {
    const browserSupabase = getSupabaseBrowserClient();
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    // Query facility_activity_data for Scope 1 & 2
    const { data: activityData, error: activityError } = await browserSupabase
      .from('facility_activity_data')
      .select(`
        id,
        quantity,
        unit,
        emission_source_id,
        scope_1_2_emission_sources!inner (
          source_name,
          scope,
          category,
          emission_factor_id,
          emissions_factors!inner (
            factor_id,
            name,
            value,
            unit
          )
        )
      `)
      .eq('organization_id', currentOrganization.id)
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    if (activityError) throw activityError;

    let scope1Total = 0;
    let scope2Total = 0;

    activityData?.forEach((activity: any) => {
      const source = activity.scope_1_2_emission_sources;
      const factor = source?.emissions_factors;

      if (factor && factor.value) {
        const emissions = activity.quantity * factor.value;

        if (source.scope === 'Scope 1') {
          scope1Total += emissions;
        } else if (source.scope === 'Scope 2') {
          scope2Total += emissions;
        }
      }
    });

    toast.success(`Calculations complete: Scope 1: ${scope1Total.toFixed(2)} kgCO2e, Scope 2: ${scope2Total.toFixed(2)} kgCO2e`);

    await fetchScope1Emissions();
    await fetchScope2Emissions();
  } catch (error) {
    console.error('Error running calculations:', error);
    toast.error(
      error instanceof Error ? error.message : 'Failed to run calculations'
    );
  } finally {
    setIsCalculating(false);
  }
};
```

---

### Fix #6: Update fetchScope1Emissions and fetchScope2Emissions

**Find and replace `fetchScope1Emissions`** (should be around line 200-230):

```typescript
const fetchScope1Emissions = async () => {
  if (!currentOrganization?.id) return;

  try {
    const browserSupabase = getSupabaseBrowserClient();
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const { data, error } = await browserSupabase
      .from('facility_activity_data')
      .select(`
        quantity,
        scope_1_2_emission_sources!inner (
          scope,
          emission_factor_id,
          emissions_factors!inner (
            value
          )
        )
      `)
      .eq('organization_id', currentOrganization.id)
      .eq('scope_1_2_emission_sources.scope', 'Scope 1')
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    if (error) throw error;

    const total = data?.reduce((sum, item: any) => {
      const factor = item.scope_1_2_emission_sources?.emissions_factors?.value || 0;
      return sum + (item.quantity * factor);
    }, 0) || 0;

    setScope1CO2e(total);
  } catch (error: any) {
    console.error('Error fetching Scope 1 emissions:', error);
    setScope1CO2e(0);
  }
};
```

**Find and replace `fetchScope2Emissions`** (should be around line 230-260):

```typescript
const fetchScope2Emissions = async () => {
  if (!currentOrganization?.id) return;

  try {
    const browserSupabase = getSupabaseBrowserClient();
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const { data, error } = await browserSupabase
      .from('facility_activity_data')
      .select(`
        quantity,
        scope_1_2_emission_sources!inner (
          scope,
          emission_factor_id,
          emissions_factors!inner (
            value
          )
        )
      `)
      .eq('organization_id', currentOrganization.id)
      .eq('scope_1_2_emission_sources.scope', 'Scope 2')
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    if (error) throw error;

    const total = data?.reduce((sum, item: any) => {
      const factor = item.scope_1_2_emission_sources?.emissions_factors?.value || 0;
      return sum + (item.quantity * factor);
    }, 0) || 0;

    setScope2CO2e(total);
  } catch (error: any) {
    console.error('Error fetching Scope 2 emissions:', error);
    setScope2CO2e(0);
  }
};
```

---

### Fix #7: Update useEffect Calls

**Replace line 535** from:
```typescript
fetchFuelTypes();
```

**To**:
```typescript
fetchEmissionSources();
```

---

## Validation After Fix

### Test 1: All Scope 1 Sources Load
1. Navigate to `/data/scope-1-2`
2. Click Scope 1 tab
3. Click "Fuel Type" dropdown
4. **Expected**: See 12 sources grouped by:
   - Stationary Combustion (6)
   - Mobile Combustion (2)
   - Fugitive Emissions (4)

### Test 2: Unit Auto-Selects
1. Select "Natural Gas"
2. **Expected**: Unit field shows "kWh"
3. Select "Diesel (Owned Fleet)"
4. **Expected**: Unit field changes to "litres"

### Test 3: Scope 1 Data Saves
1. Select facility
2. Select "Natural Gas"
3. Enter amount: 100
4. Unit should be "kWh" (auto-selected)
5. Select today's date
6. Click "Submit Scope 1 Data"
7. **Expected**: Success toast, data appears in "Recent Scope 1 Activity" table

### Test 4: Scope 2 Sources Available
1. Click Scope 2 tab
2. Click "Source Type" dropdown
3. **Expected**: See 3 sources:
   - Purchased Grid Electricity
   - Purchased Heat or Steam
   - Purchased Cooling

### Test 5: Scope 2 Data Saves
1. Select facility
2. Select "Purchased Grid Electricity"
3. Enter amount: 500
4. Unit should be "kWh" (auto-selected)
5. Select today's date
6. Click "Submit Scope 2 Data"
7. **Expected**: Success toast, data appears in table

### Test 6: Run Calculations Works
1. After entering data
2. Click "Run Calculations" button
3. **Expected**: Success toast showing Scope 1 and Scope 2 totals

### Test 7: Annual Footprint Shows Data
1. Click "Annual Footprint" tab
2. **Expected**:
   - Scope 1 card shows total kgCO2e (not "No data")
   - Scope 2 card shows total kgCO2e (not "No data")

---

## Summary of Changes

### Files Modified
- `app/(authenticated)/data/scope-1-2/page.tsx`

### Changes Required
1. ✅ Replace `fetchFuelTypes()` with `fetchEmissionSources()` to query `scope_1_2_emission_sources`
2. ✅ Add state for `scope1Sources` and `scope2Sources`
3. ✅ Update Scope 1 form submission to INSERT directly to `facility_activity_data`
4. ✅ Update Scope 2 form submission to INSERT directly to `facility_activity_data`
5. ✅ Add Scope 2 source type dropdown (was hardcoded to "Electricity")
6. ✅ Add unit auto-selection handlers
7. ✅ Update Scope 1 fuel type dropdown with all sources grouped by category
8. ✅ Update Run Calculations to query `facility_activity_data` and calculate totals
9. ✅ Update `fetchScope1Emissions()` to query `facility_activity_data`
10. ✅ Update `fetchScope2Emissions()` to query `facility_activity_data`

---

## Expected Result

After this fix:
- ✅ All 12 Scope 1 sources appear in dropdown
- ✅ All 3 Scope 2 sources appear in dropdown
- ✅ Unit auto-selects based on fuel/source type
- ✅ Data saves to `facility_activity_data` table
- ✅ Run Calculations calculates emissions from saved data
- ✅ Annual Footprint displays Scope 1 and Scope 2 totals
- ✅ Users can fully enter and track Scope 1 & 2 emissions

---

## Priority: P0 - CRITICAL
**Effort**: 2-3 hours
**Impact**: Unblocks all Scope 1-2 data entry functionality

---

## Notes

1. **Database Schema**: Already fixed via migrations (all sources linked to emission factors)
2. **Edge Functions**: Not using `ingest-activity-data` or `invoke-scope1-2-calculations` - doing direct DB operations instead for reliability
3. **RLS Policies**: Ensure RLS policies on `facility_activity_data` allow INSERT with organization_id
4. **Organization ID**: Form submissions now explicitly set `organization_id` from `currentOrganization.id`
