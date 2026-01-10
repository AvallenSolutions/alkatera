export function downloadTemplateAsCSV(templateType: string = 'materials'): void {
  const templates: Record<string, string[][]> = {
    materials: [
      ['Material Name', 'Quantity', 'Unit', 'Origin Country', 'Transport Mode'],
      ['Example Material', '100', 'kg', 'GB', 'road'],
    ],
    products: [
      ['Product Name', 'SKU', 'Functional Unit', 'Description'],
      ['Example Product', 'SKU-001', '1 unit', 'Product description'],
    ],
  };

  const data = templates[templateType] || templates.materials;
  const csvContent = data.map(row => row.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${templateType}_template.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createGoogleSheetsTemplate(templateType: string): string {
  return `https://docs.google.com/spreadsheets/create?title=${encodeURIComponent(templateType + '_import')}`;
}
