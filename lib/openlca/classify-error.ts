/**
 * Maps raw OpenLCA client errors onto the stable error vocabulary the
 * calculate route returns and the waterfall resolver consumes.
 *
 * ORDERING MATTERS: `process_not_found` is the signal the resolver uses to
 * (a) retry the alternate database and (b) permanently write
 * `openlca_no_match` to product_materials when both databases 404. The
 * client's "Impact method not found: ..." and "Calculation result ... not
 * found" messages also contain "not found", so the specific server-side
 * failures MUST be matched before the generic 404 sniff — otherwise a
 * transient server problem (LCIA method missing after a gdt-server reload, a
 * disposed calculation result) is recorded as "this material has no process
 * on either database" and silently downgrades it to proxy factors on every
 * future recalculation.
 */
export type OpenLcaErrorCode =
  | 'process_not_found'   // the UUID doesn't exist on the targeted database
  | 'no_impacts'          // process resolved but produced no calculable impacts
  | 'method_not_found'    // requested impact method missing on the server
  | 'timeout'             // the calculation/poll exceeded its time budget
  | 'calculation_error';  // anything else (engine state error, etc.)

export function classifyOpenLcaError(error: unknown): {
  status: number;
  code: OpenLcaErrorCode;
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();

  // Requested LCIA method missing on the server — a server-state problem,
  // NOT evidence the process is absent. Must precede the 404 sniff.
  if (lower.includes('impact method not found')) {
    return { status: 422, code: 'method_not_found', message: 'Impact method not available on this server' };
  }
  // A calculation result that was disposed or failed server-side — again a
  // transient/engine condition, not a missing process. Must precede the 404 sniff.
  if (lower.includes('calculation result') && lower.includes('not found')) {
    return { status: 500, code: 'calculation_error', message: 'OpenLCA calculation failed' };
  }
  // Empty impact array from a calculable-looking process.
  if (lower.includes('no impact results')) {
    return { status: 422, code: 'no_impacts', message: 'Process produced no calculable impacts' };
  }
  // Timed out (our own client timeout or a poll budget exhaustion).
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return { status: 504, code: 'timeout', message: 'OpenLCA calculation timed out' };
  }
  // getProcess() / any data fetch returning 404 → the process is simply not on
  // this database. This is the signal the resolver uses to retry the alternate
  // server (e.g. an Agribalyse UUID accidentally pointed at the ecoinvent one).
  if (lower.includes('404') || lower.includes('not found') || lower.includes('does not exist')) {
    return { status: 404, code: 'process_not_found', message: 'Process not found on this database' };
  }
  // Default: a genuine engine/calculation failure.
  return { status: 500, code: 'calculation_error', message: 'OpenLCA calculation failed' };
}
