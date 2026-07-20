'use client';

import { Panel, Eyebrow, StateChip, FactList, ProvenanceChip, PillButton } from '@/components/studio';
import type { FactRowItem } from '@/components/studio';
import type { DossierSection, SectionState } from '@/lib/lca/dossier';

/**
 * One section of the dossier.
 *
 * The grammar: what this covers, what it comes to, how much to trust it, and
 * only then the detail. A section the reader has nothing to do with should
 * cost them nothing to skip, so the state chip carries the whole message and
 * the rows stay quiet underneath.
 */

const STATE_TONE: Record<SectionState, 'good' | 'attention' | 'stale' | 'quiet'> = {
  settled: 'good',
  unreviewed: 'attention',
  incomplete: 'stale',
  out_of_scope: 'quiet',
};

const STATE_LABEL: Record<SectionState, string> = {
  settled: 'Settled',
  unreviewed: 'Not checked',
  incomplete: 'Needs you',
  out_of_scope: 'Not counted',
};

interface DossierSectionPanelProps {
  section: DossierSection;
  /** The one act this section exists for, when it has one. */
  action?: { label: string; onClick: () => void };
}

export function DossierSectionPanel({ section, action }: DossierSectionPanelProps) {
  const rows: FactRowItem[] = section.rows.map((row) => ({
    id: row.id,
    title: row.title,
    hint: row.hint,
    value: row.value,
    unit: row.unit,
    // Provenance rides on the row it describes, so a reader can see which
    // single ingredient is dragging a section down rather than only that
    // something is.
    trailing: row.provenance ? <ProvenanceChip provenance={row.provenance} compact /> : undefined,
  }));

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>{section.title}</Eyebrow>
          <p className="mt-2 max-w-prose text-sm text-studio-dim">{section.blurb}</p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {/* A section the boundary excludes has no provenance worth stating:
              "Confirmed." beside "Not counted." reads as a contradiction. */}
          {section.state !== 'out_of_scope' && (
            <ProvenanceChip provenance={section.provenance} compact />
          )}
          {section.kgCo2e !== null && (
            <div className="text-right">
              <div className="font-display text-[1.5rem] font-bold leading-none tabular-nums">
                {section.kgCo2e.toFixed(3)}
              </div>
              <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em] opacity-70">
                KG CO₂E
                {section.sharePct !== null && ` · ${section.sharePct}%`}
              </div>
            </div>
          )}
          <StateChip tone={STATE_TONE[section.state]}>{STATE_LABEL[section.state]}</StateChip>
        </div>
      </div>

      {section.note && (
        <p className="mt-4 max-w-prose text-sm text-foreground">{section.note}</p>
      )}

      {rows.length > 0 && (
        <div className="mt-5">
          <FactList items={rows} dense />
        </div>
      )}

      {action && (
        <div className="mt-5">
          <PillButton variant={section.state === 'settled' ? 'outline' : 'room'} size="sm" onClick={action.onClick}>
            {action.label}
          </PillButton>
        </div>
      )}
    </Panel>
  );
}
