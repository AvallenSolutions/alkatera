export interface LcaLifeCycleStage {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface LcaSubStage {
  id: string;
  lca_stage_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface LcaStageWithSubStages extends LcaLifeCycleStage {
  sub_stages: LcaSubStage[];
}

export interface Ingredient {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  lca_sub_stage_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientWithSubStage extends Ingredient {
  lca_sub_stages?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export interface PackagingType {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  material: string | null;
  weight_g: number | null;
  created_at: string;
  updated_at: string;
}

export type MaterialType = 'ingredient' | 'packaging';

export type DataSource = 'openlca' | 'supplier' | 'primary';

export interface MaterialSelectionOutput {
  materialId: string;
  materialType: MaterialType;
  quantity: number;
}

export interface ProductLca {
  id: string;
  organization_id: string;
  product_name: string;
  product_description?: string | null;
  product_image_url?: string | null;
  functional_unit: string;
  system_boundary: string;
  status: 'draft' | 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ProductLcaMaterial {
  id: string;
  product_lca_id: string;
  material_id?: string | null;
  material_type?: MaterialType | null;
  name?: string | null;
  quantity: number;
  unit?: string | null;
  country_of_origin?: string | null;
  is_organic?: boolean;
  is_regenerative?: boolean;
  lca_sub_stage_id?: string | null;
  data_source?: DataSource | null;
  data_source_id?: string | null;
  supplier_product_id?: string | null;
  origin_country?: string | null;
  is_organic_certified?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SimpleMaterialInput {
  id?: string;
  name: string;
  quantity: number | string;
  unit: string;
  lca_sub_stage_id: number | string;
  data_source?: DataSource;
  data_source_id?: string;
  supplier_product_id?: string;
  origin_country?: string;
  is_organic_certified?: boolean;
}

export interface OpenLCAProcess {
  id: string;
  name: string;
  category: string;
  unit?: string;
  processType?: string;
  location?: string;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unit: string;
  carbon_intensity?: number | null;
  product_code?: string | null;
  supplier_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngredientCardData {
  tempId: string;
  data_source: DataSource;
  name: string;
  quantity: number | string;
  unit: string;
  lca_sub_stage_id: string | null;
  data_source_id?: string;
  supplier_product_id?: string;
  origin_country: string;
  is_organic_certified: boolean;
}

export interface MaterialWithDetails {
  material_id: string;
  material_type: MaterialType;
  name: string;
  quantity: number;
  unit: string;
  country_of_origin: string;
  is_organic: boolean;
  is_regenerative: boolean;
  lca_sub_stage_id: number;
  lca_sub_stage_name?: string;
}

export interface CreateLcaPayload {
  productDetails: {
    product_name: string;
    product_description: string;
    product_image_url: string;
    functional_unit: string;
    system_boundary: string;
  };
  materials: Array<{
    material_id: string;
    material_type: MaterialType;
    quantity: number;
    unit: string;
    country_of_origin: string;
    is_organic: boolean;
    is_regenerative: boolean;
    lca_sub_stage_id: number;
  }>;
}
