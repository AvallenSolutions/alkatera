import type { DashboardData } from './dashboard';

const ALKATERA_LOGO =
  'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

export interface PortfolioPdfContext {
  /** Procurement org name (e.g. "Foodbuy"). */
  procurementName: string;
  /** Friendly display name shown on the cover (e.g. "Foodbuy"). */
  displayName: string;
  /** Optional parent company line. */
  parentCompany?: string | null;
  /** Cover title for the report — defaults to displayName + "Wine Sustainability Portfolio". */
  coverTitle?: string;
  /** Cover subtitle. */
  coverSubtitle?: string;
  /** PDF footer line (e.g. "Generated for Foodbuy procurement programme"). */
  footerText?: string | null;
  /** Hex accent colour for the cover bar / pull-quotes / pill backgrounds. */
  primaryColor?: string | null;
  /** Procurement logo URL — appears top-right on the cover and footer. */
  procurementLogoUrl?: string | null;
  /** Aggregated dashboard data — drives every section. */
  data: DashboardData;
  /** Optional date string (ISO) for the cover. Defaults to now. */
  generatedAt?: string;
}

const TIER_LABEL: Record<string, string> = {
  leader: 'Leader',
  progressing: 'Progressing',
  developing: 'Developing',
  insufficient: 'Insufficient',
  unknown: 'No data yet',
};

