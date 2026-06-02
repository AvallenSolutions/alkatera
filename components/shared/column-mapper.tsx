'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ColumnFieldSpec<Key extends string = string> {
  key: Key;
  label: string;
  required: boolean;
  hint?: string;
}

export interface ColumnMapperParseInput {
  preview: Record<string, string>[];
  detected_columns: string[];
  suggestions: Record<string, string | undefined>;
}

interface Props<Key extends string> {
  parse: ColumnMapperParseInput;
  fields: Array<ColumnFieldSpec<Key>>;
  onConfirm: (mapping: Partial<Record<Key, string>>) => Promise<void> | void;
  disabled?: boolean;
  submitLabel?: string;
  /** Fired whenever the user changes a column selection. Lets the host
   *  surface context-aware help (e.g. "no brand column — detect with AI"). */
  onMappingChange?: (mapping: Partial<Record<Key, string>>) => void;
  /** Optional content rendered just above the submit button — used to slot
   *  in the AI brand-detection panel without forking this component. */
  footer?: React.ReactNode;
}

const NONE = '__none__';

/**
 * Generic column-mapper UI. Distributor SKU upload, admin brand upload,
 * and admin product upload all consume this with their own `fields`
 * config — no copy-paste of the table / select / submit layout.
 *
 * `parse.suggestions` is a partial map from field-key → detected column
 * header; the UI uses it as the default selection.
 */
export function ColumnMapper<Key extends string>({
  parse,
  fields,
  onConfirm,
  disabled,
  submitLabel = 'Confirm mapping & import',
  onMappingChange,
  footer,
}: Props<Key>) {
  const [mapping, setMapping] = useState<Partial<Record<Key, string>>>(
    parse.suggestions as Partial<Record<Key, string>>,
  );
  const [submitting, setSubmitting] = useState(false);

  // Real-world spreadsheets often carry blank / unnamed trailing columns.
  // An empty header would render <SelectItem value="" />, which Radix rejects
  // (empty string is reserved for clearing the selection) and crashes the page.
  // A blank-named column isn't mappable anyway, so drop it from the options.
  const mappableColumns = parse.detected_columns.filter(
    (col) => typeof col === 'string' && col.trim().length > 0,
  );

  const canSubmit = fields
    .filter((f) => f.required)
    .every((f) => Boolean(mapping[f.key]));

  async function handleConfirm() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(mapping);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Preview</h3>
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                {parse.detected_columns.map((col, idx) => (
                  <th key={`${col}-${idx}`} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                    {col?.trim() ? col : <span className="text-muted-foreground/50 italic">(unnamed)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parse.preview.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {parse.detected_columns.map((col, idx) => (
                    <td key={`${col}-${idx}`} className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {row[col] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Showing {parse.preview.length} of the first rows.
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Map columns</h3>
        <div className="space-y-3">
          {fields.map((field) => {
            const value = mapping[field.key] ?? NONE;
            return (
              <div key={field.key} className="flex items-start gap-3 py-1">
                <div className="w-44 text-sm">
                  <div>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </div>
                  {field.hint && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {field.hint}
                    </div>
                  )}
                </div>
                <div className="flex-1 max-w-sm">
                  <Select
                    value={value}
                    onValueChange={(v) =>
                      setMapping((prev) => {
                        const next = { ...prev, [field.key]: v === NONE ? undefined : v };
                        onMappingChange?.(next);
                        return next;
                      })
                    }
                    disabled={disabled || submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a column…" />
                    </SelectTrigger>
                    <SelectContent>
                      {!field.required && (
                        <SelectItem value={NONE}>— Not in file —</SelectItem>
                      )}
                      {mappableColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {footer}

      <div className="flex justify-end">
        <Button
          onClick={handleConfirm}
          disabled={!canSubmit || submitting || disabled}
          className="bg-sky-400 hover:bg-sky-300 text-black"
        >
          {submitting ? 'Processing…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
