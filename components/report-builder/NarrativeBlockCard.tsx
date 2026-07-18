'use client';

import { useState, type ReactNode } from 'react';
import { Panel, FieldLabel, StateChip, PillButton } from '@/components/studio';
import { cn } from '@/lib/utils';

export interface NarrativeField {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
}

export type NarrativeChipState = 'ai' | 'edited' | 'fallback';

interface NarrativeBlockCardProps {
  title: string;
  chip: NarrativeChipState;
  /** Human-editable text fields for this block. */
  fields: NarrativeField[];
  /** Machine-owned lines rendered dim below (confidence, methodology). */
  footnotes?: string[];
  onSave: (edits: Record<string, string>) => Promise<void>;
  onRegenerate: (toneHint?: string) => Promise<void>;
  /** Foreword only: the explicit accept step. */
  accept?: { accepted: boolean; onAccept: () => Promise<void> };
  children?: ReactNode;
}

const quietTextareaClass =
  'w-full resize-none rounded-[6px] border border-studio-hairline bg-transparent p-3 text-sm outline-none transition-colors focus-visible:border-studio-forest';

/**
 * One reviewable narrative block: read view with a quiet Edit swap (the
 * arrival idiom), honest provenance chips, and per-block regeneration with
 * an optional free-text steer. Edits flip the AI-draft flag server-side.
 */
export function NarrativeBlockCard({
  title,
  chip,
  fields,
  footnotes,
  onSave,
  onRegenerate,
  accept,
  children,
}: NarrativeBlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [toneHintOpen, setToneHintOpen] = useState(false);
  const [toneHint, setToneHint] = useState('');
  const [busy, setBusy] = useState<'save' | 'regenerate' | 'accept' | null>(null);

  const startEditing = () => {
    setDraft(Object.fromEntries(fields.map(f => [f.key, f.value])));
    setEditing(true);
  };

  const handleSave = async () => {
    setBusy('save');
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setBusy(null);
    }
  };

  const handleRegenerate = async () => {
    setBusy('regenerate');
    try {
      await onRegenerate(toneHint.trim() || undefined);
      setToneHint('');
      setToneHintOpen(false);
      setEditing(false);
    } finally {
      setBusy(null);
    }
  };

  const handleAccept = async () => {
    if (!accept) return;
    setBusy('accept');
    try {
      await accept.onAccept();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <FieldLabel>{title}</FieldLabel>
        {chip === 'edited' ? (
          <StateChip tone="good">Edited</StateChip>
        ) : chip === 'fallback' ? (
          <StateChip tone="stale">Fallback</StateChip>
        ) : (
          <StateChip tone="attention">AI draft</StateChip>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {fields.map(field => (
            <div key={field.key}>
              {fields.length > 1 && <FieldLabel className="mb-1">{field.label}</FieldLabel>}
              <textarea
                value={draft[field.key] ?? ''}
                onChange={e => setDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                className={cn(quietTextareaClass, field.multiline ? 'h-28' : 'h-16')}
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <PillButton size="sm" onClick={handleSave} disabled={busy !== null}>
              {busy === 'save' ? 'Saving.' : 'Save'}
            </PillButton>
            <PillButton variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy !== null}>
              Cancel
            </PillButton>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startEditing} className="group block w-full text-left">
          <div className="space-y-2">
            {fields.map((field, i) => (
              <p
                key={field.key}
                className={cn(
                  'text-sm leading-relaxed text-foreground',
                  i === 0 && 'font-display font-semibold'
                )}
              >
                {field.value}
              </p>
            ))}
          </div>
          <span className="mt-2 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-150 ease-studio group-hover:text-foreground">
            Edit
          </span>
        </button>
      )}

      {footnotes && footnotes.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-studio-hairline pt-3">
          {footnotes.map(note => (
            <p key={note} className="font-mono text-[10px] text-studio-dim">{note}</p>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-studio-hairline pt-3">
        {accept && (
          accept.accepted ? (
            <StateChip tone="good">Included in the report</StateChip>
          ) : (
            <>
              <PillButton size="sm" onClick={handleAccept} disabled={busy !== null}>
                {busy === 'accept' ? 'Adding.' : 'Use this foreword'}
              </PillButton>
              <span className="text-xs text-muted-foreground">Not included until you accept it.</span>
            </>
          )
        )}
        <span className="ml-auto flex items-center gap-2">
          {toneHintOpen && (
            <input
              type="text"
              value={toneHint}
              onChange={e => setToneHint(e.target.value)}
              placeholder="Steer it, e.g. shorter and warmer"
              className="h-7 w-56 rounded-full border border-studio-hairline bg-transparent px-3 text-xs outline-none focus-visible:border-studio-forest"
            />
          )}
          <PillButton
            variant="outline"
            size="sm"
            onClick={() => (toneHintOpen ? handleRegenerate() : setToneHintOpen(true))}
            disabled={busy !== null}
          >
            {busy === 'regenerate' ? 'Rewriting.' : toneHintOpen ? 'Rewrite' : 'Regenerate'}
          </PillButton>
          {toneHintOpen && busy === null && (
            <PillButton variant="ghost" size="sm" onClick={() => { setToneHintOpen(false); setToneHint(''); }}>
              Cancel
            </PillButton>
          )}
        </span>
      </div>

      {children}
    </Panel>
  );
}
