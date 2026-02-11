"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Database, Layers, CheckCircle2, AlertCircle, Shield, Leaf, Sprout, BookOpen, FlaskConical, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { DataSource } from "@/lib/types/lca";

interface SearchResult {
  id: string;
  name: string;
  category: string;
  unit?: string;
  processType?: string;
  location?: string;
  co2_factor?: number;
  water_factor?: number;
  land_factor?: number;
  waste_factor?: number;
  source?: string;
  source_type?: 'primary' | 'staging' | 'global_library' | 'ecoinvent_proxy' | 'ecoinvent_live' | 'defra';
  data_quality?: 'verified' | 'calculated' | 'estimated';
  data_quality_grade?: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainty_percent?: number;
  source_citation?: string;
  metadata?: any;
  supplier_name?: string;
  recycled_content_pct?: number;
  packaging_components?: any;
}

interface SearchResponse {
  results: SearchResult[];
  total_found: number;
  sources: {
    primary: number;
    staging: number;
    global_library: number;
    ecoinvent_proxy: number;
    ecoinvent_live: number;
  };
  openlca_enabled: boolean;
}

interface InlineIngredientSearchProps {
  organizationId: string;
  value: string;
  placeholder?: string;
  onSelect: (selection: {
    name: string;
    data_source: DataSource;
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit: string;
    carbon_intensity?: number;
    location?: string;
    recycled_content_pct?: number;
    packaging_components?: any;
  }) => void;
  onChange?: (value: string) => void;
  className?: string;
}

