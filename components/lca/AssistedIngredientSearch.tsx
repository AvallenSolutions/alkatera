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
import { IngredientQuantityDialog } from "./IngredientQuantityDialog";
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
    lca_sub_stage_id?: string | null;
    origin_country?: string;
    is_organic_certified?: boolean;
    impact_climate?: number;
    impact_water?: number;
    impact_land?: number;
    impact_waste?: number;
  }) => void;
  disabled?: boolean;
}

/**
 * Normalize quantity to kilograms for calculation
 * All emission factors in the database are per kg
 */
function normalizeQuantityToKg(quantity: number, unit: string): number {
  const lowerUnit = unit.toLowerCase();

  if (lowerUnit === 'g' || lowerUnit === 'grams') {
    return quantity / 1000;
  }

  if (lowerUnit === 'ml' || lowerUnit === 'millilitres' || lowerUnit === 'milliliters') {
    return quantity / 1000;
  }

  if (lowerUnit === 'l' || lowerUnit === 'litres' || lowerUnit === 'liters') {
    return quantity;
  }

  return quantity;
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
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);

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
    setSelectedIngredient({
      name: supplier.name,
      data_source: 'supplier',
      supplier_name: supplier.supplier_name || 'Unknown Supplier',
      carbon_intensity: supplier.carbon_intensity,
      unit: supplier.unit,
      supplier_product_id: supplier.id,
    });
    setQuantityDialogOpen(true);
    setSearchOpen(false);
  };

  const handleDatabaseClick = (process: OpenLCAProcess) => {
    setSelectedIngredient({
      name: process.name,
      data_source: 'openlca',
      data_source_id: process.id,
      unit: process.unit || 'kg',
      location: process.location,
      processType: process.processType,
      impact_climate: process.co2_factor,
      impact_water: process.water_factor,
      impact_land: process.land_factor,
      impact_waste: process.waste_factor,
    });
    setQuantityDialogOpen(true);
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
    lca_sub_stage_id: string | null;
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

  const handleQuantityConfirm = (data: {
    quantity: number;
    unit: string;
    lca_sub_stage_id: string | null;
  }) => {
    if (!selectedIngredient) return;

    // CRITICAL FIX: Calculate total impact based on data source
    let calculatedImpactClimate: number | undefined;
    let calculatedImpactWater: number | undefined;
    let calculatedImpactLand: number | undefined;
    let calculatedImpactWaste: number | undefined;

    // Normalize quantity to kg for calculations
    const quantityInKg = normalizeQuantityToKg(data.quantity, data.unit);

    if (selectedIngredient.data_source === 'supplier' && selectedIngredient.carbon_intensity) {
      // Supplier data: carbon_intensity is per-kg, multiply by quantity
      calculatedImpactClimate = selectedIngredient.carbon_intensity * quantityInKg;

      console.log('[AssistedIngredientSearch] Supplier data calculation:', {
        name: selectedIngredient.name,
        inputQuantity: data.quantity,
        inputUnit: data.unit,
        normalizedQuantityKg: quantityInKg,
        carbonIntensityPerKg: selectedIngredient.carbon_intensity,
        calculatedTotalImpact: calculatedImpactClimate,
      });
    } else if (selectedIngredient.data_source === 'openlca') {
      // OpenLCA data: impacts are already calculated per unit, multiply by quantity
      calculatedImpactClimate = selectedIngredient.impact_climate
        ? selectedIngredient.impact_climate * quantityInKg
        : undefined;
      calculatedImpactWater = selectedIngredient.impact_water
        ? selectedIngredient.impact_water * quantityInKg
        : undefined;
      calculatedImpactLand = selectedIngredient.impact_land
        ? selectedIngredient.impact_land * quantityInKg
        : undefined;
      calculatedImpactWaste = selectedIngredient.impact_waste
        ? selectedIngredient.impact_waste * quantityInKg
        : undefined;

      console.log('[AssistedIngredientSearch] OpenLCA data calculation:', {
        name: selectedIngredient.name,
        inputQuantity: data.quantity,
        inputUnit: data.unit,
        normalizedQuantityKg: quantityInKg,
        impactFactors: {
          climate: selectedIngredient.impact_climate,
          water: selectedIngredient.impact_water,
          land: selectedIngredient.impact_land,
          waste: selectedIngredient.impact_waste,
        },
        calculatedImpacts: {
          climate: calculatedImpactClimate,
          water: calculatedImpactWater,
          land: calculatedImpactLand,
          waste: calculatedImpactWaste,
        },
      });
    }

    onIngredientConfirmed({
      name: selectedIngredient.name,
      data_source: selectedIngredient.data_source,
      data_source_id: selectedIngredient.data_source_id,
      supplier_product_id: selectedIngredient.supplier_product_id,
      supplier_name: selectedIngredient.supplier_name,
      unit: data.unit,
      quantity: data.quantity,
      lca_sub_stage_id: data.lca_sub_stage_id,
      origin_country: '',
      is_organic_certified: false,
      impact_climate: calculatedImpactClimate,
      impact_water: calculatedImpactWater,
      impact_land: calculatedImpactLand,
      impact_waste: calculatedImpactWaste,
    });

    setSelectedIngredient(null);
    setQuantityDialogOpen(false);
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

      <IngredientQuantityDialog
        open={quantityDialogOpen}
        onOpenChange={setQuantityDialogOpen}
        ingredientName={selectedIngredient?.name || ""}
        defaultUnit={selectedIngredient?.unit || "kg"}
        subStages={subStages}
        onConfirm={handleQuantityConfirm}
        onCancel={() => {
          setSelectedIngredient(null);
          setQuantityDialogOpen(false);
        }}
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
