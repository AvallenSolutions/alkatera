import type { ReactNode } from 'react'
import type { BeverageType } from '@/lib/onboarding'

/**
 * Bespoke line-art marks for the arrival flow's "What do you make?" row.
 * Studio rule: no emoji anywhere in the UI (design/studio-design-language.md
 * — marks are a maker's stamp, never clip art). Single-weight hairline
 * strokes at `currentColor` so the selected state is just a text-colour
 * change (studio-forest), same as every other studio control — no separate
 * "coloured icon" state to maintain.
 *
 * Each icon sits in the same 24x24 box with a shared visual rhythm (a vessel
 * resting on the same baseline) so the row reads as one drawn set rather
 * than seven unrelated glyphs.
 */

const STROKE_WIDTH = 1.5

function IconShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Beer: a tapered pint, two hairline foam strokes near the rim. */
function BeerGlassIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M7 4.5H17L15.8 20H8.2L7 4.5Z" />
      <path d="M9.2 8H14.8" opacity={0.55} />
      <path d="M9.4 10.4H14.6" opacity={0.55} />
    </IconShell>
  )
}

/** Cider: the same tapered glass, taller and slimmer, with a small leaf
 * mark at the rim — a quiet orchard nod, not an apple clip-art. */
function CiderGlassIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M8.3 5H15.7L14.7 20H9.3L8.3 5Z" />
      <path d="M9.9 8.3H14.1" opacity={0.55} />
      <path d="M12 5C12 3.4 13.3 2.6 14.6 2.8C14.5 4.1 13.5 5 12 5Z" />
    </IconShell>
  )
}

/** Spirits: a short rocks glass with a single stylised ice cube. */
function SpiritsGlassIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M6.5 10H17.5L16.5 20H7.5L6.5 10Z" />
      <rect x="9.7" y="13" width="4.2" height="4.2" transform="rotate(12 11.8 15.1)" opacity={0.7} />
    </IconShell>
  )
}

/** Wine: a stemmed bowl, thin stem, quiet base line. */
function WineGlassIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M7.3 4.2C7.3 8.6 7.3 13 12 15C16.7 13 16.7 8.6 16.7 4.2" />
      <path d="M12 15V19.4" />
      <path d="M9 20H15" />
    </IconShell>
  )
}

/** RTD: a slim can, top rim ellipse, small pull-tab loop. */
function RtdCanIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <rect x="8" y="4.5" width="8" height="15.5" rx="1.6" />
      <ellipse cx="12" cy="4.5" rx="4" ry="1.1" />
      <path d="M11 4.1C11 3.3 11.5 2.7 12.3 2.7C13 2.7 13.3 3.2 13.1 3.7" opacity={0.6} />
    </IconShell>
  )
}

/** Non-alcoholic: a straight tumbler, a straw crossing the rim, quiet
 * bubbles rather than any alcohol-coded vessel shape. */
function NonAlcoholicGlassIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M8.2 5H15.8L14.9 20H9.1L8.2 5Z" />
      <path d="M13.2 5.6L16.4 1.6" opacity={0.7} />
      <circle cx="11.3" cy="9.6" r="0.5" fill="currentColor" stroke="none" opacity={0.6} />
      <circle cx="12.6" cy="13.4" r="0.5" fill="currentColor" stroke="none" opacity={0.6} />
    </IconShell>
  )
}

/** Functional: a narrow-neck bottle with a small spark mark, standing in
 * for the added-ingredient (nootropic / adaptogen) story without literal
 * lightning-bolt clip art. */
function FunctionalBottleIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M10.6 2.6H13.4V5.6L15.6 8.2V19.4C15.6 19.9 15.2 20 14.7 20H9.3C8.8 20 8.4 19.9 8.4 19.4V8.2L10.6 5.6V2.6Z" />
      <path d="M9.6 11.5H14.4" opacity={0.5} />
      <path d="M18.2 4L18.9 5.6L20.5 6.3L18.9 7L18.2 8.6L17.5 7L15.9 6.3L17.5 5.6L18.2 4Z" opacity={0.75} />
    </IconShell>
  )
}

const BEVERAGE_ICONS: Record<Exclude<BeverageType, 'other'>, (props: { className?: string }) => JSX.Element> = {
  beer: BeerGlassIcon,
  cider: CiderGlassIcon,
  spirits: SpiritsGlassIcon,
  wine: WineGlassIcon,
  rtd: RtdCanIcon,
  non_alcoholic: NonAlcoholicGlassIcon,
  functional: FunctionalBottleIcon,
}

/** Look up the mark for a beverage type. Returns null for 'other' (no
 * option card renders for it) rather than guessing at a shape. */
export function BeverageIcon({ type, className }: { type: BeverageType; className?: string }) {
  if (type === 'other') return null
  const Icon = BEVERAGE_ICONS[type]
  return <Icon className={className} />
}

export {
  BeerGlassIcon,
  CiderGlassIcon,
  SpiritsGlassIcon,
  WineGlassIcon,
  RtdCanIcon,
  NonAlcoholicGlassIcon,
  FunctionalBottleIcon,
}
