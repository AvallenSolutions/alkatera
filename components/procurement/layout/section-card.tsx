import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Padding for the content area. Defaults to comfortable. */
  contentClassName?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Refined card surface used to host a single widget on the dashboard,
 * brand drilldown, reports page etc. Establishes a consistent header
 * rhythm (label + subtitle on the left, optional action on the right)
 * and a generous content area. Subtle shadow and border on hover help
 * the page feel crafted without shouting.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  contentClassName = 'px-6 pb-6',
  className = '',
  children,
}: SectionCardProps) {
  return (
    <section
      className={`rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-shadow overflow-hidden ${className}`}
    >
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/60">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0 text-[11px] text-muted-foreground">{action}</div> : null}
      </header>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
