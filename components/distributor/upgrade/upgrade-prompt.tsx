import Link from 'next/link';
import { Lock, Sparkles, ArrowRight, type LucideIcon } from 'lucide-react';
import { AlkaTeraIcon, AlkaTeraWordmark } from '@/components/lca-report/Logo';
import { CAPABILITY_LABELS, type DistributorCapability } from '@/lib/distributor/capabilities';

export interface UpgradePromptProps {
  /** Which capability the user just tried to access. */
  capability: DistributorCapability;
  /** Optional context the page can prepend (e.g. "You tried to upload"). */
  intro?: string;
  /** Where the user came from — Back link target. Optional. */
  backHref?: string;
  backLabel?: string;
}

/**
 * Polished upgrade CTA shown when a procurement-partner-tier
 * distributor tries to use a feature locked behind a full alka**tera**
 * subscription. Used both as a full page (for direct gated route hits)
 * and as an inline component (for buttons that route to it).
 *
 * The pitch leans on the alka**tera** brand identity — neon-lime
 * accents on the dark portal — and explicitly names what they'd unlock
 * plus everything else a full customer gets.
 */
export function UpgradePrompt({ capability, intro, backHref, backLabel }: UpgradePromptProps) {
  const label = CAPABILITY_LABELS[capability];
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {backLabel ?? 'Back'}
        </Link>
      ) : null}

      <div className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-card/80 to-card/80 p-10 sm:p-14 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 h-64 w-64 rounded-full bg-neon-lime/10 blur-3xl" />

        <div className="relative space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-full px-2.5 py-1">
              <Lock className="h-3 w-3" />
              Full alka<strong>tera</strong> feature
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              {label.title}
            </h1>
            {intro ? (
              <p
                className="text-base text-foreground/80"
                dangerouslySetInnerHTML={{ __html: intro }}
              />
            ) : null}
            <p
              className="text-sm text-muted-foreground max-w-xl leading-relaxed"
              dangerouslySetInnerHTML={{ __html: label.description }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <BenefitLine icon={Sparkles} title="Your portfolio, fully managed">
              Upload your complete distribution list, not only what a procurement client routes to you.
            </BenefitLine>
            <BenefitLine icon={Sparkles} title="Discover">
              Browse the global directory for brands you don't yet list. Pre-scraped sustainability signals included.
            </BenefitLine>
            <BenefitLine icon={Sparkles} title="Client-ready reports">
              Generate PDF and CSV exports for every buyer you serve, not just Foodbuy. Your branding.
            </BenefitLine>
            <BenefitLine icon={Sparkles} title="alka<strong>tera</strong> customer matching">
              Manual matching for ambiguous brand identities. High-confidence verified data, ready to use.
            </BenefitLine>
          </div>

          <div className="flex items-center gap-4 pt-4 flex-wrap">
            <a
              href="mailto:hello@alkatera.com?subject=Becoming%20a%20full%20alkatera%20customer"
              className="inline-flex items-center gap-2 rounded-lg bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold text-sm px-5 py-2.5 transition-colors"
            >
              Talk to alka<strong>tera</strong>
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="https://www.alkatera.com"
              target="_blank"
              rel="noopener"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              See what's included →
            </Link>
          </div>

          <div className="pt-6 border-t border-border/40 flex items-center gap-2 text-[11px] text-muted-foreground">
            <AlkaTeraIcon className="h-3.5 w-3.5 text-neon-emerald" />
            <span className="text-xs font-light text-foreground tracking-tight lowercase">
              alka<strong className="font-semibold">tera</strong>
            </span>
            <span>· You're on the procurement partner tier (free, while linked to a procurement client).</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitLine({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/30 backdrop-blur-sm p-4">
      <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5 shrink-0">
        <Icon className="h-3.5 w-3.5 text-sky-300" />
      </div>
      <div className="space-y-0.5">
        <div
          className="text-sm font-semibold text-foreground"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
