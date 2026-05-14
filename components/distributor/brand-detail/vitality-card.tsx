import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  vitality: number | null;
  tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
  completeness: number | null;
}

/**
 * Vitality is the headline sustainability-performance score for a brand,
 * sitting alongside (and outranking) completeness for the distributor's
 * mental model. Completeness answers "have we got data?"; vitality
 * answers "how good is the sustainability story?". Missing data
 * deliberately pulls vitality down, so a brand with no website and no
 * uploaded documents looks bad here even if it isn't *missing*
 * anything from the completeness perspective.
 */
export function VitalityCard({ vitality, tier, completeness }: Props) {
  const score = vitality ?? 0;
  const colour = colourForTier(tier);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const tierGradient = gradientForTier(tier);
  const glow = glowForTier(tier);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${tierGradient.border} bg-gradient-to-br ${tierGradient.bg} p-6`}
    >
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${tierGradient.line} to-transparent`} />
      <div className="flex items-start gap-6 flex-col sm:flex-row">
        <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
          <svg width={128} height={128} viewBox="0 0 128 128">
            <defs>
              <filter id="vitality-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle
              cx={64}
              cy={64}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={10}
            />
            <circle
              cx={64}
              cy={64}
              r={radius}
              fill="none"
              stroke={colour}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 64 64)"
              filter="url(#vitality-glow)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-semibold tabular-nums tracking-tight">
              {Math.round(score)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
              of 100
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
            <Sparkles className={`h-3 w-3 ${glow}`} />
            Vitality score
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {renderTierBadge(tier)}
            {completeness != null && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-muted"
              >
                Data {Math.round(completeness)}% complete
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {explanationForTier(tier, vitality)}
          </p>
        </div>
      </div>
    </div>
  );
}

function colourForTier(tier: Props['tier']): string {
  switch (tier) {
    case 'leader':
      return '#34d399';
    case 'progressing':
      return '#38bdf8';
    case 'developing':
      return '#fbbf24';
    default:
      return '#71717a';
  }
}

function gradientForTier(tier: Props['tier']): {
  bg: string;
  border: string;
  line: string;
} {
  switch (tier) {
    case 'leader':
      return {
        bg: 'from-emerald-500/10 via-card/40 to-card/40',
        border: 'border-emerald-500/30',
        line: 'via-emerald-400/80',
      };
    case 'progressing':
      return {
        bg: 'from-sky-500/10 via-card/40 to-card/40',
        border: 'border-sky-500/30',
        line: 'via-sky-400/80',
      };
    case 'developing':
      return {
        bg: 'from-amber-500/10 via-card/40 to-card/40',
        border: 'border-amber-500/30',
        line: 'via-amber-400/80',
      };
    default:
      return {
        bg: 'from-card/60 via-card/40 to-card/40',
        border: 'border-border/60',
        line: 'via-border',
      };
  }
}

function glowForTier(tier: Props['tier']): string {
  switch (tier) {
    case 'leader':
      return 'text-emerald-300';
    case 'progressing':
      return 'text-sky-300';
    case 'developing':
      return 'text-amber-300';
    default:
      return 'text-muted-foreground';
  }
}

function renderTierBadge(tier: Props['tier']): React.ReactNode {
  if (!tier) return null;
  const cfg: Record<NonNullable<Props['tier']>, { label: string; className: string }> = {
    leader: {
      label: 'Leader',
      className: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15',
    },
    progressing: {
      label: 'Progressing',
      className: 'text-sky-300 border-sky-400/40 bg-sky-500/15',
    },
    developing: {
      label: 'Developing',
      className: 'text-amber-300 border-amber-500/40 bg-amber-500/15',
    },
    insufficient: {
      label: 'Insufficient data',
      className: 'text-muted-foreground border-muted',
    },
  };
  const c = cfg[tier];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase tracking-wider font-semibold ${c.className}`}
    >
      {c.label}
    </Badge>
  );
}

function explanationForTier(tier: Props['tier'], vitality: number | null): string {
  if (vitality == null) return 'No data yet — set a website and run a finding to score this brand.';
  switch (tier) {
    case 'leader':
      return 'Strong sustainability data across the key pillars. This brand stands out in your portfolio.';
    case 'progressing':
      return 'A solid sustainability story with room to deepen evidence in some pillars.';
    case 'developing':
      return 'Some sustainability data on file but significant gaps. Outreach + brand uploads will improve the score.';
    case 'insufficient':
      return 'Not enough data to score reliably. Most fields are missing — consider outreach for primary data.';
    default:
      return '';
  }
}
