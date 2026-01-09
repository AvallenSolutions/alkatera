# Advanced Report Builder Features - Implementation Guide

## Overview

This document describes 7 powerful enhancements to the sustainability report builder:

1. **Interactive Data Preview & Verification** ✅ BUILT
2. **Multi-Year Trend Analysis** → TO BUILD
3. **Smart Section Recommendations** → TO BUILD
4. **Collaborative Review Workflow** → TO BUILD
5. **Template Library & Benchmarking** → TO BUILD
6. **Data Gap Alerts** → TO BUILD
7. **Report Versioning & Changelog** → TO BUILD

---

## Database Schema ✅ COMPLETE

All required tables created in migration: `20260109130000_add_advanced_report_features.sql`

### New Tables:
- `report_versions` - Version history with snapshots
- `report_reviews` - Collaborative review workflow
- `report_review_comments` - Threaded comments
- `report_templates` - System and user templates
- `data_gaps` - Missing data tracking
- `report_data_quality` - Quality metrics per section
- `industry_benchmarks` - Industry averages

### Enhanced Tables:
- `generated_reports` - Added version, multi-year, changelog fields

---

## Feature 1: Interactive Data Preview ✅ COMPLETE

**Component:** `DataPreviewPanel.tsx`

**What it does:**
- Shows actual data that will be included in report
- Displays data quality (Tier 1/2/3)
- Highlights missing data
- Shows completeness and confidence scores

**Usage:**
```tsx
<DataPreviewPanel config={config} />
```

**Key Metrics:**
- Overall Completeness: % of selected sections with data
- Confidence Score: Based on data quality tiers
- Missing Data Alerts: Lists gaps

---

## Feature 2: Multi-Year Trend Analysis

### Implementation Steps:

**1. Update BasicConfigForm to support year ranges:**

```tsx
// Add multi-year toggle and year selector
const [isMultiYear, setIsMultiYear] = useState(false);
const [selectedYears, setSelectedYears] = useState([2024]);

// UI Component
<Switch
  checked={isMultiYear}
  onCheckedChange={setIsMultiYear}
/>

{isMultiYear && (
  <MultiSelect
    options={yearOptions}
    selected={selectedYears}
    onChange={setSelectedYears}
  />
)}
```

**2. Update ReportConfig interface:**

```typescript
interface ReportConfig {
  // ... existing fields
  isMultiYear: boolean;
  reportYears: number[]; // e.g., [2022, 2023, 2024]
}
```

**3. Enhance data aggregation in edge function:**

```typescript
// For each year, aggregate data
for (const year of reportYears) {
  const yearData = await aggregateReportData(supabaseClient, orgId, year, sections);
  allYearsData[year] = yearData;
}

// Calculate year-over-year changes
const trends = calculateTrends(allYearsData);
```

**4. Update Skywork query to include trends:**

```typescript
const skyworkQuery = `
# MULTI-YEAR TREND ANALYSIS

| Metric | 2022 | 2023 | 2024 | Change (2022-2024) |
|--------|------|------|------|--------------------|
| Total Emissions | ${data[2022].total} | ${data[2023].total} | ${data[2024].total} | ${change}% |
| Scope 1 | ... | ... | ... | ... |

## Trend Insights
- Total emissions decreased by ${Math.abs(change)}% over 3 years
- Scope 1 emissions show ${trend} trend
- On track to meet ${targetYear} target
`;
```

---

## Feature 3: Smart Section Recommendations

### Implementation:

**1. Create recommendation engine:**

