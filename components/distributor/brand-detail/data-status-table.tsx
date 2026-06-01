import {
  Cloud,
  Droplets,
  Recycle,
  Leaf,
  Users,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  FIELD_DEFINITIONS,
  type FieldKey,
} from '@/lib/distributor/scraping/field-definitions';
import { pillarForField, type PillarKey } from '@/lib/sustainability/pillars';
import { Badge } from '@/components/ui/badge';

export interface DataStatusRow {
  field_key: FieldKey;
  value: string | null;
  numeric: number | null;
  source: string | null;
  confidence: number | null;
  updated_at: string | null;
}

interface Props {
  rows: DataStatusRow[];
}

// Six canonical ESG pillars, shared with the procurement portal.
const PILLAR_ORDER: PillarKey[] = [
  'climate',
  'water',
  'circularity',
  'nature',
  'social',
  'governance',
];

const PILLAR_META: Record<
  PillarKey,
  { label: string; icon: LucideIcon; chipBg: string; chipText: string; chipBorder: string; bar: string }
> = {
  climate: {
    label: 'Climate',
    icon: Cloud,
    chipBg: 'bg-emerald-500/10',
    chipText: 'text-emerald-300',
    chipBorder: 'border-emerald-400/30',
    bar: 'bg-gradient-to-b from-emerald-400 to-emerald-500/40',
  },
  water: {
    label: 'Water',
    icon: Droplets,
    chipBg: 'bg-cyan-500/10',
    chipText: 'text-cyan-300',
    chipBorder: 'border-cyan-400/30',
    bar: 'bg-gradient-to-b from-cyan-400 to-cyan-500/40',
  },
  circularity: {
    label: 'Circularity',
    icon: Recycle,
    chipBg: 'bg-amber-500/10',
    chipText: 'text-amber-300',
    chipBorder: 'border-amber-400/30',
    bar: 'bg-gradient-to-b from-amber-400 to-amber-500/40',
  },
  nature: {
    label: 'Nature',
    icon: Leaf,
    chipBg: 'bg-teal-500/10',
    chipText: 'text-teal-300',
    chipBorder: 'border-teal-400/30',
    bar: 'bg-gradient-to-b from-teal-400 to-teal-500/40',
  },
  social: {
    label: 'Social',
    icon: Users,
    chipBg: 'bg-rose-500/10',
    chipText: 'text-rose-300',
    chipBorder: 'border-rose-400/30',
    bar: 'bg-gradient-to-b from-rose-400 to-rose-500/40',
  },
  governance: {
    label: 'Governance',
    icon: ShieldCheck,
    chipBg: 'bg-indigo-500/10',
    chipText: 'text-indigo-300',
    chipBorder: 'border-indigo-400/30',
    bar: 'bg-gradient-to-b from-indigo-400 to-indigo-500/40',
  },
};

/**
 * Field-by-field status table, grouped by pillar. Each pillar gets a
 * coloured icon chip in the header and an accent bar on the left to
 * match the alka**tera** main design + the brand-upload review portal.
 */
export function DataStatusTable({ rows }: Props) {
  const byKey = new Map(rows.map((r) => [r.field_key, r]));

  return (
    <div className="space-y-5">
      {PILLAR_ORDER.map((pillar) => {
        const pillarFields = FIELD_DEFINITIONS.filter((f) => pillarForField(f.key) === pillar);
        if (pillarFields.length === 0) return null;
        const meta = PILLAR_META[pillar];
        const Icon = meta.icon;
        const populated = pillarFields.filter(
          (f) => (byKey.get(f.key)?.value ?? null) != null && byKey.get(f.key)?.value !== '',
        ).length;
        return (
          <section
            key={pillar}
            className="relative rounded-xl border border-border/60 bg-card/40 overflow-hidden"
          >
            <div className={`absolute inset-y-0 left-0 w-[3px] ${meta.bar}`} />
            <div className="flex items-center justify-between gap-3 pl-6 pr-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg border ${meta.chipBg} ${meta.chipBorder} p-2`}>
                  <Icon className={`h-4 w-4 ${meta.chipText}`} />
                </div>
                <div className="text-sm font-semibold">{meta.label}</div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold tabular-nums">
                {populated} / {pillarFields.length} populated
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr className="bg-background/30 border-b border-border/40">
                    <th className="text-left px-5 py-2.5">Field</th>
                    <th className="text-left px-4 py-2.5">Value</th>
                    <th className="text-left px-4 py-2.5">Source</th>
                    <th className="text-left px-4 py-2.5">Confidence</th>
                    <th className="text-left px-4 py-2.5">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {pillarFields.map((def) => {
                    const row = byKey.get(def.key);
                    const hasValue = !!row?.value;
                    return (
                      <tr
                        key={def.key}
                        className="border-b border-border/30 last:border-b-0 hover:bg-sky-500/5 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                hasValue ? 'bg-foreground/50' : 'border border-border bg-transparent'
                              }`}
                            />
                            {def.label}
                          </div>
                        </td>
                        <td className="px-4 py-3">{renderValue(row, def.type)}</td>
                        <td className="px-4 py-3">{renderSource(row?.source, row?.confidence)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {row?.confidence != null ? `${Math.round(row.confidence * 100)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {row?.updated_at ? formatRelative(row.updated_at) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function renderValue(row: DataStatusRow | undefined, type: string): React.ReactNode {
  if (!row || row.value == null || row.value === '') {
    return <span className="text-muted-foreground italic">—</span>;
  }
  if (type === 'boolean') {
    if (row.value === 'true' || row.numeric === 1) {
      return <span className="text-emerald-300 font-medium">✓ Yes</span>;
    }
    if (row.value === 'false' || row.numeric === 0) {
      return <span className="text-muted-foreground">No</span>;
    }
  }
  if (type === 'longtext') {
    const preview = row.value.length > 120 ? `${row.value.slice(0, 120).trim()}…` : row.value;
    return (
      <span className="text-muted-foreground italic" title={row.value}>
        {preview}
      </span>
    );
  }
  return <span className="tabular-nums">{row.value}</span>;
}

function renderSource(
  source: string | null | undefined,
  confidence: number | null | undefined,
): React.ReactNode {
  if (!source) return <span className="text-muted-foreground text-xs italic">Missing</span>;

  const isOfficial =
    confidence != null &&
    confidence >= 0.9 &&
    ['B Corp Directory', 'Carbon Trust Certification', 'Companies House UK'].includes(source);
  const isBrandUpload = source === 'brand_upload';
  const isBrandVerified = source === 'brand_verified';
  const isAlkateraLive = source === 'alkatera_live';
  const isLowConfidence =
    confidence != null &&
    confidence < 0.8 &&
    !isOfficial &&
    !isBrandUpload &&
    !isBrandVerified &&
    !isAlkateraLive;

  if (isBrandVerified) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider font-semibold text-sky-200 border-sky-400/40 bg-sky-500/15"
      >
        Verified by brand
      </Badge>
    );
  }
  if (isAlkateraLive) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider font-semibold text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
      >
        alkatera live
      </Badge>
    );
  }
  if (isOfficial) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider font-semibold text-sky-200 border-sky-400/40 bg-sky-500/15"
      >
        {source}
      </Badge>
    );
  }
  if (isBrandUpload) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider font-semibold text-sky-300 border-sky-400/30"
      >
        Brand upload
      </Badge>
    );
  }
  if (isLowConfidence) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider font-semibold text-amber-300 border-amber-500/30"
      >
        {source}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-muted"
    >
      {source}
    </Badge>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
