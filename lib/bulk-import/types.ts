export interface BulkImportRow {
  name: string;
  quantity: number | null;
  unit: string | null;
  origin_country?: string;
  supplier?: string;
  material_type?: string;
  recyclable?: boolean;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: ImportValidationError[];
}
