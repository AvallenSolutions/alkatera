import Link from 'next/link';
import { AlertTriangle, Mail, MailQuestion, Database, ArrowRight, CheckCircle2 } from 'lucide-react';

export type ActionItem =
  | { type: 'conflict'; brand_id: string; brand_name: string; count: number }
  | { type: 'stale_outreach'; brand_id: string; brand_name: string; days: number }
  | { type: 'no_outreach_email'; brand_id: string; brand_name: string }
  | { type: 'zero_completeness'; brand_id: string; brand_name: string };

interface Props {
  items: ActionItem[];
}

export function ActionQueue({ items }: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
          <AlertTriangle className="h-4 w-4 text-sky-300" />
        </div>
        <div className="text-sm font-semibold">Needs attention</div>
      </div>
      <div className="px-5 pb-5">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Nothing needs you right now. Nice work.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((item, i) => {
              const tone = toneFor(item);
              return (
                <li
                  key={`${item.type}-${item.brand_id}-${i}`}
                  className="py-3 flex items-center gap-3 group"
                >
                  <div className={`rounded-md border p-1.5 shrink-0 ${tone.chipBg} ${tone.chipBorder}`}>
                    <Icon item={item} className={`h-4 w-4 ${tone.iconColour}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium truncate">{item.brand_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{describe(item)}</div>
                  </div>
                  <Link
                    href={hrefFor(item)}
                    className="text-xs font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap flex items-center gap-1 transition-colors"
                  >
                    {ctaFor(item)} <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Icon({ item, className }: { item: ActionItem; className: string }) {
  if (item.type === 'conflict') return <AlertTriangle className={className} />;
  if (item.type === 'stale_outreach') return <Mail className={className} />;
  if (item.type === 'no_outreach_email') return <MailQuestion className={className} />;
  return <Database className={className} />;
}

function toneFor(item: ActionItem): {
  iconColour: string;
  chipBg: string;
  chipBorder: string;
} {
  if (item.type === 'conflict' || item.type === 'stale_outreach') {
    return {
      iconColour: 'text-amber-300',
      chipBg: 'bg-amber-500/15',
      chipBorder: 'border-amber-400/30',
    };
  }
  return {
    iconColour: 'text-muted-foreground',
    chipBg: 'bg-muted/40',
    chipBorder: 'border-border/60',
  };
}

function describe(item: ActionItem): string {
  switch (item.type) {
    case 'conflict':
      return `${item.count} data conflict${item.count === 1 ? '' : 's'} to review`;
    case 'stale_outreach':
      return `Outreach sent ${item.days} days ago, no response`;
    case 'no_outreach_email':
      return 'No outreach email on file';
    case 'zero_completeness':
      return 'No sustainability data discovered yet';
  }
}

function ctaFor(item: ActionItem): string {
  switch (item.type) {
    case 'conflict':
      return 'Resolve';
    case 'stale_outreach':
      return 'Remind';
    case 'no_outreach_email':
      return 'Set email';
    case 'zero_completeness':
      return 'Open';
  }
}

function hrefFor(item: ActionItem): string {
  if (item.type === 'conflict') return `/distributor/brands/${item.brand_id}/conflicts`;
  if (item.type === 'stale_outreach') return `/distributor/outreach`;
  return `/distributor/brands/${item.brand_id}`;
}
