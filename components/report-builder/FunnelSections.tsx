'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { StateChip, PillButton, FieldLabel } from '@/components/studio';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useSubscription, type FeatureCode } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import type { ReportConfig } from '@/types/report-builder';
import { AVAILABLE_SECTIONS, SECTION_CATEGORIES, SECTION_LABELS } from '@/types/report-builder';
import {
  sectionHasData,
  type ReportDataAvailability,
} from '@/hooks/useReportDataAvailability';

interface FunnelSectionsProps {
  config: ReportConfig;
  availability: ReportDataAvailability;
  /** Sections the selected style would preselect, filtered by data. */
  styleDefaults: string[];
  /** The selected style's narrative arc (default running order). */
  styleOrder: string[];
  organizationId: string | null;
  onChange: (updates: Partial<ReportConfig>) => void;
}

function ChoicePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-studio',
        active
          ? 'bg-studio-ink text-studio-cream'
          : 'border border-studio-ink/25 text-foreground hover:border-studio-ink/60'
      )}
    >
      {children}
    </button>
  );
}

/**
 * The full section catalogue plus Phase D section control: a reorderable
 * running order (quiet chevrons, the house pattern), a products scope
 * (all footprints or exactly the picked ones) and a trends year range.
 * Every section carries an honest data state.
 */
