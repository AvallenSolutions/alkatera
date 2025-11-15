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
  functional_unit: string;
  system_boundary: string;
  status: 'draft' | 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ProductLcaMaterial {
  id: string;
  product_lca_id: string;
  material_id: string;
  material_type: MaterialType;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialWithDetails extends MaterialSelectionOutput {
  name?: string;
  displayName?: string;
}
