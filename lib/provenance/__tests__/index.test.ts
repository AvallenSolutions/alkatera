import { describe, expect, it } from 'vitest';
import {
  confidenceToScale,
  provenanceFromDataQuality,
  provenanceFromEfSourceType,
  provenanceFromLegacy,
  provenanceFromPcfStatus,
  provenanceFromQuantitiesStatus,
  PROVENANCE_VALUES,
} from '../index';

describe('PROVENANCE_VALUES', () => {
  it('lists all three states', () => {
    expect(PROVENANCE_VALUES).toEqual(['estimated', 'drafted', 'confirmed']);
  });
});

describe('provenanceFromPcfStatus', () => {
  it('maps the three documented statuses per the plan', () => {
    expect(provenanceFromPcfStatus('estimate')).toBe('estimated');
    expect(provenanceFromPcfStatus('draft')).toBe('drafted');
    expect(provenanceFromPcfStatus('completed')).toBe('confirmed');
  });

  it('treats a superseded record as confirmed (it was completed once)', () => {
    expect(provenanceFromPcfStatus('superseded')).toBe('confirmed');
  });

  it('defaults pending, failed, null and unknown values to estimated', () => {
    expect(provenanceFromPcfStatus('pending')).toBe('estimated');
    expect(provenanceFromPcfStatus('failed')).toBe('estimated');
    expect(provenanceFromPcfStatus(null)).toBe('estimated');
    expect(provenanceFromPcfStatus(undefined)).toBe('estimated');
    expect(provenanceFromPcfStatus('made-up-status')).toBe('estimated');
  });

  it('maps the review-workflow states defensively, in case a caller passes review_status by mistake', () => {
    expect(provenanceFromPcfStatus('approved')).toBe('confirmed');
    expect(provenanceFromPcfStatus('published')).toBe('confirmed');
    expect(provenanceFromPcfStatus('ready_for_review')).toBe('drafted');
    expect(provenanceFromPcfStatus('under_review')).toBe('drafted');
    expect(provenanceFromPcfStatus('revision_required')).toBe('drafted');
  });
});

describe('provenanceFromQuantitiesStatus', () => {
  it('maps the three hospitality QuantitiesStatus values per the plan', () => {
    expect(provenanceFromQuantitiesStatus('unconfirmed')).toBe('drafted');
    expect(provenanceFromQuantitiesStatus('estimated')).toBe('estimated');
    expect(provenanceFromQuantitiesStatus('confirmed')).toBe('confirmed');
  });

  it('defaults null and unknown values to drafted (a placeholder awaiting a look)', () => {
    expect(provenanceFromQuantitiesStatus(null)).toBe('drafted');
    expect(provenanceFromQuantitiesStatus(undefined)).toBe('drafted');
    expect(provenanceFromQuantitiesStatus('made-up')).toBe('drafted');
  });
});

describe('provenanceFromDataQuality', () => {
  it('maps utility_data_entries.data_quality (actual/estimated)', () => {
    expect(provenanceFromDataQuality('actual')).toBe('confirmed');
    expect(provenanceFromDataQuality('estimated')).toBe('estimated');
  });

  it('maps facility_activity_entries.data_provenance (primary_*/secondary_*)', () => {
    expect(provenanceFromDataQuality('primary_supplier_verified')).toBe('confirmed');
    expect(provenanceFromDataQuality('primary_measured_onsite')).toBe('confirmed');
    expect(provenanceFromDataQuality('secondary_calculated_allocation')).toBe('estimated');
    expect(provenanceFromDataQuality('secondary_modelled_industry_average')).toBe('estimated');
  });

  it('maps fleet_activities.data_quality tiers (Primary/Secondary/Tertiary), case-insensitively', () => {
    expect(provenanceFromDataQuality('Primary')).toBe('confirmed');
    expect(provenanceFromDataQuality('Secondary')).toBe('estimated');
    expect(provenanceFromDataQuality('Tertiary')).toBe('estimated');
  });

  it('maps the plain words measured/verified/calculated the plan calls out', () => {
    expect(provenanceFromDataQuality('measured')).toBe('confirmed');
    expect(provenanceFromDataQuality('verified')).toBe('confirmed');
    expect(provenanceFromDataQuality('calculated')).toBe('estimated');
  });

  it('defaults null and unrecognised values to estimated', () => {
    expect(provenanceFromDataQuality(null)).toBe('estimated');
    expect(provenanceFromDataQuality(undefined)).toBe('estimated');
    expect(provenanceFromDataQuality('mystery')).toBe('estimated');
  });
});

