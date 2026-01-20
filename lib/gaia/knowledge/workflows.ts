// Gaia Knowledge Base - Common Workflows
// Step-by-step guides for data entry and platform navigation
//
// IMPORTANT: Never refer to Gaia as "AI" or "AI agent" in any user-facing text.
// Use "digital assistant", "sustainability guide", or simply "Gaia".

export interface WorkflowStep {
  instruction: string;
  tip?: string;
  navPath?: string;
}

export interface Workflow {
  id: string;
  title: string;
  description: string;
  estimatedTime: string;
  steps: WorkflowStep[];
  tips: string[];
  relatedWorkflows?: string[];
}

/**
 * Common workflows for drinks industry sustainability tracking
 */
export const COMMON_WORKFLOWS: Record<string, Workflow> = {
  ADD_PRODUCT: {
    id: 'add_product',
    title: 'Adding a Product',
    description: 'Create a new product in your catalog',
    estimatedTime: '1-2 minutes',
    steps: [
      {
        instruction: 'Go to **Products** in the sidebar',
        navPath: '/products',
      },
      {
        instruction: 'Click the **"Add New Product"** button',
        navPath: '/products/new',
      },
      {
        instruction: 'Enter the product name (e.g., "Oxford Rye Whisky 50cl")',
        tip: 'Include the size/volume in the name for easy identification',
      },
      {
        instruction: 'Select category (Beer/Spirits/Wine/Cider/RTD)',
      },
      {
        instruction: 'Select sub-category (e.g., Whisky, Lager, Red Wine)',
      },
      {
        instruction: 'Upload a product image (optional but recommended)',
        tip: 'Product images help you recognize products quickly in lists',
      },
      {
        instruction: 'Add a description (optional)',
      },
      {
        instruction: 'Click **"Create Product"**',
      },
    ],
    tips: [
      'Start with just basic info - you can complete details later',
      'Product images help you recognize products quickly',
      'You can bulk import products from CSV if you have many',
      "Don't worry about ingredients and packaging yet - add those when you're ready",
    ],
    relatedWorkflows: ['ADD_INGREDIENTS', 'ADD_PACKAGING', 'COMPLETE_PRODUCT_LCA'],
  },

  ADD_FACILITY: {
    id: 'add_facility',
    title: 'Adding a Facility',
    description: 'Add a production site, office, or warehouse',
    estimatedTime: '2-3 minutes',
    steps: [
      {
        instruction: 'Go to **Company > Facilities**',
        navPath: '/company/facilities',
      },
      {
        instruction: 'Click **"Add New Facility"**',
        navPath: '/company/facilities/new',
      },
      {
        instruction: 'Enter the facility name (e.g., "Edinburgh Distillery")',
      },
      {
        instruction: 'Start typing the address (uses OpenStreetMap autocomplete)',
        tip: 'The address helps us identify local water stress levels automatically',
      },
      {
        instruction: 'Select the facility type (Distillery/Brewery/Winery/Bottling/Office/Warehouse)',
      },
      {
        instruction: 'Add facility size in square metres if known (optional)',
        tip: 'Facility size helps with energy intensity calculations',
      },
      {
        instruction: 'Click **"Create Facility"**',
      },
    ],
    tips: [
      'Include all locations: production sites, offices, warehouses',
      "Don't forget contract partners - they count toward Scope 3",
      'You can add utility data after creating the facility',
      'The address helps calculate water stress risk for your location',
    ],
    relatedWorkflows: ['ADD_UTILITY_DATA', 'ADD_WATER_DATA'],
  },

  ADD_UTILITY_DATA: {
    id: 'add_utility_data',
    title: 'Adding Utility Data',
    description: 'Track electricity, gas, and other utilities',
    estimatedTime: '5-10 minutes (depends on data availability)',
    steps: [
      {
        instruction: 'Gather your utility bills first (electricity, gas, water)',
        tip: 'Monthly bills are ideal, but quarterly or annual works too',
      },
      {
        instruction: 'Go to **Company > Facilities**',
        navPath: '/company/facilities',
      },
      {
        instruction: 'Click on the facility you want to update',
      },
      {
        instruction: 'Go to the **"Utilities"** tab',
      },
      {
        instruction: 'Click **"Add Data"** for each utility type',
      },
      {
        instruction: 'Enter consumption amount and units (kWh, m³, etc.)',
        tip: 'Look for "Total Consumption" or "Total Usage" on your bill',
      },
      {
        instruction: 'Select the billing period (month, quarter, year)',
      },
      {
        instruction: 'Click **"Save"**',
      },
    ],
    tips: [
      'Monthly data is best for tracking trends',
      "If you don't have exact numbers, estimates are better than nothing",
      'Electricity is typically measured in kWh or MWh',
      'Gas is typically measured in kWh, therms, or m³',
      'Check your email for electronic bills if you can\'t find paper copies',
    ],
    relatedWorkflows: ['ADD_FACILITY', 'ADD_WATER_DATA'],
  },

  ADD_WATER_DATA: {
    id: 'add_water_data',
    title: 'Adding Water Data',
    description: 'Track water consumption at your facilities',
    estimatedTime: '3-5 minutes',
    steps: [
      {
        instruction: 'Gather your water bills or meter readings',
      },
      {
        instruction: 'Go to **Company > Facilities**',
        navPath: '/company/facilities',
      },
      {
        instruction: 'Click on the facility',
      },
      {
        instruction: 'Go to the **"Water"** tab',
      },
      {
        instruction: 'Click **"Add Water Data"**',
      },
      {
        instruction: 'Enter consumption in cubic metres (m³) or litres',
        tip: 'For drinks producers: brewing typically uses 3-7 litres water per litre of beer',
      },
      {
        instruction: 'Select the time period',
      },
      {
        instruction: 'Click **"Save"**',
      },
    ],
    tips: [
      'Water is typically measured in cubic metres (m³) on utility bills',
      '1 cubic metre = 1,000 litres',
      'Include process water, cleaning water, and cooling water',
      'Breweries typically use 3-7 litres of water per litre of beer produced',
      'Distilleries may use 10-20 litres of water per litre of spirit',
    ],
    relatedWorkflows: ['ADD_FACILITY', 'ADD_UTILITY_DATA'],
  },

  ADD_INGREDIENTS: {
    id: 'add_ingredients',
    title: 'Adding Product Ingredients',
    description: 'Define ingredients for accurate LCA calculations',
    estimatedTime: '5-10 minutes per product',
    steps: [
      {
        instruction: 'Go to **Products**',
        navPath: '/products',
      },
      {
        instruction: 'Click on the product you want to update',
      },
      {
        instruction: 'Go to the **"Ingredients"** tab',
      },
      {
        instruction: 'Click **"Add Ingredient"**',
      },
      {
        instruction: 'Search for the ingredient (e.g., "Barley malt")',
        tip: 'Our database has emission factors for common drinks industry ingredients',
      },
      {
        instruction: 'Enter the quantity per unit of product',
      },
      {
        instruction: 'Select the unit (kg, litres, etc.)',
      },
      {
        instruction: 'Add supplier/source if known (optional, but improves accuracy)',
      },
      {
        instruction: 'Click **"Save"** and repeat for all ingredients',
      },
    ],
    tips: [
      'Include all raw materials that go into your product',
      'For spirits: grain, yeast, botanicals, water additives',
      'For beer: malt, hops, yeast, water treatment chemicals, adjuncts',
      'For wine: grapes, yeast, sulphites, fining agents',
      'Processing aids count too (CO2 for carbonation, filtering materials)',
    ],
    relatedWorkflows: ['ADD_PRODUCT', 'ADD_PACKAGING', 'COMPLETE_PRODUCT_LCA'],
  },

  ADD_PACKAGING: {
    id: 'add_packaging',
    title: 'Adding Product Packaging',
    description: 'Define packaging components for carbon footprint calculation',
    estimatedTime: '5-10 minutes per product',
    steps: [
      {
        instruction: 'Go to **Products**',
        navPath: '/products',
      },
      {
        instruction: 'Click on the product you want to update',
      },
      {
        instruction: 'Go to the **"Packaging"** tab',
      },
      {
        instruction: 'Click **"Add Component"**',
      },
      {
        instruction: 'Select the component type (Bottle, Can, Cap, Label, Box, etc.)',
      },
      {
        instruction: 'Select the material (Glass, Aluminium, Steel, Paper, Plastic, etc.)',
      },
      {
        instruction: 'Enter the weight in grams',
        tip: 'Weigh an empty component on a kitchen scale for accuracy',
      },
      {
        instruction: 'Add recycled content percentage if known (reduces footprint!)',
      },
      {
        instruction: 'Click **"Save"** and repeat for all components',
      },
    ],
    tips: [
      'Include everything: bottle/can, closure, label, secondary packaging (boxes, trays)',
      'Glass bottles are typically 300-600g depending on size and style',
      '330ml aluminium cans are typically 12-15g',
      'Labels are usually 1-5g',
      'Cardboard boxes for multipacks count toward your footprint',
      'Recycled content significantly reduces packaging footprint',
    ],
    relatedWorkflows: ['ADD_PRODUCT', 'ADD_INGREDIENTS', 'COMPLETE_PRODUCT_LCA'],
  },

  COMPLETE_PRODUCT_LCA: {
    id: 'complete_product_lca',
    title: 'Completing a Product LCA',
    description: 'Calculate the full carbon footprint of your product',
    estimatedTime: '10-15 minutes (with ingredients and packaging ready)',
    steps: [
      {
        instruction: 'Ensure ingredients are complete (see "Adding Product Ingredients")',
      },
      {
        instruction: 'Ensure packaging is complete (see "Adding Product Packaging")',
      },
      {
        instruction: 'Go to **Products**',
        navPath: '/products',
      },
      {
        instruction: 'Click on the product',
      },
      {
        instruction: 'Review the **"Overview"** tab to check data completeness',
        tip: 'Look for the completeness indicator - aim for 80%+ before calculating',
      },
      {
        instruction: 'Go to the **"LCA"** tab',
      },
      {
        instruction: 'Click **"Calculate LCA"** button',
      },
      {
        instruction: 'Review the carbon footprint breakdown',
        tip: 'Raw materials and packaging typically make up 70-80% of a drinks product footprint',
      },
      {
        instruction: 'Check the results make sense - typical spirits are 2-5 kg CO2e per 70cl bottle',
      },
    ],
    tips: [
      'Be as accurate as possible - this affects your total corporate footprint',
      'You can save progress and come back later',
      'Our database has emission factors for common materials',
      'Typical beer: 0.3-0.8 kg CO2e per 330ml can',
      'Typical spirits: 2-5 kg CO2e per 70cl bottle',
      'Typical wine: 1-2 kg CO2e per 75cl bottle',
    ],
    relatedWorkflows: ['ADD_INGREDIENTS', 'ADD_PACKAGING'],
  },

  ADD_FLEET_VEHICLE: {
    id: 'add_fleet_vehicle',
    title: 'Adding a Fleet Vehicle',
    description: 'Track your company vehicles for Scope 1 emissions',
    estimatedTime: '2-3 minutes',
    steps: [
      {
        instruction: 'Go to **Company > Fleet**',
        navPath: '/company/fleet',
      },
      {
        instruction: 'Click **"Add Vehicle"**',
      },
      {
        instruction: 'Enter the vehicle registration',
      },
      {
        instruction: 'Select the vehicle type (Car, Van, HGV, etc.)',
      },
      {
        instruction: 'Select the fuel type (Petrol, Diesel, Electric, Hybrid)',
      },
      {
        instruction: 'Add engine size or battery capacity if known',
      },
      {
        instruction: 'Click **"Save"**',
      },
    ],
    tips: [
      'Include all company-owned vehicles',
      'Delivery vans often have the biggest fleet footprint for drinks producers',
      'Electric vehicles have zero Scope 1 emissions (electricity is Scope 2)',
      'You can add mileage data after creating the vehicle',
    ],
    relatedWorkflows: ['ADD_FLEET_ACTIVITY'],
  },

  ADD_FLEET_ACTIVITY: {
    id: 'add_fleet_activity',
    title: 'Adding Fleet Activity (Mileage)',
    description: 'Log vehicle journeys and fuel consumption',
    estimatedTime: '2-5 minutes',
    steps: [
      {
        instruction: 'Go to **Company > Fleet**',
        navPath: '/company/fleet',
      },
      {
        instruction: 'Click on the vehicle',
      },
      {
        instruction: 'Go to the **"Activity"** tab',
      },
      {
        instruction: 'Click **"Add Journey"** or **"Add Activity"**',
      },
      {
        instruction: 'Enter the date or date range',
      },
      {
        instruction: 'Enter distance in miles or kilometres',
      },
      {
        instruction: 'Enter fuel consumed in litres (if known)',
        tip: 'Fuel receipts or fuel card data work great here',
      },
      {
        instruction: 'Click **"Save"**',
      },
    ],
    tips: [
      'Monthly summaries work well if you have fleet cards',
      'You can enter either distance, fuel, or both',
      "If you only have fuel receipts, that's enough to calculate emissions",
      'Delivery routes for drinks distribution often accumulate significant mileage',
    ],
    relatedWorkflows: ['ADD_FLEET_VEHICLE'],
  },

  ADD_SUPPLIER: {
    id: 'add_supplier',
    title: 'Adding a Supplier',
    description: 'Track your supply chain for Scope 3 emissions',
    estimatedTime: '3-5 minutes',
    steps: [
      {
        instruction: 'Go to **Suppliers**',
        navPath: '/suppliers',
      },
      {
        instruction: 'Click **"Add Supplier"**',
      },
      {
        instruction: 'Enter the supplier name',
      },
      {
        instruction: 'Select the category (Ingredients, Packaging, Services, etc.)',
      },
      {
        instruction: 'Add contact details (optional but helpful)',
      },
      {
        instruction: 'Add location/country (helps with transport calculations)',
      },
      {
        instruction: 'Click **"Save"**',
      },
    ],
    tips: [
      'Start with your biggest suppliers by spend',
      'Ingredient and packaging suppliers typically have the biggest Scope 3 impact',
      "Don't forget contract manufacturers or co-packers",
      'You can invite suppliers to share their emissions data directly',
    ],
    relatedWorkflows: ['ADD_INGREDIENTS', 'ADD_PACKAGING'],
  },

  GENERATE_REPORT: {
    id: 'generate_report',
    title: 'Generating a Sustainability Report',
    description: 'Create professional reports to share with stakeholders',
    estimatedTime: '5-10 minutes',
    steps: [
      {
        instruction: 'Make sure you have complete data for the reporting period',
        tip: 'Check your Dashboard for any data gaps or warnings',
      },
      {
        instruction: 'Go to **Dashboard**',
        navPath: '/dashboard',
      },
      {
        instruction: 'Click **"Generate Report"** button',
      },
      {
        instruction: 'Select report type (Annual/Quarterly/Custom)',
      },
      {
        instruction: 'Select the date range',
      },
      {
        instruction: 'Choose sections to include',
      },
      {
        instruction: 'Click **"Generate"**',
      },
      {
        instruction: 'Review the report preview',
      },
      {
        instruction: 'Download as PDF or share via link',
      },
    ],
    tips: [
      'More complete data = better reports',
      'You can customize which sections to include',
      'Reports are professional-quality and ready to share with customers',
      'Annual reports align well with B Corp or sustainability certifications',
    ],
    relatedWorkflows: ['COMPLETE_PRODUCT_LCA', 'ADD_UTILITY_DATA'],
  },
};

