import { describe, it, expect } from 'vitest';
import {
  buildExtractionRequest,
  detectMode,
  parseExtractionResponse,
  stripUnsourcedNumerics,
  type ExtractedSupplierProduct,
} from '../supplier-product-extractor';

const mkNum = (value: number | null, source_quote: string | null = 'q', confidence: 'high' | 'medium' | 'low' = 'high') => ({
  value,
  confidence,
  source_quote,
});

const baseRow = (): ExtractedSupplierProduct => ({
  name: 'Test',
  product_type: 'packaging',
  unit: 'unit',
  packaging_category: 'container',
  primary_material: 'glass',
  epr_material_code: 'GL',
  epr_is_drinks_container: true,
  weight_g: mkNum(82, 'weighs 82 g'),
  recycled_content_pct: mkNum(94, '94% recycled glass'),
  recyclability_pct: mkNum(100, 'fully recyclable'),
  impact_climate: mkNum(0.091, '0.091 kg CO2e per unit'),
  impact_water: mkNum(null, null),
  impact_waste: mkNum(null, null),
  impact_land: mkNum(null, null),
  origin_country_code: 'GB',
  description: null,
  row_confidence: 'high',
});

describe('detectMode', () => {
  it('returns datasheet when input is short narrative text', () => {
    const text = 'Frugal Bottle is a paper bottle.\nIt weighs 82g and is 94% recycled.';
    expect(detectMode(text)).toBe('datasheet');
  });

  it('returns datasheet when there are fewer than 4 lines', () => {
    expect(detectMode('one line')).toBe('datasheet');
    expect(detectMode('one\ntwo\nthree')).toBe('datasheet');
  });

  it('returns catalogue when many lines have ≥3 separated columns', () => {
    const tsv = [
      'name\ttype\tweight\trecycled',
      'Bottle A\tpackaging\t82\t94',
      'Bottle B\tpackaging\t90\t60',
      'Bottle C\tpackaging\t100\t30',
      'Bottle D\tpackaging\t110\t10',
      'Bottle E\tpackaging\t120\t5',
    ].join('\n');
    expect(detectMode(tsv)).toBe('catalogue');
  });

  it('returns catalogue for CSV', () => {
    const csv = [
      'name,type,weight,recycled',
      'A,packaging,82,94',
      'B,packaging,90,60',
      'C,packaging,100,30',
      'D,packaging,110,10',
    ].join('\n');
    expect(detectMode(csv)).toBe('catalogue');
  });

  it('returns datasheet when only a few lines look tabular among long narrative', () => {
    const lines = ['Intro paragraph one', 'Intro paragraph two', 'Intro paragraph three',
      'Some prose here', 'More prose here', 'A,B,C', 'A,B,C', 'A,B,C',
      'Even more narrative', 'And another paragraph', 'Tail line'];
    expect(detectMode(lines.join('\n'))).toBe('datasheet');
  });
});

describe('stripUnsourcedNumerics', () => {
  it('preserves numerics whose source_quote is present', () => {
    const out = stripUnsourcedNumerics(baseRow());
    expect(out.weight_g.value).toBe(82);
    expect(out.recycled_content_pct.value).toBe(94);
  });

  it('nulls numerics whose source_quote is missing (hallucination guard)', () => {
    const row = { ...baseRow(), weight_g: { value: 999, confidence: 'high' as const, source_quote: null } };
    const out = stripUnsourcedNumerics(row);
    expect(out.weight_g.value).toBeNull();
    expect(out.weight_g.source_quote).toBeNull();
    expect(out.weight_g.confidence).toBe('low');
  });

  it('nulls numerics whose source_quote is whitespace only', () => {
    const row = { ...baseRow(), recycled_content_pct: { value: 50, confidence: 'high' as const, source_quote: '   ' } };
    const out = stripUnsourcedNumerics(row);
    expect(out.recycled_content_pct.value).toBeNull();
  });

  it('does not mutate non-numeric fields', () => {
    const row = baseRow();
    const out = stripUnsourcedNumerics(row);
    expect(out.name).toBe('Test');
    expect(out.packaging_category).toBe('container');
    expect(out.primary_material).toBe('glass');
  });

  it('handles every numeric field independently', () => {
    const row = baseRow();
    row.impact_water = { value: 1.5, confidence: 'high', source_quote: null };
    row.impact_waste = { value: 0.2, confidence: 'high', source_quote: 'good source' };
    const out = stripUnsourcedNumerics(row);
    expect(out.impact_water.value).toBeNull();
    expect(out.impact_waste.value).toBe(0.2);
  });
});

