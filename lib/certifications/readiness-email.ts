/**
 * B Corp certification — readiness status change email.
 *
 * Inline-styled, table-based HTML so Gmail, Apple Mail and Outlook render
 * consistently. Mirrors the Pulse anomaly alert email style.
 */

const BRAND_GREEN = '#ccff00';
const INK = '#0a0a0a';
const SOFT = '#525960';

export interface ReadinessEmailData {
  orgName: string;
  isReadyToSubmit: boolean;
  blockingCount: number;
  appUrl: string;
}

export function renderReadinessEmail(data: ReadinessEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { orgName, isReadyToSubmit, blockingCount, appUrl } = data;
  const link = `${appUrl}/certifications`;

  const subject = isReadyToSubmit
    ? `${orgName} is ready to submit for B Corp audit`
    : `${orgName}: B Corp readiness has changed`;

  const headline = isReadyToSubmit
    ? 'You have met all Year 0 requirements'
    : 'Your B Corp readiness has changed';

  const body = isReadyToSubmit
    ? 'Every Year 0 requirement now passes. You can prepare your audit package and submit for certification.'
    : `${blockingCount} requirement${
        blockingCount === 1 ? '' : 's'
      } still need to be met before you can submit. Review the gap analysis to see exactly what is outstanding.`;

  const text = `${headline}\n\n${body}\n\nOpen alkatera: ${link}`;

  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f7;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:640px;width:100%;">
<tr><td style="background:${INK};padding:20px 28px;">
<span style="color:#ffffff;font-size:18px;font-weight:700;">alka<span style="color:${BRAND_GREEN};font-weight:700;">tera</span></span>
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 8px;font-size:20px;color:${INK};">${headline}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:${SOFT};">${body}</p>
<a href="${link}" style="display:inline-block;background:${BRAND_GREEN};color:${INK};text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:14px;">Open the Certifications hub</a>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eceded;">
<p style="margin:0;font-size:12px;color:${SOFT};">${orgName} · B Corp certification tracking on alkatera</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { subject, html, text };
}
