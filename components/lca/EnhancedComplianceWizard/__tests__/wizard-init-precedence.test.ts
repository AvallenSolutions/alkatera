/**
 * LCA wizard prefill precedence tests.
 *
 * Covers the two pure helpers that together prevent the Mighty Ginger drift
 * class of bug:
 *
 *   - buildInitialFormData(product) overlays product.last_wizard_settings
 *     onto INITIAL_FORM_DATA. If there's no per-product settings blob the
 *     wizard opens blank; the wizard shell's auto-opened ApplyTemplateDialog
 *     then prompts the user to pick a template (or skip).
 *   - pickLcaSettings(formData) strips product-specific / derived fields
 *     before mirror-writing the blob to products.last_wizard_settings or
 *     to a new lca_report_template.
 *
 * Org-scoped templates are NOT auto-applied inside buildInitialFormData
 * any more — the previous silent-auto-apply behaviour was replaced by an
 * explicit prompt dialog on wizard load. See ApplyTemplateDialog +
 * WizardContext.showTemplatePicker.
 *
 * These two functions are the entire reason the wizard now remembers what
 * the user did last time, so they deserve explicit unit coverage that does
 * NOT need the React provider, Supabase, or the network.
 */

import { describe, it, expect, vi } from 'vitest';

// Same provider mocks as wizard-logic.test.ts. WizardContext.tsx touches
// supabase at module load time via its imports, so we stub them here.
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: { getUser: vi.fn(), getSession: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import { buildInitialFormData, type WizardFormData } from '../WizardContext';
import {
  pickLcaSettings,
  type LcaWizardSettings,
} from '@/types/lca-templates';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * A fully-populated, representative LcaWizardSettings blob. Every field has
 * a distinctive value so we can positively assert which source won the
 * precedence race rather than just checking "not blank".
 */
const FULL_PRODUCT_SETTINGS: LcaWizardSettings = {
  intendedApplication: 'Product-level improvement',
  reasonsForStudy: 'Customer request',
  intendedAudience: ['customers_b2b'],
  isComparativeAssertion: false,
  systemBoundary: 'cradle-to-grave',
  cutoffCriteria: '1% by mass, energy and env. significance',
  assumptions: ['All primary packaging recycled at UK rate'],
  dataQuality: {
    temporal_coverage: '2026',
    geographic_coverage: 'UK',
    technological_coverage: 'Current best practice',
    precision: 'high',
    completeness: 95,
  },
  referenceYear: 2026,
  criticalReviewType: 'internal',
  criticalReviewJustification: 'Internal sustainability team review',
};

// ============================================================================
// buildInitialFormData — per-product prefill
// ============================================================================

describe('buildInitialFormData — per-product prefill', () => {
  it('returns blank defaults when product is null', () => {
    const result = buildInitialFormData(null);

    // Sentinel values from INITIAL_FORM_DATA
    expect(result.intendedApplication).toBe('');
    expect(result.systemBoundary).toBe('cradle-to-gate');
    expect(result.intendedAudience).toEqual([]);
    expect(result.assumptions).toEqual([]);
    expect(result.isComparativeAssertion).toBe(false);
    expect(result.criticalReviewType).toBe('none');
    // functionalUnit always falls through to '' because it's deliberately
    // excluded from the settings blob.
    expect(result.functionalUnit).toBe('');
  });

  it('returns blank defaults when product exists but has no last_wizard_settings', () => {
    // This is the "new product" case: the wizard opens blank and the
    // shell auto-opens the ApplyTemplateDialog prompt so the user can
    // pick a template or skip.
    const result = buildInitialFormData({ last_wizard_settings: null });
    expect(result.intendedApplication).toBe('');
    expect(result.systemBoundary).toBe('cradle-to-gate');
  });

  it('prefills from per-product last_wizard_settings when present', () => {
    // THE critical invariant for the Mighty Ginger fix: every Goal &
    // Scope field the user chose last time reappears when they reopen
    // the wizard on the same product.
    const result = buildInitialFormData({
      last_wizard_settings: FULL_PRODUCT_SETTINGS,
    });

    expect(result.systemBoundary).toBe('cradle-to-grave');
    expect(result.referenceYear).toBe(2026);
    expect(result.intendedAudience).toEqual(['customers_b2b']);
    expect(result.isComparativeAssertion).toBe(false);
    expect(result.cutoffCriteria).toBe(FULL_PRODUCT_SETTINGS.cutoffCriteria);
    expect(result.dataQuality.completeness).toBe(95);
    expect(result.criticalReviewType).toBe('internal');
    // functionalUnit is product-specific and never part of the blob,
    // so it always falls back to INITIAL_FORM_DATA.
    expect(result.functionalUnit).toBe('');
  });

  it('merges partial per-product settings on top of INITIAL_FORM_DATA', () => {
    // Simulates a product whose last run only configured a couple of fields.
    // Everything else must still fall through to INITIAL_FORM_DATA.
    const partial: Partial<LcaWizardSettings> = {
      referenceYear: 2027,
      systemBoundary: 'cradle-to-shelf',
    };
    const result = buildInitialFormData({
      last_wizard_settings: partial as LcaWizardSettings,
    });
    expect(result.referenceYear).toBe(2027);
    expect(result.systemBoundary).toBe('cradle-to-shelf');
    // Fields the partial didn't set must come from INITIAL_FORM_DATA
    expect(result.intendedApplication).toBe('');
    expect(result.intendedAudience).toEqual([]);
    expect(result.assumptions).toEqual([]);
    expect(result.isComparativeAssertion).toBe(false);
    expect(result.criticalReviewType).toBe('none');
  });

  it('does NOT re-introduce functionalUnit if it is smuggled into the blob', () => {
    // pickLcaSettings guarantees functionalUnit is never WRITTEN into the
    // blob. This test documents the read-side behaviour if an old row has
    // it anyway: the spread will carry it through, but saveProgressInternal
    // strips it again via pickLcaSettings on the next save, so the blob
    // self-heals.
    const settingsWithSmuggledUnit = {
      ...FULL_PRODUCT_SETTINGS,
      functionalUnit: '1 bottle of shot',
    } as unknown as LcaWizardSettings;

    const result = buildInitialFormData({
      last_wizard_settings: settingsWithSmuggledUnit,
    });
    expect(result.functionalUnit).toBe('1 bottle of shot');

    // Round-tripping through pickLcaSettings removes it on the next save.
    const clean = pickLcaSettings(result);
    expect(clean).not.toHaveProperty('functionalUnit');
  });
});

// ============================================================================
// pickLcaSettings — STRIP PRODUCT-SPECIFIC / DERIVED FIELDS BEFORE WRITE
// ============================================================================

describe('pickLcaSettings — write-side safety', () => {
  const BASE_FORM: WizardFormData = {
    intendedApplication: 'Product-level improvement',
    reasonsForStudy: 'Customer request',
    intendedAudience: ['customers_b2b'],
    isComparativeAssertion: false,
    functionalUnit: '1 bottle of 60 ml shot',
    systemBoundary: 'cradle-to-grave',
    cutoffCriteria: '1% by mass',
    assumptions: ['assumption A'],
    dataQuality: {
      temporal_coverage: '2026',
      geographic_coverage: 'UK',
      technological_coverage: 'Best practice',
      precision: 'high',
      completeness: 95,
    },
    hasInterpretation: true,
    interpretationId: 'interp-abc-123',
    dqiScore: 4.2,
    criticalReviewType: 'internal',
    criticalReviewJustification: 'Internal review',
    referenceYear: 2026,
  };

  it('strips functionalUnit (product-specific)', () => {
    const settings = pickLcaSettings(BASE_FORM);
    expect(settings).not.toHaveProperty('functionalUnit');
  });

  it('strips derived / output fields (hasInterpretation, interpretationId, dqiScore)', () => {
    const settings = pickLcaSettings(BASE_FORM);
    expect(settings).not.toHaveProperty('hasInterpretation');
    expect(settings).not.toHaveProperty('interpretationId');
    expect(settings).not.toHaveProperty('dqiScore');
  });

  it('keeps every Goal & Scope field', () => {
    const settings = pickLcaSettings(BASE_FORM);
    expect(settings.intendedApplication).toBe('Product-level improvement');
    expect(settings.reasonsForStudy).toBe('Customer request');
    expect(settings.intendedAudience).toEqual(['customers_b2b']);
    expect(settings.isComparativeAssertion).toBe(false);
    expect(settings.systemBoundary).toBe('cradle-to-grave');
    expect(settings.cutoffCriteria).toBe('1% by mass');
    expect(settings.assumptions).toEqual(['assumption A']);
    expect(settings.dataQuality).toEqual(BASE_FORM.dataQuality);
    expect(settings.referenceYear).toBe(2026);
    expect(settings.criticalReviewType).toBe('internal');
    expect(settings.criticalReviewJustification).toBe('Internal review');
  });

  it('round-trips through buildInitialFormData without losing any Goal & Scope state', () => {
    // The guarantee: save this session's settings, reopen on the same
    // product, and every Goal & Scope choice reappears. This is the fix
    // for the Mighty Ginger drift in one assertion.
    const savedBlob = pickLcaSettings(BASE_FORM);
    const reopened = buildInitialFormData({ last_wizard_settings: savedBlob });

    expect(reopened.intendedApplication).toBe(BASE_FORM.intendedApplication);
    expect(reopened.reasonsForStudy).toBe(BASE_FORM.reasonsForStudy);
    expect(reopened.intendedAudience).toEqual(BASE_FORM.intendedAudience);
    expect(reopened.isComparativeAssertion).toBe(BASE_FORM.isComparativeAssertion);
    expect(reopened.systemBoundary).toBe(BASE_FORM.systemBoundary);
    expect(reopened.cutoffCriteria).toBe(BASE_FORM.cutoffCriteria);
    expect(reopened.assumptions).toEqual(BASE_FORM.assumptions);
    expect(reopened.dataQuality).toEqual(BASE_FORM.dataQuality);
    expect(reopened.referenceYear).toBe(BASE_FORM.referenceYear);
    expect(reopened.criticalReviewType).toBe(BASE_FORM.criticalReviewType);
    expect(reopened.criticalReviewJustification).toBe(
      BASE_FORM.criticalReviewJustification,
    );

    // Derived / product-specific fields SHOULD reset
    expect(reopened.functionalUnit).toBe(''); // back to INITIAL_FORM_DATA
    expect(reopened.hasInterpretation).toBe(false);
  });

  it('handles empty-ish form data without blowing up', () => {
    const empty: WizardFormData = {
      intendedApplication: '',
      reasonsForStudy: '',
      intendedAudience: [],
      isComparativeAssertion: false,
      functionalUnit: '',
      systemBoundary: 'cradle-to-gate',
      cutoffCriteria: '',
      assumptions: [],
      dataQuality: {
        temporal_coverage: '',
        geographic_coverage: '',
        technological_coverage: '',
        precision: 'medium',
        completeness: 0,
      },
      hasInterpretation: false,
      criticalReviewType: 'none',
      criticalReviewJustification: '',
      referenceYear: 2026,
    };
    const settings = pickLcaSettings(empty);
    expect(settings).not.toHaveProperty('functionalUnit');
    expect(settings.systemBoundary).toBe('cradle-to-gate');
    expect(settings.intendedAudience).toEqual([]);
  });
});