const TIER_COLOUR: Record<string, string> = {
  leader: '#059669',
  progressing: '#0d9488',
  developing: '#f59e0b',
  insufficient: '#ef4444',
  unknown: '#cbd5e1',
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function gbDate(input?: string): string {
  const d = input ? new Date(input) : new Date();
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Render an A4 portrait portfolio report as a complete HTML document.
 * Fed straight to PDFShift to produce a client-ready PDF.
 *
 * Sections:
 *   1. Cover with alka**tera** + procurement co-branding
 *   2. Headline stats — SKUs, brands, channels, leaders, coverage
 *   3. Channel breakdown with CSS bar chart
 *   4. Sustainability tier distribution
 *   5. Category mix
 *   6. Country of origin
 *   7. Top wins
 *   8. Top gaps
 *   9. Methodology footnote
 *
 * No JS — every chart is pure HTML/CSS so PDFShift renders deterministically.
 */
export function renderProcurementPortfolioHtml(ctx: PortfolioPdfContext): string {
  const { data } = ctx;
  const primary = ctx.primaryColor || '#3dbac6';
  const procurementLogo = ctx.procurementLogoUrl
    ? `<img src="${esc(ctx.procurementLogoUrl)}" alt="${esc(ctx.procurementName)}" class="proc-logo" />`
    : '';
  const coverTitle = ctx.coverTitle ?? `${ctx.displayName} sustainability portfolio`;
  const coverSubtitle = ctx.coverSubtitle ?? `Procurement programme . ${gbDate(ctx.generatedAt)}`;
  const footerText = ctx.footerText ?? `Generated for ${ctx.procurementName} procurement programme`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(coverTitle)}</title>
<style>
  ${baseCss(primary)}
</style>
</head>
<body>

  <section class="cover">
    <div class="cover-stripe"></div>
    <div class="cover-header">
      <img src="${ALKATERA_LOGO}" alt="alkatera" class="alk-logo" />
      ${procurementLogo}
    </div>
    <div class="cover-body">
      <div class="cover-pill">SUSTAINABILITY PORTFOLIO</div>
      <h1 class="cover-title">${esc(coverTitle)}</h1>
      <p class="cover-subtitle">${esc(coverSubtitle)}</p>
      ${ctx.parentCompany ? `<p class="cover-meta">${esc(ctx.parentCompany)}</p>` : ''}
    </div>
    <div class="cover-foot">
      <span>Powered by alka<strong>tera</strong></span>
      <span>${esc(gbDate(ctx.generatedAt))}</span>
    </div>
  </section>

  <section class="page">
    <h2 class="section-h">Portfolio overview</h2>
    <div class="stat-grid">
      ${statCard('SKUs', data.totals.sku_count.toLocaleString('en-GB'), 'Active across linked distributors')}
      ${statCard('Brands', data.totals.brand_count.toLocaleString('en-GB'), 'Distinct in portfolio')}
      ${statCard('Channels', data.totals.channel_count.toLocaleString('en-GB'), 'Supplying distributors')}
      ${statCard('Leaders', data.totals.leader_count.toLocaleString('en-GB'), 'Tier 1 brands')}
      ${statCard('Coverage', data.totals.coverage_pct > 0 ? `${data.totals.coverage_pct.toFixed(1)}%` : '—', 'Avg completeness')}
    </div>

    <h2 class="section-h">Channel split</h2>
    <p class="section-p">Procurement SKUs sourced through each distributor channel.</p>
    ${cssBarChart(
      data.channels.map((c) => ({
        label: c.channel,
        value: c.sku_count,
        sub: `${c.brand_count} brands · ${Math.round(c.volume_liters).toLocaleString('en-GB')} L/yr`,
      })),
      'No channel data yet',
      primary,
    )}

    <h2 class="section-h">Sustainability tier distribution</h2>
    <p class="section-p">Distinct brands grouped by their sustainability tier.</p>
    ${tierChart(data.tiers)}
  </section>

  <section class="page">
    <h2 class="section-h">Coverage by completeness band</h2>
    <p class="section-p">How well-evidenced each brand's sustainability profile is.</p>
    ${cssBarChart(
      data.completeness_bands.map((b) => ({ label: b.label, value: b.count })),
      'No coverage data yet',
      primary,
    )}

    <h2 class="section-h">Category mix</h2>
    ${cssBarChart(
      data.categories.slice(0, 10).map((c) => ({ label: c.category, value: c.sku_count })),
      'No category data yet',
      primary,
    )}

    <h2 class="section-h">Country of origin</h2>
    ${cssBarChart(
      data.countries.slice(0, 10).map((c) => ({
        label: c.country,
        value: c.sku_count,
        sub: `${c.brand_count} brands`,
      })),
      'No country data yet',
      primary,
    )}
  </section>

  <section class="page">
    <h2 class="section-h">Top wins</h2>
    <p class="section-p">Highest-scoring brands in the portfolio. Lean on these in client storytelling.</p>
    ${brandList(data.top_wins, 'No leader-tier brands yet. Outreach will surface them.', false, primary)}

    <h2 class="section-h">Top gaps</h2>
    <p class="section-p">Highest-volume brands with the lowest data coverage. Outreach priority.</p>
    ${brandList(data.top_gaps, 'No coverage gaps. Every brand has full data on file.', true, primary)}

    <h2 class="section-h">Methodology</h2>
    <p class="section-p methodology">
      The tier model counts verifiable sustainability signals per brand (carbon negativity,
      EPDs, renewable energy, B Corp, ISO 14001, net-zero commitments, and similar).
      Three or more signals on environment, social and governance pillars combined puts a
      brand in Leader; fewer signals progress through Progressing, Developing and Insufficient.
      Completeness reflects the proportion of weighted fields with verified or high-confidence
      values on file. Procurement views filter scraped findings to confidence ≥ 60% so
      lower-confidence claims never reach client-facing reports without manual confirmation.
    </p>
  </section>

  <footer class="pdf-footer">${esc(footerText)}</footer>
</body>
</html>`;
}

function statCard(label: string, value: string, hint: string): string {
  return `<div class="stat">
    <div class="stat-label">${esc(label)}</div>
    <div class="stat-value">${esc(value)}</div>
    <div class="stat-hint">${esc(hint)}</div>
  </div>`;
}

function cssBarChart(
  rows: Array<{ label: string; value: number; sub?: string }>,
  emptyText: string,
  primary: string,
): string {
  if (rows.length === 0 || rows.every((r) => r.value === 0)) {
    return `<p class="empty">${esc(emptyText)}</p>`;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<div class="bars">
    ${rows
      .map(
        (r) => `<div class="bar">
        <div class="bar-row">
          <span class="bar-label">${esc(r.label)}</span>
          <span class="bar-value">${esc(r.value.toLocaleString('en-GB'))}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(r.value / max) * 100}%;background:${primary}"></div>
        </div>
        ${r.sub ? `<div class="bar-sub">${esc(r.sub)}</div>` : ''}
      </div>`,
      )
      .join('')}
  </div>`;
}

function tierChart(tiers: DashboardData['tiers']): string {
  const visible = tiers.filter((t) => t.brand_count > 0);
  if (visible.length === 0) {
    return `<p class="empty">No tier data yet.</p>`;
  }
  const max = Math.max(...visible.map((t) => t.brand_count), 1);
  return `<div class="bars">
    ${visible
      .map(
        (t) => `<div class="bar">
        <div class="bar-row">
          <span class="bar-label">${esc(TIER_LABEL[t.tier])}</span>
          <span class="bar-value">${t.brand_count} brand${t.brand_count === 1 ? '' : 's'} . ${t.sku_count} SKUs</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(t.brand_count / max) * 100}%;background:${TIER_COLOUR[t.tier]}"></div>
        </div>
      </div>`,
      )
      .join('')}
  </div>`;
}

