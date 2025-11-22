"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  PopoverTrigger,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Database, Building2, Sprout, Search, Info, Loader2, Package, Tag, Grip, Box } from "lucide-react";
import { IngredientQuantityDialog } from "./IngredientQuantityDialog";
import type { OpenLCAProcess, SupplierProduct, LcaSubStage, PackagingCategory } from "@/lib/types/lca";

interface SearchResults {
  supplier: SupplierProduct[];
  database: OpenLCAProcess[];
}

interface AssistedPackagingSearchProps {
  lcaId: string;
  organizationId: string;
  subStages: LcaSubStage[];
  onPackagingConfirmed: (packaging: {
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
    packaging_category: PackagingCategory;
    label_printing_type?: string;
  }) => void;
  disabled?: boolean;
}

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

const PACKAGING_CATEGORIES = [
  { value: 'container', label: 'Container', icon: Package, description: 'Bottles, cans, packs' },
  { value: 'label', label: 'Label', icon: Tag, description: 'Labels and printing' },
  { value: 'closure', label: 'Closure', icon: Grip, description: 'Caps, corks, seals' },
  { value: 'secondary', label: 'Secondary', icon: Box, description: 'Gift packs, delivery boxes' },
] as const;

export function AssistedPackagingSearch({
  lcaId,
  organizationId,
  subStages,
  onPackagingConfirmed,
  disabled = false,
}: AssistedPackagingSearchProps) {
  const [selectedCategory, setSelectedCategory] = useState<PackagingCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({
    supplier: [],
    database: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [selectedPackaging, setSelectedPackaging] = useState<any>(null);
  const [labelPrintingType, setLabelPrintingType] = useState<string>("");

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2 || !selectedCategory) {
        setSearchResults({ supplier: [], database: [] });
        return;
      }

      setIsSearching(true);
      try {
        const { getSupabaseBrowserClient } = await import('@/lib/supabase/browser-client');
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          console.error('[AssistedPackagingSearch] No session token available');
          return;
        }

        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        };

        const [supplierResponse, databaseResponse] = await Promise.all([
          fetch(
            `/api/supplier-products/search?q=${encodeURIComponent(query)}&organization_id=${organizationId}&material_type=packaging`,
            { headers }
          ),
          fetch(
            `/api/ingredients/search?q=${encodeURIComponent(query)}&material_type=packaging&category=${selectedCategory}`,
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
        console.error('[AssistedPackagingSearch] Search error:', error);
        setSearchResults({ supplier: [], database: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [organizationId, selectedCategory]
  );

  useEffect(() => {
    if (searchQuery.length >= 2 && selectedCategory) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults({ supplier: [], database: [] });
    }
  }, [searchQuery, debouncedSearch, selectedCategory]);

  const handleSupplierClick = (supplier: SupplierProduct) => {
    setSelectedPackaging({
      name: supplier.name,
      data_source: 'supplier',
      supplier_name: supplier.supplier_name || 'Unknown Supplier',
      carbon_intensity: supplier.carbon_intensity,
      unit: supplier.unit,
      supplier_product_id: supplier.id,
      packaging_category: selectedCategory,
    });
    setQuantityDialogOpen(true);
    setSearchOpen(false);
  };

  const handleDatabaseClick = (process: OpenLCAProcess) => {
    setSelectedPackaging({
      name: process.name,
      data_source: 'openlca',
      data_source_id: process.id,
      unit: process.unit || 'kg',
      location: process.location,
      processType: process.processType,
      packaging_category: selectedCategory,
    });
    setQuantityDialogOpen(true);
    setSearchOpen(false);
  };

  const handleQuantityConfirm = (data: {
    quantity: number;
    unit: string;
    lca_sub_stage_id: string | null;
  }) => {
    if (!selectedPackaging || !selectedCategory) return;

    onPackagingConfirmed({
      name: selectedPackaging.name,
      data_source: selectedPackaging.data_source,
      data_source_id: selectedPackaging.data_source_id,
      supplier_product_id: selectedPackaging.supplier_product_id,
      supplier_name: selectedPackaging.supplier_name,
      unit: data.unit,
      carbon_intensity: selectedPackaging.carbon_intensity,
      quantity: data.quantity,
      lca_sub_stage_id: data.lca_sub_stage_id,
      origin_country: '',
      is_organic_certified: false,
      packaging_category: selectedCategory,
      label_printing_type: selectedCategory === 'label' ? labelPrintingType : undefined,
    });

    setSelectedPackaging(null);
    setQuantityDialogOpen(false);
    setSearchQuery("");
    setSearchResults({ supplier: [], database: [] });
    setLabelPrintingType("");
  };

  const getCategoryIcon = (category: string) => {
    const cat = PACKAGING_CATEGORIES.find(c => c.value === category);
    return cat?.icon || Package;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      container: 'blue',
      label: 'yellow',
      closure: 'green',
      secondary: 'purple',
    };
    return colors[category as keyof typeof colors] || 'grey';
  };

  const hasResults = searchResults.supplier.length > 0 || searchResults.database.length > 0;

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Select Category First:</strong> Choose the packaging type, then search from your suppliers or the generic database.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Packaging Category *</label>
          <Select
            value={selectedCategory || undefined}
            onValueChange={(value) => setSelectedCategory(value as PackagingCategory)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select packaging category..." />
            </SelectTrigger>
            <SelectContent>
              {PACKAGING_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{cat.label}</div>
                        <div className="text-xs text-muted-foreground">{cat.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedCategory && (
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverAnchor asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={`Search for ${selectedCategory} materials...`}
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
                    <CommandEmpty>No matches found.</CommandEmpty>
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
                                </div>
                              </div>
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
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
                                </div>
                              </div>
                              <Badge className="bg-grey-100 text-grey-800 text-xs">
                                OpenLCA
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {selectedCategory === 'label' && searchQuery && (
          <div>
            <label className="text-sm font-medium mb-2 block">Printing Type (Optional)</label>
            <Select
              value={labelPrintingType}
              onValueChange={setLabelPrintingType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select printing type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="digital">Digital</SelectItem>
                <SelectItem value="offset">Offset</SelectItem>
                <SelectItem value="flexographic">Flexographic</SelectItem>
                <SelectItem value="gravure">Gravure</SelectItem>
                <SelectItem value="screen">Screen</SelectItem>
                <SelectItem value="letterpress">Letterpress</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <IngredientQuantityDialog
        open={quantityDialogOpen}
        onOpenChange={(open) => {
          setQuantityDialogOpen(open);
          if (!open) {
            setSelectedPackaging(null);
          }
        }}
        onConfirm={handleQuantityConfirm}
        onCancel={() => {
          setQuantityDialogOpen(false);
          setSelectedPackaging(null);
        }}
        ingredientName={selectedPackaging?.name || ''}
        defaultUnit={selectedPackaging?.unit || 'kg'}
        subStages={subStages}
      />
    </div>
  );
}
