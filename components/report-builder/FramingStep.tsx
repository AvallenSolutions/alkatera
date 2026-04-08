'use client';

import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, TrendingUp, Scale, Users, Truck, FlaskConical, Building2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportConfig } from '@/types/report-builder';
import { AUDIENCE_TYPES } from '@/types/report-builder';

interface FramingStepProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
  /** Whether smart defaults were applied from materiality/transition plan */
  smartDefaultsApplied?: boolean;
}

const AUDIENCE_META: Record<string, {
  icon: React.ElementType;
  cues: string[];
  suggestedSections: string[];
  suggestedStandards: string[];
}> = {
  investors: {
    icon: TrendingUp,
    cues: ['Financial materiality and ESG risk', 'Year-on-year progress against targets', 'Transition plan and decarbonisation pathway'],
    suggestedSections: ['executive-summary', 'scope-1-2-3', 'key-findings', 'trends', 'targets', 'transition-roadmap', 'risks-and-opportunities', 'governance'],
    suggestedStandards: ['csrd', 'tcfd'],
  },
  regulators: {
    icon: Scale,
    cues: ['Framework compliance (CSRD, GRI, ISO)', 'Methodology transparency and data quality', 'Disclosure completeness against required disclosures'],
    suggestedSections: ['executive-summary', 'scope-1-2-3', 'ghg-inventory', 'targets', 'methodology', 'regulatory'],
    suggestedStandards: ['csrd', 'iso-14064', 'gri'],
  },
  customers: {
    icon: Users,
    cues: ['Product environmental impact', 'Supply chain commitments', 'Community and social impact'],
    suggestedSections: ['executive-summary', 'scope-1-2-3', 'product-footprints', 'supply-chain', 'community-impact', 'people-culture'],
    suggestedStandards: ['iso-14067'],
  },
  internal: {
    icon: Building2,
    cues: ['Operational performance and efficiency', 'Progress against internal targets', 'People, culture, and governance'],
    suggestedSections: ['executive-summary', 'scope-1-2-3', 'key-findings', 'trends', 'targets', 'people-culture', 'governance', 'facilities'],
    suggestedStandards: ['ghg-protocol'],
  },
  'supply-chain': {
    icon: Truck,
    cues: ['Scope 3 value chain emissions', 'Supply chain standards and expectations', 'Collaborative decarbonisation'],
    suggestedSections: ['executive-summary', 'scope-1-2-3', 'supply-chain', 'targets', 'methodology'],
    suggestedStandards: ['ghg-protocol', 'iso-14067'],
  },
  technical: {
    icon: FlaskConical,
    cues: ['Detailed methodology and emission factors', 'Data quality tiers and uncertainty', 'Full GHG inventory by gas and category'],
    suggestedSections: ['executive-summary', 'scope-1-2-3', 'ghg-inventory', 'carbon-origin', 'methodology', 'appendix'],
    suggestedStandards: ['iso-14067', 'iso-14064', 'ghg-protocol'],
  },
};

export function FramingStep({ config, onChange, smartDefaultsApplied }: FramingStepProps) {
  const selectedMeta = AUDIENCE_META[config.audience];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Smart defaults notice */}
      {smartDefaultsApplied && (
        <div className="flex items-start gap-3 rounded-xl bg-[#ccff00]/10 border border-[#ccff00]/30 p-4">
          <Sparkles className="w-4 h-4 text-stone-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-stone-700">Smart defaults applied</p>
            <p className="text-xs text-stone-500 mt-0.5">
              Sections and standards have been pre-selected based on your audience, materiality assessment, and transition plan. Review in the next step.
            </p>
          </div>
        </div>
      )}

      {/* Question 1: Audience */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-stone-900">Who is this report for?</h3>
          <p className="text-sm text-stone-500 mt-0.5">
            This shapes the structure, language, and emphasis of every section, including what the AI narrative focuses on.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {AUDIENCE_TYPES.map((audience) => {
            const meta = AUDIENCE_META[audience.value];
            const Icon = meta?.icon || Building2;
            const isSelected = config.audience === audience.value;

            return (
              <button
                key={audience.value}
                type="button"
                onClick={() => onChange({ audience: audience.value as ReportConfig['audience'] })}
                className={cn(
                  'relative text-left p-4 rounded-xl border-2 transition-all hover:border-stone-300',
                  isSelected
                    ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-[#ccff00]" />
                  </div>
                )}
                <Icon className={cn('w-5 h-5 mb-2', isSelected ? 'text-[#ccff00]' : 'text-stone-400')} />
                <div className={cn('text-sm font-semibold', isSelected ? 'text-white' : 'text-stone-800')}>
                  {audience.label}
                </div>
                <div className={cn('text-xs mt-0.5', isSelected ? 'text-stone-300' : 'text-stone-500')}>
                  {audience.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Audience cues */}
        {selectedMeta && (
          <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-wider text-stone-400">
              What this audience cares about
            </p>
            {selectedMeta.cues.map(cue => (
              <div key={cue} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#84cc16] mt-1.5 flex-shrink-0" />
                <p className="text-xs text-stone-600">{cue}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question 2: Framing statement */}
      <div className="space-y-2">
        <div>
          <h3 className="text-base font-semibold text-stone-900">
            What is the single most important thing they should understand?
          </h3>
          <p className="text-sm text-stone-500 mt-0.5">
            Write 1-2 sentences. This becomes the editorial lens for all AI-generated narratives in the report.
            Leave blank to let the data speak for itself.
          </p>
        </div>

        <Textarea
          value={config.reportFramingStatement ?? ''}
          onChange={e => onChange({ reportFramingStatement: e.target.value || undefined })}
          placeholder={
            config.audience === 'investors'
              ? 'e.g. Despite a 12% revenue increase, absolute emissions fell — demonstrating that our growth is now decoupled from carbon.'
              : config.audience === 'customers'
              ? 'e.g. Every product in our range is now below 1 kg CO2e per unit, and we can show the full supply chain behind every number.'
              : 'e.g. We have a credible, costed pathway to net zero by 2040 with three major milestones already achieved.'
          }
          className="min-h-[90px] resize-none text-sm"
        />

        {config.reportFramingStatement && config.reportFramingStatement.length > 10 && (
          <p className="text-xs text-stone-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            This will inform every section narrative. Claude will interpret data in light of this framing.
          </p>
        )}
      </div>

      {/* Suggested sections preview */}
      {selectedMeta && (
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-wider text-stone-400">
            Suggested sections for this audience
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedMeta.suggestedSections.map(s => (
              <Badge key={s} variant="secondary" className="text-xs font-normal">
                {s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-stone-400">
            These will be pre-selected in the next step. You can add or remove any section.
          </p>
        </div>
      )}
    </div>
  );
}

/** Returns the recommended sections + standards for an audience */
export function getAudienceDefaults(audience: string): { sections: string[]; standards: string[] } {
  const meta = AUDIENCE_META[audience];
  return {
    sections: meta?.suggestedSections ?? ['executive-summary'],
    standards: meta?.suggestedStandards ?? [],
  };
}
