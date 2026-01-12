export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ImportSession {
  id: string;
  organization_id: string;
  status: 'pending' | 'processed' | 'confirmed' | 'failed';
  file_name: string;
  total_rows: number;
  processed_rows: number;
  created_at: string;
}

export interface ExtractedItem {
  id: string;
  session_id: string;
  raw_name: string;
  clean_name: string | null;
  quantity: number | null;
  unit: string | null;
  item_type: 'ingredient' | 'packaging';
  matched_material_id: string | null;
  match_confidence: number | null;
  is_reviewed: boolean;
  is_imported: boolean;
}

export interface MatchResult {
  material_id: string;
  material_name: string;
  confidence: number;
  match_type: 'exact' | 'fuzzy' | 'category';
}

export interface ConfidenceLevel {
  level: 'high' | 'medium' | 'low' | 'none';
  label: string;
  color: string;
}
