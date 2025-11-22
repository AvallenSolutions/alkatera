"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Database, Building2, Sprout, Search, Info, Loader2 } from "lucide-react";
import { IngredientConfirmationPopover } from "./IngredientConfirmationPopover";
import { PrimaryIngredientForm } from "./PrimaryIngredientForm";
import type { OpenLCAProcess, SupplierProduct, LcaSubStage } from "@/lib/types/lca";

interface SearchResults {
  supplier: SupplierProduct[];
  database: OpenLCAProcess[];
}

interface AssistedIngredientSearchProps {
  lcaId: string;
  organizationId: string;
  subStages: LcaSubStage[];
  onIngredientConfirmed: (ingredient: {
    name: string;
    data_source: 'openlca' | 'supplier' | 'primary';
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit?: string;
    carbon_intensity?: number;
    quantity?: number;
    lca_sub_stage_id?: number;
    origin_country?: string;
    is_organic_certified?: boolean;
  }) => void;
  disabled?: boolean;
}

export function AssistedIngredientSearch({
  lcaId,
  organizationId,
  subStages,
  onIngredientConfirmed,
  disabled = false,
}: AssistedIngredientSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({
    supplier: [],
    database: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [primaryFormOpen, setPrimaryFormOpen] = useState(false);
  const [primaryFormName, setPrimaryFormName] = useState("");

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
          console.error('[AssistedIngredientSearch] No session token available');
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
        console.error('[AssistedIngredientSearch] Search error:', error);
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
    setConfirmationData({
      ingredientName: supplier.name,
      dataSource: 'supplier',
      supplierName: supplier.supplier_name || 'Unknown Supplier',
      carbonIntensity: supplier.carbon_intensity,
      unit: supplier.unit,
      supplier_product_id: supplier.id,
    });
    setConfirmationOpen(true);
    setSearchOpen(false);
  };

  const handleDatabaseClick = (process: OpenLCAProcess) => {
    setConfirmationData({
      ingredientName: process.name,
      dataSource: 'openlca',
      data_source_id: process.id,
      unit: process.unit || 'kg',
      location: process.location,
      processType: process.processType,
    });
    setConfirmationOpen(true);
    setSearchOpen(false);
  };

  const handlePrimaryClick = () => {
    setPrimaryFormName(searchQuery);
    setPrimaryFormOpen(true);
    setSearchOpen(false);
  };

  const handleConfirmSelection = () => {
    if (!confirmationData) return;

    if (confirmationData.dataSource === 'supplier') {
      onIngredientConfirmed({
        name: confirmationData.ingredientName,
        data_source: 'supplier',
        supplier_product_id: confirmationData.supplier_product_id,
        supplier_name: confirmationData.supplierName,
        unit: confirmationData.unit,
        carbon_intensity: confirmationData.carbonIntensity,
      });
    } else {
      onIngredientConfirmed({
        name: confirmationData.ingredientName,
        data_source: 'openlca',
        data_source_id: confirmationData.data_source_id,
        unit: confirmationData.unit || 'kg',
      });
    }

    setSearchQuery("");
    setSearchResults({ supplier: [], database: [] });
    setConfirmationData(null);
    setConfirmationOpen(false);
  };

  const handlePrimarySave = async (data: {
    name: string;
    quantity: number;
    unit: string;
    lca_sub_stage_id: number;
    origin_country: string;
    is_organic_certified: boolean;
    notes?: string;
  }) => {
    onIngredientConfirmed({
      name: data.name,
      data_source: 'primary',
      quantity: data.quantity,
      unit: data.unit,
      lca_sub_stage_id: data.lca_sub_stage_id,
      origin_country: data.origin_country,
      is_organic_certified: data.is_organic_certified,
    });

    setSearchQuery("");
    setSearchResults({ supplier: [], database: [] });
  };

  const hasResults = searchResults.supplier.length > 0 || searchResults.database.length > 0;

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Assisted Choice:</strong> Search for ingredients from your suppliers or the
          generic database. We'll help you make informed decisions about data sources.
        </AlertDescription>
      </Alert>

      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Add an ingredient..."
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
        <PopoverContent className="w-[500px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-blue-600" />
                    From Your Suppliers ({searchResults.supplier.length})
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
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 text-xs">
                            Supplier
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <Separator />
                </>
              )}

              {searchResults.database.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <Database className="h-3 w-3 text-grey-600" />
                    From OpenLCA Database ({searchResults.database.length})
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
                          <Badge className="bg-grey-100 text-grey-800 dark:bg-grey-800 dark:text-grey-100 text-xs">
                            OpenLCA
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
                  <Separator />
                </>
              )}

              {searchQuery.length >= 2 && (
                <CommandItem onSelect={handlePrimaryClick} className="cursor-pointer">
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

      {confirmationData && (
        <IngredientConfirmationPopover
          data={confirmationData}
          open={confirmationOpen}
          onOpenChange={setConfirmationOpen}
          onConfirm={handleConfirmSelection}
          onCancel={() => {
            setConfirmationData(null);
            setConfirmationOpen(false);
          }}
        >
          <div />
        </IngredientConfirmationPopover>
      )}

      <PrimaryIngredientForm
        open={primaryFormOpen}
        onOpenChange={setPrimaryFormOpen}
        initialName={primaryFormName}
        subStages={subStages}
        onSave={handlePrimarySave}
      />
    </div>
  );
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
