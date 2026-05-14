interface Props {
  score: number;
}

/**
 * Lightweight donut/ring rendering of a 0–100 completeness score using
 * a pure SVG circle stroke-dasharray. Avoids pulling in a chart lib
 * for one small visual.
 */
export function ScoreRing({ score }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const colour =
    clamped >= 75 ? '#10b981' : clamped >= 50 ? '#14b8a6' : clamped >= 25 ? '#f59e0b' : '#71717a';

  return (
    <div className="relative" style={{ width: 112, height: 112 }}>
      <svg width={112} height={112} viewBox="0 0 112 112">
        <circle
          cx={56}
          cy={56}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={10}
        />
        <circle
          cx={56}
          cy={56}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-2xl font-semibold tabular-nums">{Math.round(clamped)}%</div>
      </div>
    </div>
  );
}
