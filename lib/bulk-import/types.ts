export interface BulkImportRow {
  materialName: string;
  quantity: number;
  unit: string;
  originCountry?: string;
  supplier?: string;
}

export interface ParsedBulkImport {
  rows: BulkImportRow[];
  errors: string[];
}
