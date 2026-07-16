import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

// Mock the Anthropic SDK so no real API calls happen. Each test programmes
// the next tool_use answer via mockToolUse().
const createMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

import {
  classifyDocument,
  detectFileKind,
  extractWithForcedTool,
  RECLASSIFY_TARGETS,
} from '../classify-document';

function mockToolUse(name: string, input: Record<string, unknown> = {}) {
  createMock.mockResolvedValueOnce({
    content: [{ type: 'tool_use', name, input }],
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

function workbookBytes(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

beforeEach(() => {
  createMock.mockReset();
});

describe('detectFileKind', () => {
  it('classifies by extension and mime', () => {
    expect(detectFileKind('a.csv', '')).toBe('csv');
    expect(detectFileKind('a.xlsx', '')).toBe('xlsx');
    expect(detectFileKind('a.xls', '')).toBe('xlsx');
    expect(detectFileKind('a.pdf', 'application/pdf')).toBe('pdf');
    expect(detectFileKind('a.jpg', 'image/jpeg')).toBe('image');
    expect(detectFileKind('a.docx', 'application/msword')).toBe('other');
  });
});

describe('classifyDocument routing', () => {
  it('still short-circuits half-hourly smart-meter CSVs without calling Claude', async () => {
    const rows = ['Timestamp,kWh'];
    for (let i = 0; i < 48; i++) {
      const hh = String(Math.floor(i / 2)).padStart(2, '0');
      const mm = i % 2 === 0 ? '00' : '30';
      rows.push(`01/01/2026 ${hh}:${mm},0.5`);
    }
    const result = await classifyDocument({
      fileBytes: new TextEncoder().encode(rows.join('\n')),
      fileName: 'meter.csv',
      fileMime: 'text/csv',
    });
    expect(result.type).toBe('smart_meter_csv');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('still short-circuits the bulk product-import template without calling Claude', async () => {
    const bytes = workbookBytes({
      Products: [['name', 'sku'], ['Gin', 'GIN-1']],
    });
    const result = await classifyDocument({
      fileBytes: bytes,
      fileName: 'import.xlsx',
      fileMime: XLSX_MIME,
    });
    expect(result.type).toBe('bulk_xlsx');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('sends a non-template workbook to Claude as serialised text', async () => {
    mockToolUse('identify_bom', { product_name: 'The Green One' });
    const bytes = workbookBytes({
      Sheet1: [
        ['Order of Addition', 'RTD Recipe', 'g/Litre RTD'],
        [2, 'White Grape Juice Concentrate', 47.856],
        [1, 'Glycerine', 30],
      ],
    });
    const result = await classifyDocument({
      fileBytes: bytes,
      fileName: 'BEV 25 recipe.xlsx',
      fileMime: XLSX_MIME,
    });

    expect(result.type).toBe('bom');
    expect(result.payload.product_name).toBe('The Green One');
    expect(createMock).toHaveBeenCalledTimes(1);

    const call = createMock.mock.calls[0][0];
    const content = call.messages[0].content;
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('<spreadsheet_content>');
    expect(content[0].text).toContain('White Grape Juice Concentrate');
    expect(content[1].text).toContain('Uploaded file name: BEV 25 recipe.xlsx');
    expect(call.tool_choice).toEqual({ type: 'any' });
    const toolNames = call.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('identify_spray_diary');
    expect(toolNames).toContain('identify_accounts_csv');
    expect(toolNames).toContain('identify_bom');
  });

  it('sends a non-meter CSV to Claude instead of assuming accounts_csv', async () => {
    mockToolUse('identify_accounts_csv', { source_hint: 'Xero' });
    const csv = 'Date,Description,Amount\n2026-01-05,Stationery,42.50\n2026-01-08,Software,99.00';
    const result = await classifyDocument({
      fileBytes: new TextEncoder().encode(csv),
      fileName: 'ledger.csv',
      fileMime: 'text/csv',
    });
    expect(result.type).toBe('accounts_csv');
    expect(String(result.payload.note)).toContain('Xero');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('maps identify_spray_diary with sheet names to the existing payload shape', async () => {
    mockToolUse('identify_spray_diary', {
      note: 'Vineyard spray records for 2026',
      sheet_names: ['April', 'May'],
    });
    const bytes = workbookBytes({
      April: [['Date', 'Product', 'Rate/ha'], ['01/04/2026', 'Sulphur', 5]],
      May: [['Date', 'Product', 'Rate/ha'], ['02/05/2026', 'Copper', 2]],
    });
    const result = await classifyDocument({
      fileBytes: bytes,
      fileName: 'spray diary.xlsx',
      fileMime: XLSX_MIME,
    });
    expect(result.type).toBe('spray_diary');
    expect(result.payload).toEqual({
      sheetNames: ['April', 'May'],
      note: 'Vineyard spray records for 2026',
    });
  });

  it('defaults spray diary sheetNames to an empty array for PDFs', async () => {
    mockToolUse('identify_spray_diary', { note: 'Paper spray log' });
    const result = await classifyDocument({
      fileBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      fileName: 'diary.pdf',
      fileMime: 'application/pdf',
    });
    expect(result.type).toBe('spray_diary');
    expect(result.payload.sheetNames).toEqual([]);
  });

  it('returns unsupported for unknown file kinds without calling Claude', async () => {
    const result = await classifyDocument({
      fileBytes: new Uint8Array([1, 2, 3]),
      fileName: 'notes.docx',
      fileMime: 'application/msword',
    });
    expect(result.type).toBe('unsupported');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('forces the chosen tool on reclassify', async () => {
    mockToolUse('identify_bom', { product_name: 'The Green One' });
    const bytes = workbookBytes({ Sheet1: [['Ingredient', 'g/L'], ['Juice', 10]] });
    const result = await extractWithForcedTool({
      fileBytes: bytes,
      fileName: 'recipe.xlsx',
      fileMime: XLSX_MIME,
      targetType: 'bom',
    });
    expect(result.type).toBe('bom');
    const call = createMock.mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'identify_bom' });
    expect(call.messages[0].content[1].text).toContain('The user has confirmed the document type');
  });

  it('reclassifies to bulk_xlsx deterministically without Claude', async () => {
    const bytes = workbookBytes({ Products: [['name'], ['Gin']] });
    const result = await extractWithForcedTool({
      fileBytes: bytes,
      fileName: 'import.xlsx',
      fileMime: XLSX_MIME,
      targetType: 'bulk_xlsx',
    });
    expect(result.type).toBe('bulk_xlsx');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('refuses smart_meter_csv reclassify on a non-meter file', async () => {
    const result = await extractWithForcedTool({
      fileBytes: new TextEncoder().encode('a,b\n1,2'),
      fileName: 'random.csv',
      fileMime: 'text/csv',
      targetType: 'smart_meter_csv',
    });
    expect(result.type).toBe('unsupported');
    expect(String(result.payload.reason)).toContain('half-hourly');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('exposes a tool mapping for every reclassifiable type', () => {
    for (const [type, tool] of Object.entries(RECLASSIFY_TARGETS)) {
      expect(typeof tool, `tool for ${type}`).toBe('string');
    }
    // The two deterministic parsers are intentionally NOT in the map.
    expect(RECLASSIFY_TARGETS).not.toHaveProperty('bulk_xlsx');
    expect(RECLASSIFY_TARGETS).not.toHaveProperty('smart_meter_csv');
    expect(RECLASSIFY_TARGETS).not.toHaveProperty('unsupported');
  });

  it('strips confidence fields out of the payload into meta', async () => {
    mockToolUse('identify_spray_diary', {
      note: 'Spray records',
      classification_confidence: 'low',
      second_choice_type: 'bom',
    });
    const bytes = workbookBytes({ S: [['Date', 'Product'], ['01/04/2026', 'Sulphur']] });
    const result = await classifyDocument({
      fileBytes: bytes,
      fileName: 'diary.xlsx',
      fileMime: XLSX_MIME,
    });
    expect(result.meta).toEqual({ confidence: 'low', alternate: 'bom' });
    expect(result.payload).not.toHaveProperty('classification_confidence');
    expect(result.payload).not.toHaveProperty('second_choice_type');
    // Every tool schema advertises the confidence fields.
    const tools = createMock.mock.calls[0][0].tools;
    for (const t of tools) {
      expect(t.input_schema.properties).toHaveProperty('classification_confidence');
    }
  });

  it('passes org context through as a trailing text block', async () => {
    mockToolUse('identify_bom', {});
    const bytes = workbookBytes({ Sheet1: [['Ingredient', 'g/L'], ['Juice', 10]] });
    await classifyDocument({
      fileBytes: bytes,
      fileName: 'r.xlsx',
      fileMime: XLSX_MIME,
      orgContext: '<org_context>{"industry":"drinks"}</org_context>',
    });
    const content = createMock.mock.calls[0][0].messages[0].content;
    expect(content[2].text).toContain('<org_context>');
  });
});
