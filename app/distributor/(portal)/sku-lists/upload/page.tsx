'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  CheckCircle2,
  Upload,
  Sparkles,
  Link2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UploadDropzone } from '@/components/distributor/sku-upload/upload-dropzone';
import { ColumnMapper } from '@/components/distributor/sku-upload/column-mapper';
import { UploadProgress } from '@/components/distributor/sku-upload/upload-progress';
import { UpgradePrompt } from '@/components/distributor/upgrade/upgrade-prompt';
import { useDistributor } from '@/lib/distributor/context';
import { distributorCan } from '@/lib/distributor/capabilities';
import type { ColumnMapping, SkuListParseResult } from '@/types/distributor';

type Step = 'choose' | 'uploading' | 'parsing' | 'mapping' | 'processing' | 'complete' | 'error';

interface DirectoryMatch {
  brand_display_name: string;
  directory_id: string;
  matched_canonical_name: string;
  created: boolean;
  similarity: number;
  match_via: 'exact_name' | 'alias' | 'fuzzy' | 'created';
  on_alkatera: boolean;
  has_data_on_file: boolean;
  completeness_score: number | null;
  sustainability_score: number | null;
  score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
}

interface ProductDirectoryStats {
  resolved: number;
  matched_existing: number;
  created_new: number;
}

interface UploadResult {
  brand_count: number;
  sku_count: number;
  row_count: number;
  scraping_queued?: number;
  scraping_skipped_directory_hit?: number;
  warnings: string[];
  directory_matches: DirectoryMatch[];
  product_directory_stats: ProductDirectoryStats;
}

