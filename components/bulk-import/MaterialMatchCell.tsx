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
import { AlertTriangle, Check, ChevronDown, Loader2, Search, Sparkles, X, Link2Off } from 'lucide-react';
import type { MaterialMatchState, ProxySuggestion, SearchResultForMatch } from '@/lib/bulk-import/types';
import { cleanSearchQuery } from '@/lib/bulk-import/batch-matcher';

interface MaterialMatchCellProps {
  matchState: MaterialMatchState | undefined;
  onSelectResult: (index: number, manualResults?: SearchResultForMatch[]) => void;
  onManualSearch?: (query: string) => Promise<SearchResultForMatch[]>;
  /** AI-powered proxy suggestion callback */
  onSuggestProxy?: (ingredientName: string) => Promise<ProxySuggestion[]>;
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

function confidenceBadgeColor(note: 'high' | 'medium' | 'low'): string {
  if (note === 'high') return 'border-green-600/30 text-green-600';
  if (note === 'medium') return 'border-amber-500/30 text-amber-500';
  return 'border-red-500/30 text-red-500';
}

export function MaterialMatchCell({
  matchState,
  onSelectResult,
  onManualSearch,
  onSuggestProxy,
}: MaterialMatchCellProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [manualResults, setManualResults] = useState<SearchResultForMatch[]>([]);
  const [proxySuggestions, setProxySuggestions] = useState<ProxySuggestion[]>([]);
  const [loadingProxy, setLoadingProxy] = useState(false);
  const [proxySearching, setProxySearching] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Cancels any in-flight search when a proxy selection is made or popover closes */
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Guards against late-resolving searches overwriting state after a proxy selection */
  const selectionMadeRef = useRef(false);

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

  // Handler: request proxy suggestions from AI
  const handleSuggestProxy = async () => {
    if (!onSuggestProxy || loadingProxy) return;
    setLoadingProxy(true);
    try {
      const suggestions = await onSuggestProxy(matchState.materialName);
      setProxySuggestions(suggestions);
    } finally {
      setLoadingProxy(false);
    }
  };

  // Handler: use a proxy suggestion (search for it then select first result)
  const handleUseProxy = async (suggestion: ProxySuggestion) => {
    if (!onManualSearch) return;
    // Cancel any in-flight auto-search to prevent it from overwriting state
    abortControllerRef.current?.abort();
    selectionMadeRef.current = true;
    setProxySearching(suggestion.search_query);
    try {
      const results = await onManualSearch(suggestion.search_query);
      if (results.length > 0) {
        // Pass the manual results so the parent can update searchResults
        // and select index 0 in the same state update (avoids race condition
        // where searchResults haven't flushed yet).
        onSelectResult(0, results);
        setOpen(false);
      }
    } finally {
      setProxySearching(null);
    }
  };

  // Popover open/close handler — resets guards on open, cancels searches on close
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      selectionMadeRef.current = false;
    } else {
      // Cancel any in-flight search when popover closes
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  };

  // No match found — show prominent search trigger
  if (status === 'no_match' || selectedIndex == null || searchResults.length === 0) {
    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1.5 h-7 px-2 rounded-md text-xs',
              'border border-dashed border-red-500/40 hover:border-red-500/70 hover:bg-red-500/5',
              'text-red-500 transition-colors cursor-pointer max-w-[200px]'
            )}
          >
            <Link2Off className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Unlinked</span>
            <Search className="h-3 w-3 flex-shrink-0 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="p-2 border-b bg-muted/30">
            <p className="text-[11px] font-medium mb-1.5">
              Find emission factor for &quot;{matchState.materialName}&quot;
            </p>
            <SearchPopoverContent
              inputRef={inputRef}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searching={searching}
              results={manualResults}
              onSearch={async (q) => {
                if (!onManualSearch || q.length < 2 || selectionMadeRef.current) return;
                // Cancel any previous in-flight search
                abortControllerRef.current?.abort();
                const controller = new AbortController();
                abortControllerRef.current = controller;
                setSearching(true);
                try {
                  const results = await onManualSearch(q);
                  // Only update if this search wasn't cancelled and no proxy selection was made
                  if (!controller.signal.aborted && !selectionMadeRef.current) {
                    setManualResults(results);
                  }
                } finally {
                  if (!controller.signal.aborted) {
                    setSearching(false);
                  }
                }
              }}
              onSelect={(idx) => {
                // Pass manualResults so parent can update searchResults atomically
                selectionMadeRef.current = true;
                abortControllerRef.current?.abort();
                onSelectResult(idx, manualResults);
                setOpen(false);
              }}
              initialName={cleanSearchQuery(matchState.materialName)}
            />
          </div>

          {/* AI Proxy Suggestion Section */}
          {onSuggestProxy && (
            <div className="border-t">
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs gap-1.5 h-7"
                  onClick={handleSuggestProxy}
                  disabled={loadingProxy}
                >
                  {loadingProxy ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Finding proxy suggestions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      AI Proxy Suggestion
                    </>
                  )}
                </Button>
              </div>

              {proxySuggestions.length > 0 && (
                <div className="px-2 pb-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium px-1">
                    Suggested proxies:
                  </p>
                  {proxySuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{suggestion.proxy_name}</span>
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] px-1 py-0 flex-shrink-0', confidenceBadgeColor(suggestion.confidence_note))}
                        >
                          {suggestion.confidence_note}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {suggestion.reasoning}
                      </p>
                      {suggestion.uncertainty_impact && (
                        <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                          Uncertainty: {suggestion.uncertainty_impact}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-1.5 h-5 text-[10px] px-2"
                        onClick={() => handleUseProxy(suggestion)}
                        disabled={proxySearching === suggestion.search_query}
                      >
                        {proxySearching === suggestion.search_query ? (
                          <>
                            <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Search className="h-2.5 w-2.5 mr-1" />
                            Use this proxy
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Matched
  const selected = searchResults[selectedIndex];
  const isHighConfidence = (autoMatchConfidence ?? 0) >= 0.7;
  const isLowConfidence = (autoMatchConfidence ?? 0) < 0.5;

  const ConfidenceIcon = isLowConfidence ? AlertTriangle : Check;
  const confidenceColor = isHighConfidence ? 'text-green-600' : isLowConfidence ? 'text-amber-600' : 'text-amber-500';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs gap-1 max-w-[200px]">
          <ConfidenceIcon className={`h-3 w-3 flex-shrink-0 ${confidenceColor}`} />
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
        <div className="p-2 border-t space-y-1">
          {/* AI Proxy suggestion for low-confidence matches */}
          {isLowConfidence && onSuggestProxy && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1.5 h-7"
              onClick={handleSuggestProxy}
              disabled={loadingProxy}
            >
              {loadingProxy ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Finding alternatives...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Suggest better proxy
                </>
              )}
            </Button>
          )}
          {proxySuggestions.length > 0 && (
            <div className="space-y-1 pt-1">
              {proxySuggestions.slice(0, 3).map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-auto py-1 justify-start gap-1.5"
                  onClick={() => handleUseProxy(suggestion)}
                  disabled={proxySearching === suggestion.search_query}
                >
                  {proxySearching === suggestion.search_query ? (
                    <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                  ) : (
                    <Search className="h-3 w-3 flex-shrink-0" />
                  )}
                  <span className="truncate">{suggestion.proxy_name}</span>
                  <Badge
                    variant="outline"
                    className={cn('text-[9px] px-1 py-0 ml-auto flex-shrink-0', confidenceBadgeColor(suggestion.confidence_note))}
                  >
                    {suggestion.confidence_note}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-7"
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
      <div className="pb-2">
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
