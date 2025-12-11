import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { parseCSV } from '@/lib/bom';

export const runtime = 'nodejs';

interface ParsedRow {
  [key: string]: string | null;
}

function parseCSVContent(content: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  if (lines.length < 1) {
    throw new Error('CSV file is empty');
  }

  const headers = parseCSVLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: ParsedRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || null;
    }

    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
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

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const organizationId = formData.get('organizationId') as string;
    const productId = formData.get('productId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
      return NextResponse.json(
        { error: 'Only CSV and Excel files are supported' },
        { status: 400 }
      );
    }

    const fileType = isCSV ? 'csv' : 'xlsx';
    const content = await file.text();

    let parsedData: { headers: string[]; rows: ParsedRow[] };

    if (isCSV) {
      parsedData = parseCSVContent(content);
    } else {
      return NextResponse.json(
        { error: 'Excel file parsing requires xlsx library. Please convert to CSV or contact support.' },
        { status: 400 }
      );
    }

    const { headers, rows } = parsedData;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in the file' },
        { status: 400 }
      );
    }

    const { data: import_record, error: insertError } = await supabase
      .from('bom_imports')
      .insert({
        organization_id: organizationId,
        product_id: productId ? parseInt(productId) : null,
        file_name: file.name,
        file_type: fileType,
        status: 'processing',
        item_count: rows.length,
        created_by: session.data.session.user.id,
      })
      .select()
      .single();

    if (insertError || !import_record) {
      return NextResponse.json(
        { error: 'Failed to create import record' },
        { status: 500 }
      );
    }

    const extracted_items = rows
      .filter(row => row['Product Name'] && String(row['Product Name']).trim().length > 0)
      .flatMap(row => extractItemsFromRow(row, import_record.id));

    if (extracted_items.length > 0) {
      const { error: itemsError } = await supabase
        .from('bom_extracted_items')
        .insert(extracted_items);

      if (itemsError) {
        await supabase
          .from('bom_imports')
          .update({ status: 'failed', error_message: 'Failed to extract items' })
          .eq('id', import_record.id);

        return NextResponse.json(
          { error: 'Failed to process file items' },
          { status: 500 }
        );
      }
    }

    await supabase
      .from('bom_imports')
      .update({
        status: 'completed',
        item_count: extracted_items.length,
      })
      .eq('id', import_record.id);

    return NextResponse.json({
      success: true,
      importId: import_record.id,
      itemCount: extracted_items.length,
      message: `Successfully imported ${extracted_items.length} items`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing the file' },
      { status: 500 }
    );
  }
}

function extractItemsFromRow(row: ParsedRow, importId: string): any[] {
  const items: any[] = [];
  const productName = row['Product Name'] || '';

  if (!productName) return items;

  for (let i = 1; i <= 3; i++) {
    const ingredientName = row[`Ingredient Name ${i}`];
    if (ingredientName && String(ingredientName).trim().length > 0) {
      items.push({
        bom_import_id: importId,
        raw_name: ingredientName,
        clean_name: String(ingredientName).trim(),
        quantity: parseFloat(row[`Ingredient Qty ${i}`] as string) || null,
        unit: row[`Ingredient Unit ${i}`] || null,
        item_type: 'ingredient',
        is_reviewed: false,
        is_imported: false,
      });
    }
  }

  const packagingType = row['Packaging Type'];
  if (packagingType && String(packagingType).trim().length > 0) {
    items.push({
      bom_import_id: importId,
      raw_name: packagingType,
      clean_name: String(packagingType).trim(),
      quantity: parseFloat(row['Packaging Weight'] as string) || null,
      unit: 'g',
      item_type: 'packaging',
      is_reviewed: false,
      is_imported: false,
    });
  }

  return items;
}
