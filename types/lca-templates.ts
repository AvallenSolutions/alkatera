/**
 * LCA Wizard Templates — hand-rolled domain types.
 *
 * These types back the per-product "last used wizard settings" prefill
 * (products.last_wizard_settings) and the org-scoped reusable templates
 * (lca_report_templates table). Both use the same LcaWizardSettings shape so
 * a single applySettings(formData, settings) helper works for both.
 *
 * Migration: supabase/migrations/20261800000000_lca_wizard_permanence_and_templates.sql
 */

import type { WizardFormData } from '@/components/lca/EnhancedComplianceWizard/WizardContext';

/**
 * Subset of WizardFormData that is safe to persist and reuse across sessions
 * and across products.
 *
 * Excluded fields:
 *  - functionalUnit: product-specific. Kept on its own products.functional_unit
 *    column and re-entered per product.
 *  - hasInterpretation, interpretationId, dqiScore: derived outputs, never
 *    inputs the user chooses.
 */
export type LcaWizardSettings = Omit<
  WizardFormData,
  'functionalUnit' | 'hasInterpretation' | 'interpretationId' | 'dqiScore'
>;

/**
 * The fields on WizardFormData that are NOT part of LcaWizardSettings.
 * Handy for the pickLcaSettings helper to strip product-specific / derived
 * fields before mirror-writing to products.last_wizard_settings.
 */
export const LCA_WIZARD_SETTINGS_EXCLUDED_KEYS = [
  'functionalUnit',
  'hasInterpretation',
  'interpretationId',
  'dqiScore',
] as const satisfies ReadonlyArray<keyof WizardFormData>;

export type LcaWizardSettingsExcludedKey =
  (typeof LCA_WIZARD_SETTINGS_EXCLUDED_KEYS)[number];

/**
 * Extract an LcaWizardSettings blob from a full WizardFormData by stripping
 * the excluded keys. Used before writing to:
 *  - products.last_wizard_settings (per-product prefill)
 *  - lca_report_templates.settings (org-scoped reusable templates)
 */
export function pickLcaSettings(formData: WizardFormData): LcaWizardSettings {
  const {
    functionalUnit: _functionalUnit,
    hasInterpretation: _hasInterpretation,
    interpretationId: _interpretationId,
    dqiScore: _dqiScore,
    ...settings
  } = formData;
  return settings;
}

/**
 * Shape of a row in the lca_report_templates table.
 */
export interface LcaReportTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  settings: LcaWizardSettings;
  is_org_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for creating a new LCA report template (POST /api/lca-templates).
 * The API route sets organization_id and created_by from the authenticated
 * user, so they are not part of the client payload.
 */
export interface LcaReportTemplateInsert {
  name: string;
  description?: string | null;
  settings: LcaWizardSettings;
  /**
   * If true, mark this template as the org default. The BEFORE INSERT trigger
   * clears any existing default atomically.
   */
  setAsDefault?: boolean;
}

/**
 * Payload for updating an existing template (PATCH /api/lca-templates/[id]).
 * All fields are optional. is_org_default is changed via the dedicated
 * POST /api/lca-templates/[id]/set-default endpoint, not this PATCH.
 */
export interface LcaReportTemplateUpdate {
  name?: string;
  description?: string | null;
  settings?: LcaWizardSettings;
}
