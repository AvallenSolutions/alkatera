import { escapeHtml } from '@/lib/utils/escape-html';

const LOGO_URL = 'https://alkatera.com/logo.png';

const EMAIL_FROM = 'alkatera <sayhello@mail.alkatera.com>';

const SITE_URL =
  process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com';

/**
 * Optional co-brand block layered on top of the alka**tera** default
 * email identity. When a procurement org is the originator of the
 * outreach, the dispatcher fills this in and the email renders with
 * alka**tera** + procurement logos in the header and the procurement's
 * accent colour on the CTA.
 *
 * Keeping it optional means every existing distributor outreach call
 * (which passes nothing) continues to render the standard alka**tera**
 * studio identity (paper ground, ink text, forest accents).
 */
export interface EmailCoBrand {
  /** Display name shown in copy (e.g. "Foodbuy"). */
  name: string;
  /** Public URL of the co-brand's logo. Should read well on a white background. */
  logoUrl: string;
  /** Hex accent colour for the CTA button. Falls back to the alka**tera** neon-lime when unset. */
  accentColor?: string;
  /** Parent / display copy for the footer (e.g. "Levy / Compass Group"). */
  footerLine?: string;
}

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
  /** Optional procurement co-brand block — when set, the email is rendered with the procurement org's identity. */
  coBrand?: EmailCoBrand | null;
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
  const theme = themeForCoBrand(args.coBrand);

  const visibleSkus = args.skuNames.slice(0, 5);
  const overflow = Math.max(0, args.totalSkuCount - visibleSkus.length);
  const skuListHtml = visibleSkus
    .map(
      (n) =>
        `<li style="color: ${theme.body}; font-size: 13px; line-height: 1.8; margin: 0;">${escapeHtml(n)}</li>`,
    )
    .join('');
  const overflowHtml =
    overflow > 0
      ? `<li style="color: ${theme.muted}; font-size: 12px; font-style: italic; margin-top: 4px;">+ ${overflow} more</li>`
      : '';

  const subject = args.coBrand
    ? `${args.distributorName} is collecting sustainability data on behalf of ${args.coBrand.name}`
    : `${args.distributorName} is requesting your sustainability data`;

  const onBehalf = args.coBrand
    ? `<p style="color: ${theme.body}; font-size: 14px; line-height: 1.8;">
        <strong style="color: ${theme.strong};">${safeDistributor}</strong> distributes your products to <strong style="color: ${theme.strong};">${escapeHtml(args.coBrand.name)}</strong>${args.coBrand.footerLine ? ` (${escapeHtml(args.coBrand.footerLine)})` : ''} and is collecting sustainability data on their behalf.
      </p>`
    : `<p style="color: ${theme.body}; font-size: 14px; line-height: 1.8;">
        <strong style="color: ${theme.strong};">${safeDistributor}</strong> distributes your products and needs to collect sustainability data to meet reporting requirements from their retail partners.
      </p>`;

  const html = wrap(
    'Sustainability Data Request',
    `
      <p style="color: ${theme.body}; font-size: 14px; line-height: 1.8;">Hi there,</p>
      ${onBehalf}
      <p style="color: ${theme.body}; font-size: 14px; line-height: 1.8;">
        This is a straightforward, one-time upload. There is no account to create.
      </p>
      <div style="margin: 24px 0; padding: 20px; background: ${theme.box}; border: 1px solid ${theme.border}; border-radius: 4px;">
        <p style="color: ${theme.accent}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">${safeBrand} products in ${safeDistributor}'s portfolio</p>
        <ul style="margin: 0; padding: 0 0 0 18px;">${skuListHtml}${overflowHtml}</ul>
      </div>
      <p style="color: ${theme.body}; font-size: 14px; line-height: 1.8;">
        Click below to upload your sustainability documents, certifications, or reports. The whole process takes around 10 minutes.
      </p>
      ${renderCta(link, 'Upload your data', theme)}
      <p style="color: ${theme.muted}; font-size: 12px; line-height: 1.8;">
        The link is valid for 90 days.
      </p>
      ${safeContact ? `<p style="color: ${theme.muted}; font-size: 12px; line-height: 1.8;">Questions? Contact <a href="mailto:${safeContact}" style="color: ${theme.accent}; text-decoration: none;">${safeContact}</a>.</p>` : ''}
    `,
    args.distributorName,
    args.coBrand,
  );
  return { subject, html };
}

// ============================================================
// Reminder: distributor → brand
// ============================================================

