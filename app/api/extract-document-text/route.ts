import { NextRequest, NextResponse } from 'next/server';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // 10 requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported: PDF, DOCX, TXT' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    let content = '';
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === 'text/plain') {
      // Plain text - direct conversion
      content = buffer.toString('utf-8');
    } else if (file.type === 'application/pdf') {
      // PDF extraction
      try {
        const pdfData = await pdfParse.default(buffer);
        content = pdfData.text;
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        return NextResponse.json(
          { error: 'Failed to parse PDF. The file may be corrupted or password-protected.' },
          { status: 422 }
        );
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // DOCX extraction
      try {
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } catch (docxError) {
        console.error('DOCX parsing error:', docxError);
        return NextResponse.json(
          { error: 'Failed to parse DOCX. The file may be corrupted.' },
          { status: 422 }
        );
      }
    }

    // Clean up extracted text
    content = content
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ +/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!content || content.length < 10) {
      return NextResponse.json(
        { error: 'No text content could be extracted from the document' },
        { status: 422 }
      );
    }

    // Truncate if too long (to fit in AI context)
    const maxLength = 50000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n[Content truncated due to length...]';
    }

    return NextResponse.json({
      content,
      fileName: file.name,
      fileType: file.type,
      characterCount: content.length,
    });
  } catch (error: any) {
    console.error('Error extracting document text:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract document text' },
      { status: 500 }
    );
  }
}
