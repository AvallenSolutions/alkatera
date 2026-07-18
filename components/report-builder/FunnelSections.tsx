'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { StateChip, PillButton } from '@/components/studio';
import { useSubscription, type FeatureCode } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import type { ReportConfig } from '@/types/report-builder';
import { AVAILABLE_SECTIONS, SECTION_CATEGORIES } from '@/types/report-builder';
import {
  sectionHasData,
  type ReportDataAvailability,
} from '@/hooks/useReportDataAvailability';

interface FunnelSectionsProps {
  config: ReportConfig;
  availability: ReportDataAvailability;
  /** Sections the selected style would preselect, filtered by data. */
  styleDefaults: string[];
  onChange: (updates: Partial<ReportConfig>) => void;
}

/**
 * The full section catalogue, shown only when the confirmed selection is
 * opened for adjustment. Every section carries an honest data state; the
 * quick actions reset to the style's data-backed defaults, everything with
 * data, or the bare minimum.
 */
export function FunnelSections({ config, availability, styleDefaults, onChange }: FunnelSectionsProps) {
  const { hasFeature } = useSubscription();

  const isFeatureLocked = (sectionId: string): boolean => {
    const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
    if (!section?.requiresFeature) return false;
    return !hasFeature(section.requiresFeature as FeatureCode);
  };

  const toggle = (sectionId: string, checked: boolean) => {
    const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
    if (section?.required) return;
    const sections = checked
      ? [...config.sections, sectionId]
      : config.sections.filter(s => s !== sectionId);
    onChange({ sections });
  };

  const selectStyleDefaults = () => onChange({ sections: styleDefaults });
  const selectEverythingWithData = () =>
    onChange({
      sections: AVAILABLE_SECTIONS
        .filter(s => !s.comingSoon && !isFeatureLocked(s.id) && sectionHasData(s.id, availability))
        .map(s => s.id),
    });
  const selectMinimum = () =>
    onChange({ sections: AVAILABLE_SECTIONS.filter(s => s.required).map(s => s.id) });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <PillButton variant="outline" size="sm" onClick={selectStyleDefaults}>
          This style&apos;s defaults
        </PillButton>
        <PillButton variant="ghost" size="sm" onClick={selectEverythingWithData}>
          Everything with data
        </PillButton>
        <PillButton variant="ghost" size="sm" onClick={selectMinimum}>
          Minimum
        </PillButton>
      </div>

      {SECTION_CATEGORIES.map(category => {
        const sectionsInCategory = AVAILABLE_SECTIONS.filter(s => s.category === category);
        if (sectionsInCategory.length === 0) return null;

        return (
          <div key={category}>
            <p className="mb-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
              {category}
            </p>
            <div>
              {sectionsInCategory.map(section => {
                const isSelected = config.sections.includes(section.id);
                const locked = isFeatureLocked(section.id);
                const disabled = section.comingSoon || locked;
                const hasData = sectionHasData(section.id, availability);

                return (
                  <label
                    key={section.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 border-b border-studio-hairline py-2.5 last:border-b-0',
                      disabled && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <Checkbox
                      checked={isSelected && !locked}
                      disabled={section.required || disabled}
                      onCheckedChange={checked => !disabled && toggle(section.id, checked as boolean)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium text-foreground">{section.label}</span>
                        {section.required && <StateChip>Always in</StateChip>}
                        {locked && <StateChip>Beta access needed</StateChip>}
                        {section.comingSoon && <StateChip>Coming soon</StateChip>}
                        {!disabled && !section.required && (
                          hasData
                            ? <StateChip tone="good">Data ready</StateChip>
                            : <StateChip tone="attention">No data yet</StateChip>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{section.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
