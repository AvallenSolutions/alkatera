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
  unit_size_value?: number | null;
  unit_size_unit?: UnitSizeUnit | null;
  product_description?: string | null;
  product_image_url?: string | null;
  certifications?: Certification[];
  awards?: Award[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  unit_size_value?: number;
  unit_size_unit?: UnitSizeUnit;
  product_description?: string;
  product_image_url?: string;
  certifications?: Certification[];
  awards?: Award[];
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}
