import pdfParse from 'pdf-parse';
import type { ParsedTable } from './csv-parser';

/**
 * Best-effort tabular extraction from a PDF. We use pdf-parse to grab the
 * raw text, then look for the first line that contains two or more
 * consistent delimiters (tab, two-or-more spaces, or pipe). That line is
 * treated as the header; subsequent matching lines become rows.
 *
 * PDFs are notoriously poor source-of-truth for tabular data; if confident
 * structure can't be detected we return an error so the UI can prompt the
 * user to re-upload as CSV or Excel.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedTable> {
  let text: string;
  try {
    const result = await pdfParse(buffer);
    text = result.text;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { headers: [], rows: [], error: `Could not read PDF: ${message}` };
  }

  if (!text || text.trim().length === 0) {
    return { headers: [], rows: [], error: 'PDF contained no extractable text' };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const delimiters = [
    { name: 'tab', regex: /\t/, split: (s: string) => s.split(/\t+/).map((p) => p.trim()) },
    { name: 'pipe', regex: /\s*\|\s*/, split: (s: string) => s.split(/\s*\|\s*/).map((p) => p.trim()) },
    {
      name: 'multispace',
      regex: /\s{2,}/,
      split: (s: string) => s.split(/\s{2,}/).map((p) => p.trim()),
    },
  ];

  for (const { regex, split } of delimiters) {
    const candidate = findTable(lines, regex, split);
    if (candidate) return candidate;
  }

  return {
    headers: [],
    rows: [],
    error: 'Could not detect table structure. Please upload CSV or Excel instead.',
  };
}

function findTable(
  lines: string[],
  delimiterRegex: RegExp,
  split: (s: string) => string[],
): ParsedTable | null {
  let headers: string[] | null = null;
  let expectedColumnCount = 0;
  const rows: Record<string, string>[] = [];

  for (const line of lines) {
    if (!delimiterRegex.test(line)) continue;
    const parts = split(line).filter((p) => p.length > 0);
    if (parts.length < 2) continue;

    if (!headers) {
      headers = parts.map((p) => p.replace(/\s+/g, ' ').trim());
      expectedColumnCount = headers.length;
      continue;
    }

    // Only accept rows whose column count is within 1 of the header count
    // (PDFs sometimes drop a column for missing values).
    if (Math.abs(parts.length - expectedColumnCount) > 1) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = parts[idx] ?? '';
    });
    rows.push(row);
  }

  if (!headers || rows.length === 0) return null;
  return { headers, rows };
}
