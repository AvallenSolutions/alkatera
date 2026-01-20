// Data Gap Response Templates for Gaia
// Provides helpful guidance when Gaia doesn't have the data to answer a question

import type { DataAvailability } from './data-availability';

export interface ActionButton {
  label: string;
  action: 'navigate' | 'explain' | 'suggest';
  target?: string; // URL path or action identifier
  icon?: string;
}

export interface DataGapResponse {
  message: string;
  actionButtons: ActionButton[];
  helpfulSuggestions: string[];
  missingDataType: string;
}

// Templates for different missing data types
const DATA_GAP_TEMPLATES: Record<string, Omit<DataGapResponse, 'missingDataType'>> = {
  carbon_footprint: {
    message: `I don't have your total carbon footprint data yet. Here's how to get started:

1. Navigate to **Dashboard > Company Vitality**
2. Complete your emissions data:
   - **Scope 1**: Direct emissions (company vehicles, facilities)
   - **Scope 2**: Indirect emissions (purchased electricity)
   - **Scope 3**: Value chain emissions (suppliers, transportation)
3. Once entered, I'll be able to track trends and provide insights

Would you like me to:`,
    actionButtons: [
      {
        label: 'Go to Company Vitality',
        action: 'navigate',
        target: '/vitality',
        icon: 'bar-chart',
      },
      {
        label: 'Explain Carbon Scopes',
        action: 'explain',
        target: 'carbon_scopes',
        icon: 'help-circle',
      },
      {
        label: 'Show Available Data',
        action: 'suggest',
        icon: 'database',
      },
    ],
    helpfulSuggestions: [
      'What sustainability data do I already have?',
      'How do I calculate Scope 1 emissions?',
      'What are the typical emission sources for my industry?',
    ],
  },

  facility_water: {
    message: `I don't have facility-specific water usage data yet. To enable this insight:

1. Go to **Facilities Management**
2. Add your facilities (if not already listed)
3. Input monthly water usage data for each facility
4. I'll then be able to identify high-usage locations and trends

**Pro tip:** You can bulk upload facility data via CSV import.

Would you like me to:`,
    actionButtons: [
      {
        label: 'Go to Facilities',
        action: 'navigate',
        target: '/facilities',
        icon: 'building',
      },
      {
        label: 'See CSV Template',
        action: 'navigate',
        target: '/facilities?tab=import',
        icon: 'file-spreadsheet',
      },
      {
        label: 'Show Water Data I Have',
        action: 'suggest',
        icon: 'droplet',
      },
    ],
    helpfulSuggestions: [
      'What is my total water footprint from products?',
      'How should I track facility water usage?',
      'What are water intensity benchmarks for my industry?',
    ],
  },

  facilities: {
    message: `I don't have any facility information yet. Your facilities are important for tracking:

- Energy consumption
- Water usage
- Waste generation
- Scope 1 & 2 emissions

To get started:

1. Navigate to **Company > Facilities**
2. Add your physical locations (offices, warehouses, factories)
3. Enter activity data for each facility

Would you like me to:`,
    actionButtons: [
      {
        label: 'Add Facilities',
        action: 'navigate',
        target: '/facilities/new',
        icon: 'plus',
      },
      {
        label: 'Learn About Facility Tracking',
        action: 'explain',
        target: 'facility_tracking',
        icon: 'book',
      },
    ],
    helpfulSuggestions: [
      'What data should I collect for each facility?',
      'How do I estimate facility emissions?',
      'What is the most important facility data to track?',
    ],
  },

  suppliers: {
    message: `I don't have supplier information yet. Your supply chain is a key part of your sustainability footprint (often 70%+ of total emissions). To get started:

1. Navigate to **Suppliers Management**
2. Add your key suppliers
3. Request sustainability data from suppliers or estimate based on spend
4. Track supplier engagement and performance over time

Would you like me to:`,
    actionButtons: [
      {
        label: 'Go to Suppliers',
        action: 'navigate',
        target: '/suppliers',
        icon: 'users',
      },
      {
        label: 'Learn About Supplier Engagement',
        action: 'explain',
        target: 'supplier_engagement',
        icon: 'handshake',
      },
      {
        label: 'Show My Scope 3 Data',
        action: 'suggest',
        icon: 'package',
      },
    ],
    helpfulSuggestions: [
      'How do I engage suppliers on sustainability?',
      'What Scope 3 data can I estimate without supplier inputs?',
      'Show me my product supply chain impacts',
    ],
  },

  product_lca: {
    message: `I don't have product Life Cycle Assessment (LCA) data yet. LCAs help you understand the environmental impact of your products from cradle to grave.

To create product LCAs:

1. Go to **Products** and select a product
2. Click **Create LCA** or use our LCA calculator
3. Enter material composition, manufacturing processes, and packaging
4. The system will calculate environmental impacts automatically

Would you like me to:`,
    actionButtons: [
      {
        label: 'Go to Products',
        action: 'navigate',
        target: '/products',
        icon: 'box',
      },
      {
        label: 'Learn About LCAs',
        action: 'explain',
        target: 'lca_basics',
        icon: 'book',
      },
      {
        label: 'See Products Without LCAs',
        action: 'suggest',
        icon: 'alert-circle',
      },
    ],
    helpfulSuggestions: [
      'What is a Life Cycle Assessment?',
      'Which products should I prioritize for LCA?',
      'How accurate are product carbon footprint calculations?',
    ],
  },

  scope3: {
    message: `I don't have Scope 3 emissions data yet. Scope 3 covers all indirect emissions in your value chain and typically represents the largest portion of your carbon footprint.

Key Scope 3 categories include:
- **Purchased goods & services** (often the largest)
- **Business travel**
- **Employee commuting**
- **Upstream transportation**
- **Waste disposal**

To track Scope 3:

1. Add supplier data and spend information
2. Complete product LCAs for purchased materials
3. Track business travel and commuting
4. Log corporate overhead expenses

Would you like me to:`,
    actionButtons: [
      {
        label: 'Go to Suppliers',
        action: 'navigate',
        target: '/suppliers',
        icon: 'users',
      },
      {
        label: 'View Products',
        action: 'navigate',
        target: '/products',
        icon: 'box',
      },
      {
        label: 'Explain Scope 3 Categories',
        action: 'explain',
        target: 'scope3_categories',
        icon: 'help-circle',
      },
    ],
    helpfulSuggestions: [
      'What are the 15 Scope 3 categories?',
      'How do I estimate Scope 3 from spend data?',
      'Which Scope 3 categories should I prioritize?',
    ],
  },

  fleet: {
    message: `I don't have fleet data yet. If your organization operates vehicles, tracking fleet activity helps measure Scope 1 emissions from transportation.

To add fleet data:

1. Navigate to **Fleet Management**
2. Add your vehicles (company cars, trucks, vans)
3. Log trips with distance and fuel consumption
4. The system will calculate emissions automatically

Would you like me to:`,
    actionButtons: [
      {
        label: 'Go to Fleet',
        action: 'navigate',
        target: '/fleet',
        icon: 'truck',
      },
      {
        label: 'Learn About Fleet Tracking',
        action: 'explain',
        target: 'fleet_tracking',
        icon: 'book',
      },
    ],
    helpfulSuggestions: [
      'How do I calculate vehicle emissions?',
      'What fleet data should I track?',
      'How can I reduce fleet emissions?',
    ],
  },

  vitality_score: {
    message: `Your Vitality Score hasn't been calculated yet. The Vitality Score measures your overall sustainability performance across four pillars:

- **Climate**: Carbon footprint and emissions reduction
- **Water**: Water usage and efficiency
- **Circularity**: Waste reduction and recycling
- **Nature**: Biodiversity and ecosystem impact

To generate your Vitality Score:

1. Complete data entry for at least one pillar
2. The score will be calculated automatically
3. Track improvements over time

Would you like me to:`,
    actionButtons: [
      {
        label: 'Go to Company Vitality',
        action: 'navigate',
        target: '/vitality',
        icon: 'star',
      },
      {
        label: 'Explain Vitality Scoring',
        action: 'explain',
        target: 'vitality_scoring',
        icon: 'help-circle',
      },
    ],
    helpfulSuggestions: [
      'What data is needed for the Vitality Score?',
      'How is the Vitality Score calculated?',
      'What is a good Vitality Score?',
    ],
  },
};

