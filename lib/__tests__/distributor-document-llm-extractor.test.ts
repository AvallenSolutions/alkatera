import { describe, it, expect } from 'vitest';
import { parseJsonObject } from '@/lib/distributor/document-processing/llm-document-extractor';

describe('parseJsonObject (from LLM response)', () => {
  it('parses a raw JSON object', () => {
    const result = parseJsonObject('{"bcorp_certified": true, "founding_year": 1810}');
    expect(result).toEqual({ bcorp_certified: true, founding_year: 1810 });
  });

  it('strips ```json code fences', () => {
    const wrapped = '```json\n{"bcorp_certified": true}\n```';
    expect(parseJsonObject(wrapped)).toEqual({ bcorp_certified: true });
  });

  it('strips ``` code fences without language tag', () => {
    expect(parseJsonObject('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('extracts the JSON object even when surrounded by prose', () => {
    const prose = 'Here is what I found:\n\n{"founding_year": 1923}\n\nLet me know if you need more.';
    expect(parseJsonObject(prose)).toEqual({ founding_year: 1923 });
  });

  it('returns null for invalid JSON', () => {
    expect(parseJsonObject('not json at all')).toBeNull();
  });

  it('returns null for an array (we only accept objects)', () => {
    expect(parseJsonObject('[1, 2, 3]')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(parseJsonObject('')).toBeNull();
  });
});
