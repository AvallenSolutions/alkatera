import Link from 'next/link';
import { ChevronLeft, type LucideIcon } from 'lucide-react';

export interface PageHeaderProps {
  pill?: string;
  pillIcon?: LucideIcon;
  title: string;
  subtitle?: string;
  description?: string;
  /** Optional back link (top-left chevron). */
  backHref?: string;
  backLabel?: string;
  /** Optional right-aligned content — typically a primary action button or a small stat. */
  action?: React.ReactNode;
  /** Optional meta row rendered under the subtitle (chips, badges, etc.). */
  meta?: React.ReactNode;
}

/**
 * Shared page header for the procurement portal. Establishes a calm,
 * consistent rhythm at the top of every page: small back link (if any),
 * tenant-coloured pill, large title, subtitle, optional description and
 * optional right-aligned action. The container deliberately does NOT
 * use a card — page-level chrome should sit on the soft background so
 * the cards below feel like first-class content.
 */
export function PageHeader({
  pill,
  pillIcon: PillIcon,
  title,
  subtitle,
  description,
  backHref,
  backLabel,
  action,
  meta,
}: PageHeaderProps) {
  return (
    <header className="space-y-4 mb-10">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel ?? 'Back'}
        </Link>
      ) : null}

      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-3 flex-1 min-w-0">
          {pill ? (
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-full px-2.5 py-1">
              {PillIcon ? <PillIcon className="h-3 w-3" /> : null}
              {pill}
            </div>
          ) : null}
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-foreground leading-[1.15]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-base text-foreground/70 max-w-2xl leading-relaxed">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
          ) : null}
          {meta ? <div className="pt-2">{meta}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
