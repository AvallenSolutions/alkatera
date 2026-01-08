import * as XLSX from 'xlsx';

export interface ParsedRow {
  productName: string;
  sku: string;
  description: string;
  category: string;
  ingredientName?: string;
  ingredientQuantity?: number;
  ingredientUnit?: string;
  packagingType?: string;
  packagingMaterial?: string;
  packagingWeight?: number;
}

export function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const parsed = jsonData.map((row: any) => ({
          productName: row.product_name || row['Product Name'] || '',
          sku: row.sku || row.SKU || '',
          description: row.description || row.Description || '',
          category: row.category || row.Category || '',
          ingredientName: row.ingredient_name || row['Ingredient Name'],
          ingredientQuantity: row.ingredient_quantity || row['Ingredient Quantity'],
          ingredientUnit: row.ingredient_unit || row['Ingredient Unit'],
          packagingType: row.packaging_type || row['Packaging Type'],
          packagingMaterial: row.packaging_material || row['Packaging Material'],
          packagingWeight: row.packaging_weight_g || row['Packaging Weight (g)'],
        }));

        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}
