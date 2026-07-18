'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { Panel, FieldLabel, StateChip, PillButton } from '@/components/studio';
import { NarrativeBlockCard, type NarrativeChipState } from '@/components/report-builder/NarrativeBlockCard';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { cn } from '@/lib/utils';
import type { ReportConfig } from '@/types/report-builder';
import { SECTION_LABELS } from '@/types/report-builder';
import { REPORT_STYLES, resolveReportStyle, type ReportStyleId } from '@/lib/pdf/templates/report-styles';
import type { ReportDataSnapshot } from '@/lib/reports/narrative-store';

interface NarrativeReviewProps {
  organizationId: string | null;
  config: ReportConfig;
  snapshot: ReportDataSnapshot;
  busy: boolean;
  onPatch: (patch: Record<string, any>) => Promise<void>;
  onRegenerateBlock: (blockId: string, toneHint?: string) => Promise<void>;
  onToneChange: (toneOverride: 'confident' | 'measured' | 'technical' | null) => Promise<void>;
  onShip: () => Promise<void>;
}

const TONE_CHOICES = [
  { value: null, label: "The style's voice" },
  { value: 'confident', label: 'Confident' },
  { value: 'measured', label: 'Measured' },
  { value: 'technical', label: 'Technical' },
] as const;

function ChoicePill({ active, onClick, disabled, children }: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-studio disabled:pointer-events-none disabled:opacity-50',
        active
          ? 'bg-studio-ink text-studio-cream'
          : 'border border-studio-ink/25 text-foreground hover:border-studio-ink/60'
      )}
    >
      {children}
    </button>
  );
}

/**
 * The Phase C review step: every AI-drafted block, readable and editable
 * before anything ships. Provenance is honest throughout: AI draft,
 * Edited and Fallback chips per block, and a drift notice when the
 * underlying data has changed since drafting.
 */
