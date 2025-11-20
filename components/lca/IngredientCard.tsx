"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IngredientCardData, DataSource, OpenLCAProcess, SupplierProduct, LcaSubStage } from "@/lib/types/lca";

interface IngredientCardProps {
  ingredient: IngredientCardData;
  index: number;
  subStages: LcaSubStage[];
  organizationId: string;
  onUpdate: (index: number, field: keyof IngredientCardData, value: any) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "L", label: "Litres (L)" },
  { value: "mL", label: "Millilitres (mL)" },
  { value: "kWh", label: "Kilowatt-hours (kWh)" },
  { value: "m", label: "Metres (m)" },
  { value: "m2", label: "Square metres (m²)" },
  { value: "m3", label: "Cubic metres (m³)" },
  { value: "unit", label: "Units" },
];

export function IngredientCard({
  ingredient,
  index,
  subStages,
  organizationId,
  onUpdate,
  onRemove,
  disabled = false,
}: IngredientCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OpenLCAProcess[] | SupplierProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleDataSourceToggle = useCallback((checked: boolean) => {
    const newSource: DataSource = checked ? "supplier" : "openlca";
    onUpdate(index, "data_source", newSource);
    onUpdate(index, "name", "");
    onUpdate(index, "data_source_id", undefined);
    onUpdate(index, "supplier_product_id", undefined);
    setSearchQuery("");
    setSearchResults([]);
  }, [index, onUpdate]);

  const searchIngredients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Get session token from browser
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/browser-client');
      const supabase = getSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('[IngredientCard] Search session check:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        sessionError,
      });

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        console.error('[IngredientCard] No access token available for search');
      }

      if (ingredient.data_source === "openlca") {
        console.log('[IngredientCard] Searching OpenLCA for:', query);
        const response = await fetch(`/api/ingredients/search?q=${encodeURIComponent(query)}`, { headers });
        console.log('[IngredientCard] OpenLCA search response:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[IngredientCard] OpenLCA results:', data.results?.length || 0);
          setSearchResults(data.results || []);
        } else {
          const errorText = await response.text();
          console.error('[IngredientCard] OpenLCA search failed:', response.status, errorText);
        }
      } else {
        console.log('[IngredientCard] Searching supplier products for:', query);
        const response = await fetch(
          `/api/supplier-products/search?q=${encodeURIComponent(query)}&organization_id=${organizationId}`,
          { headers }
        );
        console.log('[IngredientCard] Supplier search response:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[IngredientCard] Supplier results:', data.results?.length || 0);
          setSearchResults(data.results || []);
        } else {
          const errorText = await response.text();
          console.error('[IngredientCard] Supplier products search failed:', response.status, errorText);
        }
      }
    } catch (error) {
      console.error("[IngredientCard] Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [ingredient.data_source, organizationId]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        searchIngredients(searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchIngredients]);

  const handleSelectItem = useCallback((item: OpenLCAProcess | SupplierProduct) => {
    console.log('[IngredientCard] Item selected:', {
      dataSource: ingredient.data_source,
      item,
    });

    if (ingredient.data_source === "openlca") {
      const openLCAItem = item as OpenLCAProcess;
      console.log('[IngredientCard] Setting OpenLCA item:', {
        name: openLCAItem.name,
        id: openLCAItem.id,
        unit: openLCAItem.unit,
      });
      onUpdate(index, "name", openLCAItem.name);
      onUpdate(index, "data_source_id", openLCAItem.id);
      if (openLCAItem.unit) {
        onUpdate(index, "unit", openLCAItem.unit);
      }
    } else {
      const supplierItem = item as SupplierProduct;
      console.log('[IngredientCard] Setting supplier item:', {
        name: supplierItem.name,
        id: supplierItem.id,
        unit: supplierItem.unit,
      });
      onUpdate(index, "name", supplierItem.name);
      onUpdate(index, "supplier_product_id", supplierItem.id);
      onUpdate(index, "unit", supplierItem.unit);
    }
    setSearchOpen(false);
    setSearchQuery("");
  }, [ingredient.data_source, index, onUpdate]);

  const hasError = !ingredient.name || !ingredient.quantity || !ingredient.unit || !ingredient.lca_sub_stage_id;

  return (
    <Card className={cn("relative", hasError && "border-destructive")}>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label htmlFor={`data-source-${index}`} className="text-sm font-medium">
                  Data Source
                </Label>
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm", !ingredient.data_source || ingredient.data_source === "openlca" ? "font-medium" : "text-muted-foreground")}>
                    OpenLCA Database
                  </span>
                  <Switch
                    id={`data-source-${index}`}
                    checked={ingredient.data_source === "supplier"}
                    onCheckedChange={handleDataSourceToggle}
                    disabled={disabled}
                  />
                  <span className={cn("text-sm", ingredient.data_source === "supplier" ? "font-medium" : "text-muted-foreground")}>
                    Supplier Network
                  </span>
                </div>
              </div>
              <Badge variant={ingredient.data_source === "supplier" ? "default" : "secondary"}>
                {ingredient.data_source === "supplier" ? "Primary Data" : "Secondary Data"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`search-${index}`}>
                Search {ingredient.data_source === "supplier" ? "Supplier Products" : "Materials"} *
              </Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="w-full justify-between"
                    disabled={disabled}
                  >
                    {ingredient.name || "Search and select..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={`Search ${ingredient.data_source === "supplier" ? "supplier products" : "materials"}...`}
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      {isSearching ? (
                        <div className="py-6 text-center text-sm">Searching...</div>
                      ) : searchResults.length === 0 ? (
                        <CommandEmpty>
                          {searchQuery.length < 2
                            ? "Type at least 2 characters to search"
                            : "No results found"}
                        </CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {searchResults.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={item.id}
                              onSelect={() => handleSelectItem(item)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{item.name}</span>
                                {"supplier_name" in item && (
                                  <span className="text-xs text-muted-foreground">
                                    {item.supplier_name} {item.category && `• ${item.category}`}
                                  </span>
                                )}
                                {"category" in item && !("supplier_name" in item) && (
                                  <span className="text-xs text-muted-foreground">{item.category}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`quantity-${index}`}>Quantity *</Label>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={ingredient.quantity}
                  onChange={(e) => onUpdate(index, "quantity", e.target.value)}
                  placeholder="0.00"
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`unit-${index}`}>Unit *</Label>
                <Select
                  value={ingredient.unit}
                  onValueChange={(value) => onUpdate(index, "unit", value)}
                  disabled={disabled}
                >
                  <SelectTrigger id={`unit-${index}`}>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`origin-${index}`}>Origin Country</Label>
              <Input
                id={`origin-${index}`}
                type="text"
                value={ingredient.origin_country}
                onChange={(e) => onUpdate(index, "origin_country", e.target.value)}
                placeholder="e.g., United Kingdom, France..."
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`sub-stage-${index}`}>Life Cycle Sub-Stage *</Label>
              <Select
                value={ingredient.lca_sub_stage_id ? String(ingredient.lca_sub_stage_id) : ""}
                onValueChange={(value) => onUpdate(index, "lca_sub_stage_id", Number(value))}
                disabled={disabled}
              >
                <SelectTrigger id={`sub-stage-${index}`}>
                  <SelectValue placeholder="Select sub-stage" />
                </SelectTrigger>
                <SelectContent>
                  {subStages.map((subStage) => (
                    <SelectItem key={subStage.id} value={String(subStage.id)}>
                      {subStage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id={`organic-${index}`}
                checked={ingredient.is_organic_certified}
                onCheckedChange={(checked) => onUpdate(index, "is_organic_certified", checked === true)}
                disabled={disabled}
              />
              <Label htmlFor={`organic-${index}`} className="text-sm font-normal cursor-pointer">
                Organic certified
              </Label>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