```typescript
// hooks/useRecommendations.ts
export function useRecommendations(organizationId: string, year: number) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    async function analyzeData() {
      // Check each section's data availability and quality
      const recs: Recommendation[] = [];

      // Scope 1/2/3
      const { data: corporateReport } = await supabase
        .from('corporate_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('year', year)
        .single();

      if (corporateReport && corporateReport.total_emissions > 0) {
        recs.push({
          sectionId: 'scope-1-2-3',
          status: 'strong',
          confidence: 95,
          reason: 'Complete emissions data for all scopes',
          dataPoints: corporateReport.total_emissions,
        });
      } else {
        recs.push({
          sectionId: 'scope-1-2-3',
          status: 'weak',
          confidence: 30,
          reason: 'No corporate footprint report found',
          action: 'Complete your corporate footprint first',
        });
      }

      // Product footprints
      const { data: products, count } = await supabase
        .from('product_lcas')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('status', 'completed');

      if (count && count >= 5) {
        recs.push({
          sectionId: 'product-footprints',
          status: 'strong',
          confidence: 90,
          reason: `${count} products with completed LCAs`,
        });
      }

      setRecommendations(recs);
    }

    analyzeData();
  }, [organizationId, year]);

  return recommendations;
}
```

**2. Create RecommendationsPanel component:**

