import { escapeHtml } from '@/lib/utils/escape-html';

const LOGO_URL =
  'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

const EMAIL_FROM = 'alkatera <sayhello@mail.alkatera.com>';

const SITE_URL =
  process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com';

/**
 * Resolve a stable site URL for use in email bodies. We don't trust
 * `window.location` here because emails are rendered server-side and
 * users click the link from a different origin.
 */
export function getSiteUrl(): string {
  return SITE_URL.replace(/\/$/, '');
}

export function brandUploadLink(token: string): string {
  return `${getSiteUrl()}/brand-upload/${encodeURIComponent(token)}`;
}

export { EMAIL_FROM };

// ============================================================
// Initial outreach: distributor → brand
// ============================================================

export interface InitialOutreachArgs {
  brandName: string;
  distributorName: string;
  /** Up to 5 active SKU names for the brand — the rest collapse into "+N more". */
  skuNames: string[];
  totalSkuCount: number;
  uploadToken: string;
  /** Optional reply-to address for the email — falls back to a generic alkatera contact. */
  distributorContactEmail?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function renderInitialOutreachEmail(args: InitialOutreachArgs): RenderedEmail {
  const link = brandUploadLink(args.uploadToken);
  const safeBrand = escapeHtml(args.brandName);
  const safeDistributor = escapeHtml(args.distributorName);
  const safeContact = args.distributorContactEmail ? escapeHtml(args.distributorContactEmail) : '';

  const visibleSkus = args.skuNames.slice(0, 5);
  const overflow = Math.max(0, args.totalSkuCount - visibleSkus.length);
  const skuListHtml = visibleSkus
    .map(
      (n) =>
        `<li style="color: #ccc; font-size: 13px; line-height: 1.8; margin: 0;">${escapeHtml(n)}</li>`,
    )
    .join('');
  const overflowHtml =
    overflow > 0
      ? `<li style="color: #888; font-size: 12px; font-style: italic; margin-top: 4px;">+ ${overflow} more</li>`
      : '';

  const subject = `${args.distributorName} is requesting your sustainability data`;
  const html = wrap(
    'Sustainability Data Request',
    `
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">Hi there,</p>
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
        <strong style="color: #fff;">${safeDistributor}</strong> distributes your products and needs to collect sustainability data to meet reporting requirements from their retail partners.
      </p>
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
        This is a straightforward, one-time upload. There is no account to create.
      </p>
      <div style="margin: 24px 0; padding: 20px; background: #111; border: 1px solid #222; border-radius: 4px;">
        <p style="color: #ccff00; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">${safeBrand} products in ${safeDistributor}'s portfolio</p>
        <ul style="margin: 0; padding: 0 0 0 18px;">${skuListHtml}${overflowHtml}</ul>
      </div>
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
        Click below to upload your sustainability documents, certifications, or reports. The whole process takes around 10 minutes.
      </p>
      ${renderCta(link, 'Upload your data')}
      <p style="color: #888; font-size: 12px; line-height: 1.8;">
        The link is valid for 90 days.
      </p>
      ${safeContact ? `<p style="color: #888; font-size: 12px; line-height: 1.8;">Questions? Contact <a href="mailto:${safeContact}" style="color: #ccff00; text-decoration: none;">${safeContact}</a>.</p>` : ''}
    `,
    args.distributorName,
  );
  return { subject, html };
}

// ============================================================
// Reminder: distributor → brand
// ============================================================

export function renderReminderEmail(args: InitialOutreachArgs): RenderedEmail {
  const link = brandUploadLink(args.uploadToken);
  const safeDistributor = escapeHtml(args.distributorName);

  const subject = `Reminder: ${args.distributorName} is still waiting for your sustainability data`;
  const html = wrap(
    'Reminder · Sustainability Data Request',
    `
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">Hi there,</p>
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
        Quick reminder that <strong style="color: #fff;">${safeDistributor}</strong> is still waiting for your sustainability documents.
      </p>
      ${renderCta(link, 'Upload your data')}
      <p style="color: #888; font-size: 12px; line-height: 1.8;">
        If you have already submitted, please ignore this message.
      </p>
    `,
    args.distributorName,
  );
  return { subject, html };
}

// ============================================================
// Receipt: alkatera → brand uploader (after successful submission)
// ============================================================

export interface SubmissionReceiptArgs {
  brandName: string;
  distributorName: string;
  submitterName: string;
  fileNames: string[];
}

export function renderSubmissionReceiptEmail(args: SubmissionReceiptArgs): RenderedEmail {
  const safeBrand = escapeHtml(args.brandName);
  const safeDistributor = escapeHtml(args.distributorName);
  const safeSubmitter = escapeHtml(args.submitterName || 'there');
  const filesHtml = args.fileNames
    .map(
      (n) =>
        `<li style="color: #ccc; font-size: 13px; line-height: 1.8; margin: 0;">${escapeHtml(n)}</li>`,
    )
    .join('');

  const subject = `We received your sustainability data for ${args.brandName}`;
  const html = wrap(
    'Submission Received',
    `
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">Hi ${safeSubmitter},</p>
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
        Thanks for sending your sustainability documents to <strong style="color: #fff;">${safeDistributor}</strong>. We have received the following on behalf of <strong style="color: #fff;">${safeBrand}</strong>:
      </p>
      <ul style="margin: 16px 0 24px 18px; padding: 0;">${filesHtml}</ul>
      <p style="color: #888; font-size: 12px; line-height: 1.8;">
        ${safeDistributor} will review and follow up if anything is unclear. You do not need to do anything else.
      </p>
    `,
    args.distributorName,
  );
  return { subject, html };
}

// ============================================================
// Notification: alkatera → distributor owners (after brand submission)
// ============================================================

export interface DistributorNotificationArgs {
  brandName: string;
  distributorName: string;
  submitterName: string;
  submitterEmail: string;
  fileCount: number;
  brandDetailUrl: string;
}

export function renderDistributorNotificationEmail(
  args: DistributorNotificationArgs,
): RenderedEmail {
  const safeBrand = escapeHtml(args.brandName);
  const safeSubmitter = escapeHtml(args.submitterName || 'a representative');
  const safeEmail = escapeHtml(args.submitterEmail || '');

  const subject = `${args.brandName} submitted sustainability data`;
  const html = wrap(
    'Brand Submission',
    `
      <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
        <strong style="color: #fff;">${safeBrand}</strong> has submitted ${args.fileCount} sustainability document${args.fileCount === 1 ? '' : 's'} via the brand upload portal.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; width: 120px;">Submitter</td>
          <td style="padding: 10px 0; color: #fff; font-size: 14px;">${safeSubmitter}</td>
        </tr>
        ${safeEmail ? `<tr>
          <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Email</td>
          <td style="padding: 10px 0; color: #fff; font-size: 14px;">${safeEmail}</td>
        </tr>` : ''}
      </table>
      ${renderCta(args.brandDetailUrl, 'View brand')}
    `,
    args.distributorName,
  );
  return { subject, html };
}

// ============================================================
// Shared layout helpers
// ============================================================

function wrap(headerLabel: string, inner: string, distributorName: string): string {
  const safeDistributor = escapeHtml(distributorName);
  return `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
      <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
        <img src="${LOGO_URL}" alt="alkatera" width="160" height="auto" style="display: block; margin: 0 auto 16px auto;" />
        <h1 style="color: #ccff00; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">${escapeHtml(headerLabel)}</h1>
      </div>
      ${inner}
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #333; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; text-align: center;">
        Sent via alka<strong>tera</strong> on behalf of ${safeDistributor}
      </div>
    </div>
  `;
}

function renderCta(url: string, label: string): string {
  return `
    <div style="margin: 32px 0; text-align: center;">
      <a href="${url}" style="display: inline-block; background: #ccff00; color: #000; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none;">${escapeHtml(label)} →</a>
    </div>
  `;
}
