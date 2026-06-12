'use client';

/**
 * Thin inline-SVG sparkline. No dependency, scales to its container.
 * Extracted from the old vitality hero so the Overview stat tiles and any
 * future compact card share one implementation.
 */
export function Sparkline({
  values,
  stroke = '#ccff00',
  height = 32,
}: {
  values: number[];
  stroke?: string;
  height?: number;
}) {
  if (values.length < 2) return null;
  const w = 260;
  const h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
