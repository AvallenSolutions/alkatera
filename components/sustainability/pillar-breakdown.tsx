import { Cloud, Droplets, Recycle, Leaf, Users, ShieldCheck, BadgeCheck } from 'lucide-react'
import type { PillarKey, PillarGroup } from '@/lib/sustainability/pillars'

const PILLAR_ICON: Record<PillarKey, typeof Cloud> = {
  climate: Cloud,
  water: Droplets,
  circularity: Recycle,
  nature: Leaf,
  social: Users,
  governance: ShieldCheck,
}

/**
 * Six-pillar breakdown of a brand's sustainability data. SHARED by the
 * distributor and procurement portals so the data is presented in an
 * identical card layout in both. Colours come from theme tokens
 * (bg-card, text-foreground, --brand-primary), so each portal keeps its
 * own styling while the layout stays the same.
 */
export function PillarBreakdown({ groups }: { groups: PillarGroup[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groups.map(({ def, findings }) => {
        const Icon = PILLAR_ICON[def.key]
        return (
          <div
            key={def.key}
            className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-xl bg-brand-primary/10 border border-brand-primary/20 p-2 text-brand-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{def.label}</div>
                <div className="text-[11px] text-muted-foreground">{def.blurb}</div>
              </div>
              <span className="ml-auto text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold tabular-nums">
                {findings.length} {findings.length === 1 ? 'metric' : 'metrics'}
              </span>
            </div>
            <dl className="space-y-2.5">
              {findings.map((f) => (
                <div key={f.field_key} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-muted-foreground flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{f.label}</span>
                    {(f.source_name === 'alkatera_live' || f.source_name === 'brand_verified') && (
                      <BadgeCheck className="h-3 w-3 shrink-0 text-brand-primary" aria-label="Verified" />
                    )}
                  </dt>
                  <dd className="text-[13px] font-semibold text-foreground tabular-nums text-right shrink-0">
                    {f.display}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </div>
  )
}
