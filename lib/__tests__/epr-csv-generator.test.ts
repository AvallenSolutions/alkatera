import { describe, it, expect } from 'vitest';
import {
  generateRPDCSV,
  validateSubmissionLine,
} from '@/lib/epr/csv-generator';
import { RPD_CSV_HEADERS } from '@/lib/epr/constants';
import type { EPRSubmissionLine } from '@/lib/epr/types';

// =============================================================================
// Helpers — submission line fixture
// =============================================================================

function makeSubmissionLine(overrides: Partial<EPRSubmissionLine> = {}): EPRSubmissionLine {
  return {
    id: 'line-1',
    submission_id: 'sub-1',
    organization_id: 'org-1',
    product_id: 1,
    product_name: 'Test Product',
    product_material_id: 10,
    rpd_organisation_id: 'ORG001',
    rpd_subsidiary_id: null,
    rpd_organisation_size: 'L',
    rpd_submission_period: '2025-H1',
    rpd_packaging_activity: 'SO',
    rpd_packaging_type: 'HH',
    rpd_packaging_class: 'P1',
    rpd_packaging_material: 'GL',
    rpd_material_subtype: null,
    rpd_from_nation: 'EN',
    rpd_to_nation: null,
    rpd_material_weight_kg: 1500,
    rpd_material_units: null,
    rpd_transitional_weight: null,
    rpd_recyclability_rating: null,
    fee_rate_per_tonne: 200,
    estimated_fee_gbp: 300,
    is_drs_excluded: false,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// =============================================================================
// generateRPDCSV
// =============================================================================

describe('generateRPDCSV', () => {
  describe('header row', () => {
    it('produces a 15-column header row', () => {
      const csv = generateRPDCSV([]);
      const headerLine = csv.split('\r\n')[0];
      const columns = headerLine.split(',');
      expect(columns).toHaveLength(15);
    });

    it('matches the RPD_CSV_HEADERS constant', () => {
      const csv = generateRPDCSV([]);
      const headerLine = csv.split('\r\n')[0];
      expect(headerLine).toBe(RPD_CSV_HEADERS.join(','));
    });

    it('includes all expected column names', () => {
      const csv = generateRPDCSV([]);
      const headerLine = csv.split('\r\n')[0];
      expect(headerLine).toContain('Organisation ID');
      expect(headerLine).toContain('Subsidiary ID');
      expect(headerLine).toContain('Organisation Size');
      expect(headerLine).toContain('Submission Period');
      expect(headerLine).toContain('Packaging Activity');
      expect(headerLine).toContain('Packaging Type');
      expect(headerLine).toContain('Packaging Class');
      expect(headerLine).toContain('Packaging Material');
      expect(headerLine).toContain('Material Subtype');
      expect(headerLine).toContain('From Nation');
      expect(headerLine).toContain('To Nation');
      expect(headerLine).toContain('Material Weight (kg)');
      expect(headerLine).toContain('Material Units');
      expect(headerLine).toContain('Transitional Weight');
      expect(headerLine).toContain('Recyclability Rating');
    });
  });

  describe('data rows', () => {
    it('maps submission line fields to correct columns', () => {
      const line = makeSubmissionLine({
        rpd_organisation_id: 'ORG001',
        rpd_organisation_size: 'L',
        rpd_submission_period: '2025-H1',
        rpd_packaging_activity: 'SO',
        rpd_packaging_type: 'HH',
        rpd_packaging_class: 'P1',
        rpd_packaging_material: 'GL',
        rpd_from_nation: 'EN',
        rpd_material_weight_kg: 1500,
      });
      const csv = generateRPDCSV([line]);
      const lines = csv.split('\r\n');
      const dataRow = lines[1];
      const cols = dataRow.split(',');

      expect(cols[0]).toBe('ORG001');       // Organisation ID
      expect(cols[1]).toBe('');              // Subsidiary ID (null)
      expect(cols[2]).toBe('L');             // Organisation Size
      expect(cols[3]).toBe('2025-H1');       // Submission Period
      expect(cols[4]).toBe('SO');            // Packaging Activity
      expect(cols[5]).toBe('HH');            // Packaging Type
      expect(cols[6]).toBe('P1');            // Packaging Class
      expect(cols[7]).toBe('GL');            // Packaging Material
      expect(cols[8]).toBe('');              // Material Subtype (null)
      expect(cols[9]).toBe('EN');            // From Nation
      expect(cols[10]).toBe('');             // To Nation (null)
      expect(cols[11]).toBe('1500');         // Material Weight (kg)
    });
  });

  describe('CRLF line endings', () => {
    it('uses \\r\\n line endings', () => {
      const csv = generateRPDCSV([makeSubmissionLine()]);
      expect(csv).toContain('\r\n');
      // Should not have standalone \n without preceding \r
      const withoutCRLF = csv.replace(/\r\n/g, '');
      expect(withoutCRLF).not.toContain('\n');
    });

    it('ends with a trailing CRLF', () => {
      const csv = generateRPDCSV([makeSubmissionLine()]);
      expect(csv.endsWith('\r\n')).toBe(true);
    });
  });

  describe('whole kg rounding', () => {
    it('rounds weight to nearest whole kilogram', () => {
      const line = makeSubmissionLine({ rpd_material_weight_kg: 1500.7 });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[11]).toBe('1501');
    });

    it('rounds 0.4 down to 0', () => {
      const line = makeSubmissionLine({ rpd_material_weight_kg: 0.4 });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[11]).toBe('0');
    });

    it('rounds 0.5 up to 1', () => {
      const line = makeSubmissionLine({ rpd_material_weight_kg: 0.5 });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[11]).toBe('1');
    });
  });

  describe('CSV escaping', () => {
    it('wraps fields containing commas in double quotes', () => {
      const line = makeSubmissionLine({ rpd_organisation_id: 'ORG,001' });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      expect(dataRow.startsWith('"ORG,001"')).toBe(true);
    });

    it('escapes double quotes within fields by doubling them', () => {
      const line = makeSubmissionLine({ rpd_organisation_id: 'ORG"001' });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      expect(dataRow.startsWith('"ORG""001"')).toBe(true);
    });

    it('wraps fields containing newlines in double quotes', () => {
      const line = makeSubmissionLine({ rpd_organisation_id: 'ORG\n001' });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      expect(dataRow).toContain('"ORG\n001"');
    });
  });

  describe('empty optional fields', () => {
    it('leaves subsidiary_id blank when null', () => {
      const line = makeSubmissionLine({ rpd_subsidiary_id: null });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[1]).toBe('');
    });

    it('leaves material_subtype blank when null', () => {
      const line = makeSubmissionLine({ rpd_material_subtype: null });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[8]).toBe('');
    });

    it('leaves to_nation blank when null', () => {
      const line = makeSubmissionLine({ rpd_to_nation: null });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[10]).toBe('');
    });

    it('leaves material_units blank when null', () => {
      const line = makeSubmissionLine({ rpd_material_units: null });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[12]).toBe('');
    });

    it('leaves transitional_weight blank when null', () => {
      const line = makeSubmissionLine({ rpd_transitional_weight: null });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[13]).toBe('');
    });

    it('leaves recyclability_rating blank when null', () => {
      const line = makeSubmissionLine({ rpd_recyclability_rating: null });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[14]).toBe('');
    });
  });

  describe('multiple rows', () => {
    it('generates correct number of rows (header + data)', () => {
      const lines = [makeSubmissionLine(), makeSubmissionLine()];
      const csv = generateRPDCSV(lines);
      // Split by CRLF; last entry is empty due to trailing CRLF
      const rows = csv.split('\r\n').filter(r => r.length > 0);
      expect(rows).toHaveLength(3); // 1 header + 2 data
    });
  });

  describe('material units and transitional weight when present', () => {
    it('outputs material_units as string when provided', () => {
      const line = makeSubmissionLine({ rpd_material_units: 5000 });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[12]).toBe('5000');
    });

    it('outputs transitional_weight as string when provided', () => {
      const line = makeSubmissionLine({ rpd_transitional_weight: 123.45 });
      const csv = generateRPDCSV([line]);
      const dataRow = csv.split('\r\n')[1];
      const cols = dataRow.split(',');
      expect(cols[13]).toBe('123.45');
    });
  });
});

