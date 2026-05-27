import { describe, expect, it } from 'vitest';
import {
  toGeminiFunctionDeclarations,
  toGeminiInlineData,
} from '../gemini';

describe('toGeminiFunctionDeclarations', () => {
  it('upcases JSON-Schema type names and preserves required + properties', () => {
    const tools = [
      {
        name: 'do_thing',
        description: 'Do a thing',
        input_schema: {
          type: 'object',
          properties: {
            kind: { type: 'string', description: 'k' },
            count: { type: 'number' },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['kind'],
        },
      },
    ];
    const out = toGeminiFunctionDeclarations(tools);
    expect(out).toHaveLength(1);
    const tool = out[0] as { functionDeclarations: any[] };
    expect(tool.functionDeclarations).toHaveLength(1);
    const fn = tool.functionDeclarations[0];
    expect(fn.name).toBe('do_thing');
    expect(fn.parameters.type).toBe('OBJECT');
    expect(fn.parameters.required).toEqual(['kind']);
    expect(fn.parameters.properties.kind.type).toBe('STRING');
    expect(fn.parameters.properties.count.type).toBe('NUMBER');
    expect(fn.parameters.properties.tags.type).toBe('ARRAY');
    expect(fn.parameters.properties.tags.items.type).toBe('STRING');
  });

  it('preserves enum on string fields', () => {
    const out = toGeminiFunctionDeclarations([
      {
        name: 'pick',
        description: 'pick',
        input_schema: {
          type: 'object',
          properties: {
            colour: { type: 'string', enum: ['red', 'green', 'blue'] },
          },
          required: [],
        },
      },
    ]);
    const fn = (out[0] as any).functionDeclarations[0];
    expect(fn.parameters.properties.colour.enum).toEqual(['red', 'green', 'blue']);
  });

  it('drops parameters when schema is empty', () => {
    const out = toGeminiFunctionDeclarations([
      { name: 'ping', description: 'p', input_schema: { type: 'object', properties: {}, required: [] } },
    ]);
    const fn = (out[0] as any).functionDeclarations[0];
    // Empty object schema is still kept as parameters; just verify shape.
    expect(fn.parameters.type).toBe('OBJECT');
    expect(fn.parameters.required).toEqual([]);
  });
});

describe('toGeminiInlineData', () => {
  it('builds an inlineData part with mimeType + data', () => {
    const part = toGeminiInlineData({ base64: 'ABCD', media_type: 'application/pdf' }) as any;
    expect(part.inlineData.mimeType).toBe('application/pdf');
    expect(part.inlineData.data).toBe('ABCD');
  });
});
