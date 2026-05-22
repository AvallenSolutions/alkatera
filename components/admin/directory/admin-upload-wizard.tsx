'use client';

import { useState } from 'react';
import { ChevronLeft, CheckCircle2, Upload, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UploadDropzone } from '@/components/distributor/sku-upload/upload-dropzone';
import { UploadProgress } from '@/components/distributor/sku-upload/upload-progress';
import { ColumnMapper } from '@/components/shared/column-mapper';
import type { ColumnFieldSpec } from '@/components/shared/column-mapper';

type Step = 'choose' | 'uploading' | 'parsing' | 'mapping' | 'processing' | 'complete' | 'error';

interface ParseResponse {
  preview: Record<string, string>[];
  detected_columns: string[];
  suggestions: Record<string, string>;
  row_count: number;
}

interface ConfirmResponse {
  kind: 'brands' | 'products';
  row_count: number;
  brands_created?: number;
  brands_linked?: number;
  products_created?: number;
  products_linked?: number;
  errors: Array<{ row: number; brand?: string; error: string }>;
}

interface Props<Key extends string> {
  kind: 'brands' | 'products';
  title: string;
  description: React.ReactNode;
  fields: Array<ColumnFieldSpec<Key>>;
  backHref: string;
  templateName: string;
}

export function AdminUploadWizard<Key extends string>({
  kind,
  title,
  description,
  fields,
  backHref,
  templateName,
}: Props<Key>) {
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [parse, setParse] = useState<ParseResponse | null>(null);
  const [result, setResult] = useState<ConfirmResponse | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setStep('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', kind);
      const res = await fetch('/api/admin/directory/uploads', { method: 'POST', body: formData });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Upload failed (${j.error ?? res.status}${j.detail ? `: ${j.detail}` : ''})`);
        setStep('error');
        return;
      }
      const json = (await res.json()) as { upload: { id: string } };
      setUploadId(json.upload.id);
      setStep('parsing');

      const parseRes = await fetch(`/api/admin/directory/uploads/${json.upload.id}/parse`, {
        method: 'POST',
      });
      if (!parseRes.ok) {
        const j = (await parseRes.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Parse failed (${j.error ?? parseRes.status}${j.detail ? `: ${j.detail}` : ''})`);
        setStep('error');
        return;
      }
      const parseJson = (await parseRes.json()) as ParseResponse;
      setParse(parseJson);
      setStep('mapping');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStep('error');
    }
  }

  async function handleConfirm(mapping: Partial<Record<Key, string>>) {
    if (!uploadId) return;
    setStep('processing');
    setError(null);
    try {
      const res = await fetch(`/api/admin/directory/uploads/${uploadId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_mapping: mapping }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Import failed (${j.error ?? res.status}${j.detail ? `: ${j.detail}` : ''})`);
        setStep('error');
        return;
      }
      const json = (await res.json()) as ConfirmResponse;
      setResult(json);
      setStep('complete');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('error');
    }
  }

  function reset() {
    setStep('choose');
    setError(null);
    setUploadId(null);
    setParse(null);
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="text-sm text-muted-foreground hover:text-neon-lime inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-neon-lime/30 bg-gradient-to-br from-neon-lime/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-lime/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-neon-lime/15 border border-neon-lime/30 p-3 shrink-0">
            <Upload className="h-6 w-6 text-neon-lime" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-lime shadow-[0_0_6px_rgba(204,255,0,0.8)]" />
              Bulk import
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
            <div className="text-sm text-muted-foreground max-w-2xl">{description}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <div className="px-5 pt-5 pb-3 text-sm font-semibold">{titleForStep(step)}</div>
        <div className="px-5 pb-5">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'choose' && (
            <>
              <UploadDropzone onFileSelected={handleFile} />
              <div className="text-xs text-muted-foreground mt-4">
                Expected columns:{' '}
                {fields
                  .map((f) => `${f.key}${f.required ? ' (required)' : ''}`)
                  .join(', ')}
                . Template: <code className="bg-muted/50 px-1.5 py-0.5 rounded">{templateName}</code>
              </div>
            </>
          )}
          {step === 'uploading' && <UploadProgress message="Uploading your file…" />}
          {step === 'parsing' && <UploadProgress message="Reading rows and detecting columns…" />}
          {step === 'mapping' && parse && (
            <ColumnMapper<Key>
              parse={parse}
              fields={fields}
              onConfirm={handleConfirm}
              submitLabel={`Import ${kind}`}
            />
          )}
          {step === 'processing' && (
            <UploadProgress message={`Importing ${kind} into the directory…`} />
          )}
          {step === 'complete' && result && <CompleteSummary result={result} onAgain={reset} />}
          {step === 'error' && (
            <div className="flex gap-2">
              <Button onClick={reset} className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold">
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
      return 'Step 1 of 3 · Choose a CSV';
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

function CompleteSummary({
  result,
  onAgain,
}: {
  result: ConfirmResponse;
  onAgain: () => void;
}) {
  const created =
    result.kind === 'brands' ? result.brands_created ?? 0 : result.products_created ?? 0;
  const linked =
    result.kind === 'brands' ? result.brands_linked ?? 0 : result.products_linked ?? 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 p-2 shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        </div>
        <div>
          <div className="text-base font-semibold">Import complete</div>
          <div className="text-xs text-muted-foreground">
            {created} new {result.kind} created · {linked} linked to existing
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Rows" value={result.row_count} />
        <Stat label={`${result.kind === 'brands' ? 'Brands' : 'Products'} created`} value={created} />
        <Stat label="Linked to existing" value={linked} />
      </div>
      {result.errors.length > 0 && (
        <Alert>
          <AlertDescription>
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
              {result.errors.length} row{result.errors.length === 1 ? '' : 's'} skipped
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  Row {e.row}
                  {e.brand ? ` (${e.brand})` : ''}: {e.error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button onClick={onAgain} variant="outline">
          Upload another
        </Button>
      </div>
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
