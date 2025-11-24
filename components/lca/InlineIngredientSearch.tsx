"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Database, Building2, Sprout, Search, Loader2 } from "lucide-react";
import type { OpenLCAProcess, SupplierProduct, DataSource } from "@/lib/types/lca";

interface SearchResults {
  supplier: SupplierProduct[];
  database: OpenLCAProcess[];
}

interface IngredientSelection {
  name: string;
  data_source: DataSource;
  data_source_id?: string;
  supplier_product_id?: string;
  supplier_name?: string;
  unit: string;
  carbon_intensity?: number;
  location?: string;
}

interface InlineIngredientSearchProps {
  organizationId: string;
  placeholder?: string;
  onSelect: (ingredient: IngredientSelection) => void;
  disabled?: boolean;
  value?: string;
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export function InlineIngredientSearch({
  organizationId,
  placeholder = "Search for ingredients...",
  onSelect,
  disabled = false,
  value = "",
}: InlineIngredientSearchProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [searchResults, setSearchResults] = useState<SearchResults>({
    supplier: [],
    database: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults({ supplier: [], database: [] });
        return;
      }

      setIsSearching(true);
      try {
        const { getSupabaseBrowserClient } = await import('@/lib/supabase/browser-client');
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          console.error('[InlineIngredientSearch] No session token available');
          return;
        }

        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        };

        const [supplierResponse, databaseResponse] = await Promise.all([
          fetch(
            `/api/supplier-products/search?q=${encodeURIComponent(query)}&organization_id=${organizationId}`,
            { headers }
          ),
          fetch(
            `/api/ingredients/search?q=${encodeURIComponent(query)}`,
            { headers }
          ),
        ]);

        const supplierData = await supplierResponse.json();
        const databaseData = await databaseResponse.json();

        setSearchResults({
          supplier: supplierData.results || [],
          database: databaseData.results || [],
        });
      } catch (error) {
        console.error('[InlineIngredientSearch] Search error:', error);
        setSearchResults({ supplier: [], database: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [organizationId]
  );

  useEffect(() => {
    if (searchQuery.length >= 2) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults({ supplier: [], database: [] });
    }
  }, [searchQuery, debouncedSearch]);

  const handleSupplierClick = (supplier: SupplierProduct) => {
    onSelect({
      name: supplier.name,
      data_source: 'supplier',
      supplier_product_id: supplier.id,
      supplier_name: supplier.supplier_name || 'Unknown Supplier',
      unit: supplier.unit,
      carbon_intensity: supplier.carbon_intensity || undefined,
    });
    setSearchQuery(supplier.name);
    setSearchOpen(false);
  };

  const handleDatabaseClick = (process: OpenLCAProcess) => {
    onSelect({
      name: process.name,
      data_source: 'openlca',
      data_source_id: process.id,
      unit: process.unit || 'kg',
      location: process.location,
    });
    setSearchQuery(process.name);
    setSearchOpen(false);
  };

  const handlePrimaryClick = () => {
    onSelect({
      name: searchQuery,
      data_source: 'primary',
      unit: 'kg',
    });
    setSearchOpen(false);
  };

  const hasResults = searchResults.supplier.length > 0 || searchResults.database.length > 0;

  return (
    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setSearchOpen(true);
              } else {
                setSearchOpen(false);
              }
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                setSearchOpen(true);
              }
            }}
            disabled={disabled}
            className="pl-10"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[600px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            {isSearching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Searching...
              </div>
            ) : !hasResults && searchQuery.length >= 2 ? (
              <CommandEmpty>No matches found. You can add as primary data below.</CommandEmpty>
            ) : null}

            {searchResults.supplier.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2 bg-blue-50 dark:bg-blue-950">
                  <Building2 className="h-3 w-3 text-blue-600" />
                  My Supplier Network ({searchResults.supplier.length})
                </div>
                <CommandGroup>
                  {searchResults.supplier.map((supplier) => (
                    <CommandItem
                      key={supplier.id}
                      onSelect={() => handleSupplierClick(supplier)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <div className="flex-1">
                          <div className="font-medium">{supplier.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {supplier.supplier_name}
                            {supplier.carbon_intensity && (
                              <span className="ml-2">
                                • {supplier.carbon_intensity.toFixed(2)} kg CO2e/{supplier.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs">
                          Primary Data
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {searchResults.database.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2 bg-grey-50 dark:bg-grey-950">
                  <Database className="h-3 w-3 text-grey-600" />
                  Global Database ({searchResults.database.length})
                </div>
                <CommandGroup>
                  {searchResults.database.slice(0, 5).map((process) => (
                    <CommandItem
                      key={process.id}
                      onSelect={() => handleDatabaseClick(process)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Database className="h-4 w-4 text-grey-600" />
                        <div className="flex-1">
                          <div className="font-medium">{process.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {process.category}
                            {process.unit && ` • ${process.unit}`}
                            {process.location && ` • ${process.location}`}
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 text-xs">
                          Secondary Data
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                  {searchResults.database.length > 5 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                      + {searchResults.database.length - 5} more results
                    </div>
                  )}
                </CommandGroup>
              </>
            )}

            {searchQuery.length >= 2 && (
              <CommandItem onSelect={handlePrimaryClick} className="cursor-pointer border-t">
                <div className="flex items-center gap-3 flex-1">
                  <Sprout className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <div className="font-medium">
                      Add "{searchQuery}" as new primary data
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Enter your own data for this ingredient
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs">
                    Primary
                  </Badge>
                </div>
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
