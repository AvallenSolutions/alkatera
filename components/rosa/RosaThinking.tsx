'use client'

import { cn } from '@/lib/utils'

/**
 * Animated dog used as the "Rosa is thinking" indicator inside her
 * conversation thread (replaces the previous blinking-bar cursor and
 * Sparkles dots).
 *
 * Pure SVG + CSS keyframes — no extra dependencies. The body and head
 * bob gently while the tail wags faster, giving an attentive, alive feel.
 *
 * Two sizes:
 *   - small (default): inline next to a "Thinking…" label, used inside
 *     an empty assistant turn while waiting for the first text token.
 *   - mid: streaming cursor — replaces the blinking lime bar that sat at
 *     the end of the streaming text.
 */
export function RosaThinking({
  size = 'small',
  label = 'Thinking…',
  className,
}: {
  size?: 'small' | 'mid'
  label?: string
  className?: string
}) {
  const px = size === 'mid' ? 18 : 22
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center gap-2 text-xs text-muted-foreground', className)}
    >
      <DogSpinner px={px} />
      {label && <span className="leading-none">{label}</span>}
    </span>
  )
}

/**
 * Inline dog "still working" cursor used at the end of streaming text.
 * Smaller and tail-only-visible so it doesn't crowd the writing.
 */
export function RosaStreamingCursor({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Rosa is writing"
      className={cn('inline-flex items-center align-middle ml-1', className)}
    >
      <DogSpinner px={14} />
    </span>
  )
}

function DogSpinner({ px }: { px: number }) {
  // The keyframes are inlined as a <style> tag inside the SVG so any
  // consumer of this component picks up the animation without touching
  // the global Tailwind keyframes config.
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 24"
      xmlns="http://www.w3.org/2000/svg"
      className="rosa-thinking-svg flex-shrink-0"
      aria-hidden="true"
    >
      <style>{`
        .rosa-thinking-svg .body {
          transform-origin: 50% 80%;
          animation: rosa-bob 900ms ease-in-out infinite;
        }
        .rosa-thinking-svg .tail {
          transform-origin: 22px 12px;
          animation: rosa-wag 360ms ease-in-out infinite;
        }
        .rosa-thinking-svg .head {
          transform-origin: 9px 10px;
          animation: rosa-tilt 1800ms ease-in-out infinite;
        }
        @keyframes rosa-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1px); }
        }
        @keyframes rosa-wag {
          0%   { transform: rotate(20deg); }
          50%  { transform: rotate(-30deg); }
          100% { transform: rotate(20deg); }
        }
        @keyframes rosa-tilt {
          0%, 100% { transform: rotate(0deg); }
          25%      { transform: rotate(-6deg); }
          50%      { transform: rotate(0deg); }
          75%      { transform: rotate(4deg); }
        }
      `}</style>

      {/* Body — chunky bean. */}
      <g className="body" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" color="#ccff00">
        {/* Torso */}
        <path d="M9 14 Q9 9 14 9 L19 9 Q22 9 22 12 L22 18 Q22 21 19 21 L12 21 Q9 21 9 18 Z" />
        {/* Front leg */}
        <path d="M12 21 L12 23" />
        {/* Back leg */}
        <path d="M19 21 L19 23" />
      </g>

      {/* Head — slight tilt animation. */}
      <g className="head" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" color="#ccff00">
        <circle cx="8" cy="11" r="3.5" />
        {/* Ear flopping forward */}
        <path d="M5.5 9 L4 7" />
        {/* Snout */}
        <circle cx="6" cy="12.5" r="0.6" fill="currentColor" />
      </g>

      {/* Tail — fast wag. */}
      <g className="tail" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" color="#ccff00">
        <path d="M22 12 Q26 10 27 6" />
      </g>
    </svg>
  )
}
