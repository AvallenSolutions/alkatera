"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Plus, Minus, Trash2, Package, Search, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMultipackComponents,
  fetchAvailableProductsForMultipack,
  addMultipackComponent,
  updateMultipackComponent,
  removeMultipackComponent,
} from "@/lib/multipacks";
import { supabase } from "@/lib/supabaseClient";
import type { MultipackComponent, Product } from "@/lib/types/products";

interface MultipackContentsEditorProps {
  /** The multipack product being edited. */
  productId: string;
  organizationId: string;
  /**
   * Called after any change to the contents. The staleness banner lives on the
   * hub now rather than in here, so the hub needs telling that the footprint
   * has just gone out of date.
   */
  onChanged?: () => void;
}

export function MultipackContentsEditor({
  productId,
  organizationId,
  onChanged,
}: MultipackContentsEditorProps) {
  const [components, setComponents] = useState<MultipackComponent[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Tracks which component rows have an in-flight mutation so we can disable
  // their controls without freezing the whole card.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [addBusy, setAddBusy] = useState(false);

  const setBusy = (id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  /**
   * Load the current components AND the pickable products.
   *
   * Cycle blocking (A12): fetchAvailableProductsForMultipack already excludes
   * the multipack itself (direct self-reference). Here we additionally exclude
   * any product that is a multipack whose components include THIS multipack —
   * adding such a product would create a loop (M contains C, C contains M).
   * We do this with a single query against multipack_components for rows whose
   * component_product_id is this product, giving the ids of every multipack that
   * directly contains it. Deeper transitive loops (M → C → D → M) are not fully
   * resolved here, but nested multipacks are rare in practice and this catches
   * the common case; the DB's own multipack_components org check and the unique
   * constraint remain the backstop.
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [componentsData, products, containingRows] = await Promise.all([
        fetchMultipackComponents(productId),
        fetchAvailableProductsForMultipack(organizationId, productId),
        supabase
          .from("multipack_components")
          .select("multipack_product_id")
          .eq("component_product_id", productId),
      ]);

      const cyclicIds = new Set(
        (containingRows.data || []).map((r: { multipack_product_id: string }) =>
          String(r.multipack_product_id),
        ),
      );
      setComponents(componentsData);
      setAvailableProducts(
        products.filter((p) => !cyclicIds.has(String(p.id))),
      );
    } catch (error) {
      console.error("Error loading multipack contents:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not load multipack contents",
      );
    } finally {
      setIsLoading(false);
    }
  }, [productId, organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markStale = () => onChanged?.();

  const handleAdd = async (product: Product) => {
    setSearchOpen(false);
    setSearchQuery("");
    setAddBusy(true);
    try {
      const created = await addMultipackComponent({
        multipack_product_id: productId,
        component_product_id: String(product.id),
        quantity: 1,
      });
      setComponents((prev) => [...prev, created]);
      markStale();
      toast.success(`Added ${product.name} to this multipack`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add product to multipack",
      );
    } finally {
      setAddBusy(false);
    }
  };

  const handleQuantity = async (component: MultipackComponent, newQuantity: number) => {
    if (newQuantity < 1) return; // Removal is an explicit action, not a decrement to 0.
    const previous = component.quantity;
    // Optimistic update so the stepper feels instant.
    setComponents((prev) =>
      prev.map((c) => (c.id === component.id ? { ...c, quantity: newQuantity } : c)),
    );
    setBusy(component.id, true);
    try {
      await updateMultipackComponent({ id: component.id, quantity: newQuantity });
      markStale();
    } catch (error) {
      // Roll back the optimistic change.
      setComponents((prev) =>
        prev.map((c) => (c.id === component.id ? { ...c, quantity: previous } : c)),
      );
      toast.error(
        error instanceof Error ? error.message : "Could not update quantity",
      );
    } finally {
      setBusy(component.id, false);
    }
  };

  const handleRemove = async (component: MultipackComponent) => {
    setBusy(component.id, true);
    try {
      await removeMultipackComponent(component.id);
      setComponents((prev) => prev.filter((c) => c.id !== component.id));
      markStale();
      toast.success(
        `Removed ${component.component_product?.name || "product"} from this multipack`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove product",
      );
    } finally {
      setBusy(component.id, false);
    }
  };

  // Products not already in the multipack, filtered by the search box.
  const selectedIds = new Set(components.map((c) => String(c.component_product_id)));
  const filteredProducts = availableProducts
    .filter((p) => !selectedIds.has(String(p.id)))
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())),
    );

  const totalUnits = components.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="space-y-4">
      {/* The staleness banner used to render here as well. On the old tabbed
          hub the two were never on screen together (one sat under Overview,
          this one under Specification); the one-page hub put them side by
          side. The hub owns it now and `onChanged` tells it to re-check. */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            The contents
          </p>
          {!isLoading && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
              {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Add or remove products and change quantities. Recalculate after any change.
        </p>
        <div className="space-y-4">
          {/* Add product picker */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={isLoading || addBusy}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading products...
                  </>
                ) : addBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding product...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search and add a product...
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
                          value={String(product.id)}
                          onSelect={() => handleAdd(product)}
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

          {/* Component list */}
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-16 bg-muted rounded animate-pulse" />
              <div className="h-16 bg-muted rounded animate-pulse" />
            </div>
          ) : components.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No products in this multipack yet</p>
              <p className="text-sm">Search and add products above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {components.map((component) => {
                const product = component.component_product;
                const rowBusy = busyIds.has(component.id);
                return (
                  <div
                    key={component.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    {product?.product_image_url ? (
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
                        <span className="font-medium truncate">
                          {product?.name || "Unknown Product"}
                        </span>
                        {product?.is_multipack && (
                          <Badge variant="secondary" className="text-xs">
                            <Layers className="h-3 w-3 mr-1" />
                            Multipack
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {product?.sku && <span>SKU: {product.sku}</span>}
                        {product?.unit_size_value && product?.unit_size_unit && (
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
                        onClick={() => handleQuantity(component, component.quantity - 1)}
                        disabled={rowBusy || component.quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={component.quantity}
                        onChange={(e) =>
                          handleQuantity(component, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-16 h-8 text-center"
                        disabled={rowBusy}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantity(component, component.quantity + 1)}
                        disabled={rowBusy}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(component)}
                        disabled={rowBusy}
                      >
                        {rowBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {!isLoading && components.length > 0 && (
            <div className="flex items-center justify-between border-t border-studio-hairline pt-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {components.length} product{components.length !== 1 ? "s" : ""}
              </div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
                {totalUnits} unit{totalUnits !== 1 ? "s" : ""} in all
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
