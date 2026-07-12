'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { createTicket } from '@/lib/feedback';
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

function QualityChip({ grade }: { grade?: string }) {
  switch (grade) {
    case 'HIGH':
      return <StateChip tone="good">High</StateChip>;
    case 'MEDIUM':
      return <StateChip tone="attention">Medium</StateChip>;
    case 'LOW':
      return <StateChip tone="quiet">Low</StateChip>;
    default:
      return <StateChip tone="quiet">Unknown</StateChip>;
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
          <QualityChip grade={meta.data_quality_grade} />
        </TableCell>
        <TableCell className="text-center">
          {factor.uncertainty_percent ? `±${factor.uncertainty_percent}%` : '-'}
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

        const response = await fetch(`/api/data/sources?t=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: 'no-store',
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

  const { grouped, summary } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6">
      {/* The statement */}
      <div className="space-y-4">
        <Statement eyebrow="THE WORKBENCH · SOURCES" headline="The sources.">
          <BigNumber size="display" value={summary.total} label="Factors" />
        </Statement>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The reference library behind your carbon footprint. When you log ingredients,
          packaging or energy use elsewhere in alka<strong>tera</strong>, we multiply
          your quantities by these conversion factors. Nothing here needs editing: this
          page shows exactly where our numbers come from.
        </p>
        {/* The quality tiers, explained once */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 text-xs text-muted-foreground">
          <span>
            <StateChip tone="good">High</StateChip>
            <span className="ml-2">{summary.by_quality.high} · several studies agree</span>
          </span>
          <span>
            <StateChip tone="attention">Medium</StateChip>
            <span className="ml-2">{summary.by_quality.medium} · one trusted source</span>
          </span>
          <span>
            <StateChip tone="quiet">Low</StateChip>
            <span className="ml-2">{summary.by_quality.low} · estimated from similar materials</span>
          </span>
        </div>
      </div>

      {/* Where the numbers come from */}
      <section className="max-w-3xl border-t border-studio-hairline pt-4">
        <Eyebrow tone="dim" className="mb-2">Where the numbers come from</Eyebrow>
        <p className="text-sm text-muted-foreground">
          Every factor is grounded in real-world research and follows global best practice
          for measuring greenhouse gas emissions. We always prefer the most reliable source
          available: peer-reviewed studies first, then reports from trusted trade bodies,
          then government databases, and finally estimates from similar materials where no
          direct data exists yet. Each factor carries its own precision, from within 10 to
          25% for well-studied ingredients to 40 to 60% for niche materials, so you can see
          where the data is strongest. Click any row for the original research and
          supporting sources.
        </p>
      </section>

      {/* Factor tables, one hairline section per category */}
      {summary.categories.map((cat) => (
        <section key={cat}>
          <div className="border-b border-studio-hairline pb-2">
            <Eyebrow>
              {cat} · {grouped[cat]?.length || 0}
            </Eyebrow>
          </div>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Material</TableHead>
                <TableHead className="w-[10%] text-right">CO&#8322; per unit</TableHead>
                <TableHead className="w-[8%] text-center">Unit</TableHead>
                <TableHead className="w-[18%] text-center">Quality</TableHead>
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
        </section>
      ))}

      {/* Request a factor */}
      <RequestFactorFoot />
    </div>
  );
}

function RequestFactorFoot() {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
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

    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    setSubmitting(true);
    try {
      await createTicket(currentOrganization.id, {
        title: `Missing data: ${materialName.trim()}`,
        description: `A user requested a missing ${materialType} emission factor.\n\nMaterial: ${materialName.trim()}${notes.trim() ? `\nNotes: ${notes.trim()}` : ''}`,
        category: 'feature',
        priority: 'medium',
        page_url: '/data/sources',
      });

      setSubmitted(true);
      setMaterialName('');
      setNotes('');
      toast.success('Request submitted! Our team will review and prioritise this.');

      // Reset submitted state after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error: any) {
      console.error('Failed to submit missing data request:', error);
      toast.error(error.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border-t border-studio-hairline">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center justify-between gap-4 py-4 text-left"
        >
          <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            Missing something? If you use an ingredient, packaging material or process that
            is not listed, we will research it and add it to the library.
          </span>
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
            Request a factor
          </span>
        </button>
      ) : (
        <div className="space-y-4 py-4">
          <Eyebrow tone="dim">Request a factor</Eyebrow>
          {submitted ? (
            <p className="text-sm text-muted-foreground">
              Thanks for letting us know. It is on our research list; the more businesses
              that request the same item, the higher it gets prioritised.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="req-name" className="text-sm">Material / ingredient name</Label>
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
                    'Submit request'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
