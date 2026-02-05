'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { PageLoader } from '@/components/ui/page-loader';

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
          High
        </Badge>
      );
    case 'MEDIUM':
      return (
        <Badge className="bg-amber-600 text-white text-xs">
          <FlaskConical className="h-3 w-3 mr-1" />
          Medium
        </Badge>
      );
    case 'LOW':
      return (
        <Badge className="bg-slate-500 text-white text-xs">
          <Info className="h-3 w-3 mr-1" />
          Low
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
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
        <TableCell>
          <CollapsibleTrigger asChild>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <div className="space-y-3 text-sm">
              {/* Primary source */}
              <div>
                <span className="font-semibold text-foreground">Source: </span>
                <span className="text-muted-foreground">{factor.source}</span>
              </div>

              {/* Literature reference */}
              {lit.title && (
                <div>
                  <span className="font-semibold text-foreground">Reference: </span>
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
                      DOI <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  )}
                  {!lit.doi && lit.url && (
                    <a
                      href={lit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center text-xs text-blue-600 hover:underline"
                    >
                      Link <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Corroborating sources */}
              {meta.corroborating_sources && meta.corroborating_sources.length > 0 && (
                <div>
                  <span className="font-semibold text-foreground">Corroborating sources: </span>
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
                  <span className="font-semibold text-foreground">Range: </span>
                  <span className="text-muted-foreground font-mono">
                    {meta.value_range_low} &ndash; {meta.value_range_high} kg CO&#8322;e/{factor.reference_unit}
                  </span>
                </div>
              )}

              {/* System boundary */}
              {meta.system_boundary && (
                <div>
                  <span className="font-semibold text-foreground">System boundary: </span>
                  <span className="text-muted-foreground">{meta.system_boundary}</span>
                </div>
              )}

              {/* Proxy methodology */}
              {meta.proxy_methodology && (
                <div>
                  <span className="font-semibold text-foreground">Proxy methodology: </span>
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
                  <span className="font-semibold text-foreground">Drinks relevance: </span>
                  <span className="text-muted-foreground">{meta.drinks_relevance}</span>
                </div>
              )}

              {/* Temporal coverage */}
              {factor.temporal_coverage && (
                <div>
                  <span className="font-semibold text-foreground">Temporal coverage: </span>
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
      </CollapsibleContent>
    </Collapsible>
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Emission Factor Library</h1>
        <p className="text-muted-foreground mt-1">
          Literature-sourced emission factors for drinks industry ingredients and packaging.
          Every factor is backed by published research, industry data, or documented proxy methodology.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Factors</CardDescription>
            <CardTitle className="text-3xl">{summary.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {summary.categories.length} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              High Confidence
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600">{summary.by_quality.high}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Multiple peer-reviewed sources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-amber-600" />
              Medium Confidence
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">{summary.by_quality.medium}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Single authoritative source
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Info className="h-3 w-3 text-slate-500" />
              Low Confidence
            </CardDescription>
            <CardTitle className="text-3xl text-slate-500">{summary.by_quality.low}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Proxy estimates with documented methodology
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Methodology card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Methodology
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            All emission factors follow the <strong>IPCC AR6 GWP100</strong> methodology and are aligned
            with <strong>ISO 14044</strong> data quality requirements. Factors are sourced from:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Peer-Reviewed</p>
                <p className="text-xs">Published in scientific journals with DOI. Multiple corroborating sources.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FlaskConical className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Literature-Based</p>
                <p className="text-xs">Industry body reports (MAGB, COFALEC), recognised data platforms (CarbonCloud).</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Proxy Estimates</p>
                <p className="text-xs">Derived from analogous crops/processes with documented methodology and higher uncertainty.</p>
              </div>
            </div>
          </div>
          <p className="text-xs border-t pt-2">
            Source hierarchy: peer-reviewed journal &gt; industry body report &gt; government database &gt; proxy calculation.
            Every factor includes uncertainty percentages reflecting data quality.
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
                <CardTitle>{cat} Emission Factors</CardTitle>
                <CardDescription>
                  Click any row to expand full source documentation and provenance details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">kg CO&#8322;e</TableHead>
                      <TableHead className="text-center">Unit</TableHead>
                      <TableHead className="text-center">Quality</TableHead>
                      <TableHead className="text-center">Uncertainty</TableHead>
                      <TableHead className="text-center">Scope</TableHead>
                      <TableHead className="w-8"></TableHead>
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
            Data Quality Grades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead>Typical Uncertainty</TableHead>
                <TableHead>Example Sources</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell><QualityBadge grade="HIGH" /></TableCell>
                <TableCell className="text-sm">Multiple corroborating peer-reviewed sources or large-scale industry studies</TableCell>
                <TableCell className="text-sm font-mono">10&ndash;25%</TableCell>
                <TableCell className="text-sm">Hop Growers of America LCA, MAGB malt data, MDPI peer-reviewed</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><QualityBadge grade="MEDIUM" /></TableCell>
                <TableCell className="text-sm">Single authoritative source: industry body, single peer-reviewed paper, or recognised data platform</TableCell>
                <TableCell className="text-sm font-mono">25&ndash;40%</TableCell>
                <TableCell className="text-sm">COFALEC/PwC yeast study, CarbonCloud, Kazemi et al. coriander</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><QualityBadge grade="LOW" /></TableCell>
                <TableCell className="text-sm">Proxy calculation from analogous crops/processes. No published data for this specific ingredient.</TableCell>
                <TableCell className="text-sm font-mono">40&ndash;60%</TableCell>
                <TableCell className="text-sm">Juniper berries (wild-harvest proxy), angelica root (root crop proxy)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
