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

// ── Material matching (auto-match during import) ─────────────────────────

export interface SearchResultForMatch {
  id: string;
  name: string;
  category: string;
  source_type: 'primary' | 'staging' | 'global_library' | 'ecoinvent_proxy' | 'ecoinvent_live' | 'agribalyse_live' | 'defra';
  co2_factor?: number;
  source: string;
}

export interface ProxySuggestion {
  proxy_name: string;
  search_query: string;
  category: string;
  reasoning: string;
  confidence_note: 'high' | 'medium' | 'low';
  uncertainty_impact?: string;
}

export interface MaterialMatchState {
  materialName: string;
  materialType: 'ingredient' | 'packaging';
  status: 'pending' | 'searching' | 'matched' | 'no_match' | 'error';
  searchResults: SearchResultForMatch[];
  selectedIndex: number | null;
  autoMatchConfidence: number | null;
  userReviewed: boolean;
  /** AI-suggested proxy options (populated on demand) */
  proxySuggestions?: ProxySuggestion[];
  /** Whether the selected match came from a proxy suggestion */
  isProxyMatch?: boolean;
}

export interface MaterialMatchSelection {
  data_source: 'openlca' | 'supplier' | null;
  data_source_id: string | null;
  supplier_product_id: string | null;
}

export interface MatchedIngredient extends ParsedIngredient {
  match?: MaterialMatchSelection;
}

export interface MatchedPackaging extends ParsedPackaging {
  match?: MaterialMatchSelection;
}

// ConfidenceLevel is exported from ./material-matcher — not duplicated here
