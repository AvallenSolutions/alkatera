'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Leaf,
  Users,
  Heart,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  FileText,
  ShoppingBag,
  Copy,
  Check,
  BookOpen,
  Download,
  ChevronDown,
  CheckCircle2,
  CircleAlert,
  Zap,
} from 'lucide-react';
import { useImpactValuation } from '@/hooks/data/useImpactValuation';
import { useImpactValuationNarratives } from '@/hooks/data/useImpactValuationNarratives';
import { useImpactValuationMethodology } from '@/hooks/data/useImpactValuationMethodology';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { usePeopleCultureScore } from '@/hooks/data/usePeopleCultureScore';
import { useCommunityImpactScore } from '@/hooks/data/useCommunityImpactScore';
import { useOrganization } from '@/lib/organizationContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { CapitalBreakdown } from '@/lib/calculations/impact-valuation';

// ─── Number formatting ──────────────────────────────────────────────────────

function formatGBP(value: number): string {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ─── Confidence badge ───────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  };

  return (
    <Badge className={styles[level]}>
      {level.charAt(0).toUpperCase() + level.slice(1)} confidence
    </Badge>
  );
}

// ─── Capital card icons ─────────────────────────────────────────────────────

const capitalConfig = {
  natural: {
    label: 'Natural Capital',
    Icon: Leaf,
    colour: 'emerald',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    headerBg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  human: {
    label: 'Human Capital',
    Icon: Users,
    colour: 'blue',
    bgClass: 'bg-blue-100 dark:bg-blue-900/50',
    iconClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
    headerBg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  social: {
    label: 'Social Capital',
    Icon: Heart,
    colour: 'rose',
    bgClass: 'bg-rose-100 dark:bg-rose-900/50',
    iconClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-800',
    headerBg: 'bg-rose-50 dark:bg-rose-950/30',
  },
  governance: {
    label: 'Governance Capital',
    Icon: ShieldCheck,
    colour: 'violet',
    bgClass: 'bg-violet-100 dark:bg-violet-900/50',
    iconClass: 'text-violet-600 dark:text-violet-400',
    borderClass: 'border-violet-200 dark:border-violet-800',
    headerBg: 'bg-violet-50 dark:bg-violet-950/30',
  },
} as const;

// ─── Capital card component ─────────────────────────────────────────────────

function CapitalCard({
  capitalKey,
  breakdown,
}: {
  capitalKey: keyof typeof capitalConfig;
  breakdown: CapitalBreakdown;
}) {
  const config = capitalConfig[capitalKey];
  const { Icon } = config;

  return (
    <Card className={config.borderClass}>
      <CardHeader className={`${config.headerBg} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${config.bgClass} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${config.iconClass}`} />
            </div>
            <div>
              <span className="text-base">{config.label}</span>
              <p className="text-2xl font-bold mt-0.5">{formatGBP(breakdown.total)}</p>
            </div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {breakdown.items.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.has_data ? '' : 'text-muted-foreground'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.has_data
                    ? `${item.raw_input?.toLocaleString('en-GB') ?? '—'} ${item.unit}`
                    : 'No data'}
                </p>
              </div>
              <p className={`text-sm font-semibold tabular-nums ${item.has_data ? '' : 'text-muted-foreground'}`}>
                {item.has_data ? formatGBP(item.value) : '—'}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Copy button helper ─────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Text copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', description: 'Please select and copy the text manually.', variant: 'destructive' });
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

// ─── Narrative card component ───────────────────────────────────────────────

function NarrativeCard({
  title,
  wordCount,
  Icon,
  text,
  isLoading,
}: {
  title: string;
  wordCount: string;
  Icon: typeof FileText;
  text: string | null;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{wordCount}</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : text ? (
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {text}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Narrative not yet generated. Click &ldquo;Generate Narratives&rdquo; to create.
          </p>
        )}
      </CardContent>
      {text && (
        <CardFooter className="pt-0">
          <CopyButton text={text} />
        </CardFooter>
      )}
    </Card>
  );
}

// ─── Skeleton cards ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Methodology download helper ────────────────────────────────────────────

function generateMethodologyStatement(
  orgName: string,
  year: number,
  version: string,
  calculatedAt: string,
  items: Array<{ capital: string; label: string; proxy_value: number; unit: string; source: string }>
): string {
  const capitalGroupLabels: Record<string, string> = {
    natural: 'NATURAL CAPITAL',
    human: 'HUMAN CAPITAL',
    social: 'SOCIAL CAPITAL',
    governance: 'GOVERNANCE CAPITAL',
  };
  const capitalOrder = ['natural', 'human', 'social', 'governance'];

  let text = `alkatera Impact Valuation Methodology Statement\n`;
  text += `Organisation: ${orgName}\n`;
  text += `Reporting Year: ${year}\n`;
  text += `Proxy Version: ${version}\n`;
  text += `Calculated: ${new Date(calculatedAt).toLocaleDateString('en-GB')}\n\n`;

  for (const capital of capitalOrder) {
    const capitalItems = items.filter((i) => i.capital === capital);
    if (capitalItems.length === 0) continue;
    text += `${capitalGroupLabels[capital]}\n`;
    for (const item of capitalItems) {
      text += `- ${item.label}: £${Number(item.proxy_value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${item.unit} — ${item.source}\n`;
    }
    text += '\n';
  }

  text += `This methodology statement was generated by alkatera. All proxy values\n`;
  text += `are independently sourced and versioned. Calculations are deterministic.\n`;

  return text;
}

// ─── Data readiness checklist item ──────────────────────────────────────────

function ChecklistItem({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {ready ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
      ) : (
        <CircleAlert className="h-5 w-5 text-amber-500 flex-shrink-0" />
      )}
      <span className={`text-sm ${ready ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function ImpactValuationPage() {
  const searchParams = useSearchParams();
  const { currentOrganization } = useOrganization();

  // Year selector state
  const currentYear = new Date().getFullYear();
  const yearParam = searchParams.get('year');
  const [selectedYear, setSelectedYear] = useState<number>(
    yearParam ? parseInt(yearParam, 10) : currentYear
  );
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);

  // Fetch available years on mount
  useEffect(() => {
    async function fetchAvailableYears() {
      if (!currentOrganization?.id) return;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from('impact_valuation_results')
          .select('reporting_year')
          .eq('organization_id', currentOrganization.id)
          .order('reporting_year', { ascending: false });

        if (data) {
          const years = Array.from(new Set(data.map((r) => r.reporting_year)));
          if (!years.includes(currentYear)) {
            years.push(currentYear);
          }
          years.sort((a, b) => b - a);
          setAvailableYears(years);
        }
      } catch (err) {
        console.error('Error fetching available years:', err);
      }
    }
    fetchAvailableYears();
  }, [currentOrganization?.id, currentYear]);

  const { result, isLoading, error, recalculate } = useImpactValuation(selectedYear);
  const {
    boardSummary,
    retailTenderInsert,
    isLoading: narrativesLoading,
    error: narrativesError,
    regenerate,
  } = useImpactValuationNarratives(selectedYear, !!result);

  const {
    items: methodologyItems,
    proxyVersion,
    calculatedAt,
    isLoading: methodologyLoading,
  } = useImpactValuationMethodology(selectedYear);

  // Empty state data hooks
  const { footprint, loading: footprintLoading } = useCompanyFootprint(selectedYear);
  const { score: peopleCultureScore, loading: pcLoading } = usePeopleCultureScore();
  const { score: communityImpactScore, loading: ciLoading } = useCommunityImpactScore();

  const [methodologyOpen, setMethodologyOpen] = useState(false);

  // Methodology capital grouping
  const capitalGroupLabels: Record<string, string> = {
    natural: 'Natural Capital',
    human: 'Human Capital',
    social: 'Social Capital',
    governance: 'Governance Capital',
  };
  const capitalOrder = ['natural', 'human', 'social', 'governance'];

  const handleDownloadMethodology = useCallback(() => {
    if (!proxyVersion || !calculatedAt || methodologyItems.length === 0) return;

    const orgName = currentOrganization?.name || 'Organisation';
    const text = generateMethodologyStatement(
      orgName,
      selectedYear,
      proxyVersion,
      calculatedAt,
      methodologyItems
    );

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alkatera-impact-valuation-methodology-${selectedYear}-v${proxyVersion}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [proxyVersion, calculatedAt, methodologyItems, currentOrganization?.name, selectedYear]);

  const handleYearChange = (value: string) => {
    const year = parseInt(value, 10);
    setSelectedYear(year);
    // Update URL without full navigation
    const url = new URL(window.location.href);
    url.searchParams.set('year', String(year));
    window.history.replaceState({}, '', url.toString());
  };

  // Empty state readiness checks
  const hasGHGData = !footprintLoading && footprint !== null && footprint.total_emissions > 0;
  const hasPCData = !pcLoading && (peopleCultureScore?.data_completeness ?? 0) > 0;
  const hasCIData = !ciLoading && (communityImpactScore?.data_completeness ?? 0) > 0;

  return (
    <FeatureGate feature="impact_valuation_beta">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight">Impact Valuation</h1>
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-400 bg-amber-50 text-xs font-semibold"
              >
                BETA
              </Badge>
            </div>
            <p className="text-lg text-muted-foreground">
              Monetised social and environmental value created by your organisation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={recalculate}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Recalculate
            </Button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={recalculate}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {isLoading && !result && (
          <>
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-4 w-60" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary card */}
            <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="py-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <TrendingUp className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Impact Value</p>
                      <p className="text-4xl font-bold text-emerald-900 dark:text-emerald-100">
                        {formatGBP(result.grand_total)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ConfidenceBadge level={result.confidence_level} />
                    <Badge variant="outline" className="text-sm">
                      {formatPercent(result.data_coverage)} data coverage
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {result.reporting_year}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Capital cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CapitalCard capitalKey="natural" breakdown={result.natural} />
              <CapitalCard capitalKey="human" breakdown={result.human} />
              <CapitalCard capitalKey="social" breakdown={result.social} />
              <CapitalCard capitalKey="governance" breakdown={result.governance} />
            </div>

            {/* ── Narratives section ──────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Storytelling Narratives</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerate}
                  disabled={narrativesLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${narrativesLoading ? 'animate-spin' : ''}`} />
                  {boardSummary || retailTenderInsert ? 'Regenerate Narratives' : 'Generate Narratives'}
                </Button>
              </div>

              {narrativesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{narrativesError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NarrativeCard
                  title="Board Summary"
                  wordCount="~150 words"
                  Icon={FileText}
                  text={boardSummary}
                  isLoading={narrativesLoading}
                />
                <NarrativeCard
                  title="Retail Tender Insert"
                  wordCount="~100 words"
                  Icon={ShoppingBag}
                  text={retailTenderInsert}
                  isLoading={narrativesLoading}
                />
              </div>
            </div>

            {/* ── Methodology & Proxy Values ──────────────────────────────── */}
            <Collapsible open={methodologyOpen} onOpenChange={setMethodologyOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-base">Methodology &amp; Proxy Values</CardTitle>
                          {proxyVersion && calculatedAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Proxy version {proxyVersion} · Calculated{' '}
                              {new Date(calculatedAt).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          methodologyOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-6">
                    {/* Explanatory paragraph */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Impact values are calculated by multiplying each metric by an independently
                      sourced proxy value (shadow price). Proxy values are drawn from Defra, HM
                      Treasury Green Book, the Social Value Bank, and other peer-reviewed sources.
                      All calculations are deterministic — no AI is used in the number generation.
                    </p>

                    {/* Methodology table */}
                    {methodologyLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : methodologyItems.length > 0 ? (
                      <div className="space-y-6">
                        {capitalOrder.map((capital) => {
                          const items = methodologyItems.filter((i) => i.capital === capital);
                          if (items.length === 0) return null;
                          return (
                            <div key={capital}>
                              <h4 className="text-sm font-semibold mb-2">
                                {capitalGroupLabels[capital]}
                              </h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Metric</TableHead>
                                    <TableHead className="text-right">Proxy Value</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Source</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((item) => (
                                    <TableRow key={item.metric_key}>
                                      <TableCell className="font-medium">
                                        {item.label}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums">
                                        £{Number(item.proxy_value).toLocaleString('en-GB', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 4,
                                        })}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {item.unit}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {item.source}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No methodology data available for this calculation.
                      </p>
                    )}

                    {/* Footer note */}
                    {proxyVersion && (
                      <p className="text-xs text-muted-foreground border-t pt-4">
                        Proxy values are versioned. The values shown reflect version {proxyVersion},
                        effective from{' '}
                        {methodologyItems[0]
                          ? new Date(calculatedAt || '').toLocaleDateString('en-GB')
                          : '—'}
                        .
                      </p>
                    )}

                    {/* Download button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadMethodology}
                      disabled={!proxyVersion || methodologyItems.length === 0}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download Methodology Statement
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        )}

        {/* No result and not loading — improved empty state */}
        {!isLoading && !result && !error && (
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="max-w-lg mx-auto text-center space-y-6">
                <div className="mx-auto h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-slate-400" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Run your Impact Valuation</h3>
                  <p className="text-sm text-muted-foreground">
                    Check your data readiness below, then run your first valuation.
                  </p>
                </div>

                {/* Data readiness checklist */}
                <div className="space-y-3 text-left bg-muted/30 rounded-lg p-4">
                  <ChecklistItem
                    label="Environmental footprint data"
                    ready={hasGHGData}
                  />
                  <ChecklistItem
                    label="People & Culture data"
                    ready={hasPCData}
                  />
                  <ChecklistItem
                    label="Community Impact data"
                    ready={hasCIData}
                  />
                </div>

                <Button onClick={recalculate} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Run First Valuation
                </Button>

                <p className="text-xs text-muted-foreground">
                  You can run a valuation with partial data. Missing metrics will show as £0 and
                  can be completed later.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </FeatureGate>
  );
}
