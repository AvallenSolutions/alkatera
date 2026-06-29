import type { BrandFootprintEstimate } from '@/lib/outreach/brand-footprint-estimate';

/**
 * Read-only, branded render of a personalised brand footprint report. Pure and
 * presentational: it takes a stored {@link BrandFootprintEstimate} snapshot and
 * a token, and draws the artefact a cold-outbound prospect sees at /r/[token].
 *
 * Inline styles (not Tailwind) keep it a self-contained, full-bleed artefact
 * that renders identically outside the app shell and in tests.
 */

const LIME = '#ccff00';
const BG = '#0a0a0a';
const PANEL = '#141414';
const BORDER = '#262626';
const TEXT = '#fafafa';
const MUTED = '#9ca3af';

const CONFIDENCE_LABEL: Record<BrandFootprintEstimate['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Indicative only',
};

function fmt(n: number, dp = 1): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

/** "alkatera" with "tera" in bold, per the brand rule. */
function Wordmark() {
  return (
    <span style={{ fontWeight: 400 }}>
      alka<strong style={{ fontWeight: 800 }}>tera</strong>
    </span>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '18px 20px',
        flex: '1 1 160px',
      }}
    >
      <p style={{ margin: 0, color: MUTED, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>
        {value}
        <span style={{ fontSize: 14, fontWeight: 500, color: MUTED, marginLeft: 6 }}>{unit}</span>
      </p>
    </div>
  );
}

export interface BrandReportViewProps {
  token: string;
  brandName: string;
  countryOfOrigin?: string | null;
  estimate: BrandFootprintEstimate;
}

export default function BrandReportView({
  token,
  brandName,
  countryOfOrigin,
  estimate,
}: BrandReportViewProps) {
  const rep = estimate.representativeBottle;

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 72px' }}>
        {/* Header */}
        <p style={{ margin: 0, color: LIME, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Estimated carbon footprint
        </p>
        <h1 style={{ margin: '10px 0 4px', fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>{brandName}</h1>
        <p style={{ margin: 0, color: MUTED, fontSize: 15 }}>
          {[estimate.category, countryOfOrigin].filter(Boolean).join(' · ') || 'Drinks brand'}
          <span
            style={{
              marginLeft: 10,
              padding: '2px 8px',
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              fontSize: 12,
              color: MUTED,
            }}
          >
            {CONFIDENCE_LABEL[estimate.confidence]}
          </span>
        </p>

        {/* Estimate framing — honest, prominent */}
        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            background: 'rgba(204,255,0,0.06)',
            border: `1px solid ${LIME}33`,
            borderRadius: 10,
            fontSize: 14,
            color: '#e5e7eb',
          }}
        >
          We built this estimate for you from public information and industry benchmarks. It is a
          starting point, not a measured result. Claim your profile to refine it with your own data.
        </div>

        {/* Headline metrics */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
          <Metric label="Per bottle" value={fmt(rep.kgCO2ePerBottle, 2)} unit={`kg CO₂e (${rep.containerSizeMl} ml)`} />
          <Metric label="Per litre" value={fmt(estimate.carbon.kgCO2ePerLitre, 2)} unit="kg CO₂e / L" />
          <Metric label="Water per bottle" value={fmt(rep.litresWaterPerBottle, 0)} unit="L" />
        </div>

        {/* Per-SKU breakdown */}
        {estimate.skus.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Your products</h2>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
              {estimate.skus.map((sku, i) => (
                <div
                  key={`${sku.name}-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                    background: i % 2 ? 'transparent' : PANEL,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{sku.name}</p>
                    <p style={{ margin: '2px 0 0', color: MUTED, fontSize: 12 }}>
                      {sku.containerSizeMl} ml{sku.containerAssumed ? ' (assumed)' : ''}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {fmt(sku.kgCO2ePerBottle, 2)} kg CO{'₂'}e
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Claim CTA — wired to the claim flow in Spec D */}
        <a
          href={`/r/${token}/claim`}
          style={{
            display: 'block',
            marginTop: 32,
            padding: '16px 20px',
            background: LIME,
            color: '#0a0a0a',
            fontWeight: 800,
            fontSize: 16,
            textAlign: 'center',
            borderRadius: 12,
            textDecoration: 'none',
          }}
        >
          Claim &amp; verify your profile
        </a>

        {/* Assumptions */}
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            How we estimated this
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', fontSize: 13, lineHeight: 1.7 }}>
            {estimate.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>

        {/* Sources */}
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Sources
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', fontSize: 13, lineHeight: 1.7 }}>
            <li>
              Carbon:{' '}
              <a href={estimate.carbon.source.url} style={{ color: LIME }} target="_blank" rel="noopener noreferrer">
                {estimate.carbon.source.name} ({estimate.carbon.source.year})
              </a>
            </li>
            <li>
              Water:{' '}
              <a href={estimate.water.source.url} style={{ color: LIME }} target="_blank" rel="noopener noreferrer">
                {estimate.water.source.name} ({estimate.water.source.year})
              </a>
            </li>
          </ul>
        </section>

        {/* Footer */}
        <p style={{ marginTop: 40, color: MUTED, fontSize: 13 }}>
          Footprint estimated by <Wordmark />
        </p>
      </div>
    </div>
  );
}
