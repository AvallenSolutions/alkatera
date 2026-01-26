import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, parseBOMFromPDFText } from '@/lib/bom/parser';
import type { BOMParseResult } from '@/lib/bom/types';

// Polyfill for Promise.withResolvers (ES2024 feature required by pdfjs-dist v4.x)
if (typeof Promise.withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker for server-side use (serverless environments don't support workers)
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const fileType = fileName.endsWith('.pdf') ? 'pdf' : 'csv';
    let result: BOMParseResult;

    if (fileType === 'csv') {
      const text = await file.text();
      const delimiter = text.includes('\t') ? '\t' : ',';
      result = parseCSV(text, delimiter);
    } else if (fileType === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();

      try {
        const pdfText = await extractTextFromPDF(arrayBuffer);
        result = parseBOMFromPDFText(pdfText);
      } catch (pdfError: any) {
        return NextResponse.json(
          { error: `Failed to parse PDF: ${pdfError.message}` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF or CSV file.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: result.success,
      items: result.items,
      errors: result.errors,
      metadata: result.metadata,
      fileType,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error('BOM parsing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse BOM file' },
      { status: 500 }
    );
  }
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item: any) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .join(' ');

    fullText += pageText + '\n';
  }

  return fullText;
}
