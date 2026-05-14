'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FIELD_DEFINITIONS, type FieldKey, type Pillar } from '@/lib/distributor/scraping/field-definitions';

interface Props {
  /** When set, blocks here apply only to this distributor. When null, edits global default. */
  distributorOrgId: string | null;
  distributorName: string;
}

interface PreferenceRow {
  id: string;
  distributor_org_id: string | null;
  field_key: string;
  sharing_enabled: boolean;
}

const PILLAR_LABELS: Record<Pillar, string> = {
  carbon: 'Carbon',
  water: 'Water',
  packaging: 'Packaging',
  agriculture: 'Agriculture & ingredients',
  governance: 'Governance & certification',
  corporate: 'Corporate',
};

/**
 * Per-field privacy toggles. Default state is "shared" for every field;
 * the table flips a field to "blocked" by writing a row with
 * sharing_enabled=false. Default-scope (no distributor) and per-distributor
 * scopes are managed via the same UI by switching the `distributorOrgId`
 * prop.
 */
export function FieldSharingControls({ distributorOrgId, distributorName }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Maintain a local override map for this scope: field_key → sharing_enabled.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/brand/distributors/preferences');
      if (!res.ok) return;
      const body = (await res.json()) as { preferences: PreferenceRow[] };
      const map: Record<string, boolean> = {};
      for (const row of body.preferences) {
        if (row.distributor_org_id === distributorOrgId) {
          map[row.field_key] = row.sharing_enabled;
        }
      }
      setOverrides(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [distributorOrgId]);

  function toggle(fieldKey: FieldKey) {
    setOverrides((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey] === false ? true : false,
    }));
  }

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const preferences = Object.entries(overrides).map(([field_key, sharing_enabled]) => ({
        field_key,
        sharing_enabled,
        distributor_org_id: distributorOrgId,
      }));
      const res = await fetch('/api/brand/distributors/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Save failed (${body.error ?? res.status}).` });
        return;
      }
      setFeedback({ type: 'ok', text: 'Preferences saved.' });
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<Pillar, typeof FIELD_DEFINITIONS>();
    for (const def of FIELD_DEFINITIONS) {
      const list = map.get(def.pillar) ?? [];
      list.push(def);
      map.set(def.pillar, list);
    }
    return map;
  }, []);

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading field preferences…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Toggle any field off to block it being shared with{' '}
        <strong>{distributorName}</strong>. Fields left on use your default sharing setting.
      </div>

      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([pillar, defs]) => (
          <div key={pillar}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
              {PILLAR_LABELS[pillar]}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {defs.map((def) => {
                const enabled = overrides[def.key] !== false;
                return (
                  <label
                    key={def.key}
                    className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-accent/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggle(def.key as FieldKey)}
                      className="accent-teal-500"
                    />
                    <span className={enabled ? '' : 'text-muted-foreground line-through'}>
                      {def.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          onClick={save}
          disabled={saving}
          className="bg-teal-500 hover:bg-teal-400 text-black"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
        {feedback && (
          <span
            className={`text-xs ${
              feedback.type === 'ok' ? 'text-emerald-400' : 'text-destructive'
            }`}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}
