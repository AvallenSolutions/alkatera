import type { BeverageType } from '@/lib/onboarding'

/**
 * Tim's full-colour studio illustrations for the arrival flow's "What do
 * you make?" row (public/assets/drinks/ — baked palette, matches the
 * marketing site). These replace the earlier bespoke line-art marks: use
 * the artwork as-is, no recolouring, no forcing currentColor.
 *
 * The files have varying viewBoxes/proportions (tall bottles vs wide
 * glasses), so the caller renders each inside a fixed square box with
 * object-contain — see BeverageIcon below.
 */

const BEVERAGE_ILLUSTRATIONS: Record<Exclude<BeverageType, 'other'>, string> = {
  beer: 'beer-glass',
  cider: 'cider-apple',
  spirits: 'spirits-bottle',
  wine: 'wine-glass',
  rtd: 'soda-can',
  non_alcoholic: 'non-alcoholic',
  functional: 'functional',
}

/** Look up the illustration src for a beverage type. Returns null for
 * 'other' (no option card renders for it) rather than guessing at art. */
export function BeverageIcon({ type, className }: { type: BeverageType; className?: string }) {
  if (type === 'other') return null
  const name = BEVERAGE_ILLUSTRATIONS[type]
  return (
    <span className={className ?? 'flex h-11 w-11 items-center justify-center'}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static studio artwork, not an optimisable content image */}
      <img
        src={`/assets/drinks/${name}.svg`}
        alt=""
        className="h-full w-full object-contain"
      />
    </span>
  )
}
