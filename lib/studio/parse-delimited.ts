// Minimal CSV/TSV parser for pasted or dropped plain-text spreadsheets
// (components/studio/csv-paste-import.tsx). Handles quoted fields with
// embedded delimiters/newlines (RFC 4180-ish) and auto-detects comma vs tab
// from the header line. Excel/.xlsx files are parsed server-side instead
// (app/api/studio/csv-column-mapping/route.ts, via the xlsx package already
// used by the rest of the import stack) — this stays dependency-free for
// the instant client-side paste path.

export interface ParsedDelimited {
  headers: string[];
  rows: Record<string, string>[];
}

function detectDelimiter(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function parseLines(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // skip; \n (or end) closes the row
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Parse pasted or file-read CSV/TSV text into headers + row objects. */
export function parseDelimited(text: string): ParsedDelimited {
  const trimmed = text.trim();
  if (!trimmed) return { headers: [], rows: [] };

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const lines = parseLines(trimmed, delimiter);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (line[i] ?? '').trim();
    });
    return obj;
  });

  return { headers, rows };
}
