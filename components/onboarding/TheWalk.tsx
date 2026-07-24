'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { STUDIO, type MarkShape } from '@/components/studio/theme'
import { cn } from '@/lib/utils'

/**
 * The walk: the post-checkout orientation that teaches the house by walking it,
 * room by room, each card carrying that room's OWN real data. It does three
 * jobs at once — teaches the (unconventional) navigation model, proves the
 * "lights on in every room" promise, and covers the Stripe webhook wait
 * invisibly (seven rooms at a human pace is ~a minute, well past webhook lag).
 *
 * One explainer screen names the concept, then seven full-screen room cards.
 * Auto-advances (tap or → to skip; ← to go back); calls onDone after the last
 * room, where the parent shows the planting moment.
 *
 * TRANSITIONS: the backdrop is ONE element that lives for the whole walk and
 * only ever changes colour. Each slide used to be its own `fixed inset-0`
 * panel keyed by room, so advancing unmounted the old panel and faded the new
 * one in from transparent — which flashed the desk between every room. Only
 * the content is keyed now; the ground under it never goes see-through, and
 * the room colour washes from one to the next, which is the walk.
 */

const AUTO_MS = 8000

interface WalkRoom {
  key: string
  name: string
  purpose: string
  colour: string
  onDark: boolean // paper text on a dark ground; ochre wants ink text
  shape: MarkShape
  tabs: string
}

// Keep the tab strings in step with PLATFORM_ROOMS: this is the first thing
// a new owner is told about each room, and it should still be true when they
// walk into it.
const WALK_ROOMS: WalkRoom[] = [
  { key: 'cellar', name: 'The cellar', purpose: 'What our drinks are made of.', colour: STUDIO.plum, onDark: true, shape: 'diamond', tabs: 'Products · Liquids · Packaging · Ingredients' },
  { key: 'workbench', name: 'The workbench', purpose: 'What we measure.', colour: STUDIO.cobalt, onDark: true, shape: 'triangle', tabs: 'Facilities · Spend · Integrations · Quality' },
  { key: 'evidence', name: 'The evidence', purpose: 'What we can prove.', colour: STUDIO.brick, onDark: true, shape: 'quarter', tabs: 'Reports · LCAs · Vitality · Emissions' },
  { key: 'network', name: 'The network', purpose: "Who we're talking to.", colour: STUDIO.ochre, onDark: false, shape: 'square', tabs: 'Suppliers · Experts · Messages' },
  { key: 'people', name: 'Our people', purpose: 'Who we look after.', colour: STUDIO.slate, onDark: true, shape: 'bars', tabs: 'Community · Governance · Fair work' },
  { key: 'library', name: 'The library', purpose: 'What we know.', colour: STUDIO.teal, onDark: true, shape: 'arch', tabs: 'Your library · Knowledge · Wiki' },
  { key: 'today', name: 'Today', purpose: 'The day ahead.', colour: STUDIO.forest, onDark: true, shape: 'circle', tabs: 'The brief · Pulse · The ask queue' },
]

/** The eight-room index shown on the explainer screen. */
const EXPLAINER_ROOMS: { name: string; colour: string; shape: MarkShape; desc: string }[] = [
  { name: 'The cellar', colour: STUDIO.plum, shape: 'diamond', desc: 'What your drinks are made of: the liquid, the packaging and the ingredients.' },
  { name: 'The workbench', colour: STUDIO.cobalt, shape: 'triangle', desc: 'What you measure: your sites, energy, water, waste and spend.' },
  { name: 'The evidence', colour: STUDIO.brick, shape: 'quarter', desc: 'What you can prove: reports, finished LCAs, your vitality score and your emissions.' },
  { name: 'The network', colour: STUDIO.ochre, shape: 'square', desc: 'Who you talk to: suppliers, messages and expert help.' },
  { name: 'Our people', colour: STUDIO.slate, shape: 'bars', desc: 'Who you look after: your team, your community and how you govern yourselves.' },
  { name: 'The library', colour: STUDIO.teal, shape: 'arch', desc: 'What you keep: your own documents, plus plain-language guides for your industry.' },
  { name: 'Today', colour: STUDIO.forest, shape: 'circle', desc: 'The day ahead: Rosa’s brief of what needs you.' },
  { name: 'The wiring', colour: STUDIO.ink, shape: 'ring', desc: 'Behind the walls: settings, billing and your team.' },
]

