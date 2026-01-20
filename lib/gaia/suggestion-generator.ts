// Smart Suggestion Generator for Gaia
// Generates intelligent, data-aware suggestions based on what data exists

import type { DataAvailability } from './data-availability';

export interface SmartSuggestion {
  question: string;
  category: string;
  icon: string;
  priority: number;
  requiresData: string[];
}

// All possible suggestions with their data requirements
const ALL_SUGGESTIONS: SmartSuggestion[] = [
  // Emissions-based suggestions
  {
    question: 'What is my total carbon footprint?',
    category: 'emissions',
    icon: 'cloud',
    priority: 100,
    requiresData: ['hasCarbonFootprintData'],
  },
  {
    question: 'Show me my emissions breakdown by scope',
    category: 'emissions',
    icon: 'pie-chart',
    priority: 95,
    requiresData: ['hasCarbonFootprintData'],
  },
  {
    question: 'How do my emissions compare to last year?',
    category: 'trends',
    icon: 'bar-chart',
    priority: 85,
    requiresData: ['hasCarbonFootprintData'],
  },

  // Product-based suggestions
  {
    question: 'What are the environmental impacts of my products?',
    category: 'products',
    icon: 'box',
    priority: 90,
    requiresData: ['hasProductLCAs'],
  },
  {
    question: 'Which products have the highest environmental impact?',
    category: 'products',
    icon: 'trending-up',
    priority: 88,
    requiresData: ['hasProductLCAs'],
  },
  {
    question: 'Which products use the most water?',
    category: 'products',
    icon: 'droplet',
    priority: 82,
    requiresData: ['hasProductLCAs', 'hasWaterData'],
  },
  {
    question: 'Which products still need LCA calculations?',
    category: 'products',
    icon: 'alert-circle',
    priority: 70,
    requiresData: [], // Always show if they have any products
  },

  // Facility-based suggestions
  {
    question: 'Which facilities use the most water?',
    category: 'facilities',
    icon: 'droplet',
    priority: 85,
    requiresData: ['hasFacilityData', 'hasWaterData'],
  },
  {
    question: 'What is the energy consumption at my facilities?',
    category: 'facilities',
    icon: 'zap',
    priority: 80,
    requiresData: ['hasFacilityData'],
  },
  {
    question: 'Which facilities have the highest emissions?',
    category: 'facilities',
    icon: 'factory',
    priority: 78,
    requiresData: ['hasFacilityData', 'hasCarbonFootprintData'],
  },

  // Supplier-based suggestions
  {
    question: 'Tell me about my supplier sustainability performance',
    category: 'suppliers',
    icon: 'users',
    priority: 75,
    requiresData: ['hasSupplierData'],
  },
  {
    question: 'What percentage of my suppliers have shared emissions data?',
    category: 'suppliers',
    icon: 'percent',
    priority: 72,
    requiresData: ['hasSupplierData'],
  },
  {
    question: 'Which suppliers should I prioritize for engagement?',
    category: 'suppliers',
    icon: 'target',
    priority: 70,
    requiresData: ['hasSupplierData'],
  },

  // Scope 3 suggestions
  {
    question: 'What are my Scope 3 emissions from purchased goods?',
    category: 'scope3',
    icon: 'package',
    priority: 85,
    requiresData: ['hasScope3Data'],
  },
  {
    question: 'What is my largest Scope 3 category?',
    category: 'scope3',
    icon: 'pie-chart',
    priority: 80,
    requiresData: ['hasScope3Data'],
  },

  // Fleet-based suggestions
  {
    question: 'What are my fleet emissions?',
    category: 'fleet',
    icon: 'truck',
    priority: 75,
    requiresData: ['hasFleetData'],
  },
  {
    question: 'Which vehicles have the highest fuel consumption?',
    category: 'fleet',
    icon: 'fuel',
    priority: 70,
    requiresData: ['hasFleetData'],
  },

  // Vitality score suggestions
  {
    question: 'How can I improve my Vitality Score?',
    category: 'vitality',
    icon: 'trending-up',
    priority: 90,
    requiresData: [], // Always available - general guidance
  },
  {
    question: 'What is my current Vitality Score breakdown?',
    category: 'vitality',
    icon: 'star',
    priority: 88,
    requiresData: ['vitalityScoreExists'],
  },
  {
    question: 'Which Vitality pillar needs the most improvement?',
    category: 'vitality',
    icon: 'target',
    priority: 85,
    requiresData: ['vitalityScoreExists'],
  },
];

