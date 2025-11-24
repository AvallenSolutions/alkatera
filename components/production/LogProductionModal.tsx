"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
}

interface LogProductionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess: () => void;
  editingLog?: {
    id: string;
    facility_id: string;
    product_id: number;
    date: string;
    volume: number;
    unit: string;
  } | null;
}

export function LogProductionModal({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
  editingLog,
}: LogProductionModalProps) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  const [selectedFacility, setSelectedFacility] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [volume, setVolume] = useState<string>("");
  const [unit, setUnit] = useState<string>("Litre");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFacilities();
      fetchProducts();

      if (editingLog) {
        setSelectedFacility(editingLog.facility_id);
        setSelectedProduct(editingLog.product_id.toString());
        setDate(new Date(editingLog.date));
        setVolume(editingLog.volume.toString());
        setUnit(editingLog.unit);
      } else {
        resetForm();
      }
    }
  }, [open, editingLog]);

  useEffect(() => {
    if (selectedFacility) {
      filterProductsByFacility(selectedFacility);
    } else {
      setFilteredProducts(products);
    }
  }, [selectedFacility, products]);

  const fetchFacilities = async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("facilities")
        .select("id, name, facility_type")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      setFacilities(data || []);
    } catch (error: any) {
      console.error("Error fetching facilities:", error);
      toast.error("Failed to load facilities");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", organizationId)
        .eq("is_draft", false)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    }
  };

  const filterProductsByFacility = async (facilityId: string) => {
    // For now, show all products
    // Future enhancement: Filter based on facility-product assignments
    setFilteredProducts(products);
  };

  const resetForm = () => {
    setSelectedFacility("");
    setSelectedProduct("");
    setDate(new Date());
    setVolume("");
    setUnit("Litre");
  };

  const handleFacilityChange = (value: string) => {
    setSelectedFacility(value);
    // Reset product selection when facility changes
    if (!editingLog) {
      setSelectedProduct("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFacility || !selectedProduct || !volume || parseFloat(volume) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const logData = {
        organization_id: organizationId,
        facility_id: selectedFacility,
        product_id: parseInt(selectedProduct),
        date: format(date, "yyyy-MM-dd"),
        volume: parseFloat(volume),
        unit,
      };

      if (editingLog) {
        const { error } = await supabase
          .from("production_logs")
          .update(logData)
          .eq("id", editingLog.id);

        if (error) throw error;
        toast.success("Production log updated successfully");
      } else {
        const { error } = await supabase
          .from("production_logs")
          .insert([logData]);

        if (error) throw error;
        toast.success("Production logged successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving production log:", error);
      toast.error(error.message || "Failed to save production log");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingLog ? "Edit Production Log" : "Log Production"}
          </DialogTitle>
          <DialogDescription>
            Record production volume to allocate facility impact
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Select Facility */}
          <div className="space-y-2">
            <Label htmlFor="facility">
              Facility <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedFacility}
              onValueChange={handleFacilityChange}
              disabled={isLoading}
            >
              <SelectTrigger id="facility">
                <SelectValue placeholder="Select facility..." />
              </SelectTrigger>
              <SelectContent>
                {facilities.map((facility) => (
                  <SelectItem key={facility.id} value={facility.id}>
                    <div className="flex items-center gap-2">
                      <span>{facility.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({facility.facility_type})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {facilities.length === 0 && !isLoading && (
              <p className="text-xs text-muted-foreground">
                No facilities found. Add a facility first.
              </p>
            )}
          </div>

          {/* Step 2: Select Product (Dynamic) */}
          <div className="space-y-2">
            <Label htmlFor="product">
              Product <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedProduct}
              onValueChange={setSelectedProduct}
              disabled={!selectedFacility || isLoading}
            >
              <SelectTrigger id="product">
                <SelectValue placeholder="Select product..." />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{product.name}</span>
                      {product.sku && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {product.sku}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedFacility && (
              <p className="text-xs text-muted-foreground">
                Select a facility first
              </p>
            )}
            {filteredProducts.length === 0 && selectedFacility && (
              <p className="text-xs text-muted-foreground">
                No products available. Add a product first.
              </p>
            )}
          </div>

          {/* Step 3: Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="date">
              Production Date <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Step 4: Volume & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="volume">
                Volume <span className="text-destructive">*</span>
              </Label>
              <Input
                id="volume"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Litre">Litre (L)</SelectItem>
                  <SelectItem value="Hectolitre">Hectolitre (hL)</SelectItem>
                  <SelectItem value="Unit">Units</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingLog ? "Update" : "Log Production"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
