/**
 * PDFShift API Client
 *
 * Thin wrapper around the PDFShift HTML-to-PDF conversion API.
 * Uses Chromium under the hood for pixel-perfect rendering.
 *
 * @see https://docs.pdfshift.io/api-reference/convert-to-pdf
 */

const PDFSHIFT_API_URL = 'https://api.pdfshift.io/v3/convert/pdf';

export interface PdfShiftOptions {
  /** Page format: A4 (default), Letter, A3, etc. */
  format?: string;
  /** Landscape orientation (default: false / portrait) */
  landscape?: boolean;
  /** Page margins in CSS units (e.g., '0', '10mm') */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  /** Zoom factor (0.1 to 2.0, default: 1) */
  zoom?: number;
  /** Use sandbox mode (free, adds watermark) */
  sandbox?: boolean;
  /** Remove trailing blank pages */
  removeBlank?: boolean;
  /** Inject custom CSS */
  css?: string;
  /** Inject custom JavaScript */
  javascript?: string;
  /** Disable printing of background graphics */
  disableBackgrounds?: boolean;
}

export interface PdfShiftResponse {
  /** PDF binary buffer */
  buffer: Buffer;
  /** File size in bytes */
  filesize?: number;
  /** Number of pages in the PDF */
  pages?: number;
}

/**
 * Convert an HTML string to PDF using the PDFShift API.
 *
 * @param html - Complete HTML document string
 * @param options - PDF generation options
 * @returns PDF buffer and metadata
 * @throws Error if API key is missing or conversion fails
 */
export async function convertHtmlToPdf(
  html: string,
  options: PdfShiftOptions = {}
): Promise<PdfShiftResponse> {
  const apiKey = process.env.PDFSHIFT_API_KEY;

  if (!apiKey) {
    throw new Error(
      'PDFSHIFT_API_KEY environment variable is not set. ' +
      'Get your API key from https://app.pdfshift.io'
    );
  }

  const body: Record<string, unknown> = {
    source: html,
    format: options.format || 'A4',
    landscape: options.landscape || false,
    sandbox: options.sandbox ?? false,
  };

  if (options.margin) {
    body.margin = options.margin;
  }

  if (options.zoom !== undefined) {
    body.zoom = options.zoom;
  }

  if (options.removeBlank) {
    body.remove_blank = true;
  }

  if (options.css) {
    body.css = options.css;
  }

  if (options.javascript) {
    body.javascript = options.javascript;
  }

  if (options.disableBackgrounds) {
    body.disable_backgrounds = true;
  }

  // Retry up to 2 times on transient failures
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(PDFSHIFT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `PDFShift API error (${response.status}): ${errorMessage}`
          );
        }

        // Retry on server errors (5xx)
        lastError = new Error(
          `PDFShift API error (${response.status}): ${errorMessage}`
        );
        continue;
      }

      const pdfBuffer = Buffer.from(await response.arrayBuffer());

      return {
        buffer: pdfBuffer,
        filesize: pdfBuffer.length,
        pages: parseInt(response.headers.get('x-pdfshift-pages') || '0', 10) || undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('PDFShift API error (4')) {
        throw error; // Don't retry client errors
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('PDFShift conversion failed after retries');
}
