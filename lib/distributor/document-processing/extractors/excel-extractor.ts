import * as XLSX from 'xlsx';

const MAX_CHARS = 20_000;

/**
 * Flatten every sheet of an Excel workbook into a labelled plain-text
 * blob. Sheet names are prefixed so the LLM can use them as context
 * (e.g. "Sheet: Scope 1 emissions" cues the model that the numbers
 * underneath relate to scope 1).
 */
export function extractTextFromExcel(buffer: Buffer): string {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return '';
  }
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) parts.push(`Sheet: ${sheetName}\n${csv}`);
    if (parts.join('\n\n').length > MAX_CHARS) break;
  }
  return parts.join('\n\n').slice(0, MAX_CHARS);
}
