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
        result = parseBOMFromPDFText(pdfData.text);
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
