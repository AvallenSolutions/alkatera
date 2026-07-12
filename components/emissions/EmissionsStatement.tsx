'use client';

/**
 * Emissions -- the statement.
 *
 * The page opens the studio way: eyebrow, one headline sentence, and the
 * annual total standing right as a display-bold number over its mono label.
 * The year select, the DRAFT/COMPLETE state and the one Calculate act live
 * in a quiet margin row beneath: mono text and a single pill, not a chrome
 * row. The old duplicate "Company Footprint" inner header is gone.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Statement } from '@/components/studio/statement';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';

interface EmissionsStatementProps {
  selectedYear: number;
  selectableYears: Array<{ year: number; label: string }>;
  onYearChange: (year: number) => void;
  /** corporate_reports.status: 'Finalized' reads as COMPLETE. */
  reportStatus?: string | null;
  lastCalculatedAt?: string | null;
  totalEmissions: number;
  hasData: boolean;
  isGenerating: boolean;
  isLoading: boolean;
  onCalculate: () => void;
}

export function EmissionsStatement({
  selectedYear,
  selectableYears,
  onYearChange,
  reportStatus,
  lastCalculatedAt,
  totalEmissions,
  hasData,
  isGenerating,
  isLoading,
  onCalculate,
}: EmissionsStatementProps) {
  return (
    <div>
      <Statement eyebrow="THE WORKBENCH · EMISSIONS" headline="The emissions.">
        {hasData ? (
          <BigNumber
            size="display"
            value={totalEmissions.toFixed(2)}
            label={`Tonnes CO2e · ${selectedYear}`}
          />
        ) : null}
      </Statement>

      {/* The margin row: mono facts and the one act. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-studio-hairline pb-3">
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => onYearChange(parseInt(value))}
        >
          <SelectTrigger className="h-7 w-auto gap-2 border-none bg-transparent px-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {selectableYears.map((y) => (
              <SelectItem key={y.year} value={y.year.toString()}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <StateChip tone={reportStatus === 'Finalized' ? 'good' : 'quiet'}>
          {reportStatus === 'Finalized' ? 'Complete' : 'Draft'}
        </StateChip>

        {lastCalculatedAt ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
            Last calculated {new Date(lastCalculatedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : null}

        <PillButton
          size="sm"
          className="ml-auto"
          onClick={onCalculate}
          disabled={isGenerating || isLoading}
        >
          {isGenerating ? 'Calculating…' : hasData ? 'Recalculate' : 'Calculate footprint'}
        </PillButton>
      </div>
    </div>
  );
}
