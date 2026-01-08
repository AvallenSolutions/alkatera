export interface BulkImportItem {
  raw_name: string;
  clean_name: string | null;
  quantity: number | null;
  unit: string | null;
  item_type: 'ingredient' | 'packaging';
  matched_material_id: string | null;
  match_confidence: number | null;
  is_reviewed: boolean;
}

export interface ImportSession {
  id: string;
  status: 'processing' | 'ready' | 'complete';
  items: BulkImportItem[];
}
