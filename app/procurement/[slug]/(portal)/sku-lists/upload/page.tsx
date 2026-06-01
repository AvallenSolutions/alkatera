'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/procurement/layout/page-header';
import { SectionCard } from '@/components/procurement/layout/section-card';
import type {
  ProcurementColumnField,
  ProcurementColumnMapping,
  ProcurementSkuListConfirmResult,
  ProcurementSkuListParseResult,
} from '@/types/procurement';

type Step = 'choose' | 'uploading' | 'parsing' | 'mapping' | 'processing' | 'complete' | 'error';

const REQUIRED_FIELDS: ProcurementColumnField[] = [
  'brand_name',
  'product_name',
  'distributor_channel',
];

const OPTIONAL_FIELDS: ProcurementColumnField[] = [
  'sku_code',
  'category',
  'country_of_origin',
  'vintage',
  'volume_per_year_liters',
  'list_price_gbp',
  'listing_status',
];

const FIELD_LABEL: Record<ProcurementColumnField, string> = {
  brand_name: 'Brand name',
  product_name: 'Product name',
  distributor_channel: 'Distributor channel',
  sku_code: 'SKU code',
  gtin: 'GTIN / EAN / barcode',
  category: 'Category',
  country_of_origin: 'Country of origin',
  listing_status: 'Listing status',
  website: 'Brand website',
  vintage: 'Vintage',
  volume_per_year_liters: 'Annual volume (litres)',
  list_price_gbp: 'List price (GBP)',
};

