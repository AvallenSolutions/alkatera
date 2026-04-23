/**
 * Pulse -- Insight share renderer.
 *
 * One HTML template feeds both the email body (Resend) and the PDF body
 * (PDFShift). Keeping a single template means recipients of either channel
 * see the same layout and copy. Inline styles only -- email clients ignore
 * <link>/<style> in the head sporadically, so we treat email and PDF the
 * same way.
 *
 * The template is intentionally narrow (640px) to render well in both Gmail
 * and an A4 PDF page.
 */

export interface InsightShareData {
  organisation_name: string;
  headline: string;
  narrative_md: string;
  generated_at: string;
  period: 'daily' | 'weekly';
  model?: string | null;
  /** Optional supporting metrics dump from dashboard_insights.supporting_metrics. */
  supporting_metrics?: Record<string, unknown> | null;
  /** Where the recipient can view this insight in-app. */
  app_url?: string | null;
  /** Optional sender note prepended above the headline. */
  message?: string | null;
}

const BRAND_GREEN = '#ccff00';
const INK = '#0a0a0a';
const SOFT = '#525960';

/** Convert a small subset of markdown to safe HTML. Headings, bold, lists. */
function renderNarrative(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold.
  let html = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Bullets (lines starting with -, *, or •).
  const lines = html.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed)) {
      if (!inList) { out.push('<ul style="margin:8px 0 8px 18px;padding:0;">'); inList = true; }
      out.push(`<li style="margin:4px 0;">${trimmed.replace(/^[-*•]\s+/, '')}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      if (trimmed.length === 0) {
        out.push('<div style="height:8px;"></div>');
      } else {
        out.push(`<p style="margin:8px 0;line-height:1.55;">${trimmed}</p>`);
      }
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

export function renderInsightShareHtml(data: InsightShareData): string {
  const generated = new Date(data.generated_at).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const supportingBlock = renderSupportingMetrics(data.supporting_metrics);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeAttr(data.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- header strip -->
        <tr><td style="background:${INK};padding:18px 28px;color:#ffffff;">
          <table width="100%"><tr>
            <td style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRAND_GREEN};font-weight:600;">
              alka<span style="font-weight:800;">tera</span> Pulse
            </td>
            <td align="right" style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">
              ${data.period === 'weekly' ? 'Weekly brief' : 'Daily brief'}
            </td>
          </tr></table>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:28px;">
          ${data.message ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:14px;color:${SOFT};line-height:1.5;">${escapeText(data.message)}</div>` : ''}

          <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${SOFT};">
            ${escapeText(data.organisation_name)} -- ${escapeText(generated)}
          </p>
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:${INK};">
            ${escapeText(data.headline)}
          </h1>

          <div style="font-size:14px;color:#1f2933;">
            ${renderNarrative(data.narrative_md)}
          </div>

          ${supportingBlock}

          ${data.app_url ? `
          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;">
            <a href="${escapeAttr(data.app_url)}" style="display:inline-block;background:${INK};color:${BRAND_GREEN};font-weight:600;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:6px;letter-spacing:0.5px;">
              Open in Pulse &rarr;
            </a>
          </div>` : ''}

          <p style="margin:24px 0 0;font-size:11px;color:${SOFT};line-height:1.5;">
            Generated by ${data.model ?? 'alkatera Pulse'}.
            Confidence and methodology are visible inside the app.
          </p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;">
        You're seeing this because someone in your organisation shared a Pulse insight with you.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderSupportingMetrics(supporting: Record<string, unknown> | null | undefined): string {
  if (!supporting) return '';
  const snapshots = Array.isArray((supporting as any).snapshots)
    ? (supporting as any).snapshots as Array<{ metric_key: string; current: number; unit: string; delta_pct: number | null }>
    : [];
  if (snapshots.length === 0) return '';

  const rows = snapshots.slice(0, 6).map(s => {
    const delta = s.delta_pct === null
      ? '-'
      : `${s.delta_pct > 0 ? '+' : ''}${s.delta_pct.toFixed(1)}%`;
    const deltaColour = s.delta_pct === null
      ? SOFT
      : s.delta_pct > 0 ? '#b91c1c' : '#047857';
    return `<tr>
      <td style="padding:6px 8px;border-top:1px solid #e2e8f0;font-size:12px;color:${INK};">${escapeText(s.metric_key)}</td>
      <td style="padding:6px 8px;border-top:1px solid #e2e8f0;font-size:12px;color:${INK};text-align:right;">${formatNumber(s.current)} <span style="color:${SOFT};">${escapeText(s.unit)}</span></td>
      <td style="padding:6px 8px;border-top:1px solid #e2e8f0;font-size:12px;color:${deltaColour};text-align:right;font-weight:600;">${delta}</td>
    </tr>`;
  }).join('');

  return `
    <div style="margin-top:22px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background:#f8fafc;padding:8px 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${SOFT};font-weight:600;">
        Supporting metrics
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
      </table>
    </div>`;
}

function escapeText(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}
