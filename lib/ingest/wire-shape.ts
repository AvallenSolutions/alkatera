/**
 * Wire-shape helpers for Smart Upload job payloads.
 *
 * ingest_jobs.result_payload is the shaped format from shapeIngestResult():
 * `{ type, <wrapperKey>: payload }`. Both the feedback route and the
 * reclassify route need to unwrap it back to the flat classifier payload, so
 * the mapping lives here once. Zero I/O, relative-import-safe.
 */

export const WRAPPER_KEYS: Record<string, string> = {
  utility_bill: 'utilityBill',
  water_bill: 'waterBill',
  waste_bill: 'wasteBill',
  bulk_xlsx: 'xlsx',
  spray_diary: 'sprayDiary',
  bom: 'bom',
  supplier_invoice: 'supplierInvoice',
  freight_invoice: 'freightInvoice',
  refrigerant_service: 'refrigerantService',
  packaging_spec: 'packagingSpec',
  supplier_coa: 'supplierCoa',
  certification: 'certification',
  soil_carbon_lab: 'soilCarbonLab',
  soil_carbon_evidence: 'soilCarbonEvidence',
  accounts_csv: 'accountsCsv',
  smart_meter_csv: 'smartMeter',
  historical_sustainability_report: 'historicalSustainabilityReport',
  historical_lca_report: 'historicalLcaReport',
  hospitality_menu: 'hospitalityMenu',
  pos_sales_export: 'posSalesExport',
};

/** Unwrap a shaped result_payload back to the flat classifier payload. */
export function unwrapResultPayload(
  resultType: string | null | undefined,
  resultPayload: unknown,
): Record<string, unknown> {
  if (!resultType || !resultPayload || typeof resultPayload !== 'object') return {};
  const wrapperKey = WRAPPER_KEYS[resultType];
  if (!wrapperKey) return {};
  const inner = (resultPayload as Record<string, unknown>)[wrapperKey];
  return inner && typeof inner === 'object' && !Array.isArray(inner)
    ? (inner as Record<string, unknown>)
    : {};
}