export function NarrativeReview({
  organizationId,
  config,
  snapshot,
  busy,
  onPatch,
  onRegenerateBlock,
  onToneChange,
  onShip,
}: NarrativeReviewProps) {
  const style = REPORT_STYLES[(config.style as ReportStyleId) ?? resolveReportStyle(null, config.audience).id];
  const meta = snapshot.narrative_meta;
  const fallbackSet = new Set(meta.fallback_blocks);
  const [dataDrifted, setDataDrifted] = useState(false);
  const [shipping, setShipping] = useState(false);

  // Cheap drift check: has the load-bearing data moved since drafting?
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const [corp, products] = await Promise.all([
          supabase
            .from('corporate_reports')
            .select('total_emissions, breakdown_json')
            .eq('organization_id', organizationId)
            .eq('year', config.reportYear)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('product_carbon_footprints')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('status', 'completed'),
        ]);
        if (cancelled) return;
        const bj = corp.data?.breakdown_json as any;
        const liveTotal = bj?.total || corp.data?.total_emissions || 0;
        const digest = meta.inputs_digest;
        setDataDrifted(
          Math.abs(liveTotal - digest.emissions_total) > 0.05 ||
          (config.sections.includes('product-footprints') && (products.count ?? 0) !== digest.product_count)
        );
      } catch {
        // Advisory only
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, config.reportYear, config.sections, meta.inputs_digest]);

  const chipFor = (blockId: string, aiGenerated: boolean): NarrativeChipState =>
    !aiGenerated ? 'edited' : fallbackSet.has(blockId) ? 'fallback' : 'ai';

  const handleShip = async () => {
    setShipping(true);
    try {
      await onShip();
    } finally {
      setShipping(false);
    }
  };

  // Section cards in the style's narrative arc; anything unlisted follows.
  const sectionIds = Object.keys(snapshot.narratives.sections);
  const ordered = [
    ...style.sectionOrder.filter(id => sectionIds.includes(id)),
    ...sectionIds.filter(id => !style.sectionOrder.includes(id)),
  ];

  const foreword = snapshot.narratives.foreword;
  const exec = snapshot.narratives.executiveSummary;

  return (
    <div className="space-y-5">
      {/* ── Voice + actions bar ─────────────────────────────────────────── */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <FieldLabel className="mb-2">The voice</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TONE_CHOICES.map(choice => (
                <ChoicePill
                  key={choice.label}
                  active={(meta.tone_override ?? null) === choice.value}
                  disabled={busy}
                  onClick={() => onToneChange(choice.value)}
                >
                  {choice.label}
                </ChoicePill>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PillButton variant="outline" size="sm" disabled={busy} onClick={() => onToneChange(meta.tone_override as any ?? null)}>
              Regenerate all
            </PillButton>
            <PillButton variant="room" disabled={busy || shipping} onClick={handleShip}>
              {shipping ? 'Shipping.' : 'Ship the report'}
            </PillButton>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
          Drafted {format(new Date(meta.generated_at), 'd MMM yyyy HH:mm')} · {meta.model}
        </p>
      </Panel>

      {/* ── Notices ─────────────────────────────────────────────────────── */}
      {fallbackSet.size > 0 && (
        <Panel className="flex items-baseline gap-3">
          <StateChip tone="stale">Fallback</StateChip>
          <p className="text-xs text-muted-foreground">
            Some blocks used the built-in fallback because the writing service was unavailable.
            Edit them, or regenerate when it is back.
          </p>
        </Panel>
      )}
      {dataDrifted && (
        <Panel className="flex items-baseline gap-3">
          <StateChip tone="attention">Data changed</StateChip>
          <p className="text-xs text-muted-foreground">
            Your data has changed since these drafts were written. Regenerate all to bring the
            copy back in line before shipping.
          </p>
        </Panel>
      )}

      {/* ── Foreword (storytelling styles only) ─────────────────────────── */}
      {foreword && (
        <NarrativeBlockCard
          title={
            config.branding.leadership?.name
              ? `Foreword · ${config.branding.leadership.name}`
              : 'Leadership foreword'
          }
          chip={chipFor('foreword', foreword.aiGenerated)}
          fields={[{ key: 'message', label: 'Message', value: foreword.message, multiline: true }]}
          onSave={edits => onPatch({ foreword: { message: edits.message } })}
          onRegenerate={toneHint => onRegenerateBlock('foreword', toneHint)}
          accept={{
            accepted: foreword.accepted,
            onAccept: () => onPatch({ acceptForeword: true }),
          }}
        />
      )}

      {/* ── Executive summary ───────────────────────────────────────────── */}
      <NarrativeBlockCard
        title="Executive summary"
        chip={chipFor('executive-summary', exec.aiGenerated)}
        fields={[
          { key: 'primaryMessage', label: 'The one message', value: exec.primaryMessage },
          { key: 'summaryText', label: 'Summary', value: exec.summaryText, multiline: true },
        ]}
        onSave={edits => onPatch({ executiveSummary: edits })}
        onRegenerate={toneHint => onRegenerateBlock('executive-summary', toneHint)}
      />

      {/* ── Section narratives ──────────────────────────────────────────── */}
      {ordered.map(sectionId => {
        const block = snapshot.narratives.sections[sectionId];
        if (!block) return null;
        return (
          <NarrativeBlockCard
            key={sectionId}
            title={SECTION_LABELS[sectionId] || sectionId}
            chip={chipFor(sectionId, block.aiGenerated)}
            fields={[
              { key: 'headlineInsight', label: 'Headline insight', value: block.headlineInsight },
              { key: 'contextParagraph', label: 'Context', value: block.contextParagraph, multiline: true },
              { key: 'nextStepPrompt', label: 'Next step', value: block.nextStepPrompt },
            ]}
            footnotes={[block.dataConfidenceStatement, block.methodologyFootnote].filter(Boolean) as string[]}
            onSave={edits => onPatch({ sections: { [sectionId]: edits } })}
            onRegenerate={toneHint => onRegenerateBlock(sectionId, toneHint)}
          />
        );
      })}

      {/* ── Key findings ────────────────────────────────────────────────── */}
      {snapshot.keyFindings && snapshot.keyFindings.length > 0 && (
        <div className="space-y-3">
          <FieldLabel>Key findings</FieldLabel>
          {snapshot.keyFindings.map((finding, index) => (
            <NarrativeBlockCard
              key={`${finding.title}-${index}`}
              title={`Finding ${index + 1}`}
              chip={finding.aiGenerated ? 'ai' : 'edited'}
              fields={[
                { key: 'title', label: 'Title', value: finding.title },
                { key: 'narrative', label: 'Narrative', value: finding.narrative, multiline: true },
              ]}
              footnotes={[`${finding.scope} · ${finding.direction} · ${finding.magnitude_pct}% · ${finding.confidence} confidence`]}
              onSave={edits => onPatch({ keyFindings: [{ index, ...edits }] })}
              onRegenerate={() => onRegenerateBlock('key-findings')}
            />
          ))}
        </div>
      )}

      {/* ── Ship (repeated at the foot of the page) ─────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-studio-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Blocks you edited print clean. Unedited AI drafts carry a small AI-assisted draft note
          in the document, honesty your readers can check.
        </p>
        <PillButton variant="room" disabled={busy || shipping} onClick={handleShip} className="shrink-0">
          {shipping ? 'Shipping.' : 'Ship the report'}
        </PillButton>
      </div>
    </div>
  );
}
