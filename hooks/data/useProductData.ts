"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export interface ProductIngredient {
  id: string;
  material_name: string;
  quantity: number;
  unit: string;
  data_source: string;
}

export interface ProductPackaging {
  id: string;
  material_name: string;
  quantity: number;
  unit: string;
  packaging_category: string;
  data_source: string;
}

export interface ProductLCA {
  id: string;
  created_at: string;
  system_boundary: string;
  total_ghg_emissions: number;
  status: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  image_url: string;
  product_category: string;
  functional_unit: string;
  functional_unit_quantity: number;
}

export interface ProductData {
  product: Product | null;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  lcaReports: ProductLCA[];
  isHealthy: boolean;
  loading: boolean;
  error: string | null;
}

export function useProductData(productId: string | undefined) {
  const [data, setData] = useState<ProductData>({
    product: null,
    ingredients: [],
    packaging: [],
    lcaReports: [],
    isHealthy: false,
    loading: true,
    error: null,
  });

  const fetchData = async () => {
    if (!productId) {
      setData(prev => ({ ...prev, loading: false, error: "No product ID provided" }));
      return;
    }

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseBrowserClient();

      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      // Fetch ingredients
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from("product_materials")
        .select("*")
        .eq("product_id", productId)
        .eq("material_type", "ingredient");

      if (ingredientsError) throw ingredientsError;

      // Fetch packaging
      const { data: packagingData, error: packagingError } = await supabase
        .from("product_materials")
        .select("*")
        .eq("product_id", productId)
        .eq("material_type", "packaging");

      if (packagingError) throw packagingError;

      // Fetch LCA reports
      const { data: lcaData, error: lcaError } = await supabase
        .from("product_lcas")
        .select("id, created_at, system_boundary, total_ghg_emissions, status")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      // LCA error is non-critical, just log it
      if (lcaError) console.warn("Error fetching LCA data:", lcaError);

      // Calculate data health
      const hasIngredients = (ingredientsData || []).length > 0;
      const hasPackaging = (packagingData || []).length > 0;
      const isHealthy = hasIngredients && hasPackaging;

      setData({
        product: productData,
        ingredients: ingredientsData || [],
        packaging: packagingData || [],
        lcaReports: lcaData || [],
        isHealthy,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Error fetching product data:", error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to fetch product data",
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [productId]);

  return { ...data, refetch: fetchData };
}
