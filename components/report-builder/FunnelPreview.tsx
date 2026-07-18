'use client';

import { useState } from 'react';
import { Panel, FieldLabel, StateChip, PillButton } from '@/components/studio';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { ReportConfig } from '@/types/report-builder';

interface FunnelPreviewProps {
  config: ReportConfig;
  organizationId: string | null;
}

/**
 * The truthful preview: the real renderer over the exact current config and
 * a thin slice of live data, in a sandboxed iframe. Refresh is a deliberate
 * act (never per keystroke); a quiet chip says when the preview has fallen
 * behind the config.
 */
export function FunnelPreview({ config, organizationId }: FunnelPreviewProps) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [renderedSnapshot, setRenderedSnapshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configSnapshot = JSON.stringify(config);
  const isBehind = html !== null && renderedSnapshot !== configSnapshot;

  const refresh = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const response = await fetch('/api/reports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ config, organizationId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Preview failed');
      }
      setHtml(await response.text());
      setRenderedSnapshot(configSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!html || isBehind) void refresh();
  };

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-studio-hairline py-3">
        <div className="min-w-0 text-sm">
          <span className="font-display font-semibold text-foreground">Preview</span>
          <span className="text-studio-dim"> · the real document, before you draft</span>
        </div>
        <PillButton variant="ghost" size="sm" onClick={handleOpen} className="shrink-0">
          Show preview
        </PillButton>
      </div>
    );
  }

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <FieldLabel>Preview</FieldLabel>
          {loading ? (
            <StateChip tone="attention">Rendering</StateChip>
          ) : isBehind ? (
            <StateChip tone="attention">Preview is behind</StateChip>
          ) : html ? (
            <StateChip tone="good">Current</StateChip>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          <PillButton variant="outline" size="sm" onClick={refresh} disabled={loading || !organizationId}>
            Refresh preview
          </PillButton>
          <PillButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Hide
          </PillButton>
        </span>
      </div>

      {error && <p className="mb-3 text-xs text-studio-stale">{error}</p>}

      {html ? (
        <iframe
          title="Report preview"
          sandbox=""
          srcDoc={html}
          className="h-[620px] w-full rounded-[6px] border border-studio-hairline bg-white"
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Rendering the document from your data.</p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        This is the real renderer over your current choices and live data. Narratives are drafted
        in the next step, so this preview shows the structure and the look, not the words.
      </p>
    </Panel>
  );
}
