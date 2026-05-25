import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';

export interface CertificationFinding {
  field_key: string;
  label: string;
  is_certified: boolean | null;
  source_url: string | null;
}

interface Props {
  brandName: string;
  certifications: CertificationFinding[];
}

/**
 * Brand-detail panel that groups every certification FieldKey into one
 * place, rather than scattering them across the generic Data tab.
 * Certified rows light up; unchecked / negative rows stay greyed.
 * Source URL surfaces as a small external-link icon when present.
 */
export function BrandCertificationsPanel({ brandName, certifications }: Props) {
  // Sort: certified first, then label.
  const sorted = [...certifications].sort((a, b) => {
    if (!!a.is_certified !== !!b.is_certified) {
      return a.is_certified ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
  const certifiedCount = sorted.filter((c) => c.is_certified === true).length;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">
          Certifications
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
            {certifiedCount} of {sorted.length} confirmed for {brandName}
          </span>
        </div>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sorted.map((c) => (
          <li
            key={c.field_key}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              c.is_certified === true
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                : c.is_certified === false
                  ? 'border-border/60 bg-background/40 text-muted-foreground/80'
                  : 'border-dashed border-border/40 bg-background/20 text-muted-foreground/60'
            }`}
          >
            {c.is_certified === true ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            <span className="flex-1 truncate">{c.label}</span>
            {c.source_url && (
              <a
                href={c.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-neon-lime shrink-0"
                title="View source"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
