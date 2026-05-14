'use client';

import { useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldLabel } from '@/lib/distributor/scraping/field-labels';

interface Props {
  field: FieldLabel;
  scopeLabel: string;
  currentValue: string | null;
  saving: boolean;
  error: string | null;
  onSave: (rawValue: unknown, evidence: File | null) => Promise<void>;
  onClose: () => void;
}

const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EVIDENCE = '.pdf,.png,.jpg,.jpeg,.webp';

/**
 * One field, one editor. Picks the input shape from FieldLabel.inputType
 * so booleans use Yes/No, percents use a clamped number input, URLs use
 * a url input, etc.
 *
 * For fields with `acceptsEvidence` (boolean certifications), the modal
 * also surfaces an optional drop zone so the brand can attach the
 * actual certificate alongside their answer. The file is handed back to
 * the parent which packages it as FormData to /verify.
 */
export function EditFieldModal({
  field,
  scopeLabel,
  currentValue,
  saving,
  error,
  onSave,
  onClose,
}: Props) {
  const [text, setText] = useState(currentValue ?? '');
  const [boolValue, setBoolValue] = useState<boolean | null>(coerceBoolFromText(currentValue));
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  function attachEvidence(file: File | null) {
    setEvidenceError(null);
    if (!file) {
      setEvidence(null);
      return;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      setEvidenceError(`"${file.name}" is over 25 MB.`);
      return;
    }
    setEvidence(file);
  }

  async function handleSave() {
    let value: unknown;
    if (field.inputType === 'boolean') {
      if (boolValue === null) return;
      value = boolValue;
    } else if (field.inputType === 'number' || field.inputType === 'percent' || field.inputType === 'year') {
      const n = parseFloat(text.replace(/[,%]/g, ''));
      if (!Number.isFinite(n)) return;
      value = n;
    } else {
      value = text.trim();
      if (!value) return;
    }
    await onSave(value, evidence);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{field.label}</DialogTitle>
          <DialogDescription>{field.helpText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="text-xs text-muted-foreground">{scopeLabel}</div>

          {field.inputType === 'boolean' && (
            <BooleanPicker value={boolValue} onChange={setBoolValue} />
          )}

          {(field.inputType === 'number' || field.inputType === 'percent') && (
            <div className="space-y-2">
              <Label htmlFor="value">Value{field.unit ? ` (${field.unit})` : ''}</Label>
              <Input
                id="value"
                type="number"
                inputMode="decimal"
                step={field.inputType === 'percent' ? '0.1' : 'any'}
                min={field.inputType === 'percent' ? 0 : undefined}
                max={field.inputType === 'percent' ? 100 : undefined}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {field.inputType === 'year' && (
            <div className="space-y-2">
              <Label htmlFor="value">Year</Label>
              <Input
                id="value"
                type="number"
                inputMode="numeric"
                min={1700}
                max={2200}
                step={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {field.inputType === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="value">URL</Label>
              <Input
                id="value"
                type="url"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="https://example.com/sustainability"
                autoFocus
              />
            </div>
          )}

          {field.inputType === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {field.inputType === 'longtext' && (
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <textarea
                id="value"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>
          )}

          {field.inputType === 'select' && field.selectOptions && (
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Select value={text} onValueChange={setText}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {field.selectOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {field.acceptsEvidence && (
            <EvidencePicker
              label={field.evidenceLabel ?? 'Or attach evidence (PDF, optional)'}
              file={evidence}
              error={evidenceError}
              onChange={attachEvidence}
            />
          )}

          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
          >
            {saving ? 'Saving…' : evidence ? 'Save and upload' : 'Save change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BooleanPicker({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
          value === true
            ? 'border-sky-400 bg-sky-500/15 text-sky-200'
            : 'border-border bg-background hover:border-sky-400/40'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
          value === false
            ? 'border-destructive bg-destructive/10 text-destructive'
            : 'border-border bg-background hover:border-destructive/40'
        }`}
      >
        No
      </button>
    </div>
  );
}

function EvidencePicker({
  label,
  file,
  error,
  onChange,
}: {
  label: string;
  file: File | null;
  error: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2 pt-2">
      <Label>{label}</Label>
      {!file ? (
        <label
          className="border-2 border-dashed border-border hover:border-sky-400/60 rounded-lg px-4 py-5 text-center block cursor-pointer transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onChange(f);
          }}
        >
          <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <div className="text-xs font-medium">Drop a PDF or image, or click to choose</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Max 25 MB. We'll save it with your answer and pass it to the distributor.
          </div>
          <input
            type="file"
            accept={ACCEPTED_EVIDENCE}
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      ) : (
        <div className="border border-border rounded-md px-3 py-2 flex items-center gap-3 bg-background/60">
          <FileText className="h-4 w-4 text-sky-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

function coerceBoolFromText(text: string | null): boolean | null {
  if (!text) return null;
  const s = text.trim().toLowerCase();
  if (['true', 'yes', '1'].includes(s)) return true;
  if (['false', 'no', '0'].includes(s)) return false;
  return null;
}
