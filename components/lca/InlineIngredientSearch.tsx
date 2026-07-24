"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Database, Layers, CheckCircle2, AlertCircle, AlertTriangle, Shield, Leaf, Sprout, BookOpen, FlaskConical, Info, Sparkles, Search, Lightbulb, Droplets, TreePine, Star, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { findBrandNameMatch } from "@/lib/openlca/drinks-aliases";
import type { DataSource } from "@/lib/types/lca";
import { cleanFactorDisplayName } from "@/lib/factor-display-name";
import { FactorInfoHint } from "./FactorInfoHint";
import { mapOpenLcaUnit } from "@/lib/constants/material-units";
import { FactorInfoTrigger } from "./FactorInfoTrigger";

interface ProxySuggestion {
  proxy_name: string;
  search_query: string;
  category: string;
  reasoning: string;
  confidence_note: 'high' | 'medium' | 'low';
  uncertainty_impact?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  friendly_name?: string;
  category: string;
  unit?: string;
  processType?: string;
  location?: string;
  co2_factor?: number;
  water_factor?: number;
  land_factor?: number;
  waste_factor?: number;
  source?: string;
  source_type?: 'primary' | 'staging' | 'global_library' | 'ecoinvent_proxy' | 'ecoinvent_live' | 'agribalyse_live' | 'defra';
  data_quality?: 'verified' | 'calculated' | 'estimated';
  data_quality_grade?: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainty_percent?: number;
  source_citation?: string;
  metadata?: any;
  supplier_name?: string;
  recycled_content_pct?: number;
  packaging_components?: any;
  // Packaging supplier product data
  supplier_product_type?: 'ingredient' | 'packaging';
  supplier_weight_g?: number | null;
  supplier_packaging_category?: string | null;
  supplier_primary_material?: string | null;
  supplier_epr_material_code?: string | null;
  supplier_epr_is_drinks_container?: boolean | null;
  // FLAG commodity and deforestation status
  commodity_type?: string;
  deforestation_commitment_verified?: boolean;
  // Favourites / popularity boost data
  is_user_favourite?: boolean;
  global_selection_count?: number;
  /** How many of this organisation's product materials already use this factor */
  org_usage_count?: number;
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
    agribalyse_live: number;
  };
  openlca_enabled: boolean;
  agribalyse_enabled?: boolean;
  openlca_error?: string | null;
  agribalyse_error?: string | null;
  live_databases_degraded?: boolean;
}

interface InlineIngredientSearchProps {
  organizationId: string;
  value: string;
  placeholder?: string;
  /** Whether this search is for an ingredient or packaging material. Affects filtering and AI proxy suggestions. */
  materialType?: 'ingredient' | 'packaging';
  /** Packaging category context for smarter ranking (e.g. 'closure', 'container'). Only relevant when materialType='packaging'. */
  packagingCategory?: string;
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
    user_query?: string;
    /** Raw reference unit of the factor (e.g. 'kg', 'l', 'Item(s)'); undefined = unknown */
    ef_reference_unit?: string;
    /** True when software picked this result (e.g. AI proxy auto-select) rather than the user */
    auto_matched?: boolean;
    // Emission factor metadata for detail tooltip
    ef_source?: string;
    ef_source_type?: string;
    ef_data_quality_grade?: string;
    ef_uncertainty_percent?: number;
    // Packaging supplier product data (auto-populated from supplier)
    supplier_weight_g?: number | null;
    supplier_packaging_category?: string | null;
    supplier_primary_material?: string | null;
    supplier_epr_material_code?: string | null;
    supplier_epr_is_drinks_container?: boolean | null;
  }) => void;
  onChange?: (value: string) => void;
  className?: string;
}

/**
 * The live reference databases could not be reached.
 *
 * Shown wherever search results appear, not only on an empty result set. The
 * ecoinvent and Agribalyse servers have twice been unreachable for weeks
 * (expired certificates in June 2026, a lost DNS record in July) and both went
 * unnoticed because a local factor usually matches something: the list looked
 * normal while the best matches were silently absent.
 */
function DegradedDatabasesNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[6px] border border-border bg-card px-3 py-2 text-xs text-[#B45309]',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Reference databases temporarily unavailable</p>
          <p className="mt-0.5">
            The ecoinvent and Agribalyse databases could not be reached, so only your internal
            factors are shown. Anything you pick now will carry a lower confidence than usual. This
            is a server issue, not a missing ingredient. Please try again shortly, or contact
            support if it persists.
          </p>
        </div>
      </div>
    </div>
  );
}

