import type { CSSProperties } from 'react';
import type { BrandFootprintEstimate } from '@/lib/outreach/brand-footprint-estimate';

/**
 * Read-only, branded render of a personalised brand footprint report. Pure and
 * presentational: it takes a stored {@link BrandFootprintEstimate} snapshot and
 * a token, and draws the artefact a cold-outbound prospect sees at /r/[token].
 *
 * Inline styles (not Tailwind) keep it a self-contained, full-bleed artefact
 * that renders identically outside the app shell and in tests. Styled as a
 * studio poster: paper ground, cream panels, one forest accent block.
 */

const PAPER = '#ECEAE3';
const CREAM = '#F2F1EA';
const HAIRLINE = '#D9D6CB';
const DIM = '#6F6F68';
const INK = '#1A1B1D';
const FOREST = '#205E40';

const DISPLAY = 'var(--font-display), "Bricolage Grotesque", system-ui, sans-serif';
const MONO = 'var(--font-data), "JetBrains Mono", monospace';
const BODY = 'var(--font-body), Inter, system-ui, sans-serif';

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
    <span style={{ fontWeight: 400, fontFamily: DISPLAY, color: INK }}>
      alka<strong style={{ fontWeight: 700 }}>tera</strong>
    </span>
  );
}

/** A mono caps eyebrow / section label. */
function monoLabel(extra?: CSSProperties): CSSProperties {
  return {
    fontFamily: MONO,
    fontWeight: 700,
    fontSize: 9.5,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    ...extra,
  };
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      style={{
        background: CREAM,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 6,
        padding: '18px 20px',
        flex: '1 1 160px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 30,
          fontWeight: 700,
          color: INK,
          lineHeight: 1.05,
          fontFamily: DISPLAY,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
        <span style={{ fontSize: 13, fontWeight: 500, color: DIM, marginLeft: 6, fontFamily: BODY, letterSpacing: 0 }}>
          {unit}
        </span>
      </p>
      <p style={{ ...monoLabel({ color: INK, opacity: 0.7 }), margin: '8px 0 0' }}>{label}</p>
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
    <div style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: BODY }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 72px' }}>
        {/* Statement header */}
        <p style={{ ...monoLabel({ color: FOREST, fontSize: 10.5 }), margin: 0 }}>
          Estimated carbon footprint
        </p>
        <h1
          style={{
            margin: '12px 0 6px',
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 0.95,
            fontFamily: DISPLAY,
            letterSpacing: '-0.035em',
          }}
        >
          {brandName}.
        </h1>
        <p style={{ margin: 0, color: DIM, fontSize: 15 }}>
          {[estimate.category, countryOfOrigin].filter(Boolean).join(' · ') || 'Drinks brand'}
          <span style={{ ...monoLabel({ color: DIM }), marginLeft: 12 }}>
            {CONFIDENCE_LABEL[estimate.confidence]}
          </span>
        </p>

        {/* Estimate framing — honest, prominent */}
        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            background: CREAM,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 6,
            fontSize: 14,
            lineHeight: 1.6,
            color: INK,
          }}
        >
          We built this estimate for you from public information and industry benchmarks. It is a
          starting point, not a measured result. Claim your profile to refine it with your own data.
        </div>

        {/* Headline metrics: big numbers over mono labels */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
          <Metric label="Per bottle" value={fmt(rep.kgCO2ePerBottle, 2)} unit={`kg CO₂e (${rep.containerSizeMl} ml)`} />
          <Metric label="Per litre" value={fmt(estimate.carbon.kgCO2ePerLitre, 2)} unit="kg CO₂e / L" />
          <Metric label="Water per bottle" value={fmt(rep.litresWaterPerBottle, 0)} unit="L" />
        </div>

        {/* Per-SKU breakdown */}
        {estimate.skus.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                margin: '0 0 12px',
                fontFamily: DISPLAY,
                letterSpacing: '-0.02em',
              }}
            >
              Your products.
            </h2>
            <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 6, overflow: 'hidden', background: CREAM }}>
              {estimate.skus.map((sku, i) => (
                <div
                  key={`${sku.name}-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderTop: i === 0 ? 'none' : `1px solid ${HAIRLINE}`,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, fontFamily: DISPLAY }}>{sku.name}</p>
                    <p style={{ margin: '2px 0 0', color: DIM, fontSize: 11, fontFamily: MONO }}>
                      {sku.containerSizeMl} ml{sku.containerAssumed ? ' (assumed)' : ''}
                    </p>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      fontFamily: DISPLAY,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(sku.kgCO2ePerBottle, 2)} kg CO{'₂'}e
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Claim CTA — the one saturated block. Wired to the claim flow in Spec D. */}
        <a
          href={`/r/${token}/claim`}
          style={{
            display: 'block',
            marginTop: 32,
            padding: '18px 20px',
            background: FOREST,
            color: CREAM,
            fontWeight: 700,
            fontSize: 17,
            fontFamily: DISPLAY,
            letterSpacing: '-0.01em',
            textAlign: 'center',
            borderRadius: 6,
            textDecoration: 'none',
          }}
        >
          Claim &amp; verify your profile.
        </a>

        {/* Assumptions */}
        <section style={{ marginTop: 32 }}>
          <h2 style={{ ...monoLabel({ color: DIM, fontSize: 10.5 }), margin: '0 0 8px' }}>
            How we estimated this
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: INK, fontSize: 13, lineHeight: 1.7 }}>
            {estimate.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>

        {/* Sources */}
        <section style={{ marginTop: 24 }}>
          <h2 style={{ ...monoLabel({ color: DIM, fontSize: 10.5 }), margin: '0 0 8px' }}>
            Sources
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: INK, fontSize: 13, lineHeight: 1.7 }}>
            <li>
              Carbon:{' '}
              <a href={estimate.carbon.source.url} style={{ color: FOREST }} target="_blank" rel="noopener noreferrer">
                {estimate.carbon.source.name} ({estimate.carbon.source.year})
              </a>
            </li>
            <li>
              Water:{' '}
              <a href={estimate.water.source.url} style={{ color: FOREST }} target="_blank" rel="noopener noreferrer">
                {estimate.water.source.name} ({estimate.water.source.year})
              </a>
            </li>
          </ul>
        </section>

        {/* Footer */}
        <p style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${HAIRLINE}`, color: DIM, fontSize: 13 }}>
          Footprint estimated by <Wordmark />
        </p>
      </div>
    </div>
  );
}
