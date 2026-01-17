"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Database, Layers, CheckCircle2, AlertCircle, Shield } from "lucide-react";
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
  metadata?: any;
  supplier_name?: string;
  recycled_content_pct?: number;
  packaging_components?: any;
}

interface SearchResponse {
  results: SearchResult[];
  cached: boolean;
  source: string;
  waterfall_stage: number;
  mock?: boolean;
  note?: string;
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
  const [waterfallStage, setWaterfallStage] = useState<number | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
      setWaterfallStage(data.waterfall_stage);
      setDataSource(data.source);
      setShowResults(true);

      if (data.mock) {
        setError("Using mock data. Configure OpenLCA server for real results.");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
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
    const dataSourceType: DataSource =
      result.processType === 'STAGING_FACTOR' ? 'staging' :
      result.processType === 'ECOINVENT_PROXY' ? 'ecoinvent' :
      result.supplier_name ? 'supplier' :
      'openlca';

    onSelect({
      name: result.name,
      data_source: dataSourceType,
      data_source_id: result.id,
      supplier_product_id: result.processType === 'supplier' ? result.id : undefined,
      supplier_name: result.supplier_name,
      unit: result.unit || 'kg',
      carbon_intensity: result.co2_factor,
      location: result.location,
      recycled_content_pct: result.recycled_content_pct,
      packaging_components: result.packaging_components,
    });

    setQuery(result.name);
    setShowResults(false);
  };

  const getWaterfallBadge = (stage: number) => {
    switch (stage) {
      case 0:
        return (
          <Badge className="bg-emerald-600 text-white text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Verified Supplier Data
          </Badge>
        );
      case 1:
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Primary Verified
          </Badge>
        );
      case 2:
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 text-xs">
            <Layers className="h-3 w-3 mr-1" />
            Regional Standard
          </Badge>
        );
      case 3:
      case 4:
        return (
          <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 text-xs">
            <Database className="h-3 w-3 mr-1" />
            Secondary Modelled
          </Badge>
        );
      default:
        return null;
    }
  };

  const getResultIcon = (result: SearchResult) => {
    if (result.processType === 'SUPPLIER_PRODUCT') {
      return <Shield className="h-4 w-4 text-emerald-600" />;
    }
    if (result.supplier_name) {
      return <Building2 className="h-4 w-4 text-green-600" />;
    }
    if (result.processType === 'STAGING_FACTOR') {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (result.processType === 'ECOINVENT_PROXY') {
      return <Layers className="h-4 w-4 text-blue-600" />;
    }
    return <Database className="h-4 w-4 text-slate-600" />;
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

      {error && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto shadow-lg">
          <div className="p-2 space-y-1">
            {waterfallStage && (
              <div className="px-2 py-1.5 border-b flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Found {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
                {getWaterfallBadge(waterfallStage)}
              </div>
            )}
            {results.map((result) => (
              <Button
                key={result.id}
                variant="ghost"
                className="w-full justify-start text-left h-auto py-3 px-3 hover:bg-accent"
                onClick={() => handleResultSelect(result)}
              >
                <div className="flex items-start gap-3 w-full">
                  {getResultIcon(result)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{result.name}</div>
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
                      {result.supplier_name && (
                        <Badge variant="outline" className="text-xs">
                          {result.supplier_name}
                        </Badge>
                      )}
                      {result.recycled_content_pct && result.recycled_content_pct > 0 && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs">
                          {result.recycled_content_pct}% recycled
                        </Badge>
                      )}
                    </div>
                    {result.co2_factor && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.co2_factor.toFixed(3)} kg CO₂e/{result.unit || 'kg'}
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
            No results found for "{query}"
          </div>
        </Card>
      )}
    </div>
  );
}