export function InlineIngredientSearch({
  organizationId,
  value,
  placeholder = "Search for ingredient...",
  materialType = 'ingredient',
  packagingCategory,
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
  const [liveDbDegraded, setLiveDbDegraded] = useState(false);
  const [searchDuration, setSearchDuration] = useState(0);
  const [proxySuggestions, setProxySuggestions] = useState<ProxySuggestion[]>([]);
  const [loadingProxy, setLoadingProxy] = useState(false);
  const [proxySearching, setProxySearching] = useState<string | null>(null);
  const [proxyAllFailed, setProxyAllFailed] = useState(false);
  // Recommended-pick layout: show Best match + 3 alternatives by default
  const [showAllResults, setShowAllResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchStartRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef(false);

  // Brand name detection: suggest generic term when user types a trade name
  const brandMatch = useMemo(() => {
    if (query.length < 3 || !isTypingRef.current) return null;
    return findBrandNameMatch(query);
  }, [query]);

  useEffect(() => {
    // Only sync from prop when user isn't actively typing,
    // otherwise the parent clearing matched_source_name would wipe the search input.
    if (!isTypingRef.current) {
      setQuery(value);
    }
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

      const searchUrl = `/api/ingredients/search?q=${encodeURIComponent(searchQuery)}&organization_id=${organizationId}${materialType ? `&material_type=${materialType}` : ''}${packagingCategory ? `&packaging_category=${encodeURIComponent(packagingCategory)}` : ''}`;
      const response = await fetch(
        searchUrl,
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
      setShowAllResults(false);
      setSourceCounts(data.sources);
      setOpenLCAEnabled(data.openlca_enabled);
      setLiveDbDegraded(Boolean(data.live_databases_degraded));
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

  const fetchProxySuggestions = async (ingredientName: string) => {
    if (loadingProxy || ingredientName.length < 2) return;
    setLoadingProxy(true);
    setProxySuggestions([]);
    setProxyAllFailed(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/ingredients/proxy-suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ingredient_name: ingredientName,
          ingredient_type: materialType,
          organization_id: organizationId,
        }),
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.suggestions) {
        setProxySuggestions(data.suggestions);
      }
      if (data.all_failed) {
        setProxyAllFailed(true);
      }
    } catch (err) {
      console.error('[InlineSearch] Proxy suggestion error:', err);
    } finally {
      setLoadingProxy(false);
    }
  };

  const handleUseProxy = async (suggestion: ProxySuggestion) => {
    const originalUserQuery = query; // Capture user's real ingredient name before proxy search
    setProxySearching(suggestion.search_query);
    try {
      // Search with the proxy's optimised query
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const proxySearchUrl = `/api/ingredients/search?q=${encodeURIComponent(suggestion.search_query)}&organization_id=${organizationId}${materialType ? `&material_type=${materialType}` : ''}`;
      const response = await fetch(
        proxySearchUrl,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) return;

      const data: SearchResponse = await response.json();
      if (data.results && data.results.length > 0) {
        // Auto-select the first result, preserving the user's original query
        handleResultSelect(data.results[0], originalUserQuery, { autoMatched: true });
        setProxySuggestions([]);
      } else {
        // Show the proxy results in the main results list
        setResults([]);
        setShowResults(true);
        setError(`No database matches found for "${suggestion.proxy_name}". Try another proxy.`);
      }
    } catch (err) {
      console.error('[InlineSearch] Proxy search error:', err);
    } finally {
      setProxySearching(null);
    }
  };

  const handleInputChange = (newValue: string) => {
    isTypingRef.current = true;
    setQuery(newValue);
    onChange?.(newValue);
    setProxySuggestions([]);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(newValue);
    }, 300);
  };


  /**
   * One plain-language sentence explaining WHY the top result is recommended,
   * so a non-expert can confirm rather than adjudicate raw LCA metadata.
   */
  const buildMatchReason = (result: SearchResult): string => {
    const parts: string[] = [];
    switch (result.source_type) {
      case 'primary': parts.push('verified data from your supplier network'); break;
      case 'global_library': parts.push('from our curated drinks factor library'); break;
      case 'staging': parts.push("from your organisation's own library"); break;
      case 'ecoinvent_proxy':
      case 'ecoinvent_live': parts.push('from the ecoinvent scientific database'); break;
      case 'agribalyse_live': parts.push('from the Agribalyse food database'); break;
      default: break;
    }
    const grade = result.data_quality_grade || result.metadata?.data_quality_grade;
    if (grade === 'HIGH') parts.push('high quality data');
    else if (grade === 'MEDIUM') parts.push('good quality data');
    if (result.org_usage_count && result.org_usage_count > 0) {
      parts.push(`you already use it on ${result.org_usage_count} of your product${result.org_usage_count > 1 ? 's' : ''}`);
    } else if ((result.global_selection_count || 0) >= 3) {
      parts.push(`chosen by ${result.global_selection_count} other producers`);
    }
    const sentence = parts.join(', ');
    return sentence ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : 'Closest match to your search';
  };

  const handleResultSelect = async (result: SearchResult, overrideUserQuery?: string, opts?: { autoMatched?: boolean }) => {
    console.log('[InlineSearch] Selected result:', {
      id: result.id,
      source_type: result.source_type,
      name: result.name,
      user_query: overrideUserQuery || query,
    });

    // Live ecoinvent/Agribalyse descriptors don't carry their reference unit,
    // and assuming "per kg" was wrong for per-litre/per-item processes. Fetch
    // the real unit on selection (cached server-side); on failure the unit
    // stays unknown rather than guessed.
    let resolvedUnit = result.unit;
    let efReferenceUnit: string | undefined = result.unit;
    const isLiveResult = result.source_type === 'ecoinvent_live' || result.source_type === 'agribalyse_live';
    if (isLiveResult && !resolvedUnit) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const db = result.source_type === 'agribalyse_live' ? 'agribalyse' : 'ecoinvent';
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const resp = await fetch(
            `/api/openlca/reference-unit?process_id=${encodeURIComponent(result.id)}&database=${db}`,
            { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal }
          );
          clearTimeout(timer);
          if (resp.ok) {
            const data = await resp.json();
            efReferenceUnit = data.unit ?? undefined;
            resolvedUnit = mapOpenLcaUnit(data.unit) ?? undefined;
          }
        }
      } catch {
        // Unknown unit is acceptable; never guess kg.
      }
    }

    // Map source_type to DB-valid DataSource values.
    // The product_materials.data_source constraint only allows 'openlca', 'supplier', or NULL.
    // All emission factor sources (staging, global_library, ecoinvent, defra, agribalyse)
    // use data_source_id UUIDs and should be stored as 'openlca' so the save function persists them.
    const dataSourceType: DataSource =
      result.source_type === 'primary' ? 'supplier' :
      result.source_type === 'staging' ? 'openlca' :
      result.source_type === 'global_library' ? 'openlca' :
      result.source_type === 'ecoinvent_proxy' ? 'openlca' :
      result.source_type === 'ecoinvent_live' ? 'openlca' :
      result.source_type === 'agribalyse_live' ? 'openlca' :
      result.source_type === 'defra' ? 'openlca' :
      // Fallback to old logic
      result.processType === 'STAGING_FACTOR' ? 'openlca' :
      result.processType === 'ECOINVENT_PROXY' ? 'openlca' :
      result.supplier_name ? 'supplier' :
      'openlca';

    const selectedData = {
      name: result.name,
      user_query: overrideUserQuery || query,
      data_source: dataSourceType,
      data_source_id: result.id,
      supplier_product_id: result.source_type === 'primary' ? result.id : undefined,
      supplier_name: result.metadata?.supplier_name || result.supplier_name,
      // Empty string = unknown; callers must not prefill a unit from it.
      unit: resolvedUnit || '',
      ef_reference_unit: efReferenceUnit,
      auto_matched: opts?.autoMatched ?? false,
      carbon_intensity: result.co2_factor,
      location: result.location,
      recycled_content_pct: result.recycled_content_pct || result.metadata?.recycled_content_pct,
      packaging_components: result.packaging_components,
      // Emission factor metadata for detail tooltip
      ef_source: result.source || result.metadata?.source,
      ef_source_type: result.source_type,
      // Track which OpenLCA database the factor comes from so the resolver
      // routes the calculation to the correct gdt-server instance.
      openlca_database: result.source_type === 'agribalyse_live' ? 'agribalyse'
        : result.source_type === 'ecoinvent_live' ? 'ecoinvent'
        : undefined,
      ef_data_quality_grade: result.data_quality_grade || result.metadata?.data_quality_grade,
      ef_uncertainty_percent: result.uncertainty_percent || result.metadata?.uncertainty_percent,
      // Pass through packaging supplier product data for auto-population
      supplier_weight_g: result.supplier_weight_g,
      supplier_packaging_category: result.supplier_packaging_category,
      supplier_primary_material: result.supplier_primary_material,
      supplier_epr_material_code: result.supplier_epr_material_code,
      supplier_epr_is_drinks_container: result.supplier_epr_is_drinks_container,
    };

    console.log('[InlineSearch] Calling onSelect with:', {
      data_source: selectedData.data_source,
      data_source_id: selectedData.data_source_id,
      name: selectedData.name,
      user_query: selectedData.user_query,
    });

    onSelect(selectedData);

    // Fire-and-forget: log selection for favourites and global popularity ranking
    void supabase.rpc('log_ef_selection', {
      p_search_query: overrideUserQuery || query,
      p_material_type: materialType || null,
      p_packaging_category: packagingCategory || null,
      p_selected_ef_id: result.id,
      p_selected_ef_name: result.name,
      p_ef_source_type: result.source_type || 'unknown',
      p_organization_id: organizationId,
    }).then(() => {}, () => {}); // silently ignore errors

    isTypingRef.current = false;
    setQuery(result.name);
    setShowResults(false);
  };

  const getSourceBadge = (result: SearchResult) => {
    const sourceType = result.source_type;
    const source = result.source || '';

    const chipClass = 'inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] shrink-0';

    switch (sourceType) {
      case 'primary':
        return (
          <span className={`${chipClass} text-[#047857]`}>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Primary
          </span>
        );
      case 'global_library': {
        const grade = result.data_quality_grade || result.metadata?.data_quality_grade;
        if (grade === 'HIGH') {
          return (
            <span className={`${chipClass} text-[#047857]`}>
              <BookOpen className="h-3 w-3 mr-1" />
              Peer-Reviewed
            </span>
          );
        }
        if (grade === 'MEDIUM') {
          return (
            <span className={`${chipClass} text-[#B45309]`}>
              <FlaskConical className="h-3 w-3 mr-1" />
              Literature-Based
            </span>
          );
        }
        return (
          <span className={`${chipClass} text-muted-foreground`}>
            <Info className="h-3 w-3 mr-1" />
            Proxy Estimate
          </span>
        );
      }
      case 'staging':
        return (
          <span className={`${chipClass} text-[#2B46C0]`}>
            <Database className="h-3 w-3 mr-1" />
            Internal
          </span>
        );
      case 'ecoinvent_proxy':
        return (
          <span className={`${chipClass} text-muted-foreground`}>
            <Layers className="h-3 w-3 mr-1" />
            ecoInvent
          </span>
        );
      case 'ecoinvent_live':
        return (
          <span className={`${chipClass} text-[#047857]`}>
            <Leaf className="h-3 w-3 mr-1" />
            ecoInvent Live
          </span>
        );
      case 'agribalyse_live':
        return (
          <span className={`${chipClass} text-[#047857]`}>
            <Sprout className="h-3 w-3 mr-1" />
            Agribalyse
          </span>
        );
      case 'defra':
        return (
          <span className={`${chipClass} text-[#2B46C0]`}>
            <Shield className="h-3 w-3 mr-1" />
            DEFRA
          </span>
        );
      default:
        // Fallback based on source string
        if (source.toLowerCase().includes('primary') || source.toLowerCase().includes('verified')) {
          return (
            <span className={`${chipClass} text-[#047857]`}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Primary
            </span>
          );
        }
        if (source.toLowerCase().includes('ecoinvent')) {
          return (
            <span className={`${chipClass} text-[#047857]`}>
              <Leaf className="h-3 w-3 mr-1" />
              ecoInvent
            </span>
          );
        }
        return (
          <span className={`${chipClass} text-muted-foreground`}>
            <Database className="h-3 w-3 mr-1" />
            Secondary
          </span>
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
          onBlur={() => { isTypingRef.current = false; }}
          placeholder={placeholder}
          className="pr-10"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {isSearching && (
        <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 animate-in fade-in duration-300">
          <Loader2 className="h-3 w-3 shrink-0" />
          <span>
            {searchDuration < 3
              ? 'Searching suppliers and databases...'
              : searchDuration < 10
                ? 'Searching ecoinvent database (first search takes longer)...'
                : 'Loading ecoinvent process library. This only happens once per session...'}
          </span>
        </div>
      )}

      {brandMatch && !showResults && (
        <div className="mt-1.5 rounded-[6px] border border-border bg-card px-3 py-2 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-[#2B46C0] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">&quot;{query}&quot;</span> is a brand/variety name: {brandMatch.explanation.toLowerCase()}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] border-border hover:bg-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleInputChange(brandMatch.genericTerm);
                  }}
                >
                  <Search className="h-2.5 w-2.5 mr-1" />
                  Search &quot;{brandMatch.genericTerm}&quot;
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    performSearch(query);
                  }}
                >
                  Keep original search
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-[#B45309] flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <FactorInfoHint active={showResults && results.length > 0} />
      {showResults && results.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto shadow-lg">
          <div className="p-2 space-y-1">
            {/* The outage has to be said here too, not only when the search
                comes back empty. Both of the multi-week outages this notice
                exists for were invisible precisely because a local factor
                matched: the user saw a normal list of results with the
                ecoinvent and Agribalyse entries quietly missing. */}
            {liveDbDegraded && <DegradedDatabasesNotice className="mb-2" />}

            {/* Summary header */}
            <div className="px-2 py-1.5 border-b flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                Found {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
              <div className="flex flex-wrap gap-1">
                {(sourceCounts?.primary ?? 0) > 0 && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#047857]">
                    {sourceCounts!.primary} Primary
                  </span>
                )}
                {(sourceCounts?.ecoinvent_live ?? 0) > 0 && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#047857]">
                    {sourceCounts!.ecoinvent_live} ecoInvent
                  </span>
                )}
                {(sourceCounts?.agribalyse_live ?? 0) > 0 && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#047857]">
                    {sourceCounts!.agribalyse_live} Agribalyse
                  </span>
                )}
                {(sourceCounts?.global_library ?? 0) > 0 && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#B45309]">
                    {sourceCounts!.global_library} Library
                  </span>
                )}
                {(sourceCounts?.staging ?? 0) > 0 && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {sourceCounts!.staging} Internal
                  </span>
                )}
              </div>
            </div>

            {/* Results list: one recommended Best match, a few alternatives,
                everything else behind "Show all" so non-experts confirm a
                suggestion instead of adjudicating a wall of candidates. */}
            {(showAllResults ? results : results.slice(0, 4)).map((result, resultIdx) => (
              <div
                key={`${result.source_type}-${result.id}`}
                className={resultIdx === 0 ? "rounded-md border border-primary/50 bg-primary/5 mb-1" : ""}
              >
              {resultIdx === 0 && (
                <div className="flex items-start justify-between gap-2 px-3 pt-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] h-5">Best match</Badge>
                  <span className="text-[11px] text-muted-foreground text-right flex-1">
                    {buildMatchReason(result)}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start text-left h-auto py-3 px-3 hover:bg-accent"
                onClick={() => handleResultSelect(result)}
              >
                <div className="flex items-start gap-3 w-full">
                  {getResultIcon(result)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {result.friendly_name || cleanFactorDisplayName(result.name)}
                      </span>
                      {getSourceBadge(result)}
                      {result.is_user_favourite && (
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                      )}
                      {(result.org_usage_count || 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-emerald-700 dark:text-emerald-400 border-emerald-400/50">
                          Used on {result.org_usage_count} of your products
                        </Badge>
                      )}
                      {!result.is_user_favourite && (result.global_selection_count || 0) >= 3 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-muted-foreground border-muted-foreground/30">
                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                          Popular
                        </Badge>
                      )}
                      <FactorInfoTrigger result={result} materialType={materialType} />
                    </div>
                    {result.friendly_name && (
                      <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5" title={result.name}>
                        {cleanFactorDisplayName(result.name)}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {result.unit ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          per {result.unit}
                        </Badge>
                      ) : (result.source_type === 'ecoinvent_live' || result.source_type === 'agribalyse_live') ? (
                        <span className="text-[10px] text-muted-foreground/70">
                          unit confirmed on selection
                        </span>
                      ) : null}
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
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#047857]">
                          {result.recycled_content_pct || result.metadata?.recycled_content_pct}% recycled
                        </span>
                      )}
                    </div>
                    {result.commodity_type && result.commodity_type !== 'none' && !result.deforestation_commitment_verified && (
                      <p className="text-[11px] text-[#B45309] mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        No deforestation commitment on record for this {result.commodity_type.replace('_', ' ')} ingredient
                      </p>
                    )}
                    {result.co2_factor && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${getIntensityDot(result.co2_factor)}`} />
                        <span>{result.co2_factor.toFixed(3)} kg CO₂e/{result.unit || 'kg'}</span>
                        <span className={`${getIntensityLabel(result.co2_factor).className}`}>
                          {getIntensityLabel(result.co2_factor).label}
                        </span>
                        {result.source_type === 'global_library' && (result.uncertainty_percent || result.metadata?.uncertainty_percent) && (
                          <span className="text-muted-foreground/70">
                            ±{result.uncertainty_percent || result.metadata?.uncertainty_percent}%
                          </span>
                        )}
                      </div>
                    )}
                    {/* Multi-impact indicators + data quality */}
                    {(() => {
                      const water = result.water_factor;
                      const landVal = result.land_factor;
                      const grade = result.data_quality_grade || result.metadata?.data_quality_grade;
                      const geo = result.metadata?.geographic_scope;
                      const temporal = result.metadata?.temporal_coverage;
                      const showGrade = grade && (result.source_type === 'global_library' || result.source_type === 'ecoinvent_proxy');
                      const hasAny = (water != null && water > 0) || (landVal != null && landVal > 0) || showGrade || geo || temporal;

                      if (!hasAny) return null;

                      return (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground/60">
                          {water != null && water > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[#2B46C0]">
                              <Droplets className="h-2.5 w-2.5" />
                              {water.toFixed(1)}
                            </span>
                          )}
                          {landVal != null && landVal > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[#047857]">
                              <TreePine className="h-2.5 w-2.5" />
                              {landVal.toFixed(1)}
                            </span>
                          )}
                          {showGrade && (
                            <span className="inline-flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                grade === 'HIGH' ? 'bg-[#047857]' :
                                grade === 'MEDIUM' ? 'bg-[#B45309]' :
                                'bg-[#BE123C]'
                              }`} />
                              {grade === 'HIGH' ? 'High' : grade === 'MEDIUM' ? 'Med' : 'Low'}
                            </span>
                          )}
                          {geo && (
                            <span>{geo}</span>
                          )}
                          {temporal && (
                            <span>{temporal}</span>
                          )}
                        </div>
                      );
                    })()}
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
              </div>
            ))}

            {results.length > 4 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowAllResults((v) => !v)}
              >
                {showAllResults ? 'Show fewer' : `Show all ${results.length} matches`}
              </Button>
            )}

            {/* AI Proxy Suggestion at bottom of results */}
            <ProxySuggestionPanel
              query={query}
              proxySuggestions={proxySuggestions}
              loadingProxy={loadingProxy}
              proxySearching={proxySearching}
              proxyAllFailed={proxyAllFailed}
              onFetchProxy={() => fetchProxySuggestions(query)}
              onUseProxy={handleUseProxy}
            />
          </div>
        </Card>
      )}

      {showResults && results.length === 0 && !isSearching && query.length >= 2 && (
        <Card className="absolute z-50 mt-1 w-full shadow-lg">
          <div className="p-4 text-sm text-muted-foreground">
            <p className="text-center">No results found for &quot;{query}&quot;</p>

            {liveDbDegraded && <DegradedDatabasesNotice className="mt-3" />}

            {/* Brand name suggestion in zero-results */}
            {(() => {
              const zeroResultBrand = findBrandNameMatch(query);
              if (zeroResultBrand) {
                return (
                  <div className="mt-3 rounded-[6px] border border-border bg-card px-3 py-2 text-xs">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 text-[#2B46C0] mt-0.5 shrink-0" />
                      <div>
                        <p>
                          Did you mean <span className="font-medium text-foreground">&quot;{zeroResultBrand.genericTerm}&quot;</span>?
                          {' '}{zeroResultBrand.explanation}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] mt-1.5 border-border hover:bg-secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleInputChange(zeroResultBrand.genericTerm);
                          }}
                        >
                          <Search className="h-2.5 w-2.5 mr-1" />
                          Search &quot;{zeroResultBrand.genericTerm}&quot;
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {!openLCAEnabled && (
              <div className="mt-2 text-xs text-amber-600 text-center">
                OpenLCA is not connected. Configure it in Settings to search ecoInvent.
              </div>
            )}
          </div>
          <ProxySuggestionPanel
            query={query}
            proxySuggestions={proxySuggestions}
            loadingProxy={loadingProxy}
            proxySearching={proxySearching}
            proxyAllFailed={proxyAllFailed}
            onFetchProxy={() => fetchProxySuggestions(query)}
            onUseProxy={handleUseProxy}
            autoFetch={query.length >= 3}
          />
        </Card>
      )}
    </div>
  );
}

// ── Carbon Intensity Labels ───────────────────────────────────────────

function getIntensityLabel(co2Factor: number): { label: string; className: string } {
  if (co2Factor < 0.5) return { label: 'Low impact', className: 'text-[#047857]' };
  if (co2Factor <= 2.0) return { label: 'Moderate impact', className: 'text-[#B45309]' };
  if (co2Factor <= 5.0) return { label: 'High impact', className: 'text-[#B45309]' };
  return { label: 'Very high, verify match', className: 'text-[#BE123C]' };
}

function getIntensityDot(co2Factor: number): string {
  if (co2Factor < 0.5) return 'bg-[#047857]';
  if (co2Factor <= 2.0) return 'bg-[#B45309]';
  if (co2Factor <= 5.0) return 'bg-[#B45309]';
  return 'bg-[#BE123C]';
}

// ── AI Proxy Suggestion Panel ─────────────────────────────────────────

function confidenceBadgeColor(note: 'high' | 'medium' | 'low'): string {
  if (note === 'high') return 'text-[#047857]';
  if (note === 'medium') return 'text-[#B45309]';
  return 'text-[#BE123C]';
}

function ProxySuggestionPanel({
  query,
  proxySuggestions,
  loadingProxy,
  proxySearching,
  proxyAllFailed,
  onFetchProxy,
  onUseProxy,
  autoFetch = false,
}: {
  query: string;
  proxySuggestions: ProxySuggestion[];
  loadingProxy: boolean;
  proxySearching: string | null;
  proxyAllFailed: boolean;
  onFetchProxy: () => void;
  onUseProxy: (suggestion: ProxySuggestion) => void;
  autoFetch?: boolean;
}) {
  // Auto-fetch proxy suggestions when zero results and autoFetch is true
  const autoFetchedRef = useRef(false);
  useEffect(() => {
    if (autoFetch && !autoFetchedRef.current && !loadingProxy && proxySuggestions.length === 0 && !proxyAllFailed && query.length >= 3) {
      autoFetchedRef.current = true;
      onFetchProxy();
    }
    // Reset when query changes
    if (!autoFetch) {
      autoFetchedRef.current = false;
    }
  }, [autoFetch, query, loadingProxy, proxySuggestions.length, proxyAllFailed, onFetchProxy]);
  return (
    <div className="border-t px-2 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs gap-1.5 h-7"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFetchProxy();
        }}
        disabled={loadingProxy || query.length < 2}
      >
        {loadingProxy ? (
          <>
            <Loader2 className="h-3 w-3" />
            Finding proxy suggestions...
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            AI Proxy Suggestion
          </>
        )}
      </Button>

      {proxyAllFailed && proxySuggestions.length === 0 && (
        <div className="mt-1.5 rounded-[6px] border border-border bg-card px-2.5 py-2 text-xs">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-[#B45309] mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">
                No matching materials found
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                AI suggestions could not be matched to entries in our emission factor databases. Try searching with different terms or a broader category name.
              </p>
            </div>
          </div>
        </div>
      )}

      {proxySuggestions.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium px-1">
            Suggested proxies for &quot;{query}&quot;:
          </p>
          {proxySuggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="rounded-md border bg-background px-2.5 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{suggestion.proxy_name}</span>
                <span
                  className={`font-mono text-[9px] font-bold uppercase tracking-[0.14em] flex-shrink-0 ${confidenceBadgeColor(suggestion.confidence_note)}`}
                >
                  {suggestion.confidence_note}
                </span>
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUseProxy(suggestion);
                }}
                disabled={proxySearching === suggestion.search_query}
              >
                {proxySearching === suggestion.search_query ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 mr-1" />
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
  );
}