export default function ProcurementUploadPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<string | null>(null);
  const [skuListId, setSkuListId] = useState<string | null>(null);
  const [parse, setParse] = useState<ProcurementSkuListParseResult | null>(null);
  const [mapping, setMapping] = useState<Partial<ProcurementColumnMapping>>({});
  const [result, setResult] = useState<ProcurementSkuListConfirmResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const missingRequired = useMemo(
    () => REQUIRED_FIELDS.filter((f) => !mapping[f]),
    [mapping],
  );

  async function handleFile(file: File) {
    setError(null);
    setStep('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/procurement/${slug}/sku-lists`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Upload failed (${json.error ?? res.status}${json.detail ? `: ${json.detail}` : ''})`);
        setStep('error');
        return;
      }
      const json = (await res.json()) as { sku_list: { id: string } };
      setSkuListId(json.sku_list.id);
      setStep('parsing');

      const parseRes = await fetch(
        `/api/procurement/${slug}/sku-lists/${json.sku_list.id}/parse`,
        { method: 'POST' },
      );
      if (!parseRes.ok) {
        const j = (await parseRes.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(`Parse failed (${j.error ?? parseRes.status}${j.detail ? `: ${j.detail}` : ''})`);
        setStep('error');
        return;
      }
      const parsed = (await parseRes.json()) as ProcurementSkuListParseResult;
      setParse(parsed);
      setMapping(parsed.suggestions);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
      setStep('error');
    }
  }

  async function handleConfirm() {
    if (!skuListId || !parse) return;
    if (missingRequired.length > 0) {
      setError(`Pick a column for: ${missingRequired.map((f) => FIELD_LABEL[f]).join(', ')}`);
      return;
    }
    setError(null);
    setStep('processing');
    try {
      const res = await fetch(`/api/procurement/${slug}/sku-lists/${skuListId}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ column_mapping: mapping }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(`Confirm failed (${j.error ?? res.status}${j.detail ? `: ${j.detail}` : ''})`);
        setStep('error');
        return;
      }
      const json = (await res.json()) as ProcurementSkuListConfirmResult;
      setResult(json);
      setStep('complete');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
      setStep('error');
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        pill="Upload SKU list"
        pillIcon={FileSpreadsheet}
        title="Add SKUs to your portfolio"
        subtitle="CSV, XLSX or PDF up to 25 MB. Each row's distributor channel routes the SKU to the correct supplier tenant and triggers the sustainability data flow."
        backHref={`/procurement/${slug}/sku-lists`}
        backLabel="Back to SKU lists"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'choose' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`rounded-2xl border-2 border-dashed bg-card/50 p-12 text-center space-y-5 transition-colors ${
            dragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-border'
          }`}
        >
          <div className="inline-flex items-center justify-center rounded-2xl bg-brand-primary/10 border border-brand-primary/20 p-5">
            <Upload className="h-7 w-7 text-brand-primary" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground">Drag a file here, or pick one</p>
            <p className="text-xs text-muted-foreground">
              CSV, XLSX or PDF up to 25 MB. We auto-detect columns so you only confirm the mapping.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-brand-primary hover:bg-brand-strong text-brand-on font-semibold h-10 px-5"
          >
            Choose file
          </Button>
        </div>
      ) : null}

      {step === 'uploading' || step === 'parsing' || step === 'processing' ? (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="text-sm font-medium">
            {step === 'uploading' && 'Uploading file…'}
            {step === 'parsing' && 'Parsing rows…'}
            {step === 'processing' && 'Matching brands, splitting by channel, creating SKUs…'}
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 bg-brand-primary animate-[loading-bar_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      ) : null}

      {step === 'mapping' && parse ? (
        <div className="space-y-6">
          <SectionCard
            title="Confirm column mapping"
            subtitle={`${parse.preview.length} preview rows · ${parse.detected_columns.length} columns detected`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
                const isRequired = REQUIRED_FIELDS.includes(field);
                const value = mapping[field] ?? '';
                return (
                  <div key={field} className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1">
                      {FIELD_LABEL[field]}
                      {isRequired ? <span className="text-destructive">*</span> : null}
                    </label>
                    <select
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMapping((m) => {
                          const next = { ...m } as Partial<ProcurementColumnMapping>;
                          if (v) next[field] = v;
                          else delete next[field];
                          return next;
                        });
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                    >
                      <option value="">{isRequired ? 'Pick a column' : 'None'}</option>
                      {parse.detected_columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {parse.detected_channels.length > 0 || parse.known_channels.length > 0 ? (
            <SectionCard
              title="Channel routing"
              subtitle="How the upload's distributor channel column resolves against your linked distributors"
            >
              <dl className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <dt className="text-muted-foreground font-medium min-w-[140px]">Detected in preview</dt>
                  <dd className="text-foreground">
                    {parse.detected_channels.length > 0
                      ? parse.detected_channels.join(', ')
                      : 'No channel values yet'}
                  </dd>
                </div>
                <div className="flex items-start gap-3">
                  <dt className="text-muted-foreground font-medium min-w-[140px]">Linked distributors</dt>
                  <dd className="text-foreground">
                    {parse.known_channels.length > 0
                      ? parse.known_channels.join(', ')
                      : 'None linked. Add procurement_distributor_links rows first.'}
                  </dd>
                </div>
                <div className="flex items-start gap-3">
                  <dt className="text-muted-foreground font-medium min-w-[140px]">Aliases</dt>
                  <dd className="text-foreground/70">
                    Variants like "Hallgarten & Novum" or "Enotria&Coe" auto-resolve. Rows whose
                    channel doesn't match anything are skipped and reported.
                  </dd>
                </div>
              </dl>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Preview"
            subtitle={`First ${parse.preview.length} rows from your upload`}
            contentClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60">
                    {parse.detected_columns.map((c) => (
                      <th
                        key={c}
                        className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parse.preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-b-0">
                      {parse.detected_columns.map((c) => (
                        <td key={c} className="px-4 py-2.5 whitespace-nowrap">
                          {row[c] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep('choose');
                setParse(null);
                setMapping({});
              }}
            >
              Start over
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={missingRequired.length > 0}
              className="bg-brand-primary hover:bg-brand-strong text-brand-on font-semibold h-10 px-5 shadow-sm"
            >
              Process upload
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'complete' && result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-700 font-semibold">
              <div className="rounded-full bg-emerald-100 p-1">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              Import complete
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <CompletionStat label="Brands" value={result.brand_count} />
              <CompletionStat label="SKUs" value={result.sku_count} />
              <CompletionStat label="Rows" value={result.row_count} />
              <CompletionStat
                label="Channels"
                value={Object.keys(result.channel_summary).length}
              />
            </div>
            {Object.entries(result.channel_summary).length > 0 ? (
              <div className="text-xs text-emerald-700/80 pt-2 border-t border-emerald-200/70">
                Channel split:{' '}
                {Object.entries(result.channel_summary)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </div>
            ) : null}
            <div className="text-xs text-emerald-700/80 space-y-0.5">
              {result.scraping_queued > 0 ? (
                <div>
                  {result.scraping_queued} scraping job{result.scraping_queued === 1 ? '' : 's'}{' '}
                  queued for brands without recent data.
                </div>
              ) : null}
              {result.scraping_skipped_directory_hit > 0 ? (
                <div>
                  {result.scraping_skipped_directory_hit} brand
                  {result.scraping_skipped_directory_hit === 1 ? '' : 's'} skipped scraping. Comprehensive data already on file.
                </div>
              ) : null}
              {result.alkatera_auto_linked > 0 ? (
                <div>
                  {result.alkatera_auto_linked} brand
                  {result.alkatera_auto_linked === 1 ? '' : 's'} auto-linked to an alka<strong>tera</strong>{' '}
                  customer.
                </div>
              ) : null}
            </div>
          </div>

          {result.unresolved_channels.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {result.unresolved_channels.length} channel{' '}
                {result.unresolved_channels.length === 1 ? 'value' : 'values'} did not resolve to a
                linked distributor:{' '}
                {result.unresolved_channels
                  .map((u) => `"${u.value}" (${u.row_count} rows)`)
                  .join(', ')}
                . Those rows were skipped.
              </AlertDescription>
            </Alert>
          ) : null}

          {result.warnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-1">
              <div className="text-sm font-semibold text-amber-700">
                {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}
              </div>
              <ul className="text-xs text-amber-700/80 list-disc pl-5 space-y-0.5">
                {result.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {result.warnings.length > 10 ? (
                  <li>and {result.warnings.length - 10} more</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link href={`/procurement/${slug}/sku-lists`}>Back to SKU lists</Link>
            </Button>
            <Button
              asChild
              className="bg-brand-primary hover:bg-brand-strong text-brand-on font-semibold h-10 px-5"
            >
              <Link href={`/procurement/${slug}/dashboard`}>
                View dashboard
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompletionStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-700/70 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-semibold text-emerald-800 tabular-nums leading-none mt-1">
        {value.toLocaleString('en-GB')}
      </div>
    </div>
  );
}