export function FunnelSections({
  config,
  availability,
  styleDefaults,
  styleOrder,
  organizationId,
  onChange,
}: FunnelSectionsProps) {
  const { hasFeature } = useSubscription();
  const [pcfOptions, setPcfOptions] = useState<Array<{ id: string; name: string }>>([]);

  const isFeatureLocked = (sectionId: string): boolean => {
    const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
    if (!section?.requiresFeature) return false;
    return !hasFeature(section.requiresFeature as FeatureCode);
  };

  // The effective running order of the SELECTED sections: the user's order
  // when set, else the style's arc with unlisted selections appended.
  const effectiveOrder = (() => {
    const base = config.sectionOrder?.length ? config.sectionOrder : styleOrder;
    return [
      ...base.filter(id => config.sections.includes(id)),
      ...config.sections.filter(id => !base.includes(id)),
    ];
  })();

  // Completed footprints for the products scope, fetched once when relevant.
  const wantsProducts = config.sections.includes('product-footprints');
  useEffect(() => {
    if (!wantsProducts || !organizationId || pcfOptions.length > 0) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('product_carbon_footprints')
        .select('id, products!product_lcas_product_id_fkey!inner(name)')
        .eq('organization_id', organizationId)
        .eq('status', 'completed');
      if (cancelled || !data) return;
      setPcfOptions(
        data.map((row: any) => ({ id: row.id, name: row.products?.name || 'Unnamed product' }))
      );
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsProducts, organizationId]);

  const toggle = (sectionId: string, checked: boolean) => {
    const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
    if (section?.required) return;
    const sections = checked
      ? [...config.sections, sectionId]
      : config.sections.filter(s => s !== sectionId);
    const updates: Partial<ReportConfig> = { sections };
    // Keep a materialised order in step with selection changes.
    if (config.sectionOrder?.length) {
      updates.sectionOrder = checked
        ? [...config.sectionOrder, sectionId]
        : config.sectionOrder.filter(id => id !== sectionId);
    }
    onChange(updates);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...effectiveOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // The first press materialises the full order.
    onChange({ sectionOrder: next });
  };

  const setProductsScope = (pcfIds: string[]) => {
    const allSelected = pcfIds.length === 0 || pcfIds.length === pcfOptions.length;
    const scopes = { ...config.sectionScopes };
    if (allSelected) delete scopes.products;
    else scopes.products = { pcfIds };
    onChange({ sectionScopes: Object.keys(scopes).length > 0 ? scopes : undefined });
  };

  const setTrendsScope = (range: { fromYear: number; toYear: number } | null) => {
    const scopes = { ...config.sectionScopes };
    if (!range) delete scopes.trends;
    else scopes.trends = range;
    onChange({ sectionScopes: Object.keys(scopes).length > 0 ? scopes : undefined });
  };

  const selectStyleDefaults = () =>
    onChange({ sections: styleDefaults, sectionOrder: undefined, sectionScopes: undefined });
  const selectEverythingWithData = () =>
    onChange({
      sections: AVAILABLE_SECTIONS
        .filter(s => !s.comingSoon && !isFeatureLocked(s.id) && sectionHasData(s.id, availability))
        .map(s => s.id),
      sectionOrder: undefined,
      sectionScopes: undefined,
    });
  const selectMinimum = () =>
    onChange({
      sections: AVAILABLE_SECTIONS.filter(s => s.required).map(s => s.id),
      sectionOrder: undefined,
      sectionScopes: undefined,
    });

  const scopedPcfIds = config.sectionScopes?.products?.pcfIds;
  const trendsScope = config.sectionScopes?.trends;
  const currentYear = new Date().getFullYear();
  const trendYears = Array.from({ length: 10 }, (_, i) => currentYear - 9 + i);

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

      {/* ── The running order ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <FieldLabel>The running order</FieldLabel>
          {config.sectionOrder?.length ? (
            <button type="button" onClick={() => onChange({ sectionOrder: undefined })}>
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
                Reset to this style&apos;s arc
              </span>
            </button>
          ) : null}
        </div>
        <div>
          {effectiveOrder.map((sectionId, index) => (
            <div
              key={sectionId}
              className="flex items-center justify-between gap-3 border-b border-studio-hairline py-2 last:border-b-0"
            >
              <span className="min-w-0 truncate text-sm text-foreground">
                <span className="mr-2 font-mono text-[10px] tabular-nums text-studio-dim">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {SECTION_LABELS[sectionId] || sectionId}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${SECTION_LABELS[sectionId] || sectionId} up`}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === effectiveOrder.length - 1}
                  aria-label={`Move ${SECTION_LABELS[sectionId] || sectionId} down`}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── The catalogue ─────────────────────────────────────────────────── */}
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
                  <div key={section.id} className="border-b border-studio-hairline py-2.5 last:border-b-0">
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3',
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

                    {/* Products scope */}
                    {section.id === 'product-footprints' && isSelected && pcfOptions.length > 0 && (
                      <div className="ml-7 mt-2 border-l border-studio-hairline pl-3">
                        <FieldLabel className="mb-1.5">Which products</FieldLabel>
                        <div className="space-y-1">
                          {pcfOptions.map(option => {
                            const inScope = !scopedPcfIds || scopedPcfIds.includes(option.id);
                            return (
                              <label key={option.id} className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                  checked={inScope}
                                  onCheckedChange={checked => {
                                    const current = scopedPcfIds ?? pcfOptions.map(o => o.id);
                                    const next = checked
                                      ? (current.includes(option.id) ? current : [...current, option.id])
                                      : current.filter(id => id !== option.id);
                                    // Keep at least one product in the report.
                                    if (next.length === 0) return;
                                    setProductsScope(next);
                                  }}
                                />
                                <span className="text-xs text-foreground">{option.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {scopedPcfIds
                            ? `${scopedPcfIds.length} of ${pcfOptions.length} products in this report.`
                            : 'All completed products are in this report.'}
                        </p>
                      </div>
                    )}

                    {/* Trends year range */}
                    {section.id === 'trends' && isSelected && (
                      <div className="ml-7 mt-2 border-l border-studio-hairline pl-3">
                        <FieldLabel className="mb-1.5">Which years</FieldLabel>
                        <div className="flex flex-wrap items-center gap-2">
                          <ChoicePill active={!trendsScope} onClick={() => setTrendsScope(null)}>
                            All available years
                          </ChoicePill>
                          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-studio-dim">From</span>
                          {trendYears.map(year => (
                            <ChoicePill
                              key={`from-${year}`}
                              active={trendsScope?.fromYear === year}
                              onClick={() =>
                                setTrendsScope({
                                  fromYear: year,
                                  toYear: Math.max(year, trendsScope?.toYear ?? config.reportYear),
                                })
                              }
                            >
                              {year}
                            </ChoicePill>
                          ))}
                        </div>
                        {trendsScope && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-studio-dim">To</span>
                            {trendYears
                              .filter(year => year >= trendsScope.fromYear)
                              .map(year => (
                                <ChoicePill
                                  key={`to-${year}`}
                                  active={trendsScope.toYear === year}
                                  onClick={() => setTrendsScope({ fromYear: trendsScope.fromYear, toYear: year })}
                                >
                                  {year}
                                </ChoicePill>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
