export interface LcaLifeCycleStage {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface LcaSubStage {
  id: string;
  stage_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface SimpleMaterialInput {
  id?: string;
  name: string;
  quantity: number | string;
  unit: string;
  lca_sub_stage_id: string;
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
  lca_sub_stage_id: string;
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
    lca_sub_stage_id: string;
  }>;
}
