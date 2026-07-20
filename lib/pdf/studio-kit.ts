/**
 * The studio PDF kit — shared primitives for alkatera's document renderers.
 *
 * Extracted from the LCA report template (the first document to speak the
 * studio design language; see lib/pdf/render-lca-html.ts) so every PDF the
 * platform generates composes ONE design implementation: paper ground,
 * cream panels, hairline rules, mono eyebrows, Space Grotesk numbers,
 * numbered colour bands, working-tone chips.
 *
 * Canon (design/studio-design-language.md + the Claude Design system):
 * - Space Grotesk speaks, Inter explains, JetBrains Mono annotates.
 * - Panels are cream on paper with a 1px hairline, radius 6. No shadows.
 * - One saturated block per surface; text on colour is cream or ink only
 *   (ochre and other light brands always take ink — see onBand()).
 * - Working tones are states, never decoration: small bold mono caps,
 *   no badge pills.
 * - Numbers are tabular, with a mono label.
 */

// ============================================================================
// PALETTE + TYPE (the studio tokens, as literals for inline styles)
// ============================================================================

export const INK = '#1A1B1D';
export const CREAM = '#F2F1EA';
export const PAPER = '#ECEAE3';
export const HAIR = '#D9D6CB';
export const DIM = '#6F6F68';
export const FOREST = '#205E40';
export const COBALT = '#2B46C0';
export const OCHRE = '#DFA32B';
export const OCHRE_INK = '#A97C14'; // ochre's accent form on paper (contrast)
export const BRICK = '#BF4B2A';
export const GOOD = '#047857';
export const ATTN = '#B45309';
export const STALE = '#BE123C';

export const MONO = `'JetBrains Mono',monospace`;
export const SG = `'Space Grotesk',sans-serif`;
export const INTER = `'Inter',sans-serif`;

/**
 * Text colours on a saturated band: cream everywhere, ink on light bands.
 * Generalises the ochre rule via relative luminance so a customer's brand
 * colour (sustainability reports) picks legible text automatically.
 */
export function onBand(bg: string): { fg: string; meta: string; hairline: string } {
  if (isLightColour(bg)) return { fg: INK, meta: 'rgba(26,27,29,.7)', hairline: 'rgba(26,27,29,.2)' };
  return { fg: CREAM, meta: 'rgba(242,241,234,.75)', hairline: 'rgba(242,241,234,.3)' };
}

/** WCAG-ish relative luminance check; ochre (#DFA32B) is the canonical light band. */
export function isLightColour(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Perceived luminance (ITU-R BT.709 weights, gamma-naive is fine at this scale)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

// ============================================================================
// HELPERS
// ============================================================================

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The wordmark: lowercase, "alka" medium + "tera" bold. Never capitalised. */
export function wordmark(size: number, color: string): string {
  return `<span style="font-family:${SG};font-size:${size}px;color:${color}"><span style="font-weight:500">alka</span><span style="font-weight:700">tera</span></span>`;
}

/** The brand leaf mark (veined leaf-drop), single-weight, from the design. */
export function leafMark(stroke: string, style: string): string {
  return `<svg viewBox="0 0 48 48" style="${style}" aria-hidden="true">
    <path d="M24 7 C 31 19 37 24 37 29 A 13 13 0 1 1 11 29 C 11 24 17 19 24 7 Z" fill="none" stroke="${stroke}" stroke-width="2.6"></path>
    <line x1="24" y1="14" x2="24" y2="41" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"></line>
    <line x1="24" y1="27" x2="31" y2="20" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"></line>
    <line x1="24" y1="27" x2="17" y2="20" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"></line>
  </svg>`;
}

/** Mono caps snippet. The workhorse for eyebrows, labels and meta. */
export function mono(text: string, opts: { size?: number; ls?: number; color?: string; weight?: number; upper?: boolean } = {}): string {
  const { size = 9.5, ls = 0.2, color = DIM, weight = 700, upper = true } = opts;
  return `<span style="font-family:${MONO};font-size:${size}px;font-weight:${weight};letter-spacing:${ls}em;${upper ? 'text-transform:uppercase;' : ''}color:${color}">${text}</span>`;
}

/** Section band: `NN · Title` left, mono meta right, on a room colour. */
export function band(number: string, title: string, meta: string, bg: string): string {
  const on = onBand(bg);
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;background:${bg};border-radius:6px;padding:14px 20px">
    <div style="font-family:${MONO};font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${on.fg}">${number} · ${title}</div>
    <div style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.12em;text-align:right;color:${on.meta}">${meta}</div>
  </div>`;
}

/** Hero band: the band grown into a poster block with content inside. */
export function heroBand(number: string, title: string, meta: string, bg: string, inner: string): string {
  const on = onBand(bg);
  return `<div style="background:${bg};border-radius:6px;color:${on.fg};padding:22px 28px">
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline">
      <div style="font-family:${MONO};font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${on.fg}">${number} · ${title}</div>
      <div style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.12em;text-align:right;color:${on.meta}">${meta}</div>
    </div>
    ${inner}
  </div>`;
}

/** Cream stat card: mono label / SG number / mono unit line. */
export function statCard(label: string, value: string, unit?: string, opts: { valueColor?: string; size?: number; pad?: number } = {}): string {
  const { valueColor = INK, size = 30, pad = 18 } = opts;
  return `<div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:${pad}px">
    <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${DIM}">${label}</div>
    <div style="font-family:${SG};font-size:${size}px;font-weight:700;letter-spacing:-.02em;color:${valueColor};margin-top:10px;font-variant-numeric:tabular-nums">${value}</div>
    ${unit ? `<div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${DIM};margin-top:3px">${unit}</div>` : ''}
  </div>`;
}

/** SG card title, optionally with a quiet mono suffix (e.g. an ISO clause). */
export function cardTitle(text: string, metaSuffix?: string): string {
  return `<div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK}">${text}${metaSuffix ? ` <span style="font-family:${MONO};font-size:9.5px;font-weight:500;letter-spacing:.12em;color:${DIM}">${metaSuffix}</span>` : ''}</div>`;
}

