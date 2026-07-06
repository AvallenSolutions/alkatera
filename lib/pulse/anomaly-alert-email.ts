/**
 * Pulse — branded anomaly alert email.
 *
 * Inline-styled HTML modelled on insight-share.ts so Gmail, Apple Mail,
 * and Outlook render consistently. 640px wide, table-based layout.
 */

import { METRIC_DEFINITIONS, type MetricKey } from './metric-keys';

export interface AnomalyAlertItem {
  metric_key: string;
  observed: number;
  expected: number;
  z_score: number;
}

export interface AnomalyAlertData {
  orgName: string;
  anomalies: AnomalyAlertItem[];
  appUrl: string;
}

const BRAND_GREEN = '#F2F1EA';
const INK = '#1A1B1D';
const SOFT = '#6F6F68';
const DANGER = '#BE123C';

export function renderAnomalyAlertEmail(data: AnomalyAlertData): {
  subject: string;
  html: string;
  text: string;
} {
  const { orgName, anomalies, appUrl } = data;
  const isSingle = anomalies.length === 1;

  const firstLabel = lookupLabel(anomalies[0]?.metric_key);
  const subject = isSingle
    ? `Pulse alert: ${firstLabel} anomaly for ${orgName}`
    : `Pulse alert: ${anomalies.length} anomalies for ${orgName}`;

  const rows = anomalies
    .map(a => {
      const label = lookupLabel(a.metric_key);
      const unit = lookupUnit(a.metric_key);
      const observed = `${formatNumber(a.observed)}${unit ? ` ${unit}` : ''}`;
      const expected = `${formatNumber(a.expected)}${unit ? ` ${unit}` : ''}`;
      const z = `${a.z_score >= 0 ? '+' : ''}${a.z_score.toFixed(1)}σ`;
      return `
        <tr>
          <td style="padding:14px 16px;border-top:1px solid #D9D6CB;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:${INK};margin-bottom:4px;">${escapeText(label)}</div>
            <div style="font-size:12px;color:${SOFT};">Observed <strong style="color:${INK};">${escapeText(observed)}</strong> vs expected ~${escapeText(expected)}</div>
          </td>
          <td style="padding:14px 16px;border-top:1px solid #D9D6CB;vertical-align:top;text-align:right;white-space:nowrap;">
            <span style="display:inline-block;background:${DANGER};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 8px;border-radius:4px;">High</span>
            <div style="font-size:12px;color:${SOFT};margin-top:6px;font-variant-numeric:tabular-nums;">z = ${escapeText(z)}</div>
          </td>
        </tr>`;
    })
    .join('');

  const intro = isSingle
    ? `Pulse spotted significant deviation from the 30-day baseline on the metric below. Anything more than 4σ from baseline is usually worth a look.`
    : `Pulse spotted significant deviation from the 30-day baseline on the ${anomalies.length} metrics below. Anything more than 4σ from baseline is usually worth a look.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeAttr(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ECEAE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ECEAE3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="background:#F2F1EA;border-radius:12px;border:1px solid #D9D6CB;overflow:hidden;">
        <tr><td style="background:${INK};padding:18px 28px;color:#F2F1EA;">
          <table width="100%"><tr>
            <td style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRAND_GREEN};font-weight:600;">
              alka<span style="font-weight:800;">tera</span> Pulse
            </td>
            <td align="right" style="font-size:11px;color:#D9D6CB;text-transform:uppercase;letter-spacing:1.5px;">
              Anomaly alert
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:28px;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${SOFT};">
            ${escapeText(orgName)}
          </p>
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${INK};">
            Unusual movement detected
          </h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#1A1B1D;">
            ${escapeText(intro)}
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #D9D6CB;border-radius:8px;overflow:hidden;">
            <tr><td colspan="2" style="background:#ECEAE3;padding:8px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${SOFT};font-weight:600;">
              Flagged metric${isSingle ? '' : 's'}
            </td></tr>
            ${rows}
          </table>

          <div style="margin-top:24px;">
            <a href="${escapeAttr(appUrl)}/pulse" style="display:inline-block;background:${INK};color:${BRAND_GREEN};font-weight:600;font-size:13px;text-decoration:none;padding:11px 20px;border-radius:6px;letter-spacing:0.5px;">
              Review in Pulse &rarr;
            </a>
          </div>

          <p style="margin:28px 0 0;font-size:11px;color:${SOFT};line-height:1.5;">
            You're receiving this because you're an owner or admin on ${escapeText(orgName)}.
            Pulse sends at most one alert per metric per 7 days.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLines = anomalies.map(a => {
    const label = lookupLabel(a.metric_key);
    const unit = lookupUnit(a.metric_key);
    const suffix = unit ? ` ${unit}` : '';
    return `• ${label}: observed ${formatNumber(a.observed)}${suffix} vs expected ~${formatNumber(a.expected)}${suffix} (z = ${a.z_score.toFixed(1)})`;
  });
  const text = [
    `Pulse has detected unusual movement in your sustainability metrics for ${orgName}:`,
    '',
    ...textLines,
    '',
    `Review in Pulse: ${appUrl}/pulse`,
    '',
    'alkatera Pulse',
  ].join('\n');

  return { subject, html, text };
}

function lookupLabel(metricKey: string | undefined): string {
  if (!metricKey) return 'Unknown metric';
  const def = METRIC_DEFINITIONS[metricKey as MetricKey];
  return def?.label ?? metricKey;
}

function lookupUnit(metricKey: string | undefined): string {
  if (!metricKey) return '';
  const def = METRIC_DEFINITIONS[metricKey as MetricKey];
  return def?.unit ?? '';
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
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
