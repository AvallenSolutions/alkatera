export interface Certification {
  name: string;
  evidence_url: string;
}

export interface Award {
  name: string;
}

export type UnitSizeUnit = 'ml' | 'L' | 'g' | 'kg';

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  sku?: string | null;
  product_category?: string | null;
  unit_size_value?: number | null;
  unit_size_unit?: UnitSizeUnit | null;
  product_description?: string | null;
  product_image_url?: string | null;
  certifications?: Certification[];
  awards?: Award[];
  is_multipack?: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  product_category?: string;
  unit_size_value?: number;
  unit_size_unit?: UnitSizeUnit;
  product_description?: string;
  product_image_url?: string;
  certifications?: Certification[];
  awards?: Award[];
  is_multipack?: boolean;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

// Multipack Types
export interface MultipackComponent {
  id: string;
  multipack_product_id: string;
  component_product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  // Joined product data
  component_product?: Product;
}

export interface MultipackSecondaryPackaging {
  id: string;
  multipack_product_id: string;
  material_name: string;
  material_type: string;
  weight_grams: number;
  is_recyclable?: boolean;
  recycled_content_percentage?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMultipackComponentInput {
  multipack_product_id: string;
  component_product_id: string;
  quantity: number;
}

export interface UpdateMultipackComponentInput {
  id: string;
  quantity?: number;
}

export interface CreateMultipackSecondaryPackagingInput {
  multipack_product_id: string;
  material_name: string;
  material_type: string;
  weight_grams: number;
  is_recyclable?: boolean;
  recycled_content_percentage?: number;
  notes?: string;
}

export interface UpdateMultipackSecondaryPackagingInput {
  id: string;
  material_name?: string;
  material_type?: string;
  weight_grams?: number;
  is_recyclable?: boolean;
  recycled_content_percentage?: number;
  notes?: string;
}

export interface MultipackAggregatedData {
  total_components: number;
  total_units: number;
  aggregated_unit_size_value: number | null;
  component_products: Array<{
    product_id: string;
    product_name: string;
    product_sku: string | null;
    quantity: number;
    unit_size_value: number | null;
    unit_size_unit: string | null;
    is_multipack: boolean;
  }>;
}

// Extended Product with multipack data
export interface ProductWithMultipack extends Product {
  multipack_components?: MultipackComponent[];
  multipack_secondary_packaging?: MultipackSecondaryPackaging[];
  aggregated_data?: MultipackAggregatedData;
}
