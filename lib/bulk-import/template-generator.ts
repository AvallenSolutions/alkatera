'use client';

export interface TemplateData {
  companySheet: CompanyRowData[];
  productsSheet: ProductRowData[];
  instructionsSheet: string;
}

export interface CompanyRowData {
  'Company Name': string;
  'Registration Number': string;
  'Headquarters Location': string;
  'Website': string;
  'Primary Contact Name': string;
  'Email': string;
  'Phone': string;
  'Business Type': string;
  'Company Size': string;
  'Sustainability Goals': string;
  'Operational Regions': string;
  'Certifications': string;
  'Notes': string;
}

export interface ProductRowData {
  'Product Name': string;
  'SKU': string;
  'Category': string;
  'Unit Size (Value)': string;
  'Unit Size (Unit)': string;
  'Description': string;
  [key: string]: string;
}

const PRODUCT_CATEGORIES = [
  'Gin', 'Vodka', 'Rum', 'Whisky', 'Tequila', 'Mezcal', 'Brandy', 'Liqueur',
  'Bourbon', 'Rye Whiskey', 'Calvados', 'Baijiu', 'Aquavit',
  'Lager', 'Ale', 'IPA', 'Stout & Porter', 'Wheat Beer', 'Sour Beer',
  'Cider', 'Perry',
  'Red Wine', 'White Wine', 'Rosé', 'Sparkling Wine', 'Fortified Wine', 'Natural Wine',
  'Spirit-based RTD', 'Wine-based RTD', 'Canned Cocktail', 'Bottled Cocktail',
  'Hard Seltzer', 'Hard Kombucha', 'Alcopop',
  'Carbonated Soft Drink', 'Still Soft Drink', 'Energy Drink', 'Sports Drink',
  '100% Juice', 'Juice Drink', 'Smoothie',
  'Still Water', 'Sparkling Water', 'Flavoured Water',
  'Functional Beverage', 'Plant-based Milk', 'Coffee Drink', 'Tea Drink',
  'Kombucha (Non-Alcoholic)', 'Non-Alcoholic Spirit', 'Non-Alcoholic Liqueur',
  'Non-Alcoholic Beer', 'Non-Alcoholic Wine', 'Non-Alcoholic Cider'
];

const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-250', '251-1000', '1000+'];

const UNIT_OPTIONS = ['ml', 'L', 'g', 'kg', 'unit'];

const PACKAGING_CATEGORIES = ['Container', 'Label', 'Closure', 'Secondary'];

const PACKAGING_MATERIALS = [
  'Glass', 'Plastic (PET)', 'Aluminium', 'Cardboard', 'Paper',
  'Biodegradable', 'Recycled', 'Steel', 'Polypropylene (PP)', 'Polyethylene (PE)'
];

