'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BookOpen,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  Database,
  ChevronDown,
  ExternalLink,
  Info,
  Shield,
  MessageSquarePlus,
  Loader2,
  Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { PageLoader } from '@/components/ui/page-loader';
import { toast } from 'sonner';

interface EmissionFactor {
  id: string;
  name: string;
  category: string;
  co2_factor: number;
  reference_unit: string;
  source: string;
  geographic_scope: string;
  temporal_coverage: string;
  uncertainty_percent: number;
  metadata: {
    data_quality_grade?: string;
    literature_source?: {
      title?: string;
      authors?: string;
      year?: number;
      journal?: string;
      doi?: string;
      url?: string;
    };
    corroborating_sources?: Array<{
      title?: string;
      authors?: string;
      year?: number;
      value?: string;
    }>;
    system_boundary?: string;
    value_range_low?: number;
    value_range_high?: number;
    notes?: string;
    drinks_relevance?: string;
    proxy_methodology?: string;
    review_date?: string;
  };
}

interface DataSourcesResponse {
  factors: EmissionFactor[];
  grouped: Record<string, EmissionFactor[]>;
  summary: {
    total: number;
    by_quality: { high: number; medium: number; low: number };
    categories: string[];
  };
}

function QualityBadge({ grade }: { grade?: string }) {
  switch (grade) {
    case 'HIGH':
      return (
        <Badge className="bg-emerald-600 text-white text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Well Established
        </Badge>
      );
    case 'MEDIUM':
      return (
        <Badge className="bg-amber-600 text-white text-xs">
          <FlaskConical className="h-3 w-3 mr-1" />
          Good Estimate
        </Badge>
      );
    case 'LOW':
      return (
        <Badge className="bg-slate-500 text-white text-xs">
          <Info className="h-3 w-3 mr-1" />
          Best Available
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          Unknown
        </Badge>
      );
  }
}