/** Mark paths, matching components/studio/mark.tsx geometry. */
function markPath(shape: MarkShape, fill: string) {
  switch (shape) {
    case 'circle': return <circle cx="50" cy="50" r="50" fill={fill} />
    case 'triangle': return <polygon points="50,2 98,98 2,98" fill={fill} />
    case 'square': return <rect x="18" y="18" width="64" height="64" fill={fill} transform="rotate(14 50 50)" />
    case 'quarter': return <path d="M 0 100 A 100 100 0 0 1 100 0 L 100 100 Z" fill={fill} />
    case 'diamond': return <polygon points="50,2 98,50 50,98 2,50" fill={fill} />
    case 'arch': return <path d="M 10 100 L 10 50 A 40 40 0 0 1 90 50 L 90 100 Z" fill={fill} />
    case 'ring': return <circle cx="50" cy="50" r="36" fill="none" stroke={fill} strokeWidth="24" />
    case 'bars': return (
      <g fill={fill}>
        <rect x="8" y="30" width="20" height="70" />
        <rect x="40" y="10" width="20" height="90" />
        <rect x="72" y="46" width="20" height="54" />
      </g>
    )
  }
}

export function TheWalk({ onDone }: { onDone: () => void }) {
  const { state } = useOnboarding()
  const p = state.personalization ?? {}

  const productCount = p.scrapedProducts?.length ?? p.scrapedProductNames?.length ?? 0
  const tonnes = p.estimateTonnesCO2e ?? null
  const facilityCountry = p.facilityCountry ?? null
  const fromWebsite = !!p.websiteUrl

  const dataLine = useCallback((key: string): string => {
    switch (key) {
      case 'cellar':
        return productCount > 0
          ? `${productCount} product${productCount === 1 ? '' : 's'}, drafted from your ${fromWebsite ? 'website' : 'answers'}.`
          : 'Your products and their footprints live here.'
      case 'workbench':
        return facilityCountry
          ? `Your production site in ${facilityCountry} is on the bench.`
          : 'Your sites and what they use live here.'
      case 'evidence':
        return tonnes != null
          ? `Your first estimate is on the table: about ${tonnes.toLocaleString()} t CO₂e.`
          : 'Confirm your data and it becomes reportable proof.'
      case 'network':
        return 'Your suppliers, and the asks that fill the gaps you can’t fill alone.'
      case 'people':
        return 'Fair work, your community and how you govern yourselves, all in one room.'
      case 'library':
        return 'Plain-language guides for your industry are already on the shelf.'
      case 'today':
        return 'Rosa has your first few things ready for tomorrow morning.'
      default:
        return ''
    }
  }, [productCount, tonnes, facilityCountry, fromWebsite])

  // index 0 = explainer, 1..N = room cards
  const [index, setIndex] = useState(0)
  const total = WALK_ROOMS.length + 1

  // The bound check sits OUTSIDE the updater. It used to call onDone() inside
  // setIndex's callback, which React runs during render — so finishing the
  // walk set state in the parent mid-render and logged a "Cannot update a
  // component while rendering a different component" warning every time.
  const advance = useCallback(() => {
    if (index + 1 >= total) { onDone(); return }
    setIndex(index + 1)
  }, [index, total, onDone])

  const back = useCallback(() => setIndex(i => Math.max(0, i - 1)), [])

  // Auto-advance.
  useEffect(() => {
    const t = setTimeout(advance, AUTO_MS)
    return () => clearTimeout(t)
  }, [index, advance])

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') advance()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, back])

  // index 0 is the explainer on cream; 1..N are the rooms, each on its own ink.
  const room = index === 0 ? null : WALK_ROOMS[index - 1]
  // Cream on the dark rooms, INK on ochre — the house rule, the same one
  // PLATFORM_ROOMS states for the network (`onColour: 'ink'`). This used to
  // reach for STUDIO.ochreInk, which is ochre's accent form for text ON
  // PAPER; putting it on the ochre ground itself left dark gold on gold,
  // near-invisible.
  const textColour = room ? (room.onDark ? STUDIO.paper : STUDIO.ink) : null

  return (
    <div
      // The one element that lives for the whole walk. `animate-in` fires only
      // on mount (this never remounts), so the walk fades up off the desk once
      // and then never goes see-through again.
      className="fixed inset-0 z-[70] overflow-y-auto motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
      style={textColour ? { color: textColour } : undefined}
      onClick={advance}
      role="button"
      tabIndex={0}
      aria-label={room ? `${room.name}. Tap to continue.` : 'Continue the walk'}
    >
      {/* The ground. Its own layer so the colour wash owns `duration-700`
          without fighting the mount animation's `duration-500` (one element
          cannot carry two, they are the same Tailwind utility). Fixed, not
          absolute, so it covers the viewport even when a slide scrolls. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 motion-safe:transition-colors motion-safe:duration-700 motion-safe:ease-studio"
        style={{ backgroundColor: room ? room.colour : STUDIO.cream }}
      />

      {/* Keyed on the slide, so the content (and only the content) fades in
          as the room colour washes underneath it. `relative` puts it above
          the ground without needing a z-index. */}
      <div
        key={index}
        className="relative flex min-h-full flex-col items-center justify-center px-6 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-studio"
        // The room's text colour is set HERE, on the element the text
        // actually lives in, rather than left to inherit from the root.
        style={textColour ? { color: textColour } : undefined}
      >
        {room === null ? (
          <div className="w-full max-w-2xl space-y-6">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">How alkatera works</p>
            <h1 className="font-display text-[clamp(1.75rem,5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
              This is a house, not a dashboard.
            </h1>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Everything you do lives in one of eight rooms, and every room keeps its colour, so you always know where you are. The desk is the hall: you can see into every room, and Rosa can fetch anything from any of them. Let&apos;s take the walk.
            </p>
            <div className="grid gap-2 text-left sm:grid-cols-2">
              {EXPLAINER_ROOMS.map(r => (
                <div key={r.name} className="flex items-start gap-3 rounded-[6px] border border-studio-hairline bg-white/40 p-3">
                  <svg width="18" height="18" viewBox="0 0 100 100" className="mt-0.5 shrink-0" aria-hidden="true">{markPath(r.shape, r.colour)}</svg>
                  <div>
                    <div className="font-display text-[13px] font-semibold text-foreground">{r.name}</div>
                    <div className="text-[11.5px] leading-snug text-muted-foreground">{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Tap to walk through</p>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col items-center space-y-5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] opacity-75">The walk · {index} of {WALK_ROOMS.length}</p>
            <svg width="72" height="72" viewBox="0 0 100 100" aria-hidden="true" className="motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-700">
              {markPath(room.shape, textColour!)}
            </svg>
            <h1 className="font-display text-[clamp(2rem,6vw,3.25rem)] font-bold leading-none tracking-[-0.02em]">{room.name}</h1>
            <p className="font-display text-lg font-medium opacity-90">{room.purpose}</p>
            <p className="max-w-sm text-sm opacity-90">{dataLine(room.key)}</p>
            <div className="rounded-[6px] border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] opacity-80" style={{ borderColor: textColour! }}>
              In this room · {room.tabs}
            </div>
          </div>
        )}
      </div>

      {/* Outside the keyed wrapper: the dots belong to the walk, not to a
          slide, so they hold still while the rooms change around them. */}
      {room && (
        <div className="pointer-events-none fixed bottom-6 left-0 right-0 flex justify-center gap-1.5" aria-hidden="true">
          {WALK_ROOMS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full motion-safe:transition-opacity motion-safe:duration-500 motion-safe:ease-studio',
                i === index - 1 ? 'opacity-100' : 'opacity-40',
              )}
              style={{ backgroundColor: textColour! }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
