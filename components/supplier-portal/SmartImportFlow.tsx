'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import {
  PACKAGING_CATEGORY_LABELS,
  type PackagingCategoryType,
  type SupplierProductType,
} from '@/lib/types/supplier-product';
import type {
  ExtractedField,
  ExtractedSupplierProduct,
} from '@/lib/extraction/supplier-product-extractor';

type Stage = 'upload' | 'processing' | 'review' | 'success';

interface ReviewRow extends ExtractedSupplierProduct {
  included: boolean;
}

interface SmartImportFlowProps {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  onSuccess: (count: number) => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

function blankField<T>(): ExtractedField<T> {
  return { value: null, confidence: 'low', source_quote: null };
}

export function SmartImportFlow({ open, onClose, supplierId, onSuccess }: SmartImportFlowProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [phaseMessage, setPhaseMessage] = useState('Uploading…');
  const [products, setProducts] = useState<ReviewRow[]>([]);
  const [unmapped, setUnmapped] = useState<Array<{ raw: string; reason: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const pollAbortRef = useRef<AbortController | null>(null);

  const reset = () => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    setStage('upload');
    setFile(null);
    setProducts([]);
    setUnmapped([]);
    setError(null);
    setPhaseMessage('Uploading…');
    setCreatedCount(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelectFile = (f: File | null) => {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type) && !/\.(pdf|csv|xlsx?)$/i.test(f.name)) {
      setError('Upload a PDF, CSV, or XLSX file.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File is too large. Max 20MB.');
      return;
    }
    setError(null);
    setFile(f);
  };

  const startImport = async () => {
    if (!file) return;

    setStage('processing');
    setPhaseMessage('Uploading file…');
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError('Session expired. Please sign in again.');
        setStage('upload');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('supplier_id', supplierId);

      const res = await fetch('/api/supplier-products/smart-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start import');
        setStage('upload');
        return;
      }

      pollJob(data.jobId, token);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
      setStage('upload');
    }
  };

  const pollJob = async (jobId: string, token: string) => {
    const controller = new AbortController();
    pollAbortRef.current = controller;
    const start = Date.now();

    while (!controller.signal.aborted) {
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        setError('Extraction is taking longer than expected. Try again or use a smaller file.');
        setStage('upload');
        return;
      }
      try {
        const res = await fetch(`/api/supplier-products/smart-import/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to read job status');
          setStage('upload');
          return;
        }
        setPhaseMessage(data.phaseMessage || 'Working…');

        if (data.status === 'completed') {
          const rows: ReviewRow[] = (data.products as ExtractedSupplierProduct[]).map(p => ({
            ...p,
            included: true,
          }));
          setProducts(rows);
          setUnmapped(data.unmapped || []);
          if (rows.length === 0) {
            setError(
              "We couldn't pull any products from that file. Try a clearer datasheet or a CSV with one product per row."
            );
            setStage('upload');
            return;
          }
          setStage('review');
          return;
        }

        if (data.status === 'failed') {
          setError(data.error || 'Extraction failed.');
          setStage('upload');
          return;
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setError(e?.message || 'Network error while polling');
        setStage('upload');
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  };

  const updateRow = (idx: number, patch: Partial<ReviewRow>) => {
    setProducts(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const updateNumeric = (
    idx: number,
    key: keyof ExtractedSupplierProduct,
    raw: string,
  ) => {
    const value = raw.trim() === '' ? null : Number(raw);
    setProducts(prev =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const existing = (p as any)[key] as ExtractedField<number> | undefined;
        const source_quote = existing?.source_quote ?? (raw.trim() === '' ? null : 'Edited by supplier');
        const confidence = existing?.confidence ?? 'high';
        return {
          ...p,
          [key]: { value: Number.isFinite(value as number) ? (value as number) : null, confidence, source_quote },
        };
      }),
    );
  };

  const confirmImport = async () => {
    const selected = products.filter(p => p.included);
    if (selected.length === 0) {
      toast.error('Select at least one product to import.');
      return;
    }
    setIsConfirming(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Session expired');

      const res = await fetch('/api/supplier-products/smart-import/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId: 'pending', // confirm route reads supplierId; jobId is informational
          supplierId,
          products: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.issues) && data.issues.length) {
          toast.error(data.issues[0]);
        } else {
          toast.error(data.error || 'Import failed');
        }
        return;
      }
      setCreatedCount(data.created);
      setStage('success');
      onSuccess(data.created);
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#ccff00]" />
            Smart Import
          </DialogTitle>
          <DialogDescription>
            Upload a datasheet, EPD, LCA report, or product catalogue. We&apos;ll pull the structured data
            into rows you can review before saving.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {stage === 'upload' && (
          <div className="space-y-4">
            <label
              htmlFor="smart-import-file"
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 cursor-pointer hover:bg-muted/50 transition"
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <div className="text-sm font-medium">
                {file ? file.name : 'Click to choose a file (PDF, CSV, XLSX)'}
              </div>
              <div className="text-xs text-muted-foreground">Max 20MB</div>
              <input
                id="smart-import-file"
                type="file"
                className="sr-only"
                accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={e => handleSelectFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={startImport} disabled={!file}>
                Start Import
              </Button>
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{phaseMessage}</p>
          </div>
        )}

        {stage === 'review' && (
          <ReviewStage
            products={products}
            unmapped={unmapped}
            updateRow={updateRow}
            updateNumeric={updateNumeric}
            isConfirming={isConfirming}
            onCancel={handleClose}
            onConfirm={confirmImport}
          />
        )}

        {stage === 'success' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <h3 className="text-lg font-semibold">Imported {createdCount} product{createdCount === 1 ? '' : 's'}</h3>
            <p className="text-sm text-muted-foreground">Open each product to add evidence and verify the data.</p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ReviewStageProps {
  products: ReviewRow[];
  unmapped: Array<{ raw: string; reason: string }>;
  updateRow: (idx: number, patch: Partial<ReviewRow>) => void;
  updateNumeric: (idx: number, key: keyof ExtractedSupplierProduct, raw: string) => void;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ReviewStage({
  products,
  unmapped,
  updateRow,
  updateNumeric,
  isConfirming,
  onCancel,
  onConfirm,
}: ReviewStageProps) {
  const includedCount = products.filter(p => p.included).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {includedCount} of {products.length} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => products.forEach((_, i) => updateRow(i, { included: true }))}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Select all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => products.forEach((_, i) => updateRow(i, { included: false }))}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {products.map((p, idx) => (
          <ReviewRowCard
            key={idx}
            row={p}
            idx={idx}
            updateRow={updateRow}
            updateNumeric={updateNumeric}
          />
        ))}
      </div>

      {unmapped.length > 0 && (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {unmapped.length} row{unmapped.length === 1 ? '' : 's'} could not be mapped
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {unmapped.map((u, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{u.raw.slice(0, 80)}</span> — {u.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-3 border-t">
        <Button variant="ghost" onClick={onCancel} disabled={isConfirming}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isConfirming || includedCount === 0}>
          {isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing…
            </>
          ) : (
            `Import ${includedCount} product${includedCount === 1 ? '' : 's'}`
          )}
        </Button>
      </div>
    </div>
  );
}

interface ReviewRowCardProps {
  row: ReviewRow;
  idx: number;
  updateRow: (idx: number, patch: Partial<ReviewRow>) => void;
  updateNumeric: (idx: number, key: keyof ExtractedSupplierProduct, raw: string) => void;
}

function ReviewRowCard({ row, idx, updateRow, updateNumeric }: ReviewRowCardProps) {
  const isPackaging = row.product_type === 'packaging';
  const lowConfidence = row.row_confidence === 'low';
  return (
    <div
      className={`rounded-lg border p-4 space-y-3 transition ${
        lowConfidence ? 'border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10' : 'border-border bg-card'
      } ${row.included ? '' : 'opacity-50'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-start gap-3 flex-1 cursor-pointer">
          <input
            type="checkbox"
            checked={row.included}
            onChange={e => updateRow(idx, { included: e.target.checked })}
            className="mt-1.5"
          />
          <div className="flex-1 space-y-2">
            <Input
              value={row.name}
              onChange={e => updateRow(idx, { name: e.target.value })}
              className="font-medium"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={row.product_type}
                onValueChange={v => updateRow(idx, { product_type: v as SupplierProductType })}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingredient">Ingredient</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                </SelectContent>
              </Select>
              {isPackaging && (
                <Select
                  value={row.packaging_category ?? ''}
                  onValueChange={v =>
                    updateRow(idx, { packaging_category: (v || null) as PackagingCategoryType | null })
                  }
                >
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder="Packaging category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PACKAGING_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {lowConfidence && (
                <Badge variant="outline" className="text-amber-600 border-amber-400">
                  Low confidence
                </Badge>
              )}
            </div>
          </div>
        </label>
      </div>

      {isPackaging && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumericField
            label="Weight (g) *"
            field={row.weight_g}
            onChange={v => updateNumeric(idx, 'weight_g', v)}
          />
          <NumericField
            label="Recycled content (%) *"
            field={row.recycled_content_pct}
            onChange={v => updateNumeric(idx, 'recycled_content_pct', v)}
          />
          <NumericField
            label="Recyclability (%)"
            field={row.recyclability_pct}
            onChange={v => updateNumeric(idx, 'recyclability_pct', v)}
          />
          <NumericField
            label="Carbon (kg CO₂e)"
            field={row.impact_climate}
            onChange={v => updateNumeric(idx, 'impact_climate', v)}
          />
        </div>
      )}
      {!isPackaging && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumericField
            label="Carbon (kg CO₂e)"
            field={row.impact_climate}
            onChange={v => updateNumeric(idx, 'impact_climate', v)}
          />
          <NumericField
            label="Water (m³)"
            field={row.impact_water}
            onChange={v => updateNumeric(idx, 'impact_water', v)}
          />
          <NumericField label="Waste" field={row.impact_waste} onChange={v => updateNumeric(idx, 'impact_waste', v)} />
          <NumericField label="Land" field={row.impact_land} onChange={v => updateNumeric(idx, 'impact_land', v)} />
        </div>
      )}
    </div>
  );
}

function NumericField({
  label,
  field,
  onChange,
}: {
  label: string;
  field: ExtractedField<number> | undefined;
  onChange: (raw: string) => void;
}) {
  const f = field ?? blankField<number>();
  const lowConf = f.confidence === 'low' || (!f.source_quote && f.value !== null);
  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1">
        {label}
        {lowConf && <span className="text-amber-500">●</span>}
      </Label>
      <Input
        type="number"
        step="any"
        value={f.value ?? ''}
        onChange={e => onChange(e.target.value)}
        className={lowConf ? 'border-amber-400/70' : ''}
        title={f.source_quote ? `From the document: "${f.source_quote.slice(0, 200)}"` : undefined}
      />
      {f.source_quote && (
        <p className="text-[10px] text-muted-foreground italic line-clamp-1">“{f.source_quote}”</p>
      )}
    </div>
  );
}
