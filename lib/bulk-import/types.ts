export interface BulkImportSession {
  id: string;
  organizationId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ImportItem {
  id: string;
  sessionId: string;
  rowNumber: number;
  productName: string;
  sku: string;
  status: 'pending' | 'matched' | 'manual_review' | 'failed';
  matchedMaterialId?: string;
  confidence?: number;
  errorMessage?: string;
}