```tsx
// components/report-builder/RecommendationsPanel.tsx
export function RecommendationsPanel({ config, onChange }) {
  const recommendations = useRecommendations(orgId, config.reportYear);

  return (
    <div className="space-y-4">
      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          Based on your data, we recommend including these sections for maximum impact.
        </AlertDescription>
      </Alert>

      {recommendations.map((rec) => (
        <Card key={rec.sectionId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{rec.sectionLabel}</CardTitle>
              {rec.status === 'strong' && <Badge className="bg-green-600">🟢 Strong</Badge>}
              {rec.status === 'weak' && <Badge variant="destructive">🔴 Weak</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <p>{rec.reason}</p>
            <p className="text-sm text-muted-foreground">Confidence: {rec.confidence}%</p>
            {rec.action && (
              <Button variant="outline" size="sm" className="mt-2">
                {rec.action}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## Feature 4: Collaborative Review Workflow

### Implementation:

**1. Add "Request Review" step before generation:**

```tsx
// components/report-builder/ReviewWorkflowPanel.tsx
export function ReviewWorkflowPanel({ reportId, onApproved }) {
  const [reviewers, setReviewers] = useState([]);
  const [comments, setComments] = useState([]);

  async function addReviewer(email: string, role: string) {
    const { data } = await supabase
      .from('report_reviews')
      .insert({
        report_id: reportId,
        reviewer_email: email,
        reviewer_role: role,
        status: 'pending',
      })
      .select()
      .single();

    // Send email notification
    await sendReviewRequest(email, reportId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Workflow</CardTitle>
        <CardDescription>Request approval before generating final report</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Add Reviewer Form */}
        <div className="flex gap-2 mb-4">
          <Input placeholder="colleague@company.com" value={newReviewerEmail} />
          <Select value={newReviewerRole}>
            <SelectItem value="financial">Financial Data</SelectItem>
            <SelectItem value="technical">Technical Review</SelectItem>
            <SelectItem value="compliance">Compliance Check</SelectItem>
          </Select>
          <Button onClick={handleAddReviewer}>Add Reviewer</Button>
        </div>

        {/* Reviewer List */}
        {reviewers.map((reviewer) => (
          <div key={reviewer.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">{reviewer.reviewer_email}</p>
              <p className="text-sm text-muted-foreground">{reviewer.reviewer_role}</p>
            </div>
            <Badge variant={
              reviewer.status === 'approved' ? 'default' :
              reviewer.status === 'rejected' ? 'destructive' :
              'secondary'
            }>
              {reviewer.status}
            </Badge>
          </div>
        ))}

        {/* Comment Thread */}
        <div className="mt-6">
          <h4 className="font-semibold mb-3">Comments</h4>
          {comments.map((comment) => (
            <div key={comment.id} className="border-l-2 pl-4 mb-4">
              <p className="text-sm font-medium">{comment.commenter_name}</p>
              <p className="text-sm text-muted-foreground">{comment.comment_text}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {comment.section_id && `Re: ${comment.section_id}`}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**2. Update report builder page to include review step:**

```tsx
const [reviewRequired, setReviewRequired] = useState(false);
const [pendingReviewReportId, setPendingReviewReportId] = useState(null);

// After config, before generate:
if (reviewRequired) {
  return <ReviewWorkflowPanel reportId={pendingReviewReportId} onApproved={handleGenerate} />;
}
```

---

## Feature 5: Template Library & Benchmarking

### Implementation:

**1. Template Selector (before configuration):**

```tsx
// components/report-builder/TemplateLibrary.tsx
export function TemplateLibrary({ onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase
        .from('report_templates')
        .select('*')
        .or('is_public.eq.true,template_type.eq.system')
        .order('download_count', { ascending: false });

      setTemplates(data || []);
    }
    loadTemplates();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onSelectTemplate(template)}>
          <CardHeader>
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              {template.download_count} uses
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**2. Benchmarking in Preview:**

```tsx
// components/report-builder/BenchmarkingView.tsx
export function BenchmarkingView({ organizationData, industry }) {
  const [benchmarks, setBenchmarks] = useState(null);

  useEffect(() => {
    async function loadBenchmarks() {
      const { data } = await supabase
        .from('industry_benchmarks')
        .select('*')
        .eq('industry', industry)
        .eq('year', 2024);

      setBenchmarks(data);
    }
    loadBenchmarks();
  }, [industry]);

  const emissionsIntensity = organizationData.totalEmissions / organizationData.revenue;
  const industryAvg = benchmarks?.find((b) => b.metric_name === 'emissions_intensity' && b.percentile === 'average')?.metric_value;
  const topQuartile = benchmarks?.find((b) => b.metric_name === 'emissions_intensity' && b.percentile === 'top_quartile')?.metric_value;

  const performance = emissionsIntensity < topQuartile ? 'top_quartile' : emissionsIntensity < industryAvg ? 'above_average' : 'below_average';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Industry Benchmarking</CardTitle>
        <CardDescription>Compare your performance against industry peers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Emissions Intensity</h4>
            <div className="flex items-end gap-4">
              <div>
                <div className="text-2xl font-bold">{emissionsIntensity.toFixed(0)}</div>
                <div className="text-sm text-muted-foreground">Your Organization</div>
              </div>
              <div>
                <div className="text-xl">{industryAvg?.toFixed(0)}</div>
                <div className="text-sm text-muted-foreground">Industry Average</div>
              </div>
              <div>
                <div className="text-xl text-green-600">{topQuartile?.toFixed(0)}</div>
                <div className="text-sm text-muted-foreground">Top 25%</div>
              </div>
            </div>
          </div>

          {performance === 'top_quartile' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                🌟 You're in the top 25% of your industry! Highlight this in your report.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Feature 6: Data Gap Alerts

### Implementation:

**1. Scan for missing data:**

```typescript
// edge function or client-side
async function scanForDataGaps(orgId: string, year: number) {
  const gaps: DataGap[] = [];

  // Check corporate footprint
  const { data: report } = await supabase
    .from('corporate_reports')
    .select('*')
    .eq('organization_id', orgId)
    .eq('year', year)
    .single();

  if (!report) {
    gaps.push({
      gap_type: 'scope_1',
      section_id: 'scope-1-2-3',
      description: `No corporate footprint report for ${year}`,
      severity: 'critical',
      data_required: 'Facility activity data, fleet emissions, purchased energy',
      fill_url: `/reports/company-footprint/${year}`,
    });
  }

  // Check product LCAs
  const { count: productCount } = await supabase
    .from('product_lcas')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)
    .eq('status', 'completed');

  if (!productCount || productCount < 3) {
    gaps.push({
      gap_type: 'product_lca',
      section_id: 'product-footprints',
      description: 'Limited product LCA coverage',
      severity: 'high',
      data_required: 'Complete LCA for key products',
      fill_url: '/products',
    });
  }

  // Save gaps to database
  for (const gap of gaps) {
    await supabase.from('data_gaps').insert({ ...gap, organization_id: orgId });
  }

  return gaps;
}
```

**2. Display gaps in UI:**

```tsx
// components/report-builder/DataGapAlerts.tsx
export function DataGapAlerts({ organizationId, reportYear }) {
  const [gaps, setGaps] = useState([]);

  useEffect(() => {
    async function loadGaps() {
      const { data } = await supabase
        .from('data_gaps')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_resolved', false)
        .order('severity', { ascending: false });

      setGaps(data || []);
    }
    loadGaps();
  }, [organizationId]);

  if (gaps.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>All data requirements met! ✓</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {gaps.map((gap) => (
        <Alert key={gap.id} variant={gap.severity === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{gap.description}</p>
                <p className="text-sm mt-1">Required: {gap.data_required}</p>
              </div>
              {gap.fill_url && (
                <Link href={gap.fill_url}>
                  <Button size="sm" variant="outline">Fill Data</Button>
                </Link>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
```

---

## Feature 7: Report Versioning & Changelog

### Implementation:

**1. Version history component:**

```tsx
// components/report-builder/VersionHistory.tsx
export function VersionHistory({ reportId }) {
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    async function loadVersions() {
      const { data } = await supabase
        .from('report_versions')
        .select('*')
        .eq('report_id', reportId)
        .order('version', { ascending: false });

      setVersions(data || []);
    }
    loadVersions();
  }, [reportId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History</CardTitle>
        <CardDescription>Track all changes to this report configuration</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {versions.map((version) => (
            <div key={version.id} className="border-l-2 border-blue-600 pl-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <Badge>Version {version.version}</Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(version.created_at), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
              <p className="text-sm font-medium">{version.changelog}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline">View</Button>
                <Button size="sm" variant="outline">Restore</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**2. Create new version on edit:**

```typescript
async function saveNewVersion(reportId: string, changes: string, newConfig: any) {
  const { data } = await supabase.rpc('create_report_version', {
    p_report_id: reportId,
    p_changelog: changes,
    p_config: newConfig,
  });

  return data; // Returns new report ID
}
```

---

## Integration into Main Report Builder

Update `app/(authenticated)/reports/builder/page.tsx`:

```tsx
export default function ReportBuilderPage() {
  const [activeTab, setActiveTab] = useState('templates'); // Start with templates
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  return (
    <div className="container mx-auto py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="data">Data Selection</TabsTrigger>
          <TabsTrigger value="standards">Standards</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="preview">Data Preview</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplateLibrary onSelectTemplate={(t) => {
            setSelectedTemplate(t);
            setConfig(t.config);
            setActiveTab('basics');
          }} />
        </TabsContent>

        <TabsContent value="basics">
          <BasicConfigForm config={config} onChange={handleUpdateConfig} />
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsPanel config={config} onChange={handleUpdateConfig} />
          <DataGapAlerts organizationId={orgId} reportYear={config.reportYear} />
        </TabsContent>

        <TabsContent value="data">
          <DataSelectionPanel config={config} onChange={handleUpdateConfig} />
        </TabsContent>

        <TabsContent value="standards">
          <StandardsSelector config={config} onChange={handleUpdateConfig} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingPanel config={config} onChange={handleUpdateConfig} />
          <BenchmarkingView organizationData={orgData} industry={orgIndustry} />
        </TabsContent>

        <TabsContent value="preview">
          <DataPreviewPanel config={config} />
          <ReportPreview config={config} />
        </TabsContent>

        <TabsContent value="review">
          {reviewRequired ? (
            <ReviewWorkflowPanel reportId={reportId} onApproved={handleGenerate} />
          ) : (
            <Button onClick={() => setReviewRequired(true)}>Request Review</Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Summary

All 7 features are now designed and ready for implementation. The database schema is complete, and Feature #1 (Interactive Data Preview) is fully built.

### To Complete Implementation:

1. ✅ Database schema created
2. ✅ Seed data added
3. ✅ Feature 1 built (DataPreviewPanel)
4. ⏳ Build remaining 6 components following the patterns above
5. ⏳ Update main report builder page with new tabs
6. ⏳ Enhance edge function with multi-year support
7. ⏳ Test end-to-end

### Estimated Time:
- Features 2-7: 2-3 days of development
- Testing & refinement: 1 day
- **Total: 3-4 days to complete all features**

This implementation guide provides all the patterns and code structure needed to build the remaining features quickly and consistently.