export function InlineIngredientSearch({
  organizationId,
  value,
  placeholder = "Search for ingredient...",
  onSelect,
  onChange,
  className,
}: InlineIngredientSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<SearchResponse['sources'] | null>(null);
  const [openLCAEnabled, setOpenLCAEnabled] = useState(false);
  const [searchDuration, setSearchDuration] = useState(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchStartRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchDuration(0);
    searchStartRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setSearchDuration(Math.floor((Date.now() - searchStartRef.current) / 1000));
    }, 1000);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `/api/ingredients/search?q=${encodeURIComponent(searchQuery)}&organization_id=${organizationId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed: ${response.status}`);
      }

      const data: SearchResponse = await response.json();
      setResults(data.results || []);
      setSourceCounts(data.sources);
      setOpenLCAEnabled(data.openlca_enabled);
      setShowResults(true);

    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setSearchDuration(0);
      setIsSearching(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    setQuery(newValue);
    onChange?.(newValue);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(newValue);
    }, 300);
  };

  const handleResultSelect = (result: SearchResult) => {
    console.log('[InlineSearch] Selected result:', {
      id: result.id,
      source_type: result.source_type,
      name: result.name,
    });

    // Map source_type to DataSource
    const dataSourceType: DataSource =
      result.source_type === 'primary' ? 'supplier' :
      result.source_type === 'staging' ? 'staging' :
      result.source_type === 'global_library' ? 'staging' : // Global library stored in staging table
      result.source_type === 'ecoinvent_proxy' ? 'ecoinvent' :
      result.source_type === 'ecoinvent_live' ? 'openlca' :
      result.source_type === 'defra' ? 'defra' :
      // Fallback to old logic
      result.processType === 'STAGING_FACTOR' ? 'staging' :
      result.processType === 'ECOINVENT_PROXY' ? 'ecoinvent' :
      result.supplier_name ? 'supplier' :
      'openlca';

    const selectedData = {
      name: result.name,
      data_source: dataSourceType,
      data_source_id: result.id,
      supplier_product_id: result.source_type === 'primary' ? result.id : undefined,
      supplier_name: result.metadata?.supplier_name || result.supplier_name,
      unit: result.unit || 'kg',
      carbon_intensity: result.co2_factor,
      location: result.location,
      recycled_content_pct: result.recycled_content_pct || result.metadata?.recycled_content_pct,
      packaging_components: result.packaging_components,
    };

    console.log('[InlineSearch] Calling onSelect with:', {
      data_source: selectedData.data_source,
      data_source_id: selectedData.data_source_id,
      name: selectedData.name,
    });

    onSelect(selectedData);

    setQuery(result.name);
    setShowResults(false);
  };

  const getSourceBadge = (result: SearchResult) => {
    const sourceType = result.source_type;
    const source = result.source || '';

    switch (sourceType) {
      case 'primary':
        return (
          <Badge className="bg-emerald-600 text-white text-xs shrink-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Primary
          </Badge>
        );
      case 'global_library': {
        const grade = result.data_quality_grade || result.metadata?.data_quality_grade;
        if (grade === 'HIGH') {
          return (
            <Badge className="bg-emerald-600 text-white text-xs shrink-0">
              <BookOpen className="h-3 w-3 mr-1" />
              Peer-Reviewed
            </Badge>
          );
        }
        if (grade === 'MEDIUM') {
          return (
            <Badge className="bg-amber-600 text-white text-xs shrink-0">
              <FlaskConical className="h-3 w-3 mr-1" />
              Literature-Based
            </Badge>
          );
        }
        return (
          <Badge className="bg-slate-500 text-white text-xs shrink-0">
            <Info className="h-3 w-3 mr-1" />
            Proxy Estimate
          </Badge>
        );
      }
      case 'staging':
        return (
          <Badge className="bg-blue-600 text-white text-xs shrink-0">
            <Database className="h-3 w-3 mr-1" />
            Internal
          </Badge>
        );
      case 'ecoinvent_proxy':
        return (
          <Badge className="bg-purple-600 text-white text-xs shrink-0">
            <Layers className="h-3 w-3 mr-1" />
            ecoInvent
          </Badge>
        );
      case 'ecoinvent_live':
        return (
          <Badge className="bg-green-600 text-white text-xs shrink-0">
            <Leaf className="h-3 w-3 mr-1" />
            ecoInvent Live
          </Badge>
        );
      case 'agribalyse_live':
        return (
          <Badge className="bg-teal-600 text-white text-xs shrink-0">
            <Sprout className="h-3 w-3 mr-1" />
            Agribalyse
          </Badge>
        );
      case 'defra':
        return (
          <Badge className="bg-orange-600 text-white text-xs shrink-0">
            <Shield className="h-3 w-3 mr-1" />
            DEFRA
          </Badge>
        );
      default:
        // Fallback based on source string
        if (source.toLowerCase().includes('primary') || source.toLowerCase().includes('verified')) {
          return (
            <Badge className="bg-emerald-600 text-white text-xs shrink-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Primary
            </Badge>
          );
        }
        if (source.toLowerCase().includes('ecoinvent')) {
          return (
            <Badge className="bg-green-600 text-white text-xs shrink-0">
              <Leaf className="h-3 w-3 mr-1" />
              ecoInvent
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="text-xs shrink-0">
            <Database className="h-3 w-3 mr-1" />
            Secondary
          </Badge>
        );
    }
  };

  const getResultIcon = (result: SearchResult) => {
    switch (result.source_type) {
      case 'primary':
        return <Shield className="h-4 w-4 text-emerald-600 shrink-0" />;
      case 'global_library':
        return <BookOpen className="h-4 w-4 text-amber-600 shrink-0" />;
      case 'staging':
        return <Database className="h-4 w-4 text-blue-600 shrink-0" />;
      case 'ecoinvent_proxy':
        return <Layers className="h-4 w-4 text-purple-600 shrink-0" />;
      case 'ecoinvent_live':
        return <Leaf className="h-4 w-4 text-green-600 shrink-0" />;
      case 'agribalyse_live':
        return <Sprout className="h-4 w-4 text-teal-600 shrink-0" />;
      case 'defra':
        return <Building2 className="h-4 w-4 text-orange-600 shrink-0" />;
      default:
        // Fallback
        if (result.processType === 'SUPPLIER_PRODUCT') {
          return <Shield className="h-4 w-4 text-emerald-600 shrink-0" />;
        }
        if (result.supplier_name) {
          return <Building2 className="h-4 w-4 text-green-600 shrink-0" />;
        }
        return <Database className="h-4 w-4 text-slate-600 shrink-0" />;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {isSearching && (
        <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 animate-in fade-in duration-300">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span>
            {searchDuration < 3
              ? 'Searching suppliers and databases...'
              : searchDuration < 10
                ? 'Searching ecoinvent database (first search takes longer)...'
                : 'Loading ecoinvent process library. This only happens once per session...'}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto shadow-lg">
          <div className="p-2 space-y-1">
            {/* Summary header */}
            <div className="px-2 py-1.5 border-b flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                Found {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
              <div className="flex flex-wrap gap-1">
                {sourceCounts?.primary && sourceCounts.primary > 0 && (
                  <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {sourceCounts.primary} Primary
                  </Badge>
                )}
                {sourceCounts?.ecoinvent_live && sourceCounts.ecoinvent_live > 0 && (
                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                    {sourceCounts.ecoinvent_live} ecoInvent
                  </Badge>
                )}
                {sourceCounts?.agribalyse_live && sourceCounts.agribalyse_live > 0 && (
                  <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                    {sourceCounts.agribalyse_live} Agribalyse
                  </Badge>
                )}
                {sourceCounts?.global_library && sourceCounts.global_library > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                    {sourceCounts.global_library} Library
                  </Badge>
                )}
                {sourceCounts?.staging && sourceCounts.staging > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {sourceCounts.staging} Internal
                  </Badge>
                )}
              </div>
            </div>

            {/* Results list */}
            {results.map((result) => (
              <Button
                key={`${result.source_type}-${result.id}`}
                variant="ghost"
                className="w-full justify-start text-left h-auto py-3 px-3 hover:bg-accent"
                onClick={() => handleResultSelect(result)}
              >
                <div className="flex items-start gap-3 w-full">
                  {getResultIcon(result)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{result.name}</span>
                      {getSourceBadge(result)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {result.unit && (
                        <span className="text-xs text-muted-foreground">
                          Unit: {result.unit}
                        </span>
                      )}
                      {result.location && (
                        <span className="text-xs text-muted-foreground">
                          {result.location}
                        </span>
                      )}
                      {result.metadata?.supplier_name && (
                        <Badge variant="outline" className="text-xs">
                          {result.metadata.supplier_name}
                        </Badge>
                      )}
                      {(result.recycled_content_pct || result.metadata?.recycled_content_pct) &&
                       (result.recycled_content_pct || result.metadata?.recycled_content_pct) > 0 && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs">
                          {result.recycled_content_pct || result.metadata?.recycled_content_pct}% recycled
                        </Badge>
                      )}
                    </div>
                    {result.co2_factor && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.co2_factor.toFixed(3)} kg CO₂e/{result.unit || 'kg'}
                        {result.source_type === 'global_library' && (result.uncertainty_percent || result.metadata?.uncertainty_percent) && (
                          <span className="text-muted-foreground/70 ml-1">
                            ±{result.uncertainty_percent || result.metadata?.uncertainty_percent}%
                          </span>
                        )}
                      </div>
                    )}
                    {result.source_type === 'global_library' && result.source_citation && (
                      <div className="text-xs text-muted-foreground/70 mt-0.5 truncate max-w-full" title={result.source_citation}>
                        Source: {result.source_citation.length > 80 ? result.source_citation.slice(0, 80) + '...' : result.source_citation}
                      </div>
                    )}
                    {result.source_type === 'ecoinvent_live' && result.metadata?.system_model && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {result.metadata.system_model} system model
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {showResults && results.length === 0 && !isSearching && query.length >= 2 && (
        <Card className="absolute z-50 mt-1 w-full shadow-lg">
          <div className="p-4 text-center text-sm text-muted-foreground">
            No results found for &quot;{query}&quot;
            {!openLCAEnabled && (
              <div className="mt-2 text-xs text-amber-600">
                OpenLCA is not connected. Configure it in Settings to search ecoInvent.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
