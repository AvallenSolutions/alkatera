export interface ImportedItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  type: 'ingredient' | 'packaging';
}
