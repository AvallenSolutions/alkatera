'use client';

import { cn } from '@/lib/utils';

/**
 * The directory filters, recut as quiet mono text-links (no badge pills).
 * Active reads in the room accent with an underline; the rest are dim and
 * wake on hover.
 */
export function FilterChips({
  availableIndustries,
  availableCountries,
  industryFilter,
  countryFilter,
  onIndustry,
  onCountry,
  onClear,
}: {
  availableIndustries: string[];
  availableCountries: string[];
  industryFilter: string | null;
  countryFilter: string | null;
  onIndustry: (value: string | null) => void;
  onCountry: (value: string | null) => void;
  onClear: () => void;
}) {
  if (availableIndustries.length === 0 && availableCountries.length === 0) return null;

  const hasFilters = Boolean(industryFilter || countryFilter);

  const linkClass = (active: boolean) =>
    cn(
      'font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ease-studio',
      active
        ? 'text-room-accent underline underline-offset-4'
        : 'text-studio-dim hover:text-foreground',
    );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
        >
          Clear
        </button>
      )}
      {availableIndustries.map((industry) => (
        <button
          key={industry}
          type="button"
          className={linkClass(industryFilter === industry)}
          onClick={() => onIndustry(industryFilter === industry ? null : industry)}
        >
          {industry}
        </button>
      ))}
      {availableCountries.map((country) => (
        <button
          key={country}
          type="button"
          className={linkClass(countryFilter === country)}
          onClick={() => onCountry(countryFilter === country ? null : country)}
        >
          {country}
        </button>
      ))}
    </div>
  );
}
