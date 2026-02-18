# PDF Generation Skill

## Architecture Overview

The LCA PDF generation system uses a **server-side HTML-to-PDF** approach:

1. **Data Layer**: Supabase DB → `transformLCADataForReport()` → `LCAReportData`
2. **Render Layer**: `renderLcaReportHtml(data)` → Self-contained HTML string
3. **Conversion Layer**: HTML string → PDFShift API (Chromium-based) → PDF buffer
4. **API Layer**: `POST /api/lca/[id]/generate-pdf` → Returns PDF binary
5. **Client Layer**: `LcaReportGenerator` wizard component → Preview + Download

## Key Files

| File | Purpose |
|------|---------|
| `lib/pdf/render-lca-html.ts` | Pure HTML/CSS report renderer (no React runtime) |
| `lib/pdf/pdfshift-client.ts` | PDFShift API wrapper with retry logic |
| `app/api/lca/[id]/generate-pdf/route.ts` | PDF generation API endpoint |
| `components/lca/LcaReportGenerator.tsx` | User-facing report wizard |
| `app/(authenticated)/products/[id]/lca-report/page.tsx` | Report page |
| `lib/utils/lca-report-transformer.ts` | DB data → `LCAReportData` transformer |
| `components/lca-report/types.ts` | `LCAReportData` type definition |
| `lib/claude/lca-assistant.ts` | AI narrative generation via Claude |
| `lib/lca-compliance-checker.ts` | ISO 14044 compliance scoring |

## Design Tokens

```
Brand Green:     #ccff00 (neon lime)
Dark Background: #1c1917 (stone-900)
Page Size:       A4 (794 x 1123 px at 96dpi)
Fonts:           Playfair Display (headings), Inter (body), Fira Code (data)
Font CDN:        Google Fonts via <link> tags
```

## How to Add a New Report Page

1. Open `lib/pdf/render-lca-html.ts`
2. Create a new page function following the pattern:

```typescript
function renderNewPage(data: LCAReportData): string {
  return `
    <div style="width: 794px; min-height: 1123px; padding: 60px; position: relative; page-break-after: always; background: white;">
      ${renderSectionHeader('Section Title', 'Subtitle text', '#icon-color')}

      <!-- Page content here -->

      ${renderPageFooter(data, pageNumber)}
    </div>
  `;
}
```

3. Add the page to the main `renderLcaReportHtml()` function's HTML assembly
4. Update the page count in the footer

## HTML Rendering Approach

We use **pure HTML/CSS strings** (not React SSR) because:
- PDFShift's Chromium renders vanilla HTML perfectly
- No Recharts/DOM measurement issues (Recharts needs browser DOM)
- No React runtime overhead
- Complete control over print styles

### Charts in PDF
- **Donut charts**: CSS `conic-gradient` on a circular `<div>` with a white center hole
- **Bar charts**: HTML `<div>` elements with `width` set as percentage
- **Gauge charts**: CSS `conic-gradient` on a half-circle
- **No SVG/Canvas dependencies** — everything is pure CSS

### Helper Functions
- `escapeHtml(str)` — XSS-safe text rendering
- `donutGradient(segments)` — Generates CSS conic-gradient for pie/donut charts
- `renderSectionHeader(title, subtitle, color)` — Consistent section headers
- `renderPageFooter(data, pageNum)` — Footer with product name, date, page number

## PDFShift API

- **Endpoint**: `https://api.pdfshift.io/v3/convert/pdf`
- **Auth**: `X-API-Key` header with `PDFSHIFT_API_KEY` env var
- **Key options**:
  - `format: 'A4'` — Page size
  - `landscape: false` — Portrait orientation
  - `margin: { top: '0', right: '0', bottom: '0', left: '0' }` — No extra margins (margins are in the HTML)
  - `delay: 2000` — Wait 2s for fonts/CDN to load
  - `removeBlank: true` — Remove trailing blank pages
- **Retries**: Up to 2 retries on 5xx errors
- **Sandbox mode**: Set `sandbox: true` for testing (watermarked, doesn't count against quota)

## API Route Pattern

```typescript
// POST /api/lca/[id]/generate-pdf
// Headers: Authorization: Bearer <supabase-access-token>
// Body: { includeNarratives?: boolean, inline?: boolean }
// Response: PDF binary (Content-Type: application/pdf)
```

The API route:
1. Authenticates via Bearer token
2. Fetches PCF + materials + organization from Supabase
3. Transforms data via `transformLCADataForReport()`
4. Optionally generates AI narratives via `generateNarratives()`
5. Renders HTML via `renderLcaReportHtml()`
6. Converts to PDF via `convertHtmlToPdf()`
7. Returns PDF buffer as response

## Tailwind/Print Styles

Since the HTML renderer produces self-contained HTML (not using Tailwind classes), print-friendly styles are inline. Key patterns:

- Pages use `page-break-after: always` for proper page separation
- Background colours use `background` (not `background-color`) for print compatibility
- Font sizes are in `px` for consistent rendering across environments
- The HTML includes a Tailwind CDN `<script>` for any utility classes used

## Data Flow

```
User clicks "Generate LCA Report"
  → LcaReportGenerator checks ISO compliance (evaluateCompliance)
  → User configures options (AI narratives toggle)
  → Client calls POST /api/lca/[id]/generate-pdf
    → Server fetches data from Supabase
    → Server transforms data (transformLCADataForReport)
    → Server optionally generates AI narratives (generateNarratives)
    → Server renders HTML (renderLcaReportHtml)
    → Server sends HTML to PDFShift API
    → PDFShift returns PDF buffer
    → Server returns PDF to client
  → Client creates blob URL for iframe preview
  → User can download or regenerate
```

## Environment Variables

- `PDFSHIFT_API_KEY` — Required for PDF generation (get from pdfshift.io dashboard)
- `ANTHROPIC_API_KEY` — Required for AI narrative generation (already configured)

## Deprecated Files (Do Not Use)

These files use the old jsPDF approach and should not be extended:
- `lib/pdf-generator.ts` — Old jsPDF-based generator
- `lib/enhanced-pdf-generator.ts` — Old enhanced jsPDF generator
- `lib/pdf-chart-renderer.ts` — Old chart-to-canvas renderer