function csvEscape(value: string | null): string {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function createDataValidationComment(field: string): string {
  const validations: Record<string, string[]> = {
    'Category': PRODUCT_CATEGORIES,
    'Company Size': COMPANY_SIZE_OPTIONS,
    'Unit Size (Unit)': UNIT_OPTIONS,
    'Ingredient Unit 1': UNIT_OPTIONS,
    'Ingredient Unit 2': UNIT_OPTIONS,
    'Ingredient Unit 3': UNIT_OPTIONS,
    'Packaging Type': PACKAGING_TYPES,
    'Packaging Material': PACKAGING_MATERIALS,
  };

  if (validations[field]) {
    return `Valid options: ${validations[field].join(', ')}`;
  }
  return '';
}

export function generateTemplateCSV(): string {
  const instructions = `# COMPANY DATA IMPORT TEMPLATE
# Instructions for completing this template:
# 1. Fill out the company information sheet first
# 2. Complete the products sheet with your product details
# 3. For each product, list ingredients and packaging information
# 4. Upload the file to import data into the system
# 5. Review and confirm the data before finalizing

INSTRUCTIONS SHEET
================
This template helps you bulk import company and product data.

HOW TO USE:
1. Save this file as an Excel (.xlsx) or CSV file
2. Complete all sheets (Company, Products)
3. Use the dropdown options where provided
4. Leave optional fields blank if not applicable
5. Upload the completed file to the import page

FIELD DESCRIPTIONS:

COMPANY SHEET:
- Company Name: Your company's legal name (required)
- Registration Number: Business registration/company number
- Headquarters Location: City and country
- Website: Your company website URL
- Primary Contact Name: Name of the main contact person
- Email: Contact email address
- Phone: Contact phone number
- Business Type: Manufacturing, Distribution, etc.
- Company Size: Select from provided options
- Sustainability Goals: Your sustainability targets
- Operational Regions: Countries/regions where you operate
- Certifications: ISO, B Corp, Fair Trade, etc.

PRODUCTS SHEET:
- Product Name: Your product name (required)
- SKU: Stock keeping unit/product code
- Category: Select from provided list
- Unit Size: The package size (e.g., 750 for a 750ml bottle)
- Description: Product description
- Ingredients: List key ingredients with quantities
- Packaging: Primary packaging details

All fields are optional except Product Name. You don't need to complete every field.

================

Company Name,Registration Number,Headquarters Location,Website,Primary Contact Name,Email,Phone,Business Type,Company Size,Sustainability Goals,Operational Regions,Certifications,Notes
Example Company Ltd,REG123456,London - United Kingdom,www.example.com,John Smith,john@example.com,+44 20 7946 0958,Manufacturing,51-250,Net zero by 2030,UK/EU,ISO 14001,Sample entry

---PRODUCT DATA SHEET---

Product Name,SKU,Category,Unit Size (Value),Unit Size (Unit),Description,Ingredient Name 1,Ingredient Qty 1,Ingredient Unit 1,Ingredient Name 2,Ingredient Qty 2,Ingredient Unit 2,Ingredient Name 3,Ingredient Qty 3,Ingredient Unit 3,Packaging Type,Packaging Material,Packaging Weight,Reusable
Premium Gin,GIN-001,Gin,750,ml,Classic London Dry style gin,Juniper,45,g,Coriander,12,g,Angelica,8,g,Glass Bottle,Glass,500,No
Craft Lager,BEER-001,Lager,500,ml,Full-bodied craft lager,Malted Barley,200,g,Hops,15,g,Yeast,10,g,Aluminium Can,Aluminium,35,Yes
`;

  return instructions;
}

export function generateProductsCSVHeaders(): string {
  const headers = [
    'Product Name',
    'SKU',
    'Category',
    'Unit Size (Value)',
    'Unit Size (Unit)',
    'Description',
    'Ingredient Name 1',
    'Ingredient Qty 1',
    'Ingredient Unit 1',
    'Ingredient Name 2',
    'Ingredient Qty 2',
    'Ingredient Unit 2',
    'Ingredient Name 3',
    'Ingredient Qty 3',
    'Ingredient Unit 3',
    'Packaging Type',
    'Packaging Material',
    'Packaging Weight',
    'Reusable',
  ];

  return headers.map(h => csvEscape(h)).join(',') + '\n';
}

export function generateCompanyCSVHeaders(): string {
  const headers = [
    'Company Name',
    'Registration Number',
    'Headquarters Location',
    'Website',
    'Primary Contact Name',
    'Email',
    'Phone',
    'Business Type',
    'Company Size',
    'Sustainability Goals',
    'Operational Regions',
    'Certifications',
    'Notes',
  ];

  return headers.map(h => csvEscape(h)).join(',') + '\n';
}

export function downloadTemplateAsCSV(): void {
  const csv = generateTemplateCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'product_data_template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export function getValidationOptions(fieldName: string): string[] {
  const validations: Record<string, string[]> = {
    'Category': PRODUCT_CATEGORIES,
    'Company Size': COMPANY_SIZE_OPTIONS,
    'Unit Size (Unit)': UNIT_OPTIONS,
    'Packaging Category': PACKAGING_CATEGORIES,
    'Packaging Material': PACKAGING_MATERIALS,
  };

  if (fieldName.match(/Ingredient Unit \d+/)) {
    return UNIT_OPTIONS;
  }

  return validations[fieldName] || [];
}

function generateProductHeaders(): string[] {
  const headers = [
    'Product Name*',
    'SKU',
    'Category',
    'Unit Size (Value)',
    'Unit Size (Unit)',
    'Description',
  ];

  for (let i = 1; i <= 20; i++) {
    headers.push(`Ingredient Name ${i}`);
    headers.push(`Ingredient Qty ${i}`);
    headers.push(`Ingredient Unit ${i}`);
  }

  headers.push(
    'Packaging Category (Container)',
    'Packaging Material (Container)',
    'Packaging Weight (Container)',
    'Packaging Category (Label)',
    'Packaging Material (Label)',
    'Packaging Weight (Label)',
    'Packaging Category (Closure)',
    'Packaging Material (Closure)',
    'Packaging Weight (Closure)',
    'Packaging Category (Secondary)',
    'Packaging Material (Secondary)',
    'Packaging Weight (Secondary)',
    'Reusable (Yes/No)'
  );

  return headers;
}

function generateProductSampleRow(): string[] {
  const row = [
    'Premium Gin',
    'GIN-001',
    'Gin',
    '750',
    'ml',
    'Classic London Dry gin with botanical infusions',
  ];

  for (let i = 1; i <= 20; i++) {
    if (i === 1) {
      row.push('Juniper berries', '45', 'g');
    } else if (i === 2) {
      row.push('Coriander seeds', '12', 'g');
    } else if (i === 3) {
      row.push('Angelica root', '8', 'g');
    } else {
      row.push('', '', '');
    }
  }

  row.push(
    'Container',
    'Glass',
    '500',
    'Label',
    'Paper',
    '50',
    'Closure',
    'Steel',
    '25',
    'Secondary',
    'Cardboard',
    '100',
    'No'
  );

  return row;
}

export function createGoogleSheetsTemplate(): {
  title: string;
  instructions: string;
  sheets: Array<{
    name: string;
    headers: string[];
    sampleRow: string[];
    notes: string;
  }>;
} {
  return {
    title: 'Product Data Import Template',
    instructions: 'Complete the company and product information below. Use dropdowns where provided. Optional fields can be left blank.',
    sheets: [
      {
        name: 'Instructions',
        headers: [],
        sampleRow: [],
        notes: `
INSTRUCTIONS FOR USING THIS TEMPLATE

1. COMPANY SHEET: Enter your company information
   - Only "Company Name" is required
   - Leave other fields blank if not applicable
   - Complete once per upload

2. PRODUCTS SHEET: Add your products
   - Enter one product per row
   - List up to 20 ingredients per product
   - Define packaging by category: Container, Label, Closure, Secondary
   - Each packaging category has its own material and weight fields

3. INGREDIENTS:
   - Fill in Ingredient Name, Quantity, and Unit
   - Leave blank for unused ingredient slots (up to 20 available)
   - Units: ml, L, g, kg, or unit

4. PACKAGING BREAKDOWN:
   - Container: Primary packaging (e.g., bottle, can)
   - Label: Label material and weight
   - Closure: Cap, cork, or closure mechanism
   - Secondary: Outer packaging (e.g., box, carton)
   - Fill only the categories you use

5. DATA VALIDATION:
   - Category: Select from beverage category list
   - Company Size: Use provided options
   - Packaging Categories: Container, Label, Closure, Secondary
   - Packaging Materials: Glass, Plastic, Aluminium, etc.

6. WHEN READY:
   - Download or export as Excel
   - Upload to the import page
   - Review the preview before confirming

OPTIONAL FIELDS:
You don't need to complete all fields. The system will guide you
to add missing information after the initial import.
        `
      },
      {
        name: 'Company',
        headers: [
          'Company Name*',
          'Registration Number',
          'Headquarters Location',
          'Website',
          'Primary Contact Name',
          'Email',
          'Phone',
          'Business Type',
          'Company Size',
          'Sustainability Goals',
          'Operational Regions',
          'Certifications',
          'Notes',
        ],
        sampleRow: [
          'Your Company Ltd',
          'REG123456',
          'London - United Kingdom',
          'www.example.com',
          'Jane Doe',
          'jane@company.com',
          '+44 20 7946 0958',
          'Manufacturing',
          '51-250',
          'Net zero by 2030',
          'UK, EU, US',
          'ISO 14001, B Corp',
          'Family business since 1980',
        ],
        notes: 'Enter your company information. Only "Company Name" is required.'
      },
      {
        name: 'Products',
        headers: generateProductHeaders(),
        sampleRow: generateProductSampleRow(),
        notes: 'Add one product per row. Leave ingredient fields blank if not needed. All fields optional except product name.'
      }
    ]
  };
}
