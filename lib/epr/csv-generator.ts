/**
 * EPR Compliance Tool — RPD CSV Generator
 *
 * Generates the exact 15-column CSV format required by the Defra
 * "Report Packaging Data" (RPD) portal.
 */

import type { EPRSubmissionLine } from './types';
import { RPD_CSV_HEADERS } from './constants';

// =============================================================================
// CSV Generation
// =============================================================================

/**
 * Generate an RPD-format CSV string from submission lines.
 *
 * Rules:
 * - 15 columns, comma-separated
 * - Header row first
 * - Material Weight as whole kilograms (integer)
 * - Empty fields as blank (not 'null' or 'undefined')
 * - Fields with commas or quotes are double-quote escaped
 * - UTF-8 encoding, CRLF line endings (Windows standard for Defra upload)
 */
export function generateRPDCSV(lines: EPRSubmissionLine[]): string {
  const rows: string[] = [];

  // Header row
  rows.push(RPD_CSV_HEADERS.join(','));

  // Data rows
  for (const line of lines) {
    const row = [
      escapeCSV(line.rpd_organisation_id),
      escapeCSV(line.rpd_subsidiary_id ?? ''),
      escapeCSV(line.rpd_organisation_size),
      escapeCSV(line.rpd_submission_period),
      escapeCSV(line.rpd_packaging_activity),
      escapeCSV(line.rpd_packaging_type),
      escapeCSV(line.rpd_packaging_class),
      escapeCSV(line.rpd_packaging_material),
      escapeCSV(line.rpd_material_subtype ?? ''),
      escapeCSV(line.rpd_from_nation),
      escapeCSV(line.rpd_to_nation ?? ''),
      String(Math.round(line.rpd_material_weight_kg)),  // Whole kg
      line.rpd_material_units != null ? String(line.rpd_material_units) : '',
      line.rpd_transitional_weight != null ? String(line.rpd_transitional_weight) : '',
      escapeCSV(line.rpd_recyclability_rating ?? ''),
    ];
    rows.push(row.join(','));
  }

  // CRLF line endings per Defra spec
  return rows.join('\r\n') + '\r\n';
}

/**
 * Calculate SHA-256 checksum of a CSV string.
 * Used for integrity verification in audit trail.
 */
export async function calculateCSVChecksum(csv: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(csv);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Escape a CSV field value per RFC 4180.
 * - If value contains comma, double-quote, or newline, wrap in double quotes
 * - Double any internal double-quotes
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate that a submission line has all required RPD fields populated.
 * Returns an array of error messages (empty if valid).
 */
export function validateSubmissionLine(line: Partial<EPRSubmissionLine>): string[] {
  const errors: string[] = [];

  if (!line.rpd_organisation_id) errors.push('Organisation ID is required');
  if (!line.rpd_organisation_size) errors.push('Organisation Size is required');
  if (!line.rpd_submission_period) errors.push('Submission Period is required');
  if (!line.rpd_packaging_activity) errors.push('Packaging Activity is required');
  if (!line.rpd_packaging_type) errors.push('Packaging Type is required');
  if (!line.rpd_packaging_class) errors.push('Packaging Class is required');
  if (!line.rpd_packaging_material) errors.push('Packaging Material is required');
  if (!line.rpd_from_nation) errors.push('From Nation is required');
  if (line.rpd_material_weight_kg == null || line.rpd_material_weight_kg <= 0) {
    errors.push('Material Weight must be a positive number');
  }

  // Material Units required for drinks containers
  if (
    (line.rpd_packaging_type === 'HDC' || line.rpd_packaging_type === 'NDC') &&
    line.rpd_material_units == null
  ) {
    errors.push('Material Units is required for drinks containers');
  }

  return errors;
}
