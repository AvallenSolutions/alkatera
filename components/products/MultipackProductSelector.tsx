"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Minus, Trash2, Package, Search, Check, Layers } from "lucide-react";
import { fetchAvailableProductsForMultipack } from "@/lib/multipacks";
import type { Product } from "@/lib/types/products";

export interface SelectedComponent {
  product: Product;
  quantity: number;
}

interface MultipackProductSelectorProps {
  organizationId: string;
  selectedComponents: SelectedComponent[];
  onComponentsChange: (components: SelectedComponent[]) => void;
  excludeProductId?: string;
  disabled?: boolean;
}

export function MultipackProductSelector({
  organizationId,
  selectedComponents,
  onComponentsChange,
  excludeProductId,
  disabled = false,
}: MultipackProductSelectorProps) {
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadProducts() {
      if (!organizationId) return;

      setIsLoading(true);
      try {
        const products = await fetchAvailableProductsForMultipack(
          organizationId,
          excludeProductId
        );
        setAvailableProducts(products);
      } catch (error) {
        console.error("Error loading products:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProducts();
  }, [organizationId, excludeProductId]);

  const handleAddProduct = (product: Product) => {
    // Check if already added
    const existing = selectedComponents.find(
      (c) => c.product.id === product.id
    );
    if (existing) {
      // Increment quantity
      onComponentsChange(
        selectedComponents.map((c) =>
          c.product.id === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      );
    } else {
      // Add new
      onComponentsChange([
        ...selectedComponents,
        { product, quantity: 1 },
      ]);
    }
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      // Remove if quantity is 0 or less
      onComponentsChange(
        selectedComponents.filter((c) => c.product.id !== productId)
      );
    } else {
      onComponentsChange(
        selectedComponents.map((c) =>
          c.product.id === productId ? { ...c, quantity: newQuantity } : c
        )
      );
    }
  };

  const handleRemoveProduct = (productId: string) => {
    onComponentsChange(
      selectedComponents.filter((c) => c.product.id !== productId)
    );
  };

  // Filter out already selected products from available list
  const unselectedProducts = availableProducts.filter(
    (p) => !selectedComponents.some((c) => c.product.id === p.id)
  );

  // Filter by search query
  const filteredProducts = unselectedProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate totals
  const totalUnits = selectedComponents.reduce(
    (sum, c) => sum + c.quantity,
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Multipack Contents
        </CardTitle>
        <CardDescription>
          Select products to include in this multipack and specify quantities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Product Button */}
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={disabled || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading products...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search and add products...
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup heading="Available Products">
                  <ScrollArea className="h-[300px]">
                    {filteredProducts.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={() => handleAddProduct(product)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3 w-full">
                          {product.product_image_url ? (
                            <img
                              src={product.product_image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {product.name}
                              </span>
                              {product.is_multipack && (
                                <Badge variant="secondary" className="text-xs">
                                  <Layers className="h-3 w-3 mr-1" />
                                  Multipack
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {product.sku && <span>SKU: {product.sku}</span>}
                              {product.unit_size_value && product.unit_size_unit && (
                                <span className="ml-2">
                                  {product.unit_size_value} {product.unit_size_unit}
                                </span>
                              )}
                            </div>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Selected Products List */}
        {selectedComponents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No products added yet</p>
            <p className="text-sm">Search and select products to add to your multipack</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedComponents.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
              >
                {product.product_image_url ? (
                  <img
                    src={product.product_image_url}
                    alt={product.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{product.name}</span>
                    {product.is_multipack && (
                      <Badge variant="secondary" className="text-xs">
                        <Layers className="h-3 w-3 mr-1" />
                        Multipack
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {product.sku && <span>SKU: {product.sku}</span>}
                    {product.unit_size_value && product.unit_size_unit && (
                      <span className="ml-2">
                        {product.unit_size_value} {product.unit_size_unit}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleQuantityChange(product.id, quantity - 1)}
                    disabled={disabled}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) =>
                      handleQuantityChange(product.id, parseInt(e.target.value) || 1)
                    }
                    className="w-16 h-8 text-center"
                    disabled={disabled}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleQuantityChange(product.id, quantity + 1)}
                    disabled={disabled}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveProduct(product.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {selectedComponents.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedComponents.length} product{selectedComponents.length !== 1 ? "s" : ""} selected
            </div>
            <div className="font-medium">
              Total: {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