describe('buildExtractionRequest', () => {
  it('uses claude-sonnet-4-6 with the extract_supplier_products tool', () => {
    const req = buildExtractionRequest({ mode: 'datasheet', content: 'hello' });
    expect(req.model).toBe('claude-sonnet-4-6');
    expect(req.tools).toHaveLength(1);
    expect(req.tools![0].name).toBe('extract_supplier_products');
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'extract_supplier_products' });
  });

  it('truncates very long content to 80,000 chars to stay within token budget', () => {
    const huge = 'x'.repeat(120_000);
    const req = buildExtractionRequest({ mode: 'catalogue', content: huge });
    const userMsg = req.messages[0].content as string;
    expect(userMsg.length).toBeLessThanOrEqual(80_000 + 2_000); // truncated body + intro prose
    expect(userMsg.length).toBeGreaterThanOrEqual(80_000); // confirms truncation actually happened
  });

  it('uses different prompts for datasheet vs catalogue mode', () => {
    const datasheet = buildExtractionRequest({ mode: 'datasheet', content: 'x' });
    const catalogue = buildExtractionRequest({ mode: 'catalogue', content: 'x' });
    const dPrompt = datasheet.messages[0].content as string;
    const cPrompt = catalogue.messages[0].content as string;
    expect(dPrompt).toContain('datasheet');
    expect(cPrompt).toContain('catalogue');
    expect(dPrompt).not.toBe(cPrompt);
  });

  it('passes the filename when provided', () => {
    const req = buildExtractionRequest({
      mode: 'datasheet',
      content: 'x',
      filename: 'frugal-bottle.pdf',
    });
    expect(req.messages[0].content).toContain('frugal-bottle.pdf');
  });

  it('does not leak filename into prompt when omitted', () => {
    const req = buildExtractionRequest({ mode: 'datasheet', content: 'x' });
    expect(req.messages[0].content).not.toContain('Filename:');
  });
});

describe('parseExtractionResponse', () => {
  const wrap = (toolUse: any) =>
    ({
      content: [{ type: 'text', text: 'preamble' }, toolUse].filter(Boolean),
    } as any);

  it('returns empty result when no tool_use block is present', () => {
    const resp = wrap(null);
    const out = parseExtractionResponse(resp, 'datasheet');
    expect(out.products).toEqual([]);
    expect(out.unmapped).toEqual([]);
    expect(out.mode_used).toBe('datasheet');
  });

  it('extracts products and unmapped rows from the tool input', () => {
    const resp = wrap({
      type: 'tool_use',
      id: 't1',
      name: 'extract_supplier_products',
      input: {
        products: [baseRow()],
        unmapped: [{ raw: 'mystery row', reason: 'no name' }],
      },
    });
    const out = parseExtractionResponse(resp, 'catalogue');
    expect(out.products).toHaveLength(1);
    expect(out.products[0].name).toBe('Test');
    expect(out.unmapped[0].reason).toBe('no name');
    expect(out.mode_used).toBe('catalogue');
  });

  it('applies the hallucination guard during parsing', () => {
    const fab = baseRow();
    fab.weight_g = { value: 999, confidence: 'high', source_quote: null }; // unsourced
    const resp = wrap({
      type: 'tool_use',
      id: 't1',
      name: 'extract_supplier_products',
      input: { products: [fab], unmapped: [] },
    });
    const out = parseExtractionResponse(resp, 'datasheet');
    expect(out.products[0].weight_g.value).toBeNull();
  });

  it('tolerates missing products/unmapped arrays in the tool input', () => {
    const resp = wrap({
      type: 'tool_use',
      id: 't1',
      name: 'extract_supplier_products',
      input: {},
    });
    const out = parseExtractionResponse(resp, 'datasheet');
    expect(out.products).toEqual([]);
    expect(out.unmapped).toEqual([]);
  });
});
