import type { LcaWizardSettings } from '@/types/lca-templates';

export interface Certification {
  name: string;
  evidence_url: string;
}

export interface Award {
  name: string;
}

export type UnitSizeUnit = 'ml' | 'L' | 'g' | 'kg';

export type RecipeScaleMode = 'per_unit' | 'per_batch';
export type BatchYieldUnit = 'bottles' | 'units' | 'L' | 'kL' | 'hL' | 'ml';

export type StageType =
  | 'brewing'
  | 'fermentation'
  | 'distillation'
  | 'blending'
  | 'maturation'
  | 'bottling'
  | 'other';

export interface ProductionStage {
  id: string;
  product_id: number | string;
  ordinal: number;
  name: string;
  stage_type: StageType;
  input_volume_l?: number | null;
  output_volume_l?: number | null;
  input_abv_percent?: number | null;
  output_abv_percent?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductionChainTemplateStage {
  ordinal: number;
  name: string;
  stage_type: StageType;
  default_input_volume_l?: number;
  default_output_volume_l?: number;
  default_input_abv_percent?: number;
  default_output_abv_percent?: number;
}

export interface ProductionChainTemplate {
  id: string;
  organization_id: string | null;
  kind: 'built_in' | 'custom';
  name: string;
  description?: string | null;
  stages: ProductionChainTemplateStage[];
  created_at?: string;
  updated_at?: string;
}

interface BottlesPerChainInput {
  bottles_produced_override?: number | null;
  maturation_bottles_produced?: number | null;
  maturation_output_bottled_litres?: number | null;
  unit_size_value?: number | null;
  unit_size_unit?: UnitSizeUnit | string | null;
  fallback_per_batch?: number;
}

/**
 * Resolve total bottles produced by one full run of the production chain.
 * Order of precedence:
 *   1. Explicit `bottles_produced_override` from the bottling stage / product
 *   2. `bottles_produced` set on the maturation profile
 *   3. Maturation `output_volume_bottled_litres / bottle_size_litres`
 *   4. v1 `computeBottlesPerBatch` fallback (if caller passes it as fallback_per_batch)
 *
 * Returns 1 only when no signal is available, which is treated as no allocation.
 */
export function deriveBottlesPerChain(input: BottlesPerChainInput): number {
  if (input.bottles_produced_override && input.bottles_produced_override > 0) {
    return input.bottles_produced_override;
  }
  if (input.maturation_bottles_produced && input.maturation_bottles_produced > 0) {
    return input.maturation_bottles_produced;
  }
  if (
    input.maturation_output_bottled_litres &&
    input.maturation_output_bottled_litres > 0 &&
    input.unit_size_value &&
    input.unit_size_value > 0 &&
    input.unit_size_unit
  ) {
    const sizeUnit = String(input.unit_size_unit).toLowerCase();
    const sizeToL: Record<string, number> = { ml: 0.001, l: 1 };
    const factor = sizeToL[sizeUnit];
    if (factor) {
      const bottleLitres = input.unit_size_value * factor;
      if (bottleLitres > 0) {
        return input.maturation_output_bottled_litres / bottleLitres;
      }
    }
  }
  if (input.fallback_per_batch && input.fallback_per_batch > 1) {
    return input.fallback_per_batch;
  }
  return 1;
}

export function stageTypeToLifecycleBucket(
  stage: StageType,
): 'processing' | 'maturation' | 'packaging' {
  switch (stage) {
    case 'brewing':
    case 'fermentation':
    case 'distillation':
    case 'blending':
    case 'other':
      return 'processing';
    case 'maturation':
      return 'maturation';
    case 'bottling':
      return 'packaging';
  }
}

interface BottlesPerBatchProduct {
  recipe_scale_mode?: RecipeScaleMode | null;
  batch_yield_value?: number | null;
  batch_yield_unit?: BatchYieldUnit | string | null;
  unit_size_value?: number | null;
  unit_size_unit?: UnitSizeUnit | string | null;
}

const BATCH_YIELD_TO_LITRES: Record<string, number> = {
  ml: 0.001,
  l: 1,
  hl: 100,
  kl: 1000,
};

const UNIT_SIZE_TO_LITRES: Record<string, number> = {
  ml: 0.001,
  l: 1,
};

/**
 * Returns the divisor used to allocate batch-scale ingredient quantities to a
 * single functional unit. Returns 1 for per_unit mode (no allocation).
 * Throws when batch mode is selected but inputs are missing or incompatible —
 * silent fallback would corrupt LCA results.
 */
export function computeBottlesPerBatch(product: BottlesPerBatchProduct): number {
  if (!product.recipe_scale_mode || product.recipe_scale_mode === 'per_unit') {
    return 1;
  }

  const yieldValue = product.batch_yield_value;
  const yieldUnit = product.batch_yield_unit;
  if (!yieldValue || yieldValue <= 0 || !yieldUnit) {
    throw new Error(
      'Product is in per_batch mode but batch_yield_value/batch_yield_unit are missing.',
    );
  }

  const unit = String(yieldUnit).toLowerCase();
  if (unit === 'bottles' || unit === 'units') {
    return yieldValue;
  }

  const yieldLitresFactor = BATCH_YIELD_TO_LITRES[unit];
  if (!yieldLitresFactor) {
    throw new Error(`Unsupported batch_yield_unit: ${yieldUnit}`);
  }

  if (!product.unit_size_value || product.unit_size_value <= 0 || !product.unit_size_unit) {
    throw new Error(
      'Volume-based batch yield requires unit_size_value/unit_size_unit on the product.',
    );
  }

  const sizeUnit = String(product.unit_size_unit).toLowerCase();
  const sizeLitresFactor = UNIT_SIZE_TO_LITRES[sizeUnit];
  if (!sizeLitresFactor) {
    throw new Error(
      `Cannot derive bottles-per-batch from unit_size_unit "${product.unit_size_unit}" (use ml or L).`,
    );
  }

  const batchLitres = yieldValue * yieldLitresFactor;
  const bottleLitres = product.unit_size_value * sizeLitresFactor;
  return batchLitres / bottleLitres;
}

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  sku?: string | null;
  product_category?: string | null;
  unit_size_value?: number | null;
  unit_size_unit?: UnitSizeUnit | null;
  /**
   * Bottled alcohol strength as percent (e.g. 46 for 46% ABV).
   * Drives per-bottle allocation of maturation impacts for aged spirits: water
   * added at bottling inflates bottle count by (cask_abv / bottle_abv).
   * NULL falls back to product-category default then 40%.
   * Added in migration 20261800100000_maturation_abv_and_warehouse_country.sql.
   */
  alcohol_content_abv?: number | null;
  product_description?: string | null;
  product_image_url?: string | null;
  certifications?: Certification[];
  awards?: Award[];
  is_multipack?: boolean;
  annual_production_volume?: number | null;
  annual_production_unit?: string | null;
  /**
   * Recipe input scale. 'per_unit' (default) means ingredient quantities on
   * product_carbon_footprint_materials are stored per functional unit. 'per_batch'
   * means they are stored as batch totals; the LCA calculator divides by
   * bottles-per-batch (derived from batch_yield_* and unit_size_*).
   * Added in migration 20262605300000_product_batch_scale.sql.
   */
  recipe_scale_mode?: RecipeScaleMode | null;
  batch_yield_value?: number | null;
  batch_yield_unit?: BatchYieldUnit | null;
  /**
   * Subset of WizardFormData used for the most recent LCA run on this product.
   * Prefills the LCA wizard on next open. Shape matches LcaWizardSettings in
   * types/lca-templates.ts (excludes functional_unit and derived outputs).
   * Added in migration 20261800000000_lca_wizard_permanence_and_templates.sql.
   */
  last_wizard_settings?: LcaWizardSettings | null;
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
  alcohol_content_abv?: number | null;
  product_description?: string;
  product_image_url?: string;
  certifications?: Certification[];
  awards?: Award[];
  is_multipack?: boolean;
  annual_production_volume?: number;
  annual_production_unit?: string;
  recipe_scale_mode?: RecipeScaleMode;
  batch_yield_value?: number | null;
  batch_yield_unit?: BatchYieldUnit | null;
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
