import { NextRequest, NextResponse } from 'next/server';
import { parseImportXLSX } from '@/lib/bulk-import/xlsx-parser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Please upload an Excel file (.xlsx)' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseImportXLSX(buffer);

    if (parsed.products.length === 0 && parsed.errors.length > 0) {
      return NextResponse.json(
        { error: parsed.errors[0], errors: parsed.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      summary: {
        products: parsed.products.length,
        ingredients: parsed.ingredients.length,
        packaging: parsed.packaging.length,
        errors: parsed.errors.length,
      },
    });
  } catch (error) {
    console.error('Bulk import upload error:', error);
    const message = error instanceof Error ? error.message : 'Failed to parse file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