/** Inter body paragraph. */
export function bodyP(text: string, opts: { color?: string; size?: number; mt?: number; maxWidth?: number } = {}): string {
  const { color = DIM, size = 12.5, mt = 8, maxWidth } = opts;
  return `<p style="font-family:${INTER};font-size:${size}px;line-height:1.55;color:${color};margin:${mt}px 0 0${maxWidth ? `;max-width:${maxWidth}px` : ''}">${text}</p>`;
}

/** A definition block: SG title + quiet body. The design's 2-col grid cell. */
export function defBlock(title: string, body: string, metaSuffix?: string): string {
  return `<div>${cardTitle(title, metaSuffix)}${bodyP(body)}</div>`;
}

/** Square bullet row: filled (included) or outlined (excluded/limitation). */
export function bullet(text: string, opts: { color?: string; outline?: boolean; textColor?: string } = {}): string {
  const { color = INK, outline = false, textColor } = opts;
  const box = outline
    ? `border:1px solid ${color};box-sizing:border-box`
    : `background:${color}`;
  return `<div style="display:flex;gap:10px;align-items:baseline"><span style="width:7px;height:7px;${box};flex:none;position:relative;top:-1px"></span><span style="font-family:${INTER};font-size:12px;line-height:1.5;color:${textColor ?? (outline ? DIM : INK)}">${text}</span></div>`;
}

// ---- Hairline tables (mono caps headers over an ink rule) ------------------

export function th(text: string, opts: { align?: 'left' | 'right'; first?: boolean; last?: boolean; width?: number; size?: number } = {}): string {
  const { align = 'left', first = false, last = false, width, size = 9 } = opts;
  const pad = first ? '7px 8px 7px 0' : last ? '7px 0 7px 8px' : '7px 8px';
  return `<th style="font-family:${MONO};font-size:${size}px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${DIM};text-align:${align};padding:${pad};border-bottom:1px solid ${INK}${width ? `;width:${width}px` : ''}">${text}</th>`;
}

export function td(content: string, opts: { align?: 'left' | 'right'; first?: boolean; last?: boolean; dim?: boolean; bold?: boolean; size?: number; mono?: boolean; color?: string; top?: boolean } = {}): string {
  const { align = 'left', first = false, last = false, dim = false, bold = false, size = 11.5, mono: isMono = false, color, top = false } = opts;
  const pad = first ? '7px 8px 7px 0' : last ? '7px 0 7px 8px' : '7px 8px';
  const family = isMono ? MONO : INTER;
  const c = color ?? (dim ? DIM : INK);
  return `<td style="font-family:${family};font-size:${size}px;${bold ? 'font-weight:600;' : ''}color:${c};padding:${pad};border-bottom:1px solid ${HAIR};text-align:${align};font-variant-numeric:tabular-nums${top ? ';vertical-align:top' : ''}">${content}</td>`;
}

/** Working-tone chip: small bold mono caps, never a pill. */
export function toneChip(label: string, tone: 'good' | 'attention' | 'stale' | 'quiet', size = 9.5): string {
  const color = tone === 'good' ? GOOD : tone === 'attention' ? ATTN : tone === 'stale' ? STALE : DIM;
  return `<span style="font-family:${MONO};font-size:${size}px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${color}">${label}</span>`;
}

