// Registry of non-B-Corp framework content (ISO 14001, ISO 50001, EcoVadis).
// Source of truth for the seed migrations, requirement guidance and the shared
// auto-evidence probe mapping.

import type { FrameworkContentDef, FrameworkRequirementDef } from './types';
import { ISO14001 } from './iso14001';
import { ISO50001 } from './iso50001';
import { ECOVADIS } from './ecovadis';

export type { FrameworkContentDef, FrameworkRequirementDef, ProbeId } from './types';

/** Framework codes that use the generalised certification experience. */
export const GENERALISED_FRAMEWORK_CODES = ['iso14001', 'iso50001', 'ecovadis'] as const;

export const FRAMEWORK_CONTENT: Record<string, FrameworkContentDef> = {
  iso14001: ISO14001,
  iso50001: ISO50001,
  ecovadis: ECOVADIS,
};

export function getFrameworkContent(code: string | null | undefined): FrameworkContentDef | null {
  if (!code) return null;
  return FRAMEWORK_CONTENT[code] ?? null;
}

export function isGeneralisedFramework(code: string | null | undefined): boolean {
  return !!code && code in FRAMEWORK_CONTENT;
}

/** Look up a requirement definition by framework code + requirement code. */
export function getRequirementDef(
  frameworkCode: string | null | undefined,
  requirementCode: string | null | undefined,
): FrameworkRequirementDef | null {
  const fw = getFrameworkContent(frameworkCode);
  if (!fw || !requirementCode) return null;
  return fw.requirements.find((r) => r.code === requirementCode) ?? null;
}
