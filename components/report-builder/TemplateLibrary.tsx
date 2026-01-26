'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Download,
  Save,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Sparkles,
  CheckCircle2,
  Building2,
  Search,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';
import { useToast } from '@/hooks/use-toast';

interface TemplateLibraryProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  template_type: 'system' | 'organization' | 'personal';
  config: any;
  tags: string[];
  industry: string;
  download_count: number;
}

interface IndustryBenchmark {
  industry: string;
  metric_name: string;
  metric_value: number;
  unit: string;
  percentile: string;
  year: number;
  source: string;
}

export function TemplateLibrary({ config, onChange }: TemplateLibraryProps) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [benchmarks, setBenchmarks] = useState<IndustryBenchmark[]>([]);
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const supabase = getSupabaseBrowserClient();
  const { toast } = useToast();

  useEffect(() => {
    loadTemplatesAndBenchmarks();
  }, []);

  async function loadTemplatesAndBenchmarks() {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.active_organization_id) return;

      // Load templates
      const { data: templatesData } = await supabase
        .from('report_templates')
        .select('*')
        .or(`template_type.eq.system,organization_id.eq.${profile.active_organization_id}`)
        .order('download_count', { ascending: false });

      setTemplates(templatesData || []);

      // Load organization info
      const { data: org } = await supabase
        .from('organizations')
        .select('name, industry')
        .eq('id', profile.active_organization_id)
        .single();

      setOrganizationData(org);

      // Load industry benchmarks
      if (org?.industry) {
        const { data: benchmarksData } = await supabase
          .from('industry_benchmarks')
          .select('*')
          .eq('industry', org.industry)
          .order('year', { ascending: false });

        setBenchmarks(benchmarksData || []);
      }

      // Load organization's actual emissions for comparison
      if (org) {
        const { data: corporateReport } = await supabase
          .from('corporate_reports')
          .select('total_emissions, breakdown_json')
          .eq('organization_id', profile.active_organization_id)
          .eq('year', config.reportYear)
          .single();

        if (corporateReport) {
          setOrganizationData((prev: any) => ({
            ...prev,
            emissions: corporateReport.total_emissions,
            breakdown: corporateReport.breakdown_json,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading templates and benchmarks:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleApplyTemplate(template: Template) {
    const templateConfig = template.config;

    onChange({
      audience: templateConfig.audience || config.audience,
      outputFormat: templateConfig.outputFormat || config.outputFormat,
      standards: templateConfig.standards || config.standards,
      sections: templateConfig.sections || config.sections,
      branding: {
        ...config.branding,
        primaryColor: templateConfig.branding?.primaryColor || config.branding.primaryColor,
        secondaryColor: templateConfig.branding?.secondaryColor || config.branding.secondaryColor,
      },
    });

    toast({
      title: 'Template Applied',
      description: `"${template.name}" has been applied to your report configuration.`,
    });

    // Increment download count
    supabase
      .from('report_templates')
      .update({ download_count: template.download_count + 1 })
      .eq('id', template.id)
      .then();
  }

  async function handleSaveTemplate() {
    if (!saveTemplateName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a template name',
        variant: 'destructive',
      });
      return;
    }

    setSavingTemplate(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.active_organization_id) throw new Error('No active organization');

      const templateConfig = {
        audience: config.audience,
        outputFormat: config.outputFormat,
        standards: config.standards,
        sections: config.sections,
        branding: config.branding,
      };

      const { error } = await supabase.from('report_templates').insert({
        name: saveTemplateName,
        description: `Custom template created from ${config.reportName}`,
        template_type: 'organization',
        organization_id: profile.active_organization_id,
        created_by: user.id,
        config: templateConfig,
        is_public: false,
        tags: config.standards,
        industry: organizationData?.industry || 'all',
      });

      if (error) throw error;

      toast({
        title: 'Template Saved',
        description: `"${saveTemplateName}" has been saved to your organization's template library.`,
      });

      setSaveTemplateName('');
      loadTemplatesAndBenchmarks(); // Reload to show new template
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesIndustry =
      filterIndustry === 'all' ||
      template.industry === filterIndustry ||
      template.industry === 'all';

    return matchesSearch && matchesIndustry;
  });

  const systemTemplates = filteredTemplates.filter((t) => t.template_type === 'system');
  const orgTemplates = filteredTemplates.filter((t) => t.template_type === 'organization');

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="templates" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="benchmarks">Industry Benchmarks</TabsTrigger>
        <TabsTrigger value="save">Save Template</TabsTrigger>
      </TabsList>

      {/* Templates Tab */}
      <TabsContent value="templates" className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterIndustry} onValueChange={setFilterIndustry}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              <SelectItem value="food_beverage">Food & Beverage</SelectItem>
              <SelectItem value="manufacturing">Manufacturing</SelectItem>
              <SelectItem value="technology">Technology</SelectItem>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="professional_services">Professional Services</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* System Templates */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Pre-Built Templates
          </h3>
          <div className="grid gap-3">
            {systemTemplates.map((template) => (
              <Card key={template.id} className="hover:border-blue-300 transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    </div>
                    <Button
                      onClick={() => handleApplyTemplate(template)}
                      size="sm"
                      variant="outline"
                    >
                      <Download className="mr-2 h-3 w-3" />
                      Apply
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-xs">
                      {template.download_count} uses
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Organization Templates */}
        {orgTemplates.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Your Organization&apos;s Templates
            </h3>
            <div className="grid gap-3">
              {orgTemplates.map((template) => (
                <Card key={template.id} className="hover:border-purple-300 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      </div>
                      <Button
                        onClick={() => handleApplyTemplate(template)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Apply
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 flex-wrap">
                      {template.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="text-xs">
                        Custom
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* Benchmarks Tab */}
      <TabsContent value="benchmarks" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Industry Benchmarks
            </CardTitle>
            <CardDescription>
              Compare your organization&apos;s performance against industry averages
              {organizationData?.industry && ` in ${organizationData.industry.replace('_', ' ')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {benchmarks.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No benchmark data available for your industry. Contact support to request industry benchmarks.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {/* Emissions Intensity Benchmark */}
                {benchmarks.filter((b) => b.metric_name === 'emissions_intensity').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Emissions Intensity</h4>
                    <div className="grid gap-3">
                      {benchmarks
                        .filter((b) => b.metric_name === 'emissions_intensity')
                        .map((benchmark, idx) => {
                          const orgValue = organizationData?.emissions || 0;
                          const isAbove = orgValue > benchmark.metric_value;

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div>
                                <div className="font-medium capitalize">
                                  {benchmark.percentile.replace('_', ' ')}
                                </div>
                                <div className="text-sm text-muted-foreground">{benchmark.unit}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-2xl font-bold">{benchmark.metric_value.toFixed(0)}</div>
                                  <div className="text-xs text-muted-foreground">Industry</div>
                                </div>
                                {organizationData?.emissions && (
                                  <>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold">{orgValue.toFixed(0)}</div>
                                      <div className="text-xs text-muted-foreground">Your Org</div>
                                    </div>
                                    {isAbove ? (
                                      <TrendingUp className="h-5 w-5 text-red-600" />
                                    ) : (
                                      <TrendingDown className="h-5 w-5 text-green-600" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Other Metrics */}
                {benchmarks.filter((b) => b.metric_name !== 'emissions_intensity').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Other Metrics</h4>
                    <div className="grid gap-2">
                      {benchmarks
                        .filter((b) => b.metric_name !== 'emissions_intensity')
                        .map((benchmark, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <div className="font-medium capitalize">
                                {benchmark.metric_name.replace(/_/g, ' ')}
                              </div>
                              <div className="text-sm text-muted-foreground capitalize">
                                {benchmark.percentile.replace('_', ' ')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">
                                {benchmark.metric_value.toFixed(1)} {benchmark.unit}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <Alert>
                  <AlertDescription className="text-xs">
                    Source: {benchmarks[0]?.source} ({benchmarks[0]?.year})
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Save Template Tab */}
      <TabsContent value="save" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save Current Configuration as Template
            </CardTitle>
            <CardDescription>
              Create a reusable template from your current report configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Q4 Investor Report Template"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                className="mt-2"
              />
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                This template will save your current audience, format, standards, sections, and branding choices.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <div className="text-sm font-medium">Template Preview:</div>
              <div className="text-sm space-y-1 text-muted-foreground">
                <div>• Audience: <strong>{config.audience}</strong></div>
                <div>• Format: <strong>{config.outputFormat.toUpperCase()}</strong></div>
                <div>• Standards: <strong>{config.standards.join(', ')}</strong></div>
                <div>• Sections: <strong>{config.sections.length} selected</strong></div>
                <div>• Branding: <strong>Custom colors configured</strong></div>
              </div>
            </div>

            <Button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !saveTemplateName.trim()}
              className="w-full"
            >
              {savingTemplate ? (
                <>Saving Template...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Template
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