function brandList(
  brands: DashboardData['top_wins'],
  emptyText: string,
  showVolume: boolean,
  primary: string,
): string {
  if (brands.length === 0) {
    return `<p class="empty">${esc(emptyText)}</p>`;
  }
  return `<table class="brand-table">
    <thead>
      <tr>
        <th>Brand</th>
        <th>Category</th>
        <th>Country</th>
        <th>Channels</th>
        <th>${showVolume ? 'Volume / yr' : 'Score'}</th>
        <th>Tier</th>
      </tr>
    </thead>
    <tbody>
      ${brands
        .map((b) => {
          const tier = b.score_tier ?? 'unknown';
          return `<tr>
          <td><strong>${esc(b.name)}</strong></td>
          <td>${esc(b.category ?? '—')}</td>
          <td>${esc(b.country_of_origin ?? '—')}</td>
          <td>${esc(b.channels.join(' / '))}</td>
          <td>${
            showVolume
              ? `${Math.round(b.volume_liters).toLocaleString('en-GB')} L`
              : (b.sustainability_score != null ? Math.round(b.sustainability_score) : '—')
          }</td>
          <td>
            <span class="tier-pill" style="background:${TIER_COLOUR[tier]}1a;color:${TIER_COLOUR[tier]};border-color:${TIER_COLOUR[tier]}55">
              ${esc(TIER_LABEL[tier])}
            </span>
          </td>
        </tr>`;
        })
        .join('')}
    </tbody>
  </table>`;
}

function baseCss(primary: string): string {
  return `
    @page { size: A4 portrait; margin: 18mm 14mm 22mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 10pt; line-height: 1.5; }

    .cover {
      page-break-after: always;
      min-height: 250mm;
      padding: 0 6mm 12mm 6mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .cover-stripe {
      height: 4mm;
      background: ${primary};
      margin: -4mm -6mm 14mm -6mm;
    }
    .cover-header { display: flex; justify-content: space-between; align-items: center; padding: 0 6mm; }
    .alk-logo { height: 12mm; }
    .proc-logo { height: 18mm; max-width: 60mm; object-fit: contain; }
    .cover-body { padding: 0 6mm; margin-top: 60mm; }
    .cover-pill {
      display: inline-block;
      font-size: 9pt;
      letter-spacing: 0.3em;
      color: ${primary};
      background: ${primary}15;
      border: 1px solid ${primary}55;
      padding: 4pt 10pt;
      border-radius: 999px;
      margin-bottom: 12pt;
      text-transform: uppercase;
      font-weight: 600;
    }
    .cover-title { font-size: 32pt; line-height: 1.15; margin: 0 0 8pt 0; font-weight: 600; color: #0f172a; }
    .cover-subtitle { font-size: 12pt; color: #475569; margin: 0 0 6pt 0; }
    .cover-meta { font-size: 11pt; color: #94a3b8; margin: 4pt 0 0 0; }
    .cover-foot {
      padding: 0 6mm;
      font-size: 9pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }

    .page { page-break-after: always; padding-top: 6mm; }
    .page:last-of-type { page-break-after: auto; }
    .section-h { font-size: 14pt; margin: 14pt 0 6pt 0; color: #0f172a; font-weight: 600; }
    .section-h:first-child { margin-top: 0; }
    .section-p { font-size: 9.5pt; color: #475569; margin: 0 0 10pt 0; }

    .stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6pt; margin-bottom: 12pt; }
    .stat { border: 1px solid #e2e8f0; border-radius: 6pt; padding: 8pt; background: #ffffff; }
    .stat-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; font-weight: 600; }
    .stat-value { font-size: 18pt; font-weight: 600; color: #0f172a; margin: 4pt 0 2pt 0; }
    .stat-hint { font-size: 8pt; color: #94a3b8; }

    .bars { margin: 0 0 14pt 0; }
    .bar { margin-bottom: 8pt; }
    .bar-row { display: flex; justify-content: space-between; font-size: 9.5pt; color: #0f172a; margin-bottom: 3pt; }
    .bar-label { font-weight: 500; }
    .bar-value { color: #475569; font-variant-numeric: tabular-nums; }
    .bar-track { height: 6pt; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; }
    .bar-sub { font-size: 8pt; color: #94a3b8; margin-top: 2pt; }

    .brand-table { width: 100%; border-collapse: collapse; margin: 0 0 14pt 0; }
    .brand-table th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; padding: 6pt 4pt; border-bottom: 1pt solid #e2e8f0; font-weight: 600; }
    .brand-table td { font-size: 9pt; padding: 6pt 4pt; border-bottom: 1pt solid #f1f5f9; color: #334155; }
    .brand-table strong { color: #0f172a; }
    .tier-pill { display: inline-block; font-size: 8pt; padding: 2pt 6pt; border: 1pt solid; border-radius: 999px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }

    .empty { font-size: 9.5pt; color: #94a3b8; font-style: italic; margin: 0 0 12pt 0; }
    .methodology { font-size: 8.5pt; color: #475569; line-height: 1.6; }

    .pdf-footer { position: fixed; bottom: 6mm; left: 14mm; right: 14mm; font-size: 8pt; color: #94a3b8; text-align: center; }
  `;
}
