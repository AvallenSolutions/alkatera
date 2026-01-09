# Sustainability Report Generator - Complete Fix

## Date: 2026-01-09

## Summary

Fixed the "Failed to create report record" error in the Generate Sustainability Report feature by:
1. Creating the missing `generated_reports` database table with correct RLS policies
2. Fixing organization context usage in `useReportBuilder` hook
3. Adding missing multi-year support fields
4. Improving error logging for debugging

---

## Issues Fixed

### Issue 1: Missing Database Table

**Problem:**
The `generated_reports` table didn't exist in the database, causing all INSERT operations to fail.

**Solution:**
Created migration `create_sustainability_reports_system.sql` with:
- Complete table schema for report metadata
- Correct RLS policies using `organization_members` table
- Proper indexes for performance
- Audit trail fields (skywork_query, data_snapshot)
- Status tracking (pending, generating, completed, failed)

### Issue 2: Incorrect RLS Policies

**Problem:**
Original migration (never applied) referenced non-existent `active_organization_id` column in profiles table.

**Solution:**
RLS policies now correctly use the `organization_members` table:

```sql
-- Users can create reports for organizations they belong to
CREATE POLICY "Users can create reports for their organization"
  ON generated_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );
```

### Issue 3: Organization Context Integration

**Problem:**
`useReportBuilder` hook was querying profiles table for non-existent `active_organization_id`.

**Solution:**
Hook now uses `OrganizationContext`:

```typescript
import { useOrganization } from '@/lib/organizationContext';

export function useReportBuilder() {
  const { currentOrganization } = useOrganization();

  const generateReport = async (config: ReportConfig) => {
    if (!currentOrganization) {
      throw new Error('No active organization found');
    }

    const organizationId = currentOrganization.id;
    // ... rest of logic
  }
}
```

### Issue 4: Missing Multi-Year Fields

**Problem:**
Edge function expects `is_multi_year` and `report_years` columns, but they didn't exist.

**Solution:**
Added migration `add_multi_year_fields_to_generated_reports.sql`:
- `is_multi_year` BOOLEAN (tracks multi-year reports)
- `report_years` INTEGER[] (stores years covered)
- `parent_report_id`, `version`, `is_latest`, `changelog` (for versioning)

Updated insert to include these fields:

```typescript
const { data: reportRecord } = await supabase
  .from('generated_reports')
  .insert({
    // ... other fields
    is_multi_year: config.isMultiYear || false,
    report_years: config.reportYears || [config.reportYear],
    // ...
  });
```

### Issue 5: Poor Error Logging

**Problem:**
Generic "Failed to create report record" error provided no debugging information.

**Solution:**
Added detailed error logging:

```typescript
if (insertError) {
  console.error('❌ Insert error details:', {
    message: insertError.message,
    details: insertError.details,
    hint: insertError.hint,
    code: insertError.code,
  });
  throw new Error(`Failed to create report record: ${insertError.message}`);
}
```

---

## Database Schema

### `generated_reports` Table

```sql
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Report metadata
  report_name TEXT NOT NULL,
  report_year INTEGER NOT NULL,
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,

  -- Configuration (stored as JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{}',

  -- Key fields extracted for querying
  audience TEXT NOT NULL,
  output_format TEXT NOT NULL DEFAULT 'pptx',
  standards TEXT[] NOT NULL,
  sections TEXT[] NOT NULL,

  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#10b981',

  -- Multi-year support
  is_multi_year BOOLEAN DEFAULT false,
  report_years INTEGER[] DEFAULT '{}',

  -- Generation status
  status TEXT NOT NULL DEFAULT 'pending',
  skywork_query TEXT,      -- Audit trail
  document_url TEXT,        -- Generated document
  error_message TEXT,

  -- Data snapshot for compliance
  data_snapshot JSONB,

  -- Versioning
  parent_report_id UUID REFERENCES generated_reports(id),
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,
  changelog TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Flow Architecture

### 1. **User Configures Report** (`/reports/builder`)
- Sets report name, year, period
- Selects audience (investors, regulators, etc.)
- Chooses output format (PowerPoint, Word, Excel)
- Selects standards (CSRD, ISO 14067, GHG Protocol)
- Configures branding (logo, colors)
- Enables multi-year analysis (optional)

### 2. **Frontend Creates Record** (`useReportBuilder.ts`)
```typescript
// Get organization from context (not database query)
const organizationId = currentOrganization.id;

// Insert report configuration
const { data: reportRecord } = await supabase
  .from('generated_reports')
  .insert({
    organization_id: organizationId,
    created_by: user.id,
    report_name: config.reportName,
    // ... all config fields
    status: 'pending',
  });
```

### 3. **Edge Function Generates Report** (`generate-sustainability-report`)
```typescript
// 1. Fetch report configuration
const reportConfig = await fetchReportConfig(report_config_id);

// 2. Update status to 'generating'
await updateStatus(report_config_id, 'generating');

// 3. Aggregate data from database
const data = await aggregateReportData(
  organizationId,
  reportYear,
  sections,
  isMultiYear,
  reportYears
);

// 4. Construct Skywork query with STRICT instructions
const skyworkQuery = constructSkyworkQuery(reportConfig, data);

// 5. Call Skywork API
const response = await callSkyworkAPI(skyworkQuery);

// 6. Parse SSE stream for download URL
const documentUrl = await parseSSEResponse(response);

