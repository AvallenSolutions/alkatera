import pdfParse from 'pdf-parse';

const MAX_CHARS = 20_000;

/**
 * Extract plain text from a PDF buffer for LLM consumption. Trims
 * runs of 3+ whitespace down to a single newline so the budget is
 * spent on actual content rather than layout padding.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  const text = data.text || '';
  return text.replace(/\s{3,}/g, '\n').slice(0, MAX_CHARS);
}
