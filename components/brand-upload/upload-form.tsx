'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, FileText, AlertTriangle, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStoredReviewer } from './reviewer-identity';

interface Props {
  token: string;
  brandName: string;
  skus?: Array<{ id: string; product_name: string; sku_code: string | null }>;
}

const DOCUMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'lca_report',           label: 'LCA report' },
  { value: 'carbon_report',        label: 'Carbon footprint report' },
  { value: 'water_usage',          label: 'Water usage data' },
  { value: 'sustainability_report',label: 'Sustainability / ESG report' },
  { value: 'packaging_data',       label: 'Packaging data sheet' },
  { value: 'certification',        label: 'Certification document' },
  { value: 'esg_report',           label: 'ESG report' },
  { value: 'other',                label: 'Other' },
];

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp';

interface PendingFile {
  file: File;
  document_type: string;
  vintage_year: string;
  batch_reference: string;
  /**
   * Empty array = "applies to the whole brand" (all SKUs). Non-empty =
   * applies only to the listed SKU ids. The processor uses this to
   * write SKU-attributed findings for vintage-specific documents.
   */
  applied_sku_ids: string[];
}

type Step = 'files' | 'review';

export function BrandUploadForm({ token, brandName, skus = [] }: Props) {
  const router = useRouter();
  const [identity] = useStoredReviewer();
  const [step, setStep] = useState<Step>('files');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) return;
    const incoming = Array.from(list).slice(0, remaining);
    setError(null);
    const newOnes = incoming.filter((f) => {
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" is over 25 MB.`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [
      ...prev,
      ...newOnes.map((file) => ({
        file,
        document_type: guessDocumentType(file.name),
        vintage_year: '',
        batch_reference: '',
        applied_sku_ids: [],
      })),
    ]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFile(index: number, patch: Partial<PendingFile>) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  async function handleSubmit() {
    if (!identity) {
      setError('Please add your name and email at the top of the page first.');
      return;
    }
    if (files.length === 0) {
      setError('Please attach at least one file.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    const metadata = {
      submitter_name: identity.name,
      submitter_email: identity.email,
      notes: notes.trim() || undefined,
      files: files.map((f) => ({
        document_type: f.document_type,
        vintage_year: f.vintage_year ? parseInt(f.vintage_year, 10) : undefined,
        batch_reference: f.batch_reference || undefined,
        applied_sku_ids: f.applied_sku_ids.length > 0 ? f.applied_sku_ids : undefined,
      })),
    };
    fd.append('metadata', JSON.stringify(metadata));
    files.forEach((f, idx) => fd.append(`file${idx}`, f.file, f.file.name));

    try {
      const res = await fetch(`/api/brand-upload/${encodeURIComponent(token)}/submit`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(`Upload failed (${body.error ?? res.status}${body.detail ? `: ${body.detail}` : ''}).`);
        setSubmitting(false);
        return;
      }
      router.push(`/brand-upload/${encodeURIComponent(token)}/success`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setSubmitting(false);
    }
  }

  function scrollToIdentityCard() {
    if (typeof window === 'undefined') return;
    const inputs = document.querySelectorAll<HTMLInputElement>('#reviewer-name, #reviewer-email');
    const first = inputs[0];
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.focus();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="border border-border rounded-lg p-6 space-y-6 bg-card/40">
      <StepIndicator step={step} />

      {!identity && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
            <span>Add your name and email at the top of the page before uploading.</span>
            <Button size="sm" variant="outline" onClick={scrollToIdentityCard}>
              <ArrowUp className="h-3.5 w-3.5 mr-1.5" /> Go there
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 'files' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Step 1 of 2 · Upload documents</h3>
            <p className="text-xs text-muted-foreground">
              PDF, Excel, CSV, or image. Max 25 MB per file, up to {MAX_FILES} files. We'll read
              them and use the numbers to populate the data above.
            </p>
          </div>

          <label
            className="border-2 border-dashed border-border hover:border-sky-400/60 rounded-lg px-6 py-10 text-center block cursor-pointer transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <Upload className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-medium">Drop files here or click to choose</div>
            <input
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>

          {files.length > 0 && (
            <div className="space-y-3">
              {files.map((f, idx) => (
                <div key={idx} className="border border-border rounded-md p-3 bg-background/60">
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-sky-400 mt-1 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">{f.file.name}</div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${f.file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-1">
                          <Select
                            value={f.document_type}
                            onValueChange={(v) => updateFile(idx, { document_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Document type" />
                            </SelectTrigger>
                            <SelectContent>
                              {DOCUMENT_TYPES.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          placeholder="Vintage year (optional)"
                          value={f.vintage_year}
                          onChange={(e) => updateFile(idx, { vintage_year: e.target.value })}
                        />
                        <Input
                          placeholder="Batch reference (optional)"
                          value={f.batch_reference}
                          onChange={(e) => updateFile(idx, { batch_reference: e.target.value })}
                        />
                      </div>
                      {skus.length > 0 && (
                        <SkuPicker
                          skus={skus}
                          selectedIds={f.applied_sku_ids}
                          onChange={(ids) => updateFile(idx, { applied_sku_ids: ids })}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Label htmlFor="notes">Anything else we should know? (optional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep('review')}
              disabled={files.length === 0}
              className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Step 2 of 2 · Review and submit</h3>
            <p className="text-xs text-muted-foreground">
              Check the details below. You can still go back and edit before we send anything.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-sm">
            <dt className="text-muted-foreground">Submitting as</dt>
            <dd className="col-span-2">
              {identity ? (
                <>
                  {identity.name} <span className="text-muted-foreground">· {identity.email}</span>
                </>
              ) : (
                <span className="text-destructive">No reviewer set. Add your details above.</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Brand</dt>
            <dd className="col-span-2">{brandName}</dd>
            <dt className="text-muted-foreground">Files</dt>
            <dd className="col-span-2">
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i}>
                    {f.file.name}{' '}
                    <span className="text-muted-foreground">
                      · {DOCUMENT_TYPES.find((d) => d.value === f.document_type)?.label}
                      {f.vintage_year && ` · ${f.vintage_year}`}
                      {f.batch_reference && ` · ${f.batch_reference}`}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
            {notes && (
              <>
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="col-span-2 whitespace-pre-wrap">{notes}</dd>
              </>
            )}
          </dl>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep('files')} disabled={submitting}>Back</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !identity}
              className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ['files', 'review'];
  const labels: Record<Step, string> = { files: 'Files', review: 'Review' };
  const currentIdx = order.indexOf(step);
  return (
    <div className="flex items-center gap-2 text-xs">
      {order.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
              i < currentIdx
                ? 'bg-sky-500 text-white'
                : i === currentIdx
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </div>
          <span className={i === currentIdx ? 'text-sky-300 font-medium' : 'text-muted-foreground'}>
            {labels[s]}
          </span>
          {i < order.length - 1 && <span className="text-muted-foreground/40 mx-1">→</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Per-file SKU picker. Defaults to "applies to all products" (empty
 * selection); the uploader can opt in to specifying which SKUs this
 * document covers. Used for vintage-specific reports etc.
 */
function SkuPicker({
  skus,
  selectedIds,
  onChange,
}: {
  skus: Array<{ id: string; product_name: string; sku_code: string | null }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const allSelected = selectedIds.length === 0;
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }
  return (
    <div className="border border-border rounded-md p-2 bg-background/40">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Applies to:{' '}
          <strong className="text-foreground">
            {allSelected ? 'all products' : `${selectedIds.length} of ${skus.length}`}
          </strong>
        </span>
        {!allSelected && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-sky-300 hover:text-sky-200"
          >
            Apply to all products
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2 max-h-32 overflow-y-auto">
        {skus.map((sku) => {
          const checked = selectedIds.includes(sku.id);
          return (
            <label
              key={sku.id}
              className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:text-foreground"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(sku.id)}
                className="accent-sky-500"
              />
              <span className={checked ? '' : 'text-muted-foreground'}>
                {sku.product_name}
                {sku.sku_code && <span className="text-muted-foreground"> · {sku.sku_code}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function guessDocumentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('lca')) return 'lca_report';
  if (lower.includes('carbon') || lower.includes('co2') || lower.includes('co2e')) return 'carbon_report';
  if (lower.includes('water')) return 'water_usage';
  if (lower.includes('esg')) return 'esg_report';
  if (lower.includes('sustainab')) return 'sustainability_report';
  if (lower.includes('pack')) return 'packaging_data';
  if (lower.includes('cert') || lower.includes('b-corp') || lower.includes('bcorp')) return 'certification';
  return 'other';
}
