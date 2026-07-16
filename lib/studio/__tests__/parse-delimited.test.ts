import { describe, it, expect } from 'vitest';
import { parseDelimited } from '@/lib/studio/parse-delimited';

describe('parseDelimited', () => {
  it('parses tab-separated pasted rows (Excel/Sheets default)', () => {
    const text = 'Name\tRole\nJane Smith\tChair\nJohn Doe\tDirector';
    const { headers, rows } = parseDelimited(text);
    expect(headers).toEqual(['Name', 'Role']);
    expect(rows).toEqual([
      { Name: 'Jane Smith', Role: 'Chair' },
      { Name: 'John Doe', Role: 'Director' },
    ]);
  });

  it('parses comma-separated CSV', () => {
    const text = 'Name,Role\nJane Smith,Chair';
    const { headers, rows } = parseDelimited(text);
    expect(headers).toEqual(['Name', 'Role']);
    expect(rows).toEqual([{ Name: 'Jane Smith', Role: 'Chair' }]);
  });

  it('handles quoted fields with embedded commas', () => {
    const text = 'Name,Notes\n"Smith, Jane","Likes, commas"';
    const { rows } = parseDelimited(text);
    expect(rows).toEqual([{ Name: 'Smith, Jane', Notes: 'Likes, commas' }]);
  });

  it('drops blank trailing rows', () => {
    const text = 'Name,Role\nJane,Chair\n\n';
    const { rows } = parseDelimited(text);
    expect(rows).toHaveLength(1);
  });

  it('returns empty arrays for empty input', () => {
    expect(parseDelimited('')).toEqual({ headers: [], rows: [] });
    expect(parseDelimited('   ')).toEqual({ headers: [], rows: [] });
  });
});
