'use client';

// Generalised "paste a spreadsheet" import (tasks/data-revolution-plan.md
// Pillar 2, "CSV anything"): paste or drop a CSV/TSV/Excel file, get an
// AI-assisted column mapping (reusing the same alias approach the
// distributor/admin upload wizards use, plus a Claude fallback for anything
// the aliases miss), preview, then save every row through the family's own
// per-family adapter — which posts to the exact API the quick-add row and
// the full dialog already use, so there's one write path per family.

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PillButton } from './pill-button';
import { ColumnMapper, type ColumnMapperParseInput } from '@/components/shared/column-mapper';
import { parseDelimited } from '@/lib/studio/parse-delimited';
import type { CsvImportAdapter } from '@/lib/studio/csv-import-adapters';

interface CsvPasteImportProps<Key extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adapter: CsvImportAdapter<Key>;
  onImported: () => void;
}

type Step = 'input' | 'mapping' | 'importing' | 'done';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabaseClient');
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

const isSpreadsheetBinary = (name: string) => /\.(xlsx|xls)$/i.test(name);

/** Browser-safe ArrayBuffer -> base64 (no Node `Buffer` in the client bundle). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export function CsvPasteImport<Key extends string>({
  open,
  onOpenChange,
  adapter,
  onImported,
}: CsvPasteImportProps<Key>) {
  const [step, setStep] = useState<Step>('input');
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string | undefined>>({});
  const [results, setResults] = useState<{ ok: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('input');
    setPasteText('');
    setHeaders([]);
    setRows([]);
    setSuggestions({});
    setResults(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const fieldSpecs = adapter.fields.map((f) => ({ key: f.key, label: f.label, required: f.required, hint: f.hint }));

  const requestMapping = async (parsedHeaders: string[], parsedRows: Record<string, string>[]) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/studio/csv-column-mapping', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          headers: parsedHeaders,
          sampleRows: parsedRows.slice(0, 5),
          fields: adapter.fields.map((f) => ({ key: f.key, label: f.label, required: f.required })),
          aliases: adapter.aliases,
        }),
      });
      if (response.ok) {
        const body = await response.json();
        setSuggestions(body.suggestions || {});
      }
    } catch (err) {
      console.error('[csv-paste-import] mapping suggestion failed', err);
    } finally {
      setHeaders(parsedHeaders);
      setRows(parsedRows);
      setStep('mapping');
      setBusy(false);
    }
  };

  const handleParsePaste = async () => {
    const { headers: h, rows: r } = parseDelimited(pasteText);
    if (h.length === 0 || r.length === 0) {
      toast.error('Could not find any rows. Paste a header row plus data rows, tab or comma separated.');
      return;
    }
    setBusy(true);
    await requestMapping(h, r);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      if (isSpreadsheetBinary(file.name)) {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/studio/csv-column-mapping', {
          method: 'POST',
          headers: authHeaders,
          credentials: 'include',
          body: JSON.stringify({
            fileBase64: base64,
            fields: adapter.fields.map((f) => ({ key: f.key, label: f.label, required: f.required })),
            aliases: adapter.aliases,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Could not read that file');
        }
        const body = await response.json();
        setSuggestions(body.suggestions || {});
        setHeaders(body.headers || []);
        setRows(body.rows || []);
        setStep('mapping');
        setBusy(false);
      } else {
        const text = await file.text();
        const { headers: h, rows: r } = parseDelimited(text);
        if (h.length === 0 || r.length === 0) {
          toast.error('Could not find any rows in that file.');
          setBusy(false);
          return;
        }
        await requestMapping(h, r);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file');
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleConfirmMapping = async (mapping: Partial<Record<Key, string>>) => {
    setStep('importing');
    let ok = 0;
    let failed = 0;
    const authHeaders = await getAuthHeaders();

    // Sequential, small batches — these are hand-scale imports (dozens of
    // rows, not thousands), and a per-row POST reuses the exact same create
    // API the dialog and quick-add row already call.
    for (const rawRow of rows) {
      const mappedRow = Object.fromEntries(
        adapter.fields.map((f) => [f.key, mapping[f.key] ? rawRow[mapping[f.key] as string] ?? '' : '']),
      ) as Record<Key, string>;

      // Skip rows with no name at all — trailing blank rows are common in
      // pasted spreadsheets.
      const hasAnyValue = Object.values(mappedRow).some((v) => String(v).trim().length > 0);
      if (!hasAnyValue) continue;

      try {
        const payload = adapter.buildPayload(mappedRow);
        const response = await fetch(adapter.endpoint, {
          method: 'POST',
          headers: authHeaders,
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (response.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setResults({ ok, failed });
    setStep('done');
    if (ok > 0) onImported();
  };

  const parseInput: ColumnMapperParseInput = {
    preview: rows.slice(0, 8),
    detected_columns: headers,
    suggestions,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste a spreadsheet</DialogTitle>
          <DialogDescription>
            Paste rows from Excel or Google Sheets, or drop a CSV/Excel file. We&apos;ll suggest which
            column is which — you confirm, then we save {adapter.label}.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground transition-colors ${dragOver ? 'border-room-accent bg-muted/40' : 'border-border'}`}
            >
              Drop a CSV or Excel file here, or{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                choose a file
              </button>
              .
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="text-center text-xs text-muted-foreground">or paste below</div>

            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`${adapter.fields[0]?.label || 'Name'}\tRole\t...\nJane Smith\tChair\t...`}
              rows={8}
              className="font-mono text-xs"
            />

            <div className="flex justify-end">
              <PillButton
                type="button"
                onClick={() => void handleParsePaste()}
                disabled={busy || pasteText.trim().length === 0}
              >
                {busy ? 'Reading…' : 'Continue'}
              </PillButton>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <ColumnMapper
            parse={parseInput}
            fields={fieldSpecs}
            onConfirm={handleConfirmMapping}
            submitLabel={`Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}
          />
        )}

        {step === 'importing' && (
          <p className="py-8 text-center text-sm text-muted-foreground">Saving your rows…</p>
        )}

        {step === 'done' && results && (
          <div className="space-y-4 py-4 text-sm">
            <p>
              {results.ok} {adapter.label} added
              {results.failed > 0 ? `, ${results.failed} row${results.failed === 1 ? '' : 's'} could not be saved` : ''}.
            </p>
            <div className="flex justify-end">
              <PillButton type="button" onClick={() => handleClose(false)}>Done</PillButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
