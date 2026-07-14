import * as XLSX from 'xlsx';

/**
 * Spreadsheet-to-text serialisation for the Smart Upload classifier.
 *
 * Claude only reads PDFs and images natively, so workbooks and CSVs are
 * serialised to a bounded plain-text block (CSV rows inside labelled sheet
 * fences) and sent as a text content block instead. CSV is the densest
 * representation per token and the model reads it natively.
 *
 * Zero new dependencies (SheetJS is already in the classify-document graph)
 * and relative imports only — this module bundles inside the Netlify
 * background function, where one bad alias resolution kills the cold start.
 */

export interface SpreadsheetTextOptions {
  /** Total character budget for the serialised block. */
  maxTotalChars?: number;
  /** Sheets beyond this are listed by name only. */
  maxSheets?: number;
  /** Rows per sheet beyond this are summarised as a truncation note. */
  maxRowsPerSheet?: number;
  /** Individual cell text beyond this is cut. */
  maxCellChars?: number;
}

const DEFAULTS: Required<SpreadsheetTextOptions> = {
  maxTotalChars: 30_000,
  maxSheets: 8,
  maxRowsPerSheet: 100,
  maxCellChars: 200,
};

/**
 * Strip control characters and angle brackets (the block sits inside the
 * same prompt as XML-fenced org context) and collapse whitespace. Same
 * character policy as sanitiseHintValue in feedback-hints.ts.
 */
function cleanCell(value: unknown, maxChars: number): string {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(/[\r\n\t<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/** Minimal CSV quoting: only when the cell contains a comma or a quote. */
function toCsvCell(text: string): string {
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function sanitiseFileName(fileName: string): string {
  return cleanCell(fileName, 160) || 'untitled';
}

interface SheetSection {
  name: string;
  rows: number;
  cols: number;
  /** Full body (capped rows), or null when the sheet has no readable cells. */
  body: string | null;
  /** Header line only — the shed fallback. */
  headerLine: string | null;
}

function buildSheetSection(
  ws: XLSX.WorkSheet,
  name: string,
  opts: Required<SpreadsheetTextOptions>,
): SheetSection {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
  });
  // Drop fully-empty trailing rows (sheet_to_json can include them when the
  // used range is padded) and skip empty rows inside the body.
  const rows = grid
    .map((row) => (Array.isArray(row) ? row.map((c) => cleanCell(c, opts.maxCellChars)) : []))
    .filter((row) => row.some((c) => c !== ''));

  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (rows.length === 0) {
    return { name: cleanCell(name, 80), rows: 0, cols: 0, body: null, headerLine: null };
  }

  const shown = rows.slice(0, opts.maxRowsPerSheet);
  const lines = shown.map((row) => row.map(toCsvCell).join(','));
  if (rows.length > shown.length) {
    lines.push(`[… truncated: ${rows.length - shown.length} more rows]`);
  }
  return {
    name: cleanCell(name, 80),
    rows: rows.length,
    cols,
    body: lines.join('\n'),
    headerLine: lines[0] ?? null,
  };
}

function renderSection(section: SheetSection, shed: boolean, maxRows: number): string {
  const shownNote =
    section.rows > maxRows && !shed ? `, showing first ${maxRows} rows` : '';
  const header = `=== Sheet "${section.name}" (${section.rows} rows x ${section.cols} cols${shownNote}) ===`;
  if (section.body === null) return `${header}\n[empty sheet]`;
  if (shed) {
    return `${header}\n${section.headerLine ?? ''}\n[… sheet content omitted to fit the size budget]`;
  }
  return `${header}\n${section.body}`;
}

/**
 * Serialise an already-parsed workbook to a bounded plain-text block.
 * Later sheets are shed to header-plus-dimensions first when the total
 * exceeds the character budget; sheet names and sizes always survive.
 */
export function workbookToText(
  wb: XLSX.WorkBook,
  fileName: string,
  options?: SpreadsheetTextOptions,
): string {
  const opts = { ...DEFAULTS, ...options };
  const sheetNames = wb.SheetNames || [];
  const included = sheetNames.slice(0, opts.maxSheets);
  const sections = included.map((name) => buildSheetSection(wb.Sheets[name], name, opts));

  const preambleLines = [
    `Spreadsheet file: ${sanitiseFileName(fileName)}`,
    `Sheets: ${sheetNames.length} (${sheetNames.map((n) => cleanCell(n, 80)).join(', ')})`,
  ];
  if (sheetNames.length > included.length) {
    preambleLines.push(`[only the first ${included.length} sheets are shown]`);
  }
  const preamble = preambleLines.join('\n');

  // Start with everything rendered in full, then shed sheets from the end
  // (header + dimensions only) until the block fits the budget.
  const shedFlags = sections.map(() => false);
  const render = () =>
    [preamble, ...sections.map((s, i) => renderSection(s, shedFlags[i], opts.maxRowsPerSheet))].join(
      '\n\n',
    );

  let text = render();
  for (let i = sections.length - 1; i >= 0 && text.length > opts.maxTotalChars; i--) {
    shedFlags[i] = true;
    text = render();
  }
  // A single enormous sheet can still overflow after shedding: hard-cut.
  if (text.length > opts.maxTotalChars) {
    text = `${text.slice(0, opts.maxTotalChars)}\n[… truncated to fit the size budget]`;
  }
  return text;
}

/**
 * Serialise a CSV file to the same bounded block shape, without SheetJS.
 * Rows are capped like a single sheet; cells are sanitised line-wise (a
 * quoted multi-line CSV cell degrades to separate rows, which is acceptable
 * for classification).
 */
export function csvToText(
  fileBytes: Uint8Array,
  fileName: string,
  options?: SpreadsheetTextOptions,
): string {
  const opts = { ...DEFAULTS, ...options };
  const raw = Buffer.from(fileBytes).toString('utf-8');
  const allLines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
  const shown = allLines.slice(0, opts.maxRowsPerSheet).map((l) => cleanCell(l, 2_000));

  const lines = [
    `CSV file: ${sanitiseFileName(fileName)}`,
    `Rows: ${allLines.length}${allLines.length > shown.length ? ` (showing first ${shown.length})` : ''}`,
    '',
    ...shown,
  ];
  if (allLines.length > shown.length) {
    lines.push(`[… truncated: ${allLines.length - shown.length} more rows]`);
  }

  let text = lines.join('\n');
  if (text.length > opts.maxTotalChars) {
    text = `${text.slice(0, opts.maxTotalChars)}\n[… truncated to fit the size budget]`;
  }
  return text;
}
