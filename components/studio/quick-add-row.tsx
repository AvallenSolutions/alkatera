'use client';

// One shared composer-style quick-add row for the social/governance record
// families that are still "one dialog per record" (board members,
// compensation, donations — tasks/data-revolution-plan.md Pillar 2). Same
// shape as IngredientComposer: a name, one or two extra fields, an Add
// button that saves straight through the existing create API, and a quiet
// "Open the full record." link that still opens the family's full dialog
// for anything this row can't capture.

import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PillButton } from './pill-button';
import { Plus } from 'lucide-react';

export interface QuickAddField {
  key: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Tailwind width class; defaults to a sensible size per type. */
  widthClassName?: string;
}

export interface QuickAddConfig {
  /** The primary "name" field — always first, always required. */
  nameField: { key: string; placeholder: string };
  /** One or two extra fields shown after the name. */
  fields: QuickAddField[];
  /** Create endpoint — the exact one the family's full dialog already posts to. */
  endpoint: string;
  /** Turns the row's raw values into the API payload (parses numbers, etc). */
  buildPayload: (values: Record<string, string>) => Record<string, unknown>;
  addLabel?: string;
  successMessage?: string;
  errorMessage?: string;
}

interface QuickAddRowProps {
  config: QuickAddConfig;
  onAdded: () => void;
  /** Opens the family's existing full dialog for anything beyond the quick fields. */
  onOpenFullRecord: () => void;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabaseClient');
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export function QuickAddRow({ config, onAdded, onOpenFullRecord }: QuickAddRowProps) {
  const initial: Record<string, string> = { [config.nameField.key]: '' };
  for (const f of config.fields) initial[f.key] = '';
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);

  const name = values[config.nameField.key] ?? '';
  const canAdd = name.trim().length > 0 && !saving;

  const setField = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(config.buildPayload(values)),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save');
      }
      toast.success(config.successMessage || 'Added.');
      setValues(initial);
      onAdded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (config.errorMessage || 'Failed to add.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
        <div className="flex-1 min-w-0">
          <Input
            value={name}
            placeholder={config.nameField.placeholder}
            onChange={(e) => setField(config.nameField.key, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            disabled={saving}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {config.fields.map((field) => {
            if (field.type === 'select') {
              return (
                <Select
                  key={field.key}
                  value={values[field.key] || undefined}
                  onValueChange={(v) => setField(field.key, v)}
                  disabled={saving}
                >
                  <SelectTrigger className={field.widthClassName || 'w-40'}>
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }
            return (
              <Input
                key={field.key}
                type={field.type === 'number' ? 'number' : 'text'}
                placeholder={field.placeholder}
                value={values[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
                className={field.widthClassName || 'w-28'}
                disabled={saving}
              />
            );
          })}
          <PillButton type="button" size="sm" onClick={() => void handleAdd()} disabled={!canAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {config.addLabel || 'Add'}
          </PillButton>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenFullRecord}
        className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
      >
        Open the full record.
      </button>
    </div>
  );
}
