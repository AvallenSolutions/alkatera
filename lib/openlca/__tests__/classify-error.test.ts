/**
 * The match ordering in classifyOpenLcaError is load-bearing: the resolver
 * permanently writes openlca_no_match to product_materials when both
 * databases report process_not_found, so server-state errors whose messages
 * happen to contain "not found" must never classify as process_not_found
 * (CODE_REVIEW_2026-06-10.md B5).
 */
import { describe, it, expect } from 'vitest';
import { classifyOpenLcaError } from '../classify-error';

describe('classifyOpenLcaError', () => {
  it('classifies a genuine 404 as process_not_found', () => {
    expect(classifyOpenLcaError(new Error('HTTP 404: Not Found')).code).toBe('process_not_found');
    expect(classifyOpenLcaError(new Error('Process abc does not exist')).code).toBe('process_not_found');
  });

  it('does NOT classify a missing impact method as process_not_found', () => {
    // Exact message shape from lib/openlca/client.ts:590
    const r = classifyOpenLcaError(new Error('Impact method not found: ReCiPe 2016 Midpoint (H)'));
    expect(r.code).toBe('method_not_found');
    expect(r.status).toBe(422);
  });

  it('does NOT classify a disposed calculation result as process_not_found', () => {
    // Exact message shape from lib/openlca/client.ts:339
    const r = classifyOpenLcaError(
      new Error('Calculation result xyz not found - it may have been disposed or failed'),
    );
    expect(r.code).toBe('calculation_error');
    expect(r.status).toBe(500);
  });

  it('classifies empty impact arrays as no_impacts', () => {
    expect(classifyOpenLcaError(new Error('No impact results returned')).code).toBe('no_impacts');
  });

  it('classifies timeouts as timeout', () => {
    expect(classifyOpenLcaError(new Error('Request timed out after 45000ms')).code).toBe('timeout');
    expect(classifyOpenLcaError(new Error('poll timeout exceeded')).code).toBe('timeout');
  });

  it('defaults to calculation_error', () => {
    expect(classifyOpenLcaError(new Error('engine state borked')).code).toBe('calculation_error');
    expect(classifyOpenLcaError(undefined).code).toBe('calculation_error');
  });
});