export function renderReminderEmail(args: InitialOutreachArgs): RenderedEmail {
  const link = brandUploadLink(args.uploadToken);
  const safeDistributor = escapeHtml(args.distributorName);
  const theme = themeForCoBrand(args.coBrand);

  const subject = args.coBrand
    ? `Reminder: ${args.distributorName} (on behalf of ${args.coBrand.name}) is still waiting for your sustainability data`
    : `Reminder: ${args.distributorName} is still waiting for your sustainability data`;
  const reminderLine = args.coBrand
    ? `Quick reminder that <strong style="color: ${theme.strong};">${safeDistributor}</strong> is still waiting for your sustainability documents on behalf of <strong style="color: ${theme.strong};">${escapeHtml(args.coBrand.name)}</strong>.`
    : `Quick reminder that <strong style="color: ${theme.strong};">${safeDistributor}</strong> is still waiting for your sustainability documents.`;
  const html = wrap(
    'Reminder · Sustainability Data Request',
    `
      <p style="color: ${theme.body}; font-size: 14px; line-height: 1.8;">Hi there,</p>
      <p style="color: ${theme.body}; font-size: 14px; line-height: 1.8;">${reminderLine}</p>
      ${renderCta(link, 'Upload your data', theme)}
      <p style="color: ${theme.muted}; font-size: 12px; line-height: 1.8;">
        If you have already submitted, please ignore this message.
      </p>
    `,
    args.distributorName,
    args.coBrand,
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
        `<li style="color: #1A1B1D; font-size: 13px; line-height: 1.8; margin: 0;">${escapeHtml(n)}</li>`,
    )
    .join('');

  const subject = `We received your sustainability data for ${args.brandName}`;
  const html = wrap(
    'Submission Received',
    `
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">Hi ${safeSubmitter},</p>
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">
        Thanks for sending your sustainability documents to <strong style="color: #1A1B1D;">${safeDistributor}</strong>. We have received the following on behalf of <strong style="color: #1A1B1D;">${safeBrand}</strong>:
      </p>
      <ul style="margin: 16px 0 24px 18px; padding: 0;">${filesHtml}</ul>
      <p style="color: #6F6F68; font-size: 12px; line-height: 1.8;">
        ${safeDistributor} will review and follow up if anything is unclear. You do not need to do anything else.
      </p>
    `,
    args.distributorName,
    null,
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
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">
        <strong style="color: #1A1B1D;">${safeBrand}</strong> has submitted ${args.fileCount} sustainability document${args.fileCount === 1 ? '' : 's'} via the brand upload portal.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px 0; color: #6F6F68; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; width: 120px;">Submitter</td>
          <td style="padding: 10px 0; color: #1A1B1D; font-size: 14px;">${safeSubmitter}</td>
        </tr>
        ${safeEmail ? `<tr>
          <td style="padding: 10px 0; color: #6F6F68; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Email</td>
          <td style="padding: 10px 0; color: #1A1B1D; font-size: 14px;">${safeEmail}</td>
        </tr>` : ''}
      </table>
      ${renderCta(args.brandDetailUrl, 'View brand', ALKATERA_THEME)}
    `,
    args.distributorName,
    null,
  );
  return { subject, html };
}

// ============================================================
// Directory contact: distributor → brand from Discover detail page
// ============================================================
// Fired when a wholesaler/distributor clicks "Contact brand" on a
// brand they don't yet list. Different in tone from initial outreach:
// the recipient may not know who alka**tera** is and may not be a
// confirmed alka**tera** customer. The email opens with the
// distributor's intent, includes the typed message verbatim, and
// invites reply-to-direct routing back to the sender.

export interface DirectoryContactArgs {
  brandName: string;
  distributorName: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
}

export function renderDirectoryContactEmail(args: DirectoryContactArgs): RenderedEmail {
  const safeBrand = escapeHtml(args.brandName);
  const safeDistributor = escapeHtml(args.distributorName);
  const safeSender = escapeHtml(args.senderName || args.distributorName);
  const safeEmail = escapeHtml(args.senderEmail);
  // Preserve line breaks in the user-typed message while escaping HTML.
  const safeMessageHtml = escapeHtml(args.message).replace(/\n/g, '<br>');

  const subject = args.subject || `${args.distributorName} would like to connect about ${args.brandName}`;
  const html = wrap(
    'Distributor enquiry',
    `
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">Hi ${safeBrand} team,</p>
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">
        <strong style="color: #1A1B1D;">${safeSender}</strong> from <strong style="color: #1A1B1D;">${safeDistributor}</strong> found your brand in the alka<strong>tera</strong> industry directory and would like to get in touch.
      </p>
      <div style="margin: 24px 0; padding: 16px; background: #ECEAE3; border-left: 3px solid #205E40; color: #1A1B1D; font-size: 14px; line-height: 1.7;">
        ${safeMessageHtml}
      </div>
      <p style="color: #6F6F68; font-size: 13px; line-height: 1.8;">
        Reply directly to this email and it will go straight back to <strong style="color: #1A1B1D;">${safeEmail}</strong>.
      </p>
    `,
    args.distributorName,
    null,
  );
  return { subject, html };
}

// ============================================================
// Shared layout helpers
// ============================================================

interface EmailTheme {
  /** Outer card background. */
  card: string;
  /** Body text colour. */
  body: string;
  /** Stronger body text (headings, callouts). */
  strong: string;
  /** Subdued / footer text. */
  muted: string;
  /** Card border colour. */
  border: string;
  /** SKU-list / pull-quote box background. */
  box: string;
  /** Accent / CTA background colour. */
  accent: string;
  /** Text colour for content rendered on top of the accent. */
  accentText: string;
  /** Header bar divider colour. */
  divider: string;
  /** Plain text wrapper background — what email clients show before the card. */
  outerBg: string;
}

const ALKATERA_THEME: EmailTheme = {
  card: '#F2F1EA',
  body: '#1A1B1D',
  strong: '#1A1B1D',
  muted: '#6F6F68',
  border: '#D9D6CB',
  box: '#ECEAE3',
  accent: '#1A1B1D',
  accentText: '#F2F1EA',
  divider: '#D9D6CB',
  outerBg: '#ECEAE3',
};

const COBRAND_THEME: EmailTheme = {
  card: '#ffffff',
  body: '#475569',
  strong: '#1A1B1D',
  muted: '#6F6F68',
  border: '#D9D6CB',
  box: '#ECEAE3',
  accent: '#3dbac6',
  accentText: '#ffffff',
  divider: '#D9D6CB',
  outerBg: '#ECEAE3',
};

function themeForCoBrand(coBrand: EmailCoBrand | null | undefined): EmailTheme {
  if (!coBrand) return ALKATERA_THEME;
  return { ...COBRAND_THEME, accent: coBrand.accentColor ?? COBRAND_THEME.accent };
}

function wrap(
  headerLabel: string,
  inner: string,
  distributorName: string,
  coBrand: EmailCoBrand | null | undefined,
): string {
  const theme = themeForCoBrand(coBrand);
  const safeDistributor = escapeHtml(distributorName);
  const headerLogos = coBrand
    ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
          <tr>
            <td style="text-align: left;">
              <img src="${LOGO_URL}" alt="alkatera" height="28" style="display: inline-block;" />
            </td>
            <td style="text-align: right;">
              <img src="${escapeHtml(coBrand.logoUrl)}" alt="${escapeHtml(coBrand.name)}" height="36" style="display: inline-block; max-width: 200px;" />
            </td>
          </tr>
        </table>
      `
    : `<img src="${LOGO_URL}" alt="alkatera" width="160" height="auto" style="display: block; margin: 0 auto 16px auto;" />`;
  const footerLine = coBrand
    ? `Sent via alka<strong>tera</strong> on behalf of ${escapeHtml(coBrand.name)}${coBrand.footerLine ? ` (${escapeHtml(coBrand.footerLine)})` : ''}`
    : `Sent via alka<strong>tera</strong> on behalf of ${safeDistributor}`;
  return `
    <div style="background: ${theme.outerBg}; padding: 24px 12px;">
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${theme.card}; color: ${theme.body}; padding: 40px; border: 1px solid ${theme.border}; border-radius: 8px;">
        <div style="border-bottom: 1px solid ${theme.divider}; padding-bottom: 20px; margin-bottom: 30px; ${coBrand ? '' : 'text-align: center;'}">
          ${headerLogos}
          <h1 style="color: ${theme.accent}; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 8px 0 0 0; ${coBrand ? '' : 'text-align: center;'}">${escapeHtml(headerLabel)}</h1>
        </div>
        ${inner}
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid ${theme.divider}; color: ${theme.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; text-align: center;">
          ${footerLine}
        </div>
      </div>
    </div>
  `;
}

function renderCta(url: string, label: string, theme: EmailTheme): string {
  return `
    <div style="margin: 32px 0; text-align: center;">
      <a href="${url}" style="display: inline-block; background: ${theme.accent}; color: ${theme.accentText}; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none; border-radius: 4px;">${escapeHtml(label)} &rarr;</a>
    </div>
  `;
}