export default function UploadPage() {
  const router = useRouter();
  const { organization } = useDistributor();
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<string | null>(null);
  const [skuListId, setSkuListId] = useState<string | null>(null);
  const [parse, setParse] = useState<SkuListParseResult | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  // Procurement-partner-tier distributors can't upload their own SKU
  // lists. The procurement pipeline still creates synthetic lists in
  // their tenant via the service-role client (the Foodbuy CSV split);
  // this guard only blocks the interactive upload UI. The conditional
  // sits AFTER the hook calls to keep the rules-of-hooks order valid.
  if (!distributorCan(organization, 'upload_own_sku_lists')) {
    return (
      <UpgradePrompt
        capability="upload_own_sku_lists"
        backHref="/distributor/sku-lists"
        backLabel="Back to SKU lists"
        intro="Procurement-routed SKU lists land in your tenant automatically. To add your own portfolio, become a full alka<strong>tera</strong> customer."
      />
    );
  }

  async function handleFile(file: File) {
    setError(null);
    setStep('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/distributor/sku-lists', { method: 'POST', body: formData });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Upload failed (${json.error ?? res.status}${json.detail ? `: ${json.detail}` : ''})`);
        setStep('error');
        return;
      }
      const json = (await res.json()) as { sku_list: { id: string } };
      setSkuListId(json.sku_list.id);
      setStep('parsing');

      const parseRes = await fetch(`/api/distributor/sku-lists/${json.sku_list.id}/parse`, {
        method: 'POST',
      });
      if (!parseRes.ok) {
        const j = (await parseRes.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Could not parse the file (${j.error ?? parseRes.status}${j.detail ? `: ${j.detail}` : ''})`);
        setStep('error');
        return;
      }
      const parseJson = (await parseRes.json()) as SkuListParseResult;
      setParse(parseJson);
      setStep('mapping');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStep('error');
    }
  }

  async function handleConfirm(mapping: ColumnMapping) {
    if (!skuListId) return;
    setStep('processing');
    setError(null);
    try {
      const res = await fetch(`/api/distributor/sku-lists/${skuListId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_mapping: mapping }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Import failed (${json.error ?? res.status}${json.detail ? `: ${json.detail}` : ''})`);
        setStep('error');
        return;
      }
      const json = (await res.json()) as UploadResult;
      setResult(json);
      setStep('complete');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('error');
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/distributor/sku-lists"
        className="text-sm text-muted-foreground hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to product lists
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-500/15 border border-sky-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <Upload className="h-6 w-6 text-sky-300" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              Three quick steps
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Upload product list
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              We'll detect brands and SKUs automatically. CSV is most reliable, Excel and PDF are
              best-effort.
            </p>
          </div>
        </div>
      </div>

      <StepIndicator step={step} />

      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
        <div className="px-5 pt-5 pb-3 text-sm font-semibold">{titleForStep(step)}</div>
        <div className="px-5 pb-5">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'choose' && <UploadDropzone onFileSelected={handleFile} />}
          {step === 'uploading' && <UploadProgress message="Uploading your file…" />}
          {step === 'parsing' && <UploadProgress message="Reading rows and detecting columns…" />}
          {step === 'mapping' && parse && (
            <ColumnMapper parse={parse} onConfirm={handleConfirm} />
          )}
          {step === 'processing' && (
            <UploadProgress message="Creating brand profiles and SKUs…" />
          )}
          {step === 'complete' && result && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 p-2 shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <div className="text-base font-semibold">Import complete</div>
                  <div className="text-xs text-muted-foreground">
                    Brand finding has started automatically in the background.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="Rows imported" value={result.row_count} />
                <Stat label="Brands detected" value={result.brand_count} />
                <Stat label="SKUs created" value={result.sku_count} />
              </div>

              {result.directory_matches.length > 0 && (
                <DirectoryMatchPanel matches={result.directory_matches} />
              )}

              {result.product_directory_stats &&
                result.product_directory_stats.resolved > 0 && (
                  <ProductDirectoryPanel stats={result.product_directory_stats} />
                )}

              {(result.scraping_skipped_directory_hit ?? 0) > 0 && (
                <ScrapeGatePanel
                  skipped={result.scraping_skipped_directory_hit ?? 0}
                  queued={result.scraping_queued ?? 0}
                />
              )}

              {result.warnings.length > 0 && (
                <Alert>
                  <AlertDescription>
                    <div className="font-semibold mb-1">
                      Warnings ({result.warnings.length})
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs">
                      {result.warnings.slice(0, 10).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button
                  className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
                  onClick={() => router.push('/distributor/brands')}
                >
                  View brands
                </Button>
                <Button
                  variant="outline"
                  className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
                  onClick={() => {
                    setStep('choose');
                    setError(null);
                    setSkuListId(null);
                    setParse(null);
                    setResult(null);
                  }}
                >
                  Upload another
                </Button>
              </div>
            </div>
          )}
          {step === 'error' && (
            <div className="flex gap-2">
              <Button
                className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
                onClick={() => {
                  setStep('choose');
                  setError(null);
                  setSkuListId(null);
                  setParse(null);
                  setResult(null);
                }}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function titleForStep(step: Step): string {
  switch (step) {
    case 'choose':
      return 'Step 1 of 3 · Choose a file';
    case 'uploading':
    case 'parsing':
      return 'Step 1 of 3 · Reading file';
    case 'mapping':
      return 'Step 2 of 3 · Confirm column mapping';
    case 'processing':
      return 'Step 3 of 3 · Importing';
    case 'complete':
      return 'Import complete';
    case 'error':
      return 'Something went wrong';
  }
}

function StepIndicator({ step }: { step: Step }) {
  const stepNumber =
    step === 'choose' || step === 'uploading' || step === 'parsing'
      ? 1
      : step === 'mapping'
      ? 2
      : step === 'processing'
      ? 3
      : step === 'complete'
      ? 4
      : 0;

  const steps = ['Upload', 'Map columns', 'Import'];
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const isActive = stepNumber === num;
        const isDone = stepNumber > num;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
                isDone
                  ? 'bg-sky-400 text-black shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                  : isActive
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400'
                  : 'bg-muted/60 text-muted-foreground border border-border'
              }`}
            >
              {isDone ? '✓' : num}
            </div>
            <span
              className={
                isActive
                  ? 'text-sky-200 font-semibold'
                  : isDone
                  ? 'text-foreground/70'
                  : 'text-muted-foreground'
              }
            >
              {label}
            </span>
            {idx < steps.length - 1 && (
              <span className="text-muted-foreground/40 mx-1">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function DirectoryMatchPanel({ matches }: { matches: DirectoryMatch[] }) {
  const summary = useMemo(() => {
    let linkedExisting = 0;
    let createdNew = 0;
    let onAlkatera = 0;
    let hasDataOnFile = 0;
    for (const m of matches) {
      if (m.created) createdNew += 1;
      else linkedExisting += 1;
      if (m.on_alkatera) onAlkatera += 1;
      if (m.has_data_on_file) hasDataOnFile += 1;
    }
    return { linkedExisting, createdNew, onAlkatera, hasDataOnFile };
  }, [matches]);

  const sorted = useMemo(() => {
    // Linked-with-data first (most valuable to highlight), then linked
    // without data, then newly created.
    return [...matches].sort((a, b) => {
      const score = (m: DirectoryMatch) =>
        (m.created ? 0 : 2) + (m.has_data_on_file ? 1 : 0);
      return score(b) - score(a);
    });
  }, [matches]);

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
          <Link2 className="h-4 w-4 text-sky-300" />
        </div>
        <div>
          <div className="text-sm font-semibold">Directory matches</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <strong className="text-foreground tabular-nums">{summary.linkedExisting}</strong>{' '}
            linked to existing brands ·{' '}
            <strong className="text-foreground tabular-nums">{summary.createdNew}</strong> created
            new
            {summary.hasDataOnFile > 0 && (
              <>
                {' · '}
                <strong className="text-emerald-300 tabular-nums">{summary.hasDataOnFile}</strong>{' '}
                already had data on file
              </>
            )}
          </div>
        </div>
      </div>
      <div className="px-5 pb-5">
        <ul className="space-y-2">
          {sorted.map((m) => (
            <li
              key={`${m.directory_id}-${m.brand_display_name}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    m.has_data_on_file
                      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                      : m.created
                      ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]'
                      : 'bg-foreground/50'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.brand_display_name}</div>
                  {!m.created && m.matched_canonical_name !== m.brand_display_name && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      Matched to <span className="text-foreground/80">{m.matched_canonical_name}</span>{' '}
                      <span className="text-muted-foreground/70 tabular-nums">
                        · {Math.round(m.similarity * 100)}% match
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {m.created ? (
                  <Badge
                    icon={<Sparkles className="h-3 w-3" />}
                    label="New"
                    bg="bg-sky-500/15"
                    border="border-sky-400/30"
                    text="text-sky-200"
                  />
                ) : (
                  <Badge
                    icon={<Link2 className="h-3 w-3" />}
                    label="Linked"
                    bg="bg-foreground/10"
                    border="border-border/60"
                    text="text-foreground/80"
                  />
                )}
                {m.on_alkatera && (
                  <Badge
                    icon={<ShieldCheck className="h-3 w-3" />}
                    label="On alkatera"
                    bg="bg-emerald-500/15"
                    border="border-emerald-400/30"
                    text="text-emerald-300"
                  />
                )}
                {m.has_data_on_file && !m.on_alkatera && (
                  <Badge
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    label="Data on file"
                    bg="bg-emerald-500/15"
                    border="border-emerald-400/30"
                    text="text-emerald-300"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Badge({
  icon,
  label,
  bg,
  border,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  border: string;
  text: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 ${bg} ${border} ${text}`}
    >
      {icon}
      {label}
    </span>
  );
}

function ProductDirectoryPanel({ stats }: { stats: ProductDirectoryStats }) {
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
          <Sparkles className="h-4 w-4 text-sky-300" />
        </div>
        <div className="text-sm">
          <div className="font-semibold">Products linked to the directory</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <strong className="text-foreground tabular-nums">{stats.matched_existing}</strong> of{' '}
            <strong className="text-foreground tabular-nums">{stats.resolved}</strong> products
            matched existing canonical records
            {stats.created_new > 0 && (
              <>
                {' · '}
                <strong className="text-sky-200 tabular-nums">{stats.created_new}</strong> added to
                the directory
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScrapeGatePanel({ skipped, queued }: { skipped: number; queued: number }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card/40 to-card/40 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-emerald-500/15 border border-emerald-400/30 p-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
        </div>
        <div className="text-sm">
          <div className="font-semibold">
            <strong className="tabular-nums">{skipped}</strong> brand{skipped === 1 ? '' : 's'}{' '}
            skipped finding
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            We already hold comprehensive, recent data on{' '}
            {skipped === 1 ? 'this brand' : 'these brands'} in the directory, so no fresh scrape
            was needed.{' '}
            {queued > 0 && (
              <>
                <strong className="text-foreground tabular-nums">{queued}</strong> other brand
                {queued === 1 ? '' : 's'} are being looked up now.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
