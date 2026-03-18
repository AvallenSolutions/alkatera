'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { type DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  numberOfMonths?: number;
  presets?: { label: string; from: Date; to: Date }[];
}

function DateRangePicker({
  value,
  onChange,
  placeholder = 'Select date range',
  disabled = false,
  className,
  numberOfMonths = 2,
  presets,
}: DateRangePickerProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date-range"
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !value?.from && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, 'd MMM yyyy')} -{' '}
                  {format(value.to, 'd MMM yyyy')}
                </>
              ) : (
                format(value.from, 'd MMM yyyy')
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {presets && presets.length > 0 && (
            <div className="flex flex-wrap gap-1 p-3 pb-0 border-b border-border mb-0">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() =>
                    onChange({ from: preset.from, to: preset.to })
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={numberOfMonths}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

DateRangePicker.displayName = 'DateRangePicker';

export { DateRangePicker };
export type { DateRangePickerProps };