// Generic fallback template
const GENERIC_DATA_GAP_TEMPLATE: Omit<DataGapResponse, 'missingDataType'> = {
  message: `I don't have the specific data needed to answer that question. Here's what you can do:

1. Check if the relevant data has been entered in AlkaTera
2. Navigate to the appropriate section to add missing data
3. Contact your admin if you need access to certain features

Would you like me to:`,
  actionButtons: [
    {
      label: 'View Dashboard',
      action: 'navigate',
      target: '/dashboard',
      icon: 'layout-dashboard',
    },
    {
      label: 'Show Available Data',
      action: 'suggest',
      icon: 'database',
    },
  ],
  helpfulSuggestions: [
    'What sustainability data do I already have?',
    'What data should I start tracking?',
    'How can I improve my data coverage?',
  ],
};

/**
 * Get appropriate data gap response based on missing data type
 */
export function getDataGapResponse(
  missingDataType: string,
  availability?: DataAvailability
): DataGapResponse {
  const template = DATA_GAP_TEMPLATES[missingDataType] || GENERIC_DATA_GAP_TEMPLATE;

  // If availability is provided, customize suggestions based on available data
  let customSuggestions = template.helpfulSuggestions;
  if (availability) {
    customSuggestions = generateAlternativeSuggestions(availability, missingDataType);
    if (customSuggestions.length === 0) {
      customSuggestions = template.helpfulSuggestions;
    }
  }

  return {
    ...template,
    helpfulSuggestions: customSuggestions,
    missingDataType,
  };
}

