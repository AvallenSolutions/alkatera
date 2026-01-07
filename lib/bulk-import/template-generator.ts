export function downloadTemplateAsCSV() {
  const csv = `Company Name,Company Description,Products,Ingredients,Packaging
Example Company,An example company,Product 1,Water; Sugar,Glass Bottle
`;

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'import-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

export function createGoogleSheetsTemplate() {
  const url = 'https://docs.google.com/spreadsheets/create'
  window.open(url, '_blank')
}
