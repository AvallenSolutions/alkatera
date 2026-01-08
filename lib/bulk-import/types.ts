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

export interface BulkImportSession {
  id: string;
  organization_id: string;
  status: 'pending' | 'processing' | 'preview' | 'confirmed' | 'completed' | 'failed';
  file_name: string;
  parsed_data: ParsedImportData;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export const TEMPLATE_HEADERS = [
  'Product Name*',
  'SKU',
  'Category',
  'Unit Size (Value)',
  'Unit Size (Unit)',
  'Description',
] as const;

export const INGREDIENT_COLUMNS = 20;
export const PACKAGING_CATEGORIES = ['Container', 'Label', 'Closure', 'Secondary'] as const;

export type PackagingCategory = typeof PACKAGING_CATEGORIES[number];

export const SUPPORTED_CATEGORIES = [
  'Gin',
  'Vodka',
  'Whisky',
  'Rum',
  'Tequila',
  'Brandy',
  'Liqueur',
  'Beer',
  'Lager',
  'Ale',
  'Stout',
  'Cider',
  'Wine',
  'Sparkling Wine',
  'Ready-to-Drink',
  'Non-Alcoholic',
  'Soft Drink',
  'Mixer',
  'Other',
] as const;

export const SUPPORTED_UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'oz',
  'lb',
  'unit',
  'piece',
] as const;
