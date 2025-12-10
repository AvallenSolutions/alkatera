export interface ExtractedBOMItem {
  rawName: string;
  cleanName: string;
  quantity: number | null;
  unit: string | null;
  itemType: 'ingredient' | 'packaging';
  unitCost: number | null;
  totalCost: number | null;
}

export interface BOMParseResult {
  success: boolean;
  items: ExtractedBOMItem[];
  errors: string[];
  metadata: {
    productCode?: string;
    productDescription?: string;
    totalValue?: number;
    createdDate?: string;
  };
}

export interface BOMImport {
  id: string;
  organization_id: string;
  product_id: number | null;
  file_name: string;
  file_type: 'pdf' | 'csv';
  file_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  item_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BOMExtractedItem {
  id: string;
  bom_import_id: string;
  raw_name: string;
  clean_name: string | null;
  quantity: number | null;
  unit: string | null;
  item_type: 'ingredient' | 'packaging';
  unit_cost: number | null;
  total_cost: number | null;
  matched_material_id: string | null;
  match_confidence: number | null;
  is_reviewed: boolean;
  is_imported: boolean;
  created_at: string;
  updated_at: string;
}
