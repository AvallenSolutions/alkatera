import { describe, expect, it } from 'vitest';
import { validateSql } from '../safe-sql';

describe('validateSql', () => {
  it('accepts a well-formed SELECT with an organization_id filter', () => {
    const res = validateSql(
      `SELECT metric_key, value FROM metric_snapshots WHERE organization_id = 'abc' ORDER BY snapshot_date DESC`,
    );
    expect(res.ok).toBe(true);
  });

  it('rejects non-SELECT statements', () => {
    const res = validateSql(`UPDATE facilities SET name='x' WHERE organization_id='abc'`);
    expect(res.ok).toBe(false);
  });

  it('rejects multi-statement input', () => {
    const res = validateSql(
      `SELECT 1 FROM facilities WHERE organization_id='a'; DROP TABLE facilities`,
    );
    expect(res.ok).toBe(false);
  });

  it('rejects SQL comments', () => {
    const res = validateSql(
      `SELECT * FROM facilities WHERE organization_id='a' -- DROP`,
    );
    expect(res.ok).toBe(false);
  });

  it('rejects tables outside the whitelist', () => {
    const res = validateSql(`SELECT * FROM profiles WHERE organization_id='abc'`);
    expect(res.ok).toBe(false);
  });

  it('rejects queries missing organization_id', () => {
    const res = validateSql(`SELECT * FROM facilities`);
    expect(res.ok).toBe(false);
  });

  it('allows JOINs across whitelisted tables', () => {
    const res = validateSql(
      `SELECT p.name FROM products p JOIN product_carbon_footprints pcf ON p.id = pcf.product_id WHERE p.organization_id = 'abc'`,
    );
    expect(res.ok).toBe(true);
  });

  it('does not false-positive on column names resembling keywords', () => {
    const res = validateSql(
      `SELECT created_at, updated_at FROM facilities WHERE organization_id='abc'`,
    );
    expect(res.ok).toBe(true);
  });

  it('rejects forbidden keywords like TRUNCATE even inside a SELECT', () => {
    const res = validateSql(
      `SELECT 1 FROM facilities WHERE organization_id='abc' AND (SELECT TRUNCATE(value) FROM metric_snapshots) > 0`,
    );
    expect(res.ok).toBe(false);
  });
});