// 7. Update report with success
await updateReport({
  status: 'completed',
  document_url: documentUrl,
  skywork_query: skyworkQuery,    // Audit trail
  data_snapshot: data,             // Compliance
  generated_at: new Date()
});
```

### 4. **Skywork API Integration**

The edge function sends structured prompts to Skywork:

```typescript
Generate a professional sustainability report PowerPoint for [Organization] for [Year].

**CRITICAL INSTRUCTIONS:**
1. Use ONLY the data provided below. Do NOT generate, estimate, or create any figures.
2. If data is missing, explicitly state "Data not available for this period."
3. Format the report for: investors
4. Ensure compliance with: CSRD, ISO 14067

# GREENHOUSE GAS EMISSIONS SUMMARY
Total Emissions: 1,234.56 tCO2e
- Scope 1: 234.56 tCO2e
- Scope 2: 456.78 tCO2e
- Scope 3: 543.22 tCO2e

# MULTI-YEAR TRENDS (if enabled)
[Shows year-over-year data with percentage changes]

# PRODUCT CARBON FOOTPRINTS
[Lists products with their carbon footprints]
```

**Key Security Features:**
- `use_network: false` - Prevents AI hallucination
- Data snapshot stored for audit trail
- Query stored for reproducibility

---

## Testing the Feature

### Test 1: Basic Report Generation

1. Navigate to `/reports/builder`
2. Configure report:
   - Name: "Annual Sustainability Report 2026"
   - Year: 2026
   - Audience: Investors
   - Format: PowerPoint
3. Click "Generate Report"
4. **Expected:** Report record created with status 'pending'
5. Edge function processes and returns download URL
6. Status updates to 'completed'

### Test 2: Multi-Year Report

1. Configure report with:
   - Enable "Multi-Year Analysis"
   - Select years: 2024, 2025, 2026
2. Generate report
3. **Expected:** Report includes trend analysis and year-over-year comparisons

### Test 3: Organization Switching

1. Switch to different organization
2. Generate report
3. **Expected:** Report created for newly selected organization

### Test 4: Error Handling

1. Generate report with missing data
2. **Expected:** Console shows detailed error with code, message, hint
3. Report status set to 'failed'
4. Error message stored in database

---

## Skywork API Configuration

Required environment variables (already configured in Supabase):

```bash
SKYWORK_SECRET_ID=your_secret_id
SKYWORK_SECRET_KEY=your_secret_key
SKYWORK_API_URL=https://api.skywork.ai  # Optional, defaults to this
```

**Tool Mapping:**
- PowerPoint → `gen_ppt`
- Word → `gen_doc`
- Excel → `gen_excel`

**Authentication:**
- MD5 sign: `md5(secretId:secretKey)`
- Passed as query parameters

---

## Compliance Features

### ISO 14067 & CSRD Compliance

1. **Data Provenance:**
   - `data_snapshot` field stores exact data used
   - `skywork_query` stores exact prompt sent
   - Timestamps track creation and generation time

2. **Audit Trail:**
   - Every report generation is logged
   - Source data is immutable (snapshot)
   - Query is reproducible

3. **No Hallucination:**
   - `use_network: false` prevents AI from inventing data
   - Explicit instruction: "Use ONLY the data provided"
   - Missing data is clearly stated as "Data not available"

4. **Multi-Year Analysis:**
   - Year-over-year trends
   - Progress tracking
   - Reduction trajectory

---

## Files Modified

1. **Database:**
   - `supabase/migrations/[timestamp]_create_sustainability_reports_system.sql`
   - `supabase/migrations/[timestamp]_add_multi_year_fields_to_generated_reports.sql`

2. **Frontend:**
   - `hooks/useReportBuilder.ts` - Uses organization context, improved logging
   - `components/report-builder/ReportVersioning.tsx` - Fixed TypeScript types

3. **Edge Function:**
   - `supabase/functions/generate-sustainability-report/index.ts` - Already properly configured

---

## Success Criteria

✅ **Database table created** with correct schema
✅ **RLS policies** use organization_members (not profiles)
✅ **Organization context** properly integrated
✅ **Multi-year fields** added to schema
✅ **Detailed error logging** for debugging
✅ **Build succeeds** with no TypeScript errors
✅ **Edge function** ready to process reports

---

## Next Steps for User

1. **Test the feature:**
   - Navigate to `/reports/builder`
   - Configure and generate a report
   - Check console logs for detailed progress

2. **Verify Skywork integration:**
   - Ensure SKYWORK_SECRET_ID and SKYWORK_SECRET_KEY are set
   - Test with sample data
   - Check generated document URL

3. **Add real data:**
   - Ensure corporate_reports table has data for target years
   - Ensure product_lcas has completed LCA data
   - Verify organization profile is complete

4. **Monitor:**
   - Check report_statistics view for success/failure rates
   - Review error_message field for failed reports
   - Validate data_snapshot contains expected data

---

## Troubleshooting

### "Failed to create report record"
- Check console for detailed error (code, message, hint)
- Verify user is member of organization (check organization_members)
- Ensure all required fields are provided

### "No download URL from Skywork"
- Check Skywork API credentials
- Verify Skywork API is reachable
- Review skywork_query in database for prompt issues

### "Report generation timeout"
- Large reports may take longer
- Consider increasing function timeout
- Check Skywork API response time

---

## Architecture Benefits

1. **Single Source of Truth:** Organization from context, not duplicate queries
2. **Proper Security:** RLS uses actual membership table
3. **Audit Trail:** Full compliance with data snapshots and query logging
4. **Flexible Schema:** JSONB config allows future expansion
5. **Multi-tenant:** Works correctly across organization switching
6. **Versioning Ready:** Fields in place for report version control
