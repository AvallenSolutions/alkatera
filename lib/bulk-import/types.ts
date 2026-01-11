export interface ExtractedItem {
  id: string;
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

export interface ImportSession {
  id: string;
  organization_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  created_at: string;
}
