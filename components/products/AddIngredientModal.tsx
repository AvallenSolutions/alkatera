"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Search, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddIngredientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  onSuccess: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  category: string;
  source: "supplier" | "database";
  supplierName?: string;
  defaultUnit?: string;
}

export function AddIngredientModal({
  open,
  onOpenChange,
  productId,
  onSuccess,
}: AddIngredientModalProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    itemName: "",
    quantity: "",
    unit: "",
    transportMode: "truck",
    transportDistance: "",
    dataSource: "estimated",
  });

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (selectedItem) {
      setFormData({
        ...formData,
        itemName: selectedItem.name,
        unit: selectedItem.defaultUnit || "",
        dataSource: selectedItem.source === "supplier" ? "primary" : "generic",
      });
    }
  }, [selectedItem]);

  const resetForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedItem(null);
    setFormData({
      itemName: "",
      quantity: "",
      unit: "",
      transportMode: "truck",
      transportDistance: "",
      dataSource: "estimated",
    });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const mockSupplierResults: SearchResult[] = [
        {
          id: "sup-1",
          name: "Organic Malt Extract",
          category: "Grains & Malts",
          source: "supplier" as const,
          supplierName: "Yorkshire Malt Co.",
          defaultUnit: "kg",
        },
        {
          id: "sup-2",
          name: "Premium Hops",
          category: "Hops",
          source: "supplier" as const,
          supplierName: "Kent Hop Farm",
          defaultUnit: "kg",
        },
      ].filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

      const mockDatabaseResults: SearchResult[] = [
        {
          id: "db-1",
          name: "Malt - Global Average",
          category: "Grains & Malts",
          source: "database" as const,
          defaultUnit: "kg",
        },
        {
          id: "db-2",
          name: "Hops - Global Average",
          category: "Hops",
          source: "database" as const,
          defaultUnit: "kg",
        },
      ].filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

      setSearchResults([...mockSupplierResults, ...mockDatabaseResults]);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search ingredients");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (!formData.itemName || !formData.quantity || !formData.unit) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success("Ingredient added successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving ingredient:", error);
      toast.error("Failed to save ingredient");
    } finally {
      setIsSaving(false);
    }
  };

  const supplierResults = searchResults.filter(r => r.source === "supplier");
  const databaseResults = searchResults.filter(r => r.source === "database");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Ingredient</DialogTitle>
          <DialogDescription>
            Search for supplier items or add manually
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Search Supplier Items or Database
            </Label>
            <p className="text-sm text-muted-foreground">
              Prioritise verified supplier data for highest accuracy
            </p>

            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="w-full justify-between h-auto min-h-[48px]"
                >
                  {selectedItem ? (
                    <div className="flex items-center gap-2">
                      {selectedItem.source === "supplier" ? (
                        <Shield className="h-4 w-4 text-green-600" />
                      ) : (
                        <Globe className="h-4 w-4 text-slate-600" />
                      )}
                      <div className="text-left">
                        <div className="font-medium">{selectedItem.name}</div>
                        {selectedItem.supplierName && (
                          <div className="text-xs text-muted-foreground">
                            {selectedItem.supplierName}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Search ingredients...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[560px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type to search..."
                    value={searchQuery}
                    onValueChange={handleSearch}
                  />
                  <CommandEmpty>
                    {isSearching ? "Searching..." : "No results found"}
                  </CommandEmpty>

                  {supplierResults.length > 0 && (
                    <CommandGroup heading="My Suppliers (Gold Standard)">
                      {supplierResults.map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => {
                            setSelectedItem(result);
                            setSearchOpen(false);
                          }}
                          className="py-3"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedItem?.id === result.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{result.name}</span>
                              <Badge variant="default" className="bg-green-600 text-xs">
                                Verified
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.supplierName}
                            </div>
                          </div>
                          <Shield className="h-4 w-4 text-green-600" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {databaseResults.length > 0 && (
                    <CommandGroup heading="Global Database">
                      {databaseResults.map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => {
                            setSelectedItem(result);
                            setSearchOpen(false);
                          }}
                          className="py-3"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedItem?.id === result.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <span className="font-medium">{result.name}</span>
                          </div>
                          <Globe className="h-4 w-4 text-slate-600" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <Label className="text-sm text-muted-foreground">Or enter manually</Label>

            <div className="space-y-2">
              <Label htmlFor="item-name">Item Name *</Label>
              <Input
                id="item-name"
                placeholder="e.g., Organic Barley Malt"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                disabled={!!selectedItem}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="l">Litres (l)</SelectItem>
                    <SelectItem value="ml">Millilitres (ml)</SelectItem>
                    <SelectItem value="units">Units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transport-mode">Transport Mode</Label>
                <Select
                  value={formData.transportMode}
                  onValueChange={(value) => setFormData({ ...formData, transportMode: value })}
                >
                  <SelectTrigger id="transport-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="ship">Ship</SelectItem>
                    <SelectItem value="train">Train</SelectItem>
                    <SelectItem value="air">Air</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="distance">Distance (km)</Label>
                <Input
                  id="distance"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.transportDistance}
                  onChange={(e) => setFormData({ ...formData, transportDistance: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-source">LCA Data Source</Label>
              <Select
                value={formData.dataSource}
                onValueChange={(value) => setFormData({ ...formData, dataSource: value })}
              >
                <SelectTrigger id="data-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary (Supplier)</SelectItem>
                  <SelectItem value="secondary">Secondary (Industry)</SelectItem>
                  <SelectItem value="generic">Generic (Database)</SelectItem>
                  <SelectItem value="estimated">Estimated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Add Ingredient"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
