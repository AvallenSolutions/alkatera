import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export interface PlatformSupplierProduct {
  id: string;
  platform_supplier_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  carbon_intensity: number | null;
  product_code: string | null;
  product_image_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  origin_address: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_country_code: string | null;
}

export function usePlatformSupplierProducts(platformSupplierId: string | undefined) {
  const [products, setProducts] = useState<PlatformSupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    if (!platformSupplierId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: productsError } = await supabase
        .from("platform_supplier_products")
        .select("*")
        .eq("platform_supplier_id", platformSupplierId)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      setProducts(data || []);
    } catch (err: any) {
      console.error("Error fetching platform supplier products:", err);
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (product: Partial<PlatformSupplierProduct>) => {
    try {
      const { data, error } = await supabase
        .from("platform_supplier_products")
        .insert([product])
        .select()
        .single();

      if (error) throw error;

      toast.success("Product added successfully");
      await fetchProducts();
      return data;
    } catch (err: any) {
      console.error("Error creating product:", err);
      toast.error(err.message || "Failed to create product");
      throw err;
    }
  };

  const updateProduct = async (productId: string, updates: Partial<PlatformSupplierProduct>) => {
    try {
      const { data, error } = await supabase
        .from("platform_supplier_products")
        .update(updates)
        .eq("id", productId)
        .select()
        .single();

      if (error) throw error;

      toast.success("Product updated successfully");
      await fetchProducts();
      return data;
    } catch (err: any) {
      console.error("Error updating product:", err);
      toast.error(err.message || "Failed to update product");
      throw err;
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from("platform_supplier_products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      toast.success("Product deleted successfully");
      await fetchProducts();
    } catch (err: any) {
      console.error("Error deleting product:", err);
      toast.error(err.message || "Failed to delete product");
      throw err;
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [platformSupplierId]);

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