/**
 * Get a workflow by ID
 */
export function getWorkflow(workflowId: string): Workflow | null {
  const key = workflowId.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return COMMON_WORKFLOWS[key] || null;
}

/**
 * Get workflow by searching title or description
 */
export function findWorkflow(searchTerm: string): Workflow | null {
  const term = searchTerm.toLowerCase();

  // Direct key match
  const directMatch = getWorkflow(searchTerm);
  if (directMatch) return directMatch;

  // Search by title and description
  for (const workflow of Object.values(COMMON_WORKFLOWS)) {
    if (
      workflow.title.toLowerCase().includes(term) ||
      workflow.description.toLowerCase().includes(term)
    ) {
      return workflow;
    }
  }

  // Common phrase matches
  const phraseMap: Record<string, string> = {
    'add product': 'ADD_PRODUCT',
    'new product': 'ADD_PRODUCT',
    'create product': 'ADD_PRODUCT',
    'add facility': 'ADD_FACILITY',
    'new facility': 'ADD_FACILITY',
    'utility data': 'ADD_UTILITY_DATA',
    'electricity': 'ADD_UTILITY_DATA',
    'gas data': 'ADD_UTILITY_DATA',
    'water data': 'ADD_WATER_DATA',
    'ingredients': 'ADD_INGREDIENTS',
    'packaging': 'ADD_PACKAGING',
    'lca': 'COMPLETE_PRODUCT_LCA',
    'carbon footprint': 'COMPLETE_PRODUCT_LCA',
    'vehicle': 'ADD_FLEET_VEHICLE',
    'fleet': 'ADD_FLEET_VEHICLE',
    'mileage': 'ADD_FLEET_ACTIVITY',
    'supplier': 'ADD_SUPPLIER',
    'report': 'GENERATE_REPORT',
  };

  for (const [phrase, workflowKey] of Object.entries(phraseMap)) {
    if (term.includes(phrase)) {
      return COMMON_WORKFLOWS[workflowKey];
    }
  }

  return null;
}

/**
 * Get all workflows
 */
export function getAllWorkflows(): Workflow[] {
  return Object.values(COMMON_WORKFLOWS);
}

/**
 * Format a workflow as step-by-step instructions for Gaia
 */
export function formatWorkflowSteps(workflow: Workflow): string {
  const lines: string[] = [];

  lines.push(`**${workflow.title}**`);
  lines.push(`*Estimated time: ${workflow.estimatedTime}*`);
  lines.push('');
  lines.push('Here\'s what to do:');
  lines.push('');

  workflow.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.instruction}`);
    if (step.tip) {
      lines.push(`   *Tip: ${step.tip}*`);
    }
  });

  if (workflow.tips.length > 0) {
    lines.push('');
    lines.push('**Helpful tips:**');
    workflow.tips.slice(0, 3).forEach((tip) => {
      lines.push(`- ${tip}`);
    });
  }

  return lines.join('\n');
}

export default {
  COMMON_WORKFLOWS,
  getWorkflow,
  findWorkflow,
  getAllWorkflows,
  formatWorkflowSteps,
};
