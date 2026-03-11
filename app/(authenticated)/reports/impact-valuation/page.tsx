'use client';

import { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import {
  Leaf,
  Users,
  Heart,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  ShoppingBag,
  Copy,
  Check,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Zap,
} from 'lucide-react';
import { useImpactValuation } from '@/hooks/data/useImpactValuation';
import { useImpactValuationNarratives } from '@/hooks/data/useImpactValuationNarratives';
import { useImpactValuationMethodology } from '@/hooks/data/useImpactValuationMethodology';
import { useImpactValuationTrends } from '@/hooks/data/useImpactValuationTrends';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { usePeopleCultureScore } from '@/hooks/data/usePeopleCultureScore';
import { useCommunityImpactScore } from '@/hooks/data/useCommunityImpactScore';
import { useOrganization } from '@/lib/organizationContext';
import { usePersistedYear } from '@/hooks/usePersistedYear';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { ImpactValuationMethodology } from '@/components/reports/ImpactValuationMethodology';
import { ImpactValuationTrends } from '@/components/reports/ImpactValuationTrends';
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

  // Determine overall card type badge
  const isCostCapital = capitalKey === 'natural';
  const isMixedCapital = capitalKey === 'human';

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
          {isCostCapital && (
            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 text-xs">
              Cost
            </Badge>
          )}
          {!isCostCapital && !isMixedCapital && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 text-xs">
              Benefit
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {breakdown.items.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm font-medium ${item.has_data ? '' : 'text-muted-foreground'}`}>
                    {item.label}
                  </p>
                  {isMixedCapital && item.is_cost && (
                    <span className="text-[10px] text-red-500 dark:text-red-400 font-medium">Cost</span>
                  )}
                  {isMixedCapital && !item.is_cost && (
                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">Benefit</span>
                  )}
                </div>
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

  // Year selector state — URL param takes priority, then persisted localStorage value
  const currentYear = new Date().getFullYear();
  const yearParam = searchParams.get('year');
  const { selectedYear: persistedYear, setSelectedYear: setPersistedYear } = usePersistedYear();
  const [selectedYear, setSelectedYearState] = useState<number>(
    yearParam ? parseInt(yearParam, 10) : persistedYear
  );
  const setSelectedYear = (year: number) => {
    setSelectedYearState(year);
    setPersistedYear(year);
  };
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

  // Trends data
  const { trends } = useImpactValuationTrends();

  // Empty state data hooks
  const { footprint, loading: footprintLoading } = useCompanyFootprint(selectedYear);
  const { score: peopleCultureScore, loading: pcLoading } = usePeopleCultureScore();
  const { score: communityImpactScore, loading: ciLoading } = useCommunityImpactScore();

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
            <Card className={`border-2 ${
              result.net_impact >= 0
                ? 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30'
                : 'border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30'
            }`}>
              <CardContent className="py-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                      result.net_impact >= 0
                        ? 'bg-emerald-100 dark:bg-emerald-900/50'
                        : 'bg-amber-100 dark:bg-amber-900/50'
                    }`}>
                      {result.net_impact >= 0 ? (
                        <TrendingUp className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Net Impact Value</p>
                      <p className={`text-4xl font-bold ${
                        result.net_impact >= 0
                          ? 'text-emerald-900 dark:text-emerald-100'
                          : 'text-amber-900 dark:text-amber-100'
                      }`}>
                        {formatGBP(result.grand_total)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Benefits: {formatGBP(result.positive_total)} · Costs: {formatGBP(result.negative_total)}
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

            {/* ── Impact Trends ────────────────────────────────────────────── */}
            {trends.length > 0 && <ImpactValuationTrends trends={trends} />}

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
            <ImpactValuationMethodology
              methodologyItems={methodologyItems}
              proxyVersion={proxyVersion}
              calculatedAt={calculatedAt}
              methodologyLoading={methodologyLoading}
              orgName={currentOrganization?.name || 'Organisation'}
              selectedYear={selectedYear}
            />
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
