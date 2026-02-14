export interface ParsedRow {
  [key: string]: string | number | null;
}

// ── Parsed sheet data ──────────────────────────────────────────────────────

export interface ParsedProduct {
  name: string;
  sku: string;
  category: string;
}

export interface ParsedIngredient {
  product_sku: string;
  name: string;
  quantity: number;
  unit: string;
  origin: string | null;
}

export interface ParsedPackagingComponent {
  name: string;
  material: string;
  weight_g: number | null;
  recycled_pct: number | null;
}

export interface ParsedPackaging {
  product_sku: string;
  name: string;
  category: string;
  main_material: string;
  weight_g: number;
  net_content: number | null;
  recycled_pct: number | null;
  origin_country: string | null;
  transport_mode: string | null;
  distance_km: number | null;
  // EPR
  epr_level: string | null;
  epr_activity: string | null;
  epr_material_type: string | null;
  epr_is_household: boolean | null;
  epr_is_drinks_container: boolean | null;
  epr_ram_rating: string | null;
  epr_uk_nation: string | null;
  // Component breakdown
  components: ParsedPackagingComponent[];
}

export interface ParsedImportData {
  products: ParsedProduct[];
  ingredients: ParsedIngredient[];
  packaging: ParsedPackaging[];
  errors: string[];
}

// ── Import session (client state) ──────────────────────────────────────────

export interface ImportSession {
  id: string;
  organization_id: string;
  status: 'pending' | 'processed' | 'confirmed' | 'failed';
  file_name: string;
  total_rows: number;
  processed_rows: number;
  created_at: string;
}

export interface MatchResult {
  material_id: string;
  material_name: string;
  confidence: number;
  match_type: 'exact' | 'fuzzy' | 'category';
}

// ConfidenceLevel is exported from ./material-matcher — not duplicated here