/**
 * Generate alternative suggestions based on what data IS available
 */
function generateAlternativeSuggestions(
  availability: DataAvailability,
  missingDataType: string
): string[] {
  const suggestions: string[] = [];

  // Suggest alternatives based on available data
  if (missingDataType === 'carbon_footprint') {
    if (availability.hasProductLCAs) {
      suggestions.push('Show me the carbon footprint of my products');
    }
    if (availability.hasFleetData) {
      suggestions.push('What are my fleet emissions?');
    }
  }

  if (missingDataType === 'facility_water') {
    if (availability.hasProductLCAs) {
      suggestions.push('What is the water usage across my product portfolio?');
    }
  }

  if (missingDataType === 'suppliers') {
    if (availability.hasScope3Data) {
      suggestions.push('What are my Scope 3 emissions estimates?');
    }
    if (availability.hasProductLCAs) {
      suggestions.push('Show me my product supply chain impacts');
    }
  }

  if (missingDataType === 'product_lca') {
    if (availability.productCount > 0) {
      suggestions.push('Which products are in my catalog?');
      suggestions.push('Which products need LCA calculations?');
    }
  }

  // Always add a general question
  suggestions.push('What sustainability data do I have available?');

  return suggestions.slice(0, 3);
}

/**
 * Detect data gap from AI response content
 */
export function detectDataGapFromResponse(content: string): string | null {
  const lowerContent = content.toLowerCase();

  // Pattern matching for missing data responses
  if (
    (lowerContent.includes('carbon footprint') || lowerContent.includes('total emissions')) &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('no data'))
  ) {
    return 'carbon_footprint';
  }

  if (
    lowerContent.includes('water') &&
    lowerContent.includes('facility') &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('no data'))
  ) {
    return 'facility_water';
  }

  if (
    lowerContent.includes('supplier') &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('no data'))
  ) {
    return 'suppliers';
  }

  if (
    (lowerContent.includes('lca') || lowerContent.includes('life cycle')) &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('no data'))
  ) {
    return 'product_lca';
  }

  if (
    lowerContent.includes('vitality score') &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('hasn\'t been calculated'))
  ) {
    return 'vitality_score';
  }

  if (
    lowerContent.includes('scope 3') &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('no data'))
  ) {
    return 'scope3';
  }

  if (
    lowerContent.includes('fleet') &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('no data'))
  ) {
    return 'fleet';
  }

  if (
    lowerContent.includes('facility') &&
    !lowerContent.includes('water') &&
    (lowerContent.includes("don't have") || lowerContent.includes('do not have') || lowerContent.includes('no data'))
  ) {
    return 'facilities';
  }

  return null;
}

/**
 * Check if response indicates a data gap that should be enhanced
 */
export function shouldEnhanceResponse(content: string): boolean {
  const lowerContent = content.toLowerCase();

  // Check for common "no data" patterns
  const noDataPatterns = [
    "i don't have",
    'i do not have',
    "i don't currently have",
    'no data available',
    'data is not available',
    'information is not available',
    "hasn't been",
    'has not been calculated',
    'not been entered',
    'missing data',
    'need to add',
    'please add',
  ];

  return noDataPatterns.some((pattern) => lowerContent.includes(pattern));
}
