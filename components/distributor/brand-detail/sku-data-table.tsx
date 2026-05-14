import { FIELD_DEFINITIONS, type FieldKey, type Pillar } from '@/lib/distributor/scraping/field-definitions';
import { Badge } from '@/components/ui/badge';

export interface SkuDataRow {
  field_key: FieldKey;
  value: string | null;
  numeric: number | null;
  source: string | null;
  confidence: number | null;
  updated_at: string | null;
  /** True if this finding is attributed to the specific SKU; false = inherited from the brand. */
  is_sku_specific: boolean;
}

interface Props {
  rows: SkuDataRow[];
}

const PILLAR_ORDER: Pillar[] = ['carbon', 'water', 'packaging', 'agriculture', 'governance', 'corporate'];

const PILLAR_LABELS: Record<Pillar, string> = {
  carbon: 'Carbon',
  water: 'Water',
  packaging: 'Packaging',
  agriculture: 'Agriculture & ingredients',
  governance: 'Governance & certification',
  corporate: 'Corporate',
};

/**
 * Per-SKU data view. Same visual pattern as DataStatusTable but each
 * row shows whether the finding is specific to this SKU or inherited
 * from the brand. SKU-specific findings always take precedence over
 * brand-level when both exist for the same field.
 */
export function SkuDataTable({ rows }: Props) {
  const byKey = new Map(rows.map((r) => [r.field_key, r]));

  return (
    <div className="space-y-8">
      {PILLAR_ORDER.map((pillar) => {
        const pillarFields = FIELD_DEFINITIONS.filter((f) => f.pillar === pillar);
        if (pillarFields.length === 0) return null;
        return (
          <section key={pillar}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">
              {PILLAR_LABELS[pillar]}
            </div>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Field</th>
                    <th className="text-left px-4 py-2 font-medium">Value</th>
                    <th className="text-left px-4 py-2 font-medium">Scope</th>
                    <th className="text-left px-4 py-2 font-medium">Source</th>
                    <th className="text-left px-4 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {pillarFields.map((def) => {
                    const row = byKey.get(def.key);
                    return (
                      <tr key={def.key} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{def.label}</td>
                        <td className="px-4 py-2">{renderValue(row, def.type)}</td>
                        <td className="px-4 py-2">{renderScope(row)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row?.source ?? '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground">
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

function renderValue(row: SkuDataRow | undefined, type: string): React.ReactNode {
  if (!row || row.value == null || row.value === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  if (type === 'boolean') {
    if (row.value === 'true' || row.numeric === 1) return <span className="text-emerald-300">✓ Yes</span>;
    if (row.value === 'false' || row.numeric === 0) return <span className="text-muted-foreground">No</span>;
  }
  if (type === 'longtext') {
    const preview = row.value.length > 120 ? `${row.value.slice(0, 120).trim()}…` : row.value;
    return (
      <span className="text-muted-foreground italic" title={row.value}>
        {preview}
      </span>
    );
  }
  return <span>{row.value}</span>;
}

function renderScope(row: SkuDataRow | undefined): React.ReactNode {
  if (!row) return <span className="text-muted-foreground text-xs">—</span>;
  if (row.is_sku_specific) {
    return (
      <Badge variant="outline" className="text-xs text-sky-300 border-sky-400/40 bg-sky-400/10">
        Specific to this product
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
      Inherited from brand
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