// =============================================================================
// validateSubmissionLine
// =============================================================================

describe('validateSubmissionLine', () => {
  describe('required fields', () => {
    it('returns no errors for a fully valid line', () => {
      const line = makeSubmissionLine();
      const errors = validateSubmissionLine(line);
      expect(errors).toHaveLength(0);
    });

    it('reports missing organisation_id', () => {
      const errors = validateSubmissionLine({ rpd_organisation_id: '' });
      expect(errors).toContain('Organisation ID is required');
    });

    it('reports missing organisation_size', () => {
      const errors = validateSubmissionLine({ rpd_organisation_id: 'X' });
      expect(errors).toContain('Organisation Size is required');
    });

    it('reports missing submission_period', () => {
      const errors = validateSubmissionLine({
        rpd_organisation_id: 'X',
        rpd_organisation_size: 'L' as any,
      });
      expect(errors).toContain('Submission Period is required');
    });

    it('reports missing packaging_activity', () => {
      const errors = validateSubmissionLine({
        rpd_organisation_id: 'X',
        rpd_organisation_size: 'L' as any,
        rpd_submission_period: '2025-H1',
      });
      expect(errors).toContain('Packaging Activity is required');
    });

    it('reports missing packaging_type', () => {
      const errors = validateSubmissionLine({
        rpd_organisation_id: 'X',
        rpd_organisation_size: 'L' as any,
        rpd_submission_period: '2025-H1',
        rpd_packaging_activity: 'SO' as any,
      });
      expect(errors).toContain('Packaging Type is required');
    });

    it('reports missing packaging_class', () => {
      const errors = validateSubmissionLine({
        rpd_organisation_id: 'X',
        rpd_organisation_size: 'L' as any,
        rpd_submission_period: '2025-H1',
        rpd_packaging_activity: 'SO' as any,
        rpd_packaging_type: 'HH' as any,
      });
      expect(errors).toContain('Packaging Class is required');
    });

    it('reports missing packaging_material', () => {
      const errors = validateSubmissionLine({
        rpd_organisation_id: 'X',
        rpd_organisation_size: 'L' as any,
        rpd_submission_period: '2025-H1',
        rpd_packaging_activity: 'SO' as any,
        rpd_packaging_type: 'HH' as any,
        rpd_packaging_class: 'P1',
      });
      expect(errors).toContain('Packaging Material is required');
    });

    it('reports missing from_nation', () => {
      const errors = validateSubmissionLine({
        rpd_organisation_id: 'X',
        rpd_organisation_size: 'L' as any,
        rpd_submission_period: '2025-H1',
        rpd_packaging_activity: 'SO' as any,
        rpd_packaging_type: 'HH' as any,
        rpd_packaging_class: 'P1',
        rpd_packaging_material: 'GL' as any,
      });
      expect(errors).toContain('From Nation is required');
    });

    it('reports error when material_weight_kg is zero', () => {
      const line = makeSubmissionLine({ rpd_material_weight_kg: 0 });
      const errors = validateSubmissionLine(line);
      expect(errors).toContain('Material Weight must be a positive number');
    });

    it('reports error when material_weight_kg is negative', () => {
      const line = makeSubmissionLine({ rpd_material_weight_kg: -5 });
      const errors = validateSubmissionLine(line);
      expect(errors).toContain('Material Weight must be a positive number');
    });

    it('reports error when material_weight_kg is null', () => {
      const errors = validateSubmissionLine({
        ...makeSubmissionLine(),
        rpd_material_weight_kg: null as any,
      });
      expect(errors).toContain('Material Weight must be a positive number');
    });
  });

  describe('drinks container units', () => {
    it('requires material_units when packaging_type is HDC', () => {
      const line = makeSubmissionLine({
        rpd_packaging_type: 'HDC',
        rpd_material_units: null,
      });
      const errors = validateSubmissionLine(line);
      expect(errors).toContain('Material Units is required for drinks containers');
    });

    it('requires material_units when packaging_type is NDC', () => {
      const line = makeSubmissionLine({
        rpd_packaging_type: 'NDC',
        rpd_material_units: null,
      });
      const errors = validateSubmissionLine(line);
      expect(errors).toContain('Material Units is required for drinks containers');
    });

    it('does not require material_units for HH packaging type', () => {
      const line = makeSubmissionLine({
        rpd_packaging_type: 'HH',
        rpd_material_units: null,
      });
      const errors = validateSubmissionLine(line);
      expect(errors).not.toContain('Material Units is required for drinks containers');
    });

    it('passes validation when HDC has material_units set', () => {
      const line = makeSubmissionLine({
        rpd_packaging_type: 'HDC',
        rpd_material_units: 5000,
      });
      const errors = validateSubmissionLine(line);
      expect(errors).not.toContain('Material Units is required for drinks containers');
    });
  });

  describe('completely empty partial line', () => {
    it('reports multiple errors for empty input', () => {
      const errors = validateSubmissionLine({});
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Organisation ID is required');
      expect(errors).toContain('Material Weight must be a positive number');
    });
  });
});