/** Grade → working tone (HIGH/MEDIUM/LOW and A/B/C/D style grades). */
export function gradeTone(grade: string): 'good' | 'attention' | 'stale' {
  const g = grade.toUpperCase();
  if (g === 'HIGH' || g === 'A' || g === 'B') return 'good';
  if (g === 'MEDIUM' || g === 'C') return 'attention';
  return 'stale';
}

/** Horizontal meter: cream track with a hairline, colour fill. */
export function meter(pct: number, fill: string, opts: { height?: number; track?: string; mt?: number } = {}): string {
  const { height = 8, track = CREAM, mt = 10 } = opts;
  const w = Math.max(0, Math.min(100, pct));
  return `<div style="height:${height}px;background:${track};border:1px solid ${HAIR};border-radius:6px;overflow:hidden;margin-top:${mt}px"><div style="width:${w}%;height:100%;background:${fill}"></div></div>`;
}

// ============================================================================
// PAGE SHELL
// ============================================================================

export interface PageShellOptions {
  /** Right-hand mono meta in the footer, before the date (e.g. "ISO 14040/44 &amp; 14067"). */
  footerMeta?: string;
  /** Landscape swaps the A4 box (1123×794 instead of 794×1123). */
  landscape?: boolean;
}

/**
 * Build a page() function for one document: fixed A4 boxes (@96dpi, PDFShift
 * margin 0), paper ground, the studio footer (GENERATED BY wordmark · meta +
 * date) pinned above a bottom hairline. Fixed pages are deliberate — Chromium
 * neither paints canvas backgrounds over margins nor positions fixed footers
 * reliably, and the design language models discrete pages with CONT. bands.
 */
export function createPageShell(shell: PageShellOptions = {}) {
  const { footerMeta = '', landscape = false } = shell;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  const rightMeta = footerMeta ? `${footerMeta} · ${dateStr}` : dateStr;

  return function page(content: string, opts: { footer?: boolean } = {}): string {
    const { footer = true } = opts;
    const footerHtml = footer
      ? `<div style="position:absolute;left:44px;right:44px;bottom:26px;z-index:10;background:${PAPER};display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid ${HAIR};padding-top:8px">
          <div style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.18em;color:${DIM}">GENERATED BY ${wordmark(11, INK)}</div>
          <div style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.18em;color:${DIM}">${rightMeta}</div>
        </div>`
      : '';
    return `<div class="page${landscape ? ' page-landscape' : ''}">
      <div style="position:relative;z-index:1;height:100%;overflow:hidden">${content}</div>
      ${footerHtml}
    </div>`;
  };
}

/**
 * The document-level CSS every studio PDF shares: reset, fonts hookup, the
 * fixed .page boxes. Include inside a `<style>` tag.
 */
export function studioPageCss(): string {
  return `
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: white;
      color: ${INK};
    }
    .page {
      width: 794px;
      height: 1123px;
      position: relative;
      background: ${PAPER};
      padding: 40px 44px 64px 44px;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .page-landscape { width: 1123px; height: 794px; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    @media print {
      body { background: white; }
      .page { box-shadow: none; margin: 0; }
    }`;
}

/**
 * "Not yet measured" tile: the statCard shell preserved so the metric grid
 * never reflows, the phrase at 14px so a skeleton never out-shouts a real
 * number beside it, and a mono-caps hint naming where in the app to add the
 * measure. Never prints 'N/A' — that reads as NOT APPLICABLE, a different
 * and false claim about an unmeasured thing.
 */
export function notMeasuredTile(label: string, hint?: string): string {
  return `<div style="background:${CREAM};border:1px dashed ${HAIR};border-radius:6px;padding:18px">
    <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${DIM}">${escapeHtml(label)}</div>
    <div style="font-family:${SG};font-size:14px;font-weight:600;color:${DIM};margin-top:10px">Not yet measured</div>
    ${hint ? `<div style="font-family:${MONO};font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:${DIM};margin-top:6px">${escapeHtml(hint)}</div>` : ''}
  </div>`;
}

/**
 * "Not yet measured" block: the wider-format sibling of notMeasuredTile for
 * places that would otherwise render a table, list or story card. Same rules:
 * quiet, honest, and it names where the data gets added.
 */
export function notMeasuredBlock(title: string, hint?: string): string {
  return `<div style="background:${CREAM};border:1px dashed ${HAIR};border-radius:6px;padding:20px 22px">
    <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK}">${escapeHtml(title)}</div>
    <div style="font-family:${SG};font-size:13px;font-weight:500;color:${DIM};margin-top:6px">Not yet measured.</div>
    ${hint ? `<div style="font-family:${MONO};font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:${DIM};margin-top:8px">${escapeHtml(hint)}</div>` : ''}
  </div>`;
}

/** Google Fonts link tags for the studio's three voices. */
export function studioFontLinks(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />`;
}
