"use client";

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

interface StagingFactor {
  id: string;
  name: string;
  category: string;
  co2_factor: number;
  reference_unit: string;
  source: string;
  metadata?: any;
}

interface StagingFactorSelectorProps {
  category: 'Ingredient' | 'Packaging' | 'Energy' | 'Transport';
  value?: string;
  onSelect: (factor: StagingFactor) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function StagingFactorSelector({
  category,
  value,
  onSelect,
  placeholder = 'Select material...',
  disabled = false,
}: StagingFactorSelectorProps) {
  const [open, setOpen] = useState(false);
  const [factors, setFactors] = useState<StagingFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFactor, setSelectedFactor] = useState<StagingFactor | null>(null);

  useEffect(() => {
    fetchFactors();
  }, [category]);

  useEffect(() => {
    if (value && factors.length > 0) {
      const factor = factors.find((f) => f.id === value);
      setSelectedFactor(factor || null);
    }
  }, [value, factors]);

  const fetchFactors = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('staging_emission_factors')
        .select('*')
        .eq('category', category)
        .order('name');

      if (error) {
        console.error('Error fetching staging factors:', error);
        return;
      }

      setFactors(data || []);
    } catch (error) {
      console.error('Failed to fetch staging factors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (factor: StagingFactor) => {
    setSelectedFactor(factor);
    onSelect(factor);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || loading}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedFactor ? (
              <>
                <Database className="h-4 w-4 text-green-600" />
                <span className="truncate">{selectedFactor.name}</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {selectedFactor.co2_factor} {selectedFactor.reference_unit}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search materials..." />
          <CommandEmpty>
            {loading ? 'Loading...' : 'No materials found.'}
          </CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-auto">
            {factors.map((factor) => (
              <CommandItem
                key={factor.id}
                value={factor.name}
                onSelect={() => handleSelect(factor)}
                className="flex items-start gap-2 py-3"
              >
                <Check
                  className={cn(
                    'mt-1 h-4 w-4',
                    selectedFactor?.id === factor.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{factor.name}</span>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {factor.co2_factor} {factor.reference_unit}
                    </Badge>
                  </div>
                  {factor.metadata?.description && (
                    <p className="text-xs text-muted-foreground">
                      {factor.metadata.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {factor.source}
                    </Badge>
                    {factor.metadata?.typical_mass_g && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Typical: {factor.metadata.typical_mass_g}g
                      </Badge>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
