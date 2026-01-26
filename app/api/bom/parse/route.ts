import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, parseBOMFromPDFText } from '@/lib/bom/parser';
import type { BOMParseResult } from '@/lib/bom/types';
import pdfParse from 'pdf-parse';

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
      const buffer = Buffer.from(arrayBuffer);

      try {
        const pdfData = await pdfParse(buffer);

        // Log first 2000 chars of extracted text for debugging
        console.log('=== PDF RAW TEXT START ===');
        console.log(pdfData.text.substring(0, 2000));
        console.log('=== PDF RAW TEXT END ===');

        result = parseBOMFromPDFText(pdfData.text);

        // Log parsed results for debugging
        console.log('=== PARSED ITEMS ===');
        console.log(JSON.stringify(result.items.slice(0, 3), null, 2));
      } catch (pdfError: any) {
        console.error('PDF parsing error:', pdfError);
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

    // Include debug info to help diagnose parsing issues
    const debugInfo = fileType === 'pdf' ? {
      rawTextSample: (result as any)._rawTextSample,
    } : undefined;

    return NextResponse.json({
      success: result.success,
      items: result.items,
      errors: result.errors,
      metadata: result.metadata,
      fileType,
      fileName: file.name,
      debug: debugInfo,
    });
  } catch (error: any) {
    console.error('BOM parsing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse BOM file' },
      { status: 500 }
    );
  }
}
