/**
 * Chat suggestion content for the Rosa chat UI.
 *
 * This file used to hold ROSA_SYSTEM_PROMPT, a ~315-line persona that nothing
 * ever executed: its only consumer was lib/gaia/context-builder.ts, which had
 * no callers. Rosa's persona now lives in lib/rosa/persona.ts, composed from
 * named blocks and used by every surface. What is left here is the suggested
 * questions and follow-up prompts that GaiaChat renders.
 */

import { ROSA_PHOTO_URL } from '@/lib/rosa/persona';

export { ROSA_PHOTO_URL };

export const ROSA_SUGGESTED_QUESTIONS = [
  // Data entry & navigation assistance
  {
    question: 'Help me add my first product',
    category: 'data-entry',
    icon: 'plus-circle',
  },
  {
    question: 'How do I add a facility?',
    category: 'navigation',
    icon: 'map-pin',
  },
  {
    question: 'Walk me through adding utility data',
    category: 'data-entry',
    icon: 'zap',
  },
  {
    question: 'What should I focus on first?',
    category: 'onboarding',
    icon: 'compass',
  },
  // Data understanding
  {
    question: 'What is my total carbon footprint?',
    category: 'emissions',
    icon: 'cloud',
  },
  {
    question: 'Which facilities use the most water?',
    category: 'water',
    icon: 'droplet',
  },
  {
    question: 'How can I improve my Vitality Score?',
    category: 'vitality',
    icon: 'trending-up',
  },
  {
    question: 'Which products have the highest environmental impact?',
    category: 'products',
    icon: 'box',
  },
  {
    question: 'Show me my emissions breakdown by scope',
    category: 'emissions',
    icon: 'pie-chart',
  },
  {
    question: 'How can I reduce my carbon footprint?',
    category: 'reduction',
    icon: 'leaf',
  },
];

// Backwards compatibility
// Dynamic follow-up questions based on topics detected in the response
export const ROSA_FOLLOWUP_QUESTIONS: Record<string, string[]> = {
  emissions: [
    'What are the main sources of these emissions?',
    'How does this compare to industry benchmarks?',
    'What actions can reduce these emissions?',
  ],
  water: [
    'What is the water intensity per unit of production?',
    'Which processes consume the most water?',
    'Are there any water stress risks at these locations?',
  ],
  products: [
    'Which materials contribute most to the impact?',
    'Which products need LCA calculations?',
    'How can I reduce product footprints?',
  ],
  facilities: [
    'What is the energy consumption at these facilities?',
    'Are there renewable energy opportunities?',
    'What are the waste streams from these sites?',
  ],
  suppliers: [
    'Which suppliers have the highest emissions?',
    'What is the average supplier engagement level?',
    'How can I improve supplier data quality?',
  ],
  vitality: [
    'Which pillar has the most room for improvement?',
    'What are the quick wins for improving scores?',
    'How do my scores compare to benchmarks?',
  ],
  // Navigation & data entry follow-ups
  navigation: [
    'What else can I do on this page?',
    'Where do I go next?',
    'How do I find my data?',
  ],
  dataEntry: [
    'What information do I need to gather?',
    'Can you walk me through the next step?',
    'What happens after I save this?',
  ],
  onboarding: [
    'What data should I add first?',
    'How long will setup take?',
    'Can I import data from spreadsheets?',
  ],
};

// Backwards compatibility
/**
 * Get contextual follow-up questions based on message content
 */
export function getContextualFollowUps(messageContent: string): string[] {
  const content = messageContent.toLowerCase();
  const suggestions: string[] = [];

  // Detect navigation & data entry topics (prioritize these for onboarding users)
  if (
    content.includes('go to') ||
    content.includes('click') ||
    content.includes('navigate') ||
    content.includes('sidebar') ||
    content.includes('find')
  ) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.navigation);
  }
  if (
    content.includes('step') ||
    content.includes('add') ||
    content.includes('enter') ||
    content.includes('fill') ||
    content.includes('create')
  ) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.dataEntry);
  }
  if (
    content.includes('first') ||
    content.includes('start') ||
    content.includes('begin') ||
    content.includes('setup') ||
    content.includes('getting started')
  ) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.onboarding);
  }

  // Detect data topics
  if (content.includes('emission') || content.includes('co2') || content.includes('carbon')) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.emissions);
  }
  if (content.includes('water') || content.includes('m³') || content.includes('consumption')) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.water);
  }
  if (content.includes('product') || content.includes('lca') || content.includes('lifecycle')) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.products);
  }
  if (content.includes('facility') || content.includes('site') || content.includes('location')) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.facilities);
  }
  if (content.includes('supplier') || content.includes('vendor') || content.includes('engagement')) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.suppliers);
  }
  if (content.includes('vitality') || content.includes('score') || content.includes('benchmark')) {
    suggestions.push(...ROSA_FOLLOWUP_QUESTIONS.vitality);
  }

  // Return unique suggestions, limited to 3
  return Array.from(new Set(suggestions)).slice(0, 3);
}

