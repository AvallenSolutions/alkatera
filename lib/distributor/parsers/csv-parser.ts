export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  error?: string;
}

/**
 * Parse a single CSV/TSV line into cells, honouring double-quoted fields
 * and the standard "" → " escape. Mirrors the parser in lib/bom/parser.ts
 * but exposes a generic { headers, rows } shape rather than a BOM-specific
 * result.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Parse a CSV / TSV blob into a { headers, rows } shape. The delimiter is
 * auto-detected (tab beats comma if the file contains tabs).
 */
export function parseCSV(content: string): ParsedTable {
  const text = content.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], error: 'File is empty' };
  }
  if (lines.length < 2) {
    return { headers: [], rows: [], error: 'File must contain a header row and at least one data row' };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseCSVLine(lines[0], delimiter);

  if (headers.length === 0 || headers.every((h) => h.length === 0)) {
    return { headers: [], rows: [], error: 'Header row is empty' };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.every((v) => v.length === 0)) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}
