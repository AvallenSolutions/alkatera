export interface BulkImportRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
  matchedMaterial?: {
    id: string;
    name: string;
    confidence: number;
  };
}

export interface BulkImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: BulkImportRow[];
}

export interface ImportTemplate {
  id: string;
  name: string;
  columns: string[];
  requiredColumns: string[];
  description: string;
}