function FactorRow({ factor }: { factor: EmissionFactor }) {
  const [isOpen, setIsOpen] = useState(false);
  const meta = factor.metadata || {};
  const lit = meta.literature_source || {};

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setIsOpen(!isOpen)}>
        <TableCell className="font-medium">{factor.name}</TableCell>
        <TableCell className="text-right font-mono">
          {factor.co2_factor.toFixed(2)}
        </TableCell>
        <TableCell className="text-center">{factor.reference_unit}</TableCell>
        <TableCell className="text-center">
          <QualityBadge grade={meta.data_quality_grade} />
        </TableCell>
        <TableCell className="text-center">
          {factor.uncertainty_percent ? `\u00B1${factor.uncertainty_percent}%` : '-'}
        </TableCell>
        <TableCell className="text-center">{factor.geographic_scope || '-'}</TableCell>
        <TableCell className="text-center">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <div className="space-y-3 text-sm">
              {/* Primary source */}
              <div>
                <span className="font-semibold text-foreground">Data source: </span>
                <span className="text-muted-foreground">{factor.source}</span>
              </div>

              {/* Literature reference */}
              {lit.title && (
                <div>
                  <span className="font-semibold text-foreground">Original research: </span>
                  <span className="text-muted-foreground">
                    {lit.authors && `${lit.authors} `}
                    {lit.year && `(${lit.year}). `}
                    <em>{lit.title}</em>
                    {lit.journal && `. ${lit.journal}`}
                  </span>
                  {lit.doi && (
                    <a
                      href={`https://doi.org/${lit.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center text-xs text-blue-600 hover:underline"
                    >
                      View study <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  )}
                  {!lit.doi && lit.url && (
                    <a
                      href={lit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center text-xs text-blue-600 hover:underline"
                    >
                      View source <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Corroborating sources */}
              {meta.corroborating_sources && meta.corroborating_sources.length > 0 && (
                <div>
                  <span className="font-semibold text-foreground">Supporting sources: </span>
                  <ul className="list-disc list-inside text-muted-foreground ml-2">
                    {meta.corroborating_sources.map((src, i) => (
                      <li key={i}>
                        {src.authors && `${src.authors} `}
                        {src.year && `(${src.year})`}
                        {src.title && ` - ${src.title}`}
                        {src.value && <span className="font-mono text-xs ml-1">[{src.value}]</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Value range */}
              {(meta.value_range_low || meta.value_range_high) && (
                <div>
                  <span className="font-semibold text-foreground">Typical range: </span>
                  <span className="text-muted-foreground font-mono">
                    {meta.value_range_low} &ndash; {meta.value_range_high} kg CO&#8322;e/{factor.reference_unit}
                  </span>
                </div>
              )}

              {/* System boundary */}
              {meta.system_boundary && (
                <div>
                  <span className="font-semibold text-foreground">What&apos;s included: </span>
                  <span className="text-muted-foreground">{meta.system_boundary}</span>
                </div>
              )}

              {/* Proxy methodology */}
              {meta.proxy_methodology && (
                <div>
                  <span className="font-semibold text-foreground">How this was estimated: </span>
                  <span className="text-muted-foreground">{meta.proxy_methodology}</span>
                </div>
              )}

              {/* Notes */}
              {meta.notes && (
                <div>
                  <span className="font-semibold text-foreground">Notes: </span>
                  <span className="text-muted-foreground">{meta.notes}</span>
                </div>
              )}

              {/* Drinks relevance */}
              {meta.drinks_relevance && (
                <div>
                  <span className="font-semibold text-foreground">How this applies to drinks: </span>
                  <span className="text-muted-foreground">{meta.drinks_relevance}</span>
                </div>
              )}

              {/* Temporal coverage */}
              {factor.temporal_coverage && (
                <div>
                  <span className="font-semibold text-foreground">Data period: </span>
                  <span className="text-muted-foreground">{factor.temporal_coverage}</span>
                </div>
              )}

              {/* Review date */}
              {meta.review_date && (
                <div className="text-xs text-muted-foreground/60">
                  Last reviewed: {meta.review_date}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function DataSourcesPage() {
  const [data, setData] = useState<DataSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Not authenticated');
          return;
        }

        const response = await fetch('/api/data/sources', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data sources');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error loading data sources: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const { factors, grouped, summary } = data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
        <p className="text-muted-foreground">
          This is the reference library that powers your carbon footprint calculations. It contains the
          conversion numbers (called &ldquo;emission factors&rdquo;) that tell us how much CO&#8322; is released
          for every kilogram of malt, litre of fuel, or unit of packaging your business uses.
        </p>
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Why does this matter?</strong> When you log ingredients, packaging, or energy use elsewhere in Alkatera, we
            multiply your quantities by these numbers to calculate your carbon footprint. Better data here means more
            accurate results for your business. You don&apos;t need to edit anything — this page is here so you can see
            exactly where our numbers come from.
          </AlertDescription>
        </Alert>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversion Factors</CardDescription>
            <CardTitle className="text-3xl">{summary.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Covering {summary.categories.length} categories of materials and processes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Well Established
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600">{summary.by_quality.high}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Backed by multiple published studies — the most reliable numbers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-amber-600" />
              Good Estimate
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">{summary.by_quality.medium}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on one trusted source — reliable but less cross-checked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Info className="h-3 w-3 text-slate-500" />
              Best Available
            </CardDescription>
            <CardTitle className="text-3xl text-slate-500">{summary.by_quality.low}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on similar materials — used when no direct data exists yet
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Methodology card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Where Do These Numbers Come From?
          </CardTitle>
          <CardDescription>
            We use internationally recognised standards to make sure your carbon footprint is calculated correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Every number in this library is based on real-world research and follows global best practices for
            measuring greenhouse gas emissions. We prioritise the most reliable sources available:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Published Research</p>
                <p className="text-xs">Findings from scientific studies that have been checked by other experts. These are the gold standard.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FlaskConical className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Industry Reports</p>
                <p className="text-xs">Data from trusted trade bodies and specialist platforms like brewing and packaging associations.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Best-Available Estimates</p>
                <p className="text-xs">When no direct data exists for a specific ingredient, we use numbers from similar materials and note the extra uncertainty.</p>
              </div>
            </div>
          </div>
          <p className="text-xs border-t pt-2">
            We always prefer the most reliable source available. Published research comes first, then industry reports,
            then government databases, and finally estimates based on similar materials. Every number also shows how
            precise it is, so you know where the data is strongest.
          </p>
        </CardContent>
      </Card>

      {/* Factor tables by category */}
      <Tabs defaultValue={summary.categories[0] || 'Ingredient'}>
        <TabsList>
          {summary.categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat} ({grouped[cat]?.length || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {summary.categories.map((cat) => (
          <TabsContent key={cat} value={cat}>
            <Card>
              <CardHeader>
                <CardTitle>{cat} Data</CardTitle>
                <CardDescription>
                  Click any row to see where the number comes from, including the original research and supporting sources.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Material</TableHead>
                      <TableHead className="w-[10%] text-right">CO&#8322; per unit</TableHead>
                      <TableHead className="w-[8%] text-center">Unit</TableHead>
                      <TableHead className="w-[18%] text-center">Data Quality</TableHead>
                      <TableHead className="w-[12%] text-center">Accuracy</TableHead>
                      <TableHead className="w-[12%] text-center">Region</TableHead>
                      <TableHead className="w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(grouped[cat] || []).map((factor) => (
                      <FactorRow key={factor.id} factor={factor} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Data quality legend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Understanding Data Quality
          </CardTitle>
          <CardDescription>
            Not all data is created equal. Here&apos;s what the quality badges mean and how accurate each level is
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quality</TableHead>
                <TableHead>What It Means</TableHead>
                <TableHead>How Precise</TableHead>
                <TableHead>Examples</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell><QualityBadge grade="HIGH" /></TableCell>
                <TableCell className="text-sm">Several independent studies agree on this number — it&apos;s the most reliable data we have</TableCell>
                <TableCell className="text-sm font-mono">10&ndash;25%</TableCell>
                <TableCell className="text-sm">Malt, hops, common grains — well-studied brewing ingredients</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><QualityBadge grade="MEDIUM" /></TableCell>
                <TableCell className="text-sm">One trusted source — a research paper, industry report, or specialist platform</TableCell>
                <TableCell className="text-sm font-mono">25&ndash;40%</TableCell>
                <TableCell className="text-sm">Yeast, spices, specialist packaging — data from trade bodies or single studies</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><QualityBadge grade="LOW" /></TableCell>
                <TableCell className="text-sm">No direct research exists for this specific item, so we use data from similar materials as a starting point</TableCell>
                <TableCell className="text-sm font-mono">40&ndash;60%</TableCell>
                <TableCell className="text-sm">Rare botanicals, niche ingredients — estimated from comparable crops or processes</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Request a Factor */}
      <RequestFactorForm />
    </div>
  );
}

function RequestFactorForm() {
  const [materialName, setMaterialName] = useState('');
  const [materialType, setMaterialType] = useState('ingredient');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim()) {
      toast.error('Please enter a material or ingredient name');
      return;
    }

    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        toast.error('Please sign in to submit a request');
        return;
      }

      const response = await fetch('/api/data/factor-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          material_name: materialName.trim(),
          material_type: materialType,
          notes: notes.trim() || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setSubmitted(true);
      setMaterialName('');
      setNotes('');
      toast.success('Request submitted! Our team will review and prioritise this.');

      // Reset submitted state after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5" />
          Missing Something?
        </CardTitle>
        <CardDescription>
          If you use an ingredient, packaging material, or process that isn&apos;t listed above, let us know.
          We&apos;ll research it and add it to the library so your carbon footprint calculations are as complete as possible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Thanks for letting us know! We&apos;ve added this to our research list. The more businesses that request the same item, the higher it gets prioritised.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="req-name" className="text-sm">Material / Ingredient Name</Label>
              <Input
                id="req-name"
                placeholder="e.g. Saffron, Cardamom, Shrink wrap"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-type" className="text-sm">Type</Label>
              <Select value={materialType} onValueChange={setMaterialType} disabled={submitting}>
                <SelectTrigger id="req-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingredient">Ingredient</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                  <SelectItem value="process">Process</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-notes" className="text-sm">Notes (optional)</Label>
              <Textarea
                id="req-notes"
                placeholder="Any context that helps us find the right data..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                rows={1}
                className="min-h-[36px] resize-none"
              />
            </div>
            <div>
              <Button type="submit" disabled={submitting || !materialName.trim()} className="w-full">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Submit Request</>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