describe('provenanceFromEfSourceType', () => {
  it('a proxy is always estimated, accepted or not', () => {
    expect(provenanceFromEfSourceType('proxy', { userAccepted: true })).toBe('estimated');
    expect(provenanceFromEfSourceType('proxy', { userAccepted: false })).toBe('estimated');
    expect(provenanceFromEfSourceType('ecoinvent_proxy', { userAccepted: true })).toBe('estimated');
  });

  it('a real match is confirmed when user-accepted, drafted when auto-applied', () => {
    for (const sourceType of ['primary', 'ecoinvent_live', 'agribalyse_live', 'defra', 'global_library', 'staging']) {
      expect(provenanceFromEfSourceType(sourceType, { userAccepted: true })).toBe('confirmed');
      expect(provenanceFromEfSourceType(sourceType, { userAccepted: false })).toBe('drafted');
      expect(provenanceFromEfSourceType(sourceType)).toBe('drafted');
    }
  });

  it('no source type at all is estimated unless a human still chose it', () => {
    expect(provenanceFromEfSourceType(null)).toBe('estimated');
    expect(provenanceFromEfSourceType(undefined)).toBe('estimated');
    expect(provenanceFromEfSourceType(null, { userAccepted: true })).toBe('confirmed');
  });
});

describe('provenanceFromLegacy namespace', () => {
  it('bundles all four mappers', () => {
    expect(provenanceFromLegacy.pcfStatus('completed')).toBe('confirmed');
    expect(provenanceFromLegacy.quantitiesStatus('confirmed')).toBe('confirmed');
    expect(provenanceFromLegacy.dataQuality('actual')).toBe('confirmed');
    expect(provenanceFromLegacy.efSourceType('proxy')).toBe('estimated');
  });
});

describe('confidenceToScale', () => {
  it('maps ingest classification_confidence to 90/60/30', () => {
    expect(confidenceToScale({ kind: 'classification', value: 'high' })).toBe(90);
    expect(confidenceToScale({ kind: 'classification', value: 'medium' })).toBe(60);
    expect(confidenceToScale({ kind: 'classification', value: 'low' })).toBe(30);
  });

  it('defaults an unrecognised classification string to 30 (least sure)', () => {
    expect(confidenceToScale({ kind: 'classification', value: 'mystery' })).toBe(30);
  });

  it('scales agent_exceptions.confidence (0..1 fraction) by 100', () => {
    expect(confidenceToScale({ kind: 'fraction', value: 0.85 })).toBe(85);
    expect(confidenceToScale({ kind: 'fraction', value: 0 })).toBe(0);
    expect(confidenceToScale({ kind: 'fraction', value: 1 })).toBe(100);
  });

  it('passes an already-0-100 LCA confidence_score through unchanged', () => {
    expect(confidenceToScale({ kind: 'score100', value: 72 })).toBe(72);
  });

  it('clamps an out-of-range score100 into 0..100', () => {
    expect(confidenceToScale({ kind: 'score100', value: 140 })).toBe(100);
    expect(confidenceToScale({ kind: 'score100', value: -10 })).toBe(0);
  });

  it('inverts ef_uncertainty_percent into a confidence', () => {
    expect(confidenceToScale({ kind: 'uncertaintyPercent', value: 25 })).toBe(75);
    expect(confidenceToScale({ kind: 'uncertaintyPercent', value: 100 })).toBe(0);
    expect(confidenceToScale({ kind: 'uncertaintyPercent', value: 0 })).toBe(100);
  });

  it('is always within 0..100', () => {
    const cases: Array<Parameters<typeof confidenceToScale>[0]> = [
      { kind: 'classification', value: 'low' },
      { kind: 'fraction', value: -1 },
      { kind: 'fraction', value: 5 },
      { kind: 'score100', value: -50 },
      { kind: 'score100', value: 500 },
      { kind: 'uncertaintyPercent', value: -20 },
      { kind: 'uncertaintyPercent', value: 300 },
    ];
    for (const c of cases) {
      const n = confidenceToScale(c);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });
});
