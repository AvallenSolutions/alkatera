export function downloadTemplateAsCSV(templateType: string = 'ingredients'): void {
  const headers = templateType === 'ingredients'
    ? ['Name', 'Quantity', 'Unit', 'Country of Origin', 'Is Organic']
    : ['Name', 'Quantity', 'Unit', 'Packaging Category'];

  const csvContent = headers.join(',') + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${templateType}_template.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createGoogleSheetsTemplate(templateType: string): string {
  return `https://docs.google.com/spreadsheets/create?title=${encodeURIComponent(`${templateType}_import`)}`;
}
