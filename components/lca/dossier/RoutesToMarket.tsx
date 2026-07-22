'use client';

/**
 * Routes to market.
 *
 * The problem this solves, in the user's words: the same product sold to a bar
 * and to a supermarket used to need two complete LCAs. Same liquid, same
 * bottle, same recipe; only the journey and the bin differ. Here it is one
 * footprint with a tab per channel, and only the two sections that genuinely
 * vary redraw when you switch.
 *
 * Appears only when a product actually sells more than one way. One route needs
 * no switcher, and showing one would imply a choice nobody made.
 */

import { useState } from 'react';
import { Panel, Eyebrow, StateChip, PillButton, ProvenanceChip } from '@/components/studio';
import { DossierSectionPanel } from './DossierSectionPanel';
import type { DossierScenario, DossierHeadline } from '@/lib/lca/dossier';
import { cn } from '@/lib/utils';

interface RoutesToMarketProps {
  scenarios: DossierScenario[];
  headline: DossierHeadline | null;
  /** Opens the channel-share question. Absent while shares are already set. */
  onSetShares?: () => void;
}

export function RoutesToMarket({ scenarios, headline, onSetShares }: RoutesToMarketProps) {
  const [activeId, setActiveId] = useState<string>(
    scenarios.find((s) => s.isPrimary)?.id ?? scenarios[0]?.id ?? '',
  );

  if (scenarios.length < 2) return null;

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const spread = headline ? headline.max - headline.min : 0;

  return (
    <div className="mt-8">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>Routes to market</Eyebrow>
            <p className="mt-2 max-w-prose text-sm text-studio-dim">
              This product sells more than one way. Everything up to your gate is the same
              footprint; what changes is the journey, the chilling and the bin.
            </p>
          </div>
          {headline && (
            <StateChip tone={headline.basis === 'weighted' ? 'good' : 'attention'}>
              {headline.basis === 'weighted' ? 'Weighted by sales' : 'Main route only'}
            </StateChip>
          )}
        </div>

        {/* The honest bit: when we do not know the sales mix we say which route
            the headline came from, rather than averaging channels the product
            may barely sell through. */}
        {headline && !headline.sharesComplete && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="max-w-prose text-sm text-foreground">
              The number above is the main route only. Tell us roughly how sales split and we
              will show the figure weighted across all of them.
            </p>
            {onSetShares && (
              <PillButton variant="room" size="sm" onClick={onSetShares}>
                Set the sales split
              </PillButton>
            )}
          </div>
        )}

        {headline && spread > 0 && (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            {headline.min.toFixed(3)} to {headline.max.toFixed(3)} kg CO₂e depending on route
          </p>
        )}

        {/* Channel tabs. State-driven rather than routed: switching a view of
            the same footprint is not a navigation. */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-studio-rule pb-3">
          {scenarios.map((s) => {
            const isActive = s.id === active.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={cn(
                  'font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-colors',
                  isActive ? 'text-foreground' : 'text-studio-dim hover:text-foreground',
                )}
              >
                {s.name}
                {s.sharePct !== null && (
                  <span className="ml-2 opacity-60">{s.sharePct}%</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div className="font-display text-[2rem] font-bold leading-none tabular-nums">
            {active.totalKgCo2e === null ? '—' : active.totalKgCo2e.toFixed(3)}
          </div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] opacity-70">
            KG CO₂E PER UNIT · {active.name.toUpperCase()}
          </div>
          {active.isPrimary && <StateChip tone="quiet">Main route</StateChip>}
        </div>
      </Panel>

      {/* Only the two sections a channel actually changes. Materials, making it
          and the methods are shared, so they stay above and do not redraw. */}
      <div className="mt-4 space-y-4">
        <DossierSectionPanel section={active.sections.distribution} />
        <DossierSectionPanel section={active.sections.after} />
      </div>
    </div>
  );
}

/**
 * Add a route. Deliberately one action from the dossier rather than a wizard:
 * picking a channel seeds a plausible journey, and every value it seeds is
 * labelled as an estimate and generates its own question.
 */
export function AddRoute({
  onAdd,
  busy,
  existingChannels,
}: {
  onAdd: (channel: string) => void;
  busy: boolean;
  existingChannels: string[];
}) {
  const CHANNELS: Array<{ key: string; label: string; blurb: string }> = [
    { key: 'on_trade', label: 'Bars and restaurants', blurb: 'Drunk on the premises, usually chilled behind a bar' },
    { key: 'off_trade_retail', label: 'Shops and supermarkets', blurb: 'Taken home and drunk later' },
    { key: 'dtc', label: 'Direct to customer', blurb: 'Shipped from you straight to the drinker' },
    { key: 'export', label: 'Export', blurb: 'Shipped overseas, then distributed there' },
  ];

  const available = CHANNELS.filter((c) => !existingChannels.includes(c.key));
  if (available.length === 0) return null;

  return (
    <div className="mt-4">
      <Panel>
        <Eyebrow>Sold somewhere else too?</Eyebrow>
        <p className="mt-2 max-w-prose text-sm text-studio-dim">
          Add the route and we will work out that version of the footprint. Nothing about your
          recipe or packaging is entered twice.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {available.map((c) => (
            <PillButton
              key={c.key}
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onAdd(c.key)}
            >
              {c.label}
            </PillButton>
          ))}
        </div>
      </Panel>
    </div>
  );
}
