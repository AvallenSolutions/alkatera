export interface ProductRowData {
  productName: string;
  sku?: string;
  category?: string;
  unitSizeValue?: number;
  unitSizeUnit?: string;
  description?: string;
  ingredients: IngredientData[];
  packaging: PackagingData[];
  reusable: boolean;
}

export interface IngredientData {
  name: string;
  quantity: number | null;
  unit: string | null;
  index: number;
}

export interface PackagingData {
  category: string;
  material: string;
  weight: number | null;
}

export interface ExtractedItem {
  id: string;
  raw_name: string;
  clean_name: string | null;
  quantity: number | null;
  unit: string | null;
  item_type: 'ingredient' | 'packaging';
  packaging_category?: string;
  matched_material_id: string | null;
  matched_material_name?: string;
  match_confidence: number | null;
  is_reviewed: boolean;
  is_imported: boolean;
  product_name: string;
  product_index: number;
}

export interface ParsedImportData {
  products: ProductRowData[];
  items: ExtractedItem[];
  errors: ParseError[];
}

export interface ParseError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MatchResult {
  materialId: string;
  materialName: string;
  confidence: number;
  source: 'exact' | 'fuzzy' | 'category';
}

export const INGREDIENT_COLUMNS = 20;
export const PACKAGING_CATEGORIES = ['Container', 'Label', 'Closure', 'Secondary'] as const;

export type PackagingCategory = typeof PACKAGING_CATEGORIES[number];
