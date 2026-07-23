// Studio email kit for edge functions. One wrapper, one palette, so every
// email the platform sends reads as the same house. Mirrors the studio app
// language: ink on paper, mono eyebrows, forest accent, hairline rules.
// The Node-side twin is lib/email/studio-layout.ts; keep the two in step.

export const STUDIO = {
  ink: "#1A1B1D",
  paper: "#F2F1EA",
  raisedPaper: "#ffffff",
  hairline: "#D9D6CB",
  forest: "#205E40",
  dim: "#6F6F68",
  attention: "#B45309",
  danger: "#BE123C",
} as const;

export const STUDIO_LOGO_URL =
  "https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png";

const MONO = "'Courier New', monospace";

export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** The one email shell: centred logo, mono eyebrow title, content, quiet footer. */
export function studioLayout(opts: {
  /** Short uppercase line under the logo, e.g. "Supplier Invitation". */
  eyebrow: string;
  /** Inner HTML, built from the helpers below and plain <p> tags. */
  content: string;
  /** Optional quiet line above the footer, e.g. why they received this. */
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${STUDIO.paper};">
  <div style="font-family:${MONO};max-width:600px;margin:0 auto;background:${STUDIO.paper};color:${STUDIO.ink};padding:40px;border:1px solid ${STUDIO.hairline};">
    <div style="border-bottom:1px solid ${STUDIO.hairline};padding-bottom:20px;margin-bottom:30px;text-align:center;">
      <img src="${STUDIO_LOGO_URL}" alt="alkatera" width="160" height="auto" style="display:block;margin:0 auto 16px auto;" />
      <h1 style="color:${STUDIO.forest};font-size:14px;text-transform:uppercase;letter-spacing:3px;margin:0;">${opts.eyebrow}</h1>
    </div>
    ${opts.content}
    ${opts.footerNote ? `<p style="color:${STUDIO.dim};font-size:12px;line-height:1.6;">${opts.footerNote}</p>` : ""}
    <div style="margin-top:30px;padding-top:20px;border-top:1px solid ${STUDIO.hairline};color:${STUDIO.dim};font-size:10px;text-transform:uppercase;letter-spacing:2px;">
      The alka<strong>tera</strong> Team
    </div>
  </div>
</body>
</html>`;
}

/** Body copy paragraph. */
export function studioParagraph(html: string): string {
  return `<p style="color:${STUDIO.ink};font-size:14px;line-height:1.8;">${html}</p>`;
}

/** The one CTA: ink slab, paper text, mono uppercase. */
export function studioButton(href: string, label: string): string {
  return `<div style="margin:30px 0;text-align:center;">
  <a href="${href}" style="display:inline-block;background:${STUDIO.ink};color:${STUDIO.paper};font-family:${MONO};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:3px;padding:16px 32px;text-decoration:none;">${label}</a>
</div>`;
}

/** Raised white panel with a forest eyebrow, for supporting detail. */
export function studioCallout(heading: string, bodyHtml: string): string {
  return `<div style="margin:24px 0;padding:20px;background:${STUDIO.raisedPaper};border:1px solid ${STUDIO.hairline};border-radius:4px;">
  <p style="color:${STUDIO.forest};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">${heading}</p>
  <div style="color:${STUDIO.ink};font-size:13px;line-height:1.8;">${bodyHtml}</div>
</div>`;
}

/**
 * Tonal notice. Tone is carried by the left rule and heading colour only;
 * the panel stays quiet paper-white, never a coloured wash.
 */
export function studioNotice(
  tone: "good" | "attention" | "danger",
  title: string,
  bodyHtml: string,
): string {
  const colour =
    tone === "good" ? STUDIO.forest : tone === "attention" ? STUDIO.attention : STUDIO.danger;
  return `<div style="margin:20px 0;padding:16px 20px;background:${STUDIO.raisedPaper};border-left:2px solid ${colour};">
  <p style="color:${colour};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px 0;">${title}</p>
  <div style="color:${STUDIO.ink};font-size:13px;line-height:1.8;">${bodyHtml}</div>
</div>`;
}

/** Quiet label/value fact rows, like the app's FactRow. */
export function studioFactTable(rows: Array<[label: string, valueHtml: string]>): string {
  const tr = rows
    .map(
      ([label, value]) => `<tr>
    <td style="padding:10px 0;color:${STUDIO.dim};font-size:11px;text-transform:uppercase;letter-spacing:2px;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;color:${STUDIO.ink};font-size:14px;">${value}</td>
  </tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:20px 0;">${tr}</table>`;
}