// Onboarding suggestions for users with limited data
const ONBOARDING_SUGGESTIONS: SmartSuggestion[] = [
  {
    question: 'What sustainability data should I start tracking?',
    category: 'onboarding',
    icon: 'help-circle',
    priority: 100,
    requiresData: [],
  },
  {
    question: 'Guide me through setting up my sustainability metrics',
    category: 'onboarding',
    icon: 'compass',
    priority: 95,
    requiresData: [],
  },
  {
    question: 'What are the key metrics for measuring environmental impact?',
    category: 'onboarding',
    icon: 'book',
    priority: 90,
    requiresData: [],
  },
  {
    question: 'How do I calculate my carbon footprint?',
    category: 'onboarding',
    icon: 'calculator',
    priority: 85,
    requiresData: [],
  },
];

/**
 * Generate smart suggestions based on available data
 */
export function generateSmartSuggestions(
  availability: DataAvailability,
  maxSuggestions: number = 4
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];

  // Filter suggestions based on data availability
  for (const suggestion of ALL_SUGGESTIONS) {
    const meetsRequirements = suggestion.requiresData.every((requirement) => {
      return availability[requirement as keyof DataAvailability] === true;
    });

    if (meetsRequirements) {
      suggestions.push(suggestion);
    }
  }

  // If user has very limited data (less than 3 valid suggestions), add onboarding suggestions
  if (suggestions.length < 3) {
    suggestions.push(...ONBOARDING_SUGGESTIONS);
  }

  // Sort by priority (higher first) and return top suggestions
  suggestions.sort((a, b) => b.priority - a.priority);

  // Remove duplicates by question
  const seen = new Set<string>();
  const uniqueSuggestions = suggestions.filter((s) => {
    if (seen.has(s.question)) return false;
    seen.add(s.question);
    return true;
  });

  return uniqueSuggestions.slice(0, maxSuggestions);
}

/**
 * Get category-specific suggestions
 */
export function getSuggestionsByCategory(
  availability: DataAvailability,
  category: string
): SmartSuggestion[] {
  const allSuggestions = generateSmartSuggestions(availability, 10);
  return allSuggestions.filter((s) => s.category === category);
}

/**
 * Check if a specific question can be answered with available data
 */
export function canAnswerQuestion(
  question: string,
  availability: DataAvailability
): { canAnswer: boolean; missingData: string[] } {
  const lowerQuestion = question.toLowerCase();
  const missingData: string[] = [];

  // Carbon footprint / emissions
  if (
    lowerQuestion.includes('carbon footprint') ||
    lowerQuestion.includes('total emissions') ||
    lowerQuestion.includes('scope 1') ||
    lowerQuestion.includes('scope 2')
  ) {
    if (!availability.hasCarbonFootprintData) {
      missingData.push('carbon_footprint');
    }
  }

  // Scope 3
  if (lowerQuestion.includes('scope 3') || lowerQuestion.includes('purchased goods')) {
    if (!availability.hasScope3Data) {
      missingData.push('scope3');
    }
  }

  // Products / LCAs
  if (
    lowerQuestion.includes('product') ||
    lowerQuestion.includes('lca') ||
    lowerQuestion.includes('life cycle')
  ) {
    if (!availability.hasProductLCAs) {
      missingData.push('product_lca');
    }
  }

  // Facilities
  if (lowerQuestion.includes('facility') || lowerQuestion.includes('facilities')) {
    if (!availability.hasFacilityData) {
      missingData.push('facilities');
    }
  }

  // Water
  if (lowerQuestion.includes('water')) {
    if (!availability.hasWaterData) {
      missingData.push('facility_water');
    }
  }

  // Suppliers
  if (lowerQuestion.includes('supplier')) {
    if (!availability.hasSupplierData) {
      missingData.push('suppliers');
    }
  }

  // Fleet
  if (
    lowerQuestion.includes('fleet') ||
    lowerQuestion.includes('vehicle') ||
    lowerQuestion.includes('travel')
  ) {
    if (!availability.hasFleetData) {
      missingData.push('fleet');
    }
  }

  // Vitality Score
  if (lowerQuestion.includes('vitality score') && lowerQuestion.includes('breakdown')) {
    if (!availability.vitalityScoreExists) {
      missingData.push('vitality_score');
    }
  }

  return {
    canAnswer: missingData.length === 0,
    missingData,
  };
}
