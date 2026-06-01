import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** Optional small delta indicator (e.g. "+12 vs last week"). */
  delta?: string;
  /** Optional accent tint variant. 'brand' uses the tenant teal; 'success' uses emerald; default is neutral. */
  tone?: 'brand' | 'success' | 'neutral';
}

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, { value: string; icon: string; iconBg: string }> = {
  brand: {
    value: 'text-foreground',
    icon: 'text-brand-primary',
    iconBg: 'bg-brand-primary/10',
  },
  success: {
    value: 'text-foreground',
    icon: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
  },
  neutral: {
    value: 'text-foreground',
    icon: 'text-foreground/60',
    iconBg: 'bg-muted',
  },
};

export function StatCard({ label, value, hint, icon: Icon, delta, tone = 'neutral' }: StatCardProps) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-border transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          {label}
        </div>
        {Icon ? (
          <div className={`flex items-center justify-center rounded-lg h-7 w-7 ${t.iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${t.icon}`} />
          </div>
        ) : null}
      </div>
      <div className={`text-[28px] font-semibold tabular-nums leading-none mt-3 tracking-tight ${t.value}`}>
        {value}
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-2">
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : <span />}
        {delta ? (
          <div className="text-[11px] text-emerald-600 font-medium tabular-nums">{delta}</div>
        ) : null}
      </div>
    </div>
  );
}
