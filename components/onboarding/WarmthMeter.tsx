'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { STUDIO, type MarkShape } from '@/components/studio/theme'
import { cn } from '@/lib/utils'

/**
 * The warmth meter: the ritual's honest progress spine.
 *
 * Seven small room marks sit at the foot of every arrival screen. A room only
 * lights when a REAL row exists for it — org created, products drafted, an
 * estimate written — so the meter can never overstate what the house holds.
 * It is the house-of-rooms translation of a setup-completion score: as data
 * lands, the marks fill with their room colour and the count climbs.
 *
 * Lit state is derived from the onboarding context alone (no extra fetch): the
 * signals below are the ones the ritual genuinely produces today. Workbench
 * (facility), network (supplier matches) and today (day-one cards) light as
 * later phases wire their data sources — the meter grows with the build.
 */

interface MeterRoom {
  key: string
  label: string
  colour: string
  shape: MarkShape
  lit: boolean
}

/** One small mark: filled with the room colour when lit, a hairline outline
 * when not. Same geometry as the studio Mark, sized for a meter. */
function MeterMark({ shape, colour, lit, label }: { shape: MarkShape; colour: string; lit: boolean; label: string }) {
  const fill = lit ? colour : 'none'
  const stroke = lit ? colour : STUDIO.hairline
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${label}: ${lit ? 'lit' : 'not yet'}`}
      className="shrink-0 transition-all duration-700 ease-studio"
    >
      {shape === 'circle' && <circle cx="50" cy="50" r="46" fill={fill} stroke={stroke} strokeWidth="8" />}
      {shape === 'triangle' && <polygon points="50,6 94,94 6,94" fill={fill} stroke={stroke} strokeWidth="8" strokeLinejoin="round" />}
      {shape === 'square' && <rect x="16" y="16" width="68" height="68" rx="4" fill={fill} stroke={stroke} strokeWidth="8" transform="rotate(14 50 50)" />}
      {shape === 'quarter' && <path d="M 8 92 A 84 84 0 0 1 92 8 L 92 92 Z" fill={fill} stroke={stroke} strokeWidth="8" strokeLinejoin="round" />}
      {shape === 'diamond' && <polygon points="50,6 94,50 50,94 6,50" fill={fill} stroke={stroke} strokeWidth="8" strokeLinejoin="round" />}
      {shape === 'arch' && <path d="M 12 92 L 12 50 A 38 38 0 0 1 88 50 L 88 92 Z" fill={fill} stroke={stroke} strokeWidth="8" strokeLinejoin="round" />}
      {shape === 'ring' && <circle cx="50" cy="50" r="34" fill="none" stroke={stroke} strokeWidth="22" />}
    </svg>
  )
}

export function WarmthMeter() {
  const { state } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const p = state.personalization ?? {}

  const hasProducts = (p.scrapedProducts?.length ?? p.scrapedProductNames?.length ?? 0) > 0
  const hasEstimate = p.estimateTonnesCO2e != null
  const hasCategory = (p.beverageTypes?.length ?? 0) > 0

  // Ritual order: wiring lights first (the org), then the rooms as their data
  // lands. A room's `lit` is a real-data predicate, never a step counter.
  const rooms: MeterRoom[] = [
    { key: 'wiring', label: 'The wiring', colour: STUDIO.ink, shape: 'ring', lit: !!currentOrganization },
    { key: 'cellar', label: 'The cellar', colour: STUDIO.plum, shape: 'diamond', lit: hasProducts },
    { key: 'workbench', label: 'The workbench', colour: STUDIO.cobalt, shape: 'triangle', lit: false },
    { key: 'evidence', label: 'The evidence', colour: STUDIO.brick, shape: 'quarter', lit: hasEstimate },
    { key: 'network', label: 'The network', colour: STUDIO.ochre, shape: 'square', lit: false },
    { key: 'library', label: 'The library', colour: STUDIO.teal, shape: 'arch', lit: hasCategory },
    { key: 'today', label: 'Today', colour: STUDIO.forest, shape: 'circle', lit: false },
  ]

  const litCount = rooms.filter(r => r.lit).length

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[2]',
        'flex items-center justify-center gap-4 px-5 py-3',
        'border-t border-studio-hairline bg-studio-cream/85 backdrop-blur-sm',
      )}
    >
      <div className="flex items-center gap-3">
        {rooms.map(r => (
          <MeterMark key={r.key} shape={r.shape} colour={r.colour} lit={r.lit} label={r.label} />
        ))}
      </div>
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dim"
        aria-live="polite"
      >
        {litCount === 7 ? 'Every room is lit.' : `The house is warming · ${litCount} of 7 rooms lit`}
      </span>
    </div>
  )
}
