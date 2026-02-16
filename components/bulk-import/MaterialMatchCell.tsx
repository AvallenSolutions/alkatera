'use client';

import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronDown, Loader2, Search, X, Link2Off } from 'lucide-react';
import type { MaterialMatchState, SearchResultForMatch } from '@/lib/bulk-import/types';

interface MaterialMatchCellProps {
  matchState: MaterialMatchState | undefined;
  onSelectResult: (index: number) => void;
  onManualSearch?: (query: string) => Promise<SearchResultForMatch[]>;
}

function sourceLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    primary: 'Supplier',
    staging: 'Internal',
    global_library: 'Library',
    ecoinvent_proxy: 'ecoinvent',
    ecoinvent_live: 'ecoinvent',
    agribalyse_live: 'Agribalyse',
    defra: 'DEFRA',
  };
  return labels[sourceType] || sourceType;
}

function sourceBadgeVariant(sourceType: string): 'default' | 'secondary' | 'outline' {
  if (sourceType === 'primary') return 'default';
  if (sourceType === 'global_library' || sourceType === 'staging') return 'secondary';
  return 'outline';
}

export function MaterialMatchCell({
  matchState,
  onSelectResult,
  onManualSearch,
}: MaterialMatchCellProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [manualResults, setManualResults] = useState<SearchResultForMatch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!matchState) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Link2Off className="h-3 w-3" />
        Unlinked
      </span>
    );
  }

  const { status, searchResults, selectedIndex, autoMatchConfidence } = matchState;

  // Loading state
  if (status === 'searching' || status === 'pending') {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Searching...
      </span>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <span className="text-xs text-red-500 flex items-center gap-1">
        <X className="h-3 w-3" />
        Error
      </span>
    );
  }

  // No match found
  if (status === 'no_match' || selectedIndex == null || searchResults.length === 0) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs gap-1">
            <Link2Off className="h-3 w-3 text-red-500" />
            <span className="text-red-500">Unlinked</span>
            <Search className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="start">
          <SearchPopoverContent
            inputRef={inputRef}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searching={searching}
            results={manualResults}
            onSearch={async (q) => {
              if (!onManualSearch || q.length < 2) return;
              setSearching(true);
              try {
                const results = await onManualSearch(q);
                setManualResults(results);
              } finally {
                setSearching(false);
              }
            }}
            onSelect={(idx) => {
              // Need to update the parent's state with the manual results
              // For now, select from manual results
              onSelectResult(idx);
              setOpen(false);
            }}
            initialName={matchState.materialName}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Matched
  const selected = searchResults[selectedIndex];
  const isHighConfidence = (autoMatchConfidence ?? 0) >= 0.7;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs gap-1 max-w-[200px]">
          <Check className={`h-3 w-3 flex-shrink-0 ${isHighConfidence ? 'text-green-600' : 'text-amber-500'}`} />
          <span className="truncate">{selected.name}</span>
          <Badge
            variant={sourceBadgeVariant(selected.source_type)}
            className="text-[10px] px-1 py-0 flex-shrink-0"
          >
            {sourceLabel(selected.source_type)}
          </Badge>
          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <p className="text-xs text-muted-foreground">
            Matched &quot;{matchState.materialName}&quot;
            {autoMatchConfidence != null && (
              <span className="ml-1">
                ({Math.round(autoMatchConfidence * 100)}% confidence)
              </span>
            )}
          </p>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {searchResults.map((result, idx) => (
            <button
              key={`${result.id}-${idx}`}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 ${
                idx === selectedIndex ? 'bg-muted' : ''
              }`}
              onClick={() => {
                onSelectResult(idx);
                setOpen(false);
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-xs">{result.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {result.category}
                  {result.co2_factor != null && ` · ${result.co2_factor.toFixed(3)} kgCO₂e`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge
                  variant={sourceBadgeVariant(result.source_type)}
                  className="text-[10px] px-1 py-0"
                >
                  {sourceLabel(result.source_type)}
                </Badge>
                {idx === selectedIndex && <Check className="h-3 w-3 text-green-600" />}
              </div>
            </button>
          ))}
        </div>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              onSelectResult(-1); // -1 = deselect (unlink)
              setOpen(false);
            }}
          >
            <Link2Off className="h-3 w-3 mr-1" />
            Remove match (leave unlinked)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Search popover inner content ─────────────────────────────────────────

function SearchPopoverContent({
  inputRef,
  searchQuery,
  setSearchQuery,
  searching,
  results,
  onSearch,
  onSelect,
  initialName,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searching: boolean;
  results: SearchResultForMatch[];
  onSearch: (q: string) => Promise<void>;
  onSelect: (idx: number) => void;
  initialName: string;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => onSearch(value), 300);
    }
  };

  // Auto-search with initial name on mount
  useEffect(() => {
    if (initialName.length >= 2) {
      setSearchQuery(initialName);
      onSearch(initialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={searchQuery}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search emission factors..."
            className={cn(
              'flex h-8 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-xs ring-offset-background',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {searching ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
            Searching...
          </div>
        ) : results.length === 0 && searchQuery.length >= 2 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No results found
          </div>
        ) : (
          results.map((result, idx) => (
            <button
              key={`${result.id}-${idx}`}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2"
              onClick={() => onSelect(idx)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-xs">{result.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {result.category}
                  {result.co2_factor != null && ` · ${result.co2_factor.toFixed(3)} kgCO₂e`}
                </p>
              </div>
              <Badge
                variant={sourceBadgeVariant(result.source_type)}
                className="text-[10px] px-1 py-0 flex-shrink-0"
              >
                {sourceLabel(result.source_type)}
              </Badge>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
