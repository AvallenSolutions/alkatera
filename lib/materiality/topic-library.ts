/**
 * Materiality Topic Library
 *
 * Curated list of ~40 sustainability topics drawn from ESRS, GRI Standards,
 * and SASB. Used in the double-materiality assessment setup flow.
 *
 * Each topic is assigned default sector relevance tags so the setup UI can
 * pre-filter topics most likely to be material for the user's industry.
 */

export type TopicCategory = 'environmental' | 'social' | 'governance';
export type TopicStatus = 'material' | 'monitoring' | 'not_material';

export interface MaterialityTopic {
  /** Unique slug used as the key in assessments */
  id: string;
  /** Display name */
  name: string;
  category: TopicCategory;
  /** Plain-English explanation of what this topic covers */
  description: string;
  /** ESRS standard reference, e.g. "ESRS E1" */
  esrsReference?: string;
  /** GRI Standards reference, e.g. "GRI 302" */
  griReference?: string;
  /** SASB standard reference */
  sasbReference?: string;
  /** Sector tags for default relevance filtering */
  sectorTags: string[];
  // ---- Set by user during assessment ----
  status?: TopicStatus;
  /** 1-5: how significantly does the business impact this topic */
  impactScore?: number;
  /** 1-5: how significantly does this topic affect business finances */
  financialScore?: number;
  /** User-written rationale */
  rationale?: string;
}

// ============================================================================
// TOPIC LIBRARY
// ============================================================================

export const TOPIC_LIBRARY: Omit<MaterialityTopic, 'status' | 'impactScore' | 'financialScore' | 'rationale'>[] = [

  // ──── ENVIRONMENTAL ────────────────────────────────────────────────────────

  {
    id: 'climate-mitigation',
    name: 'Climate Change Mitigation',
    category: 'environmental',
    description: 'Reducing greenhouse gas emissions across Scopes 1, 2, and 3 to limit global warming.',
    esrsReference: 'ESRS E1',
    griReference: 'GRI 305',
    sasbReference: 'FB-AG-110a',
    sectorTags: ['all'],
  },
  {
    id: 'climate-adaptation',
    name: 'Climate Change Adaptation',
    category: 'environmental',
    description: 'Managing the physical risks from climate change — including extreme weather, flooding, and drought — and building operational resilience.',
    esrsReference: 'ESRS E1',
    griReference: 'GRI 201-2',
    sectorTags: ['all'],
  },
  {
    id: 'energy-management',
    name: 'Energy Management',
    category: 'environmental',
    description: 'Reducing energy intensity and transitioning to renewable energy sources across operations.',
    esrsReference: 'ESRS E1',
    griReference: 'GRI 302',
    sectorTags: ['all'],
  },
  {
    id: 'water-resources',
    name: 'Water and Marine Resources',
    category: 'environmental',
    description: 'Responsible use, conservation, and quality management of freshwater and marine resources throughout the value chain.',
    esrsReference: 'ESRS E3',
    griReference: 'GRI 303',
    sasbReference: 'FB-AG-140a',
    sectorTags: ['food_beverage', 'agriculture', 'manufacturing', 'hospitality'],
  },
  {
    id: 'biodiversity',
    name: 'Biodiversity and Ecosystems',
    category: 'environmental',
    description: 'Protecting, maintaining, and restoring biodiversity and ecosystem services affected by operations and the value chain.',
    esrsReference: 'ESRS E4',
    griReference: 'GRI 304',
    sectorTags: ['agriculture', 'food_beverage', 'manufacturing', 'land_management'],
  },
  {
    id: 'circular-economy',
    name: 'Resource Use and Circular Economy',
    category: 'environmental',
    description: 'Minimising material inputs, maximising reuse and recycling, and transitioning away from single-use materials.',
    esrsReference: 'ESRS E5',
    griReference: 'GRI 306',
    sectorTags: ['manufacturing', 'food_beverage', 'retail', 'all'],
  },
  {
    id: 'waste-management',
    name: 'Waste and Pollution',
    category: 'environmental',
    description: 'Reducing hazardous and non-hazardous waste, managing pollution to air, water, and land.',
    esrsReference: 'ESRS E2, E5',
    griReference: 'GRI 306',
    sectorTags: ['manufacturing', 'food_beverage', 'agriculture', 'all'],
  },
  {
    id: 'sustainable-sourcing',
    name: 'Sustainable Sourcing and Procurement',
    category: 'environmental',
    description: 'Sourcing raw materials and ingredients responsibly, including deforestation-free commitments and sustainable agriculture.',
    esrsReference: 'ESRS E4',
    griReference: 'GRI 308',
    sasbReference: 'FB-AG-430a',
    sectorTags: ['food_beverage', 'agriculture', 'retail', 'manufacturing'],
  },
  {
    id: 'land-use',
    name: 'Land Use and Soil Health',
    category: 'environmental',
    description: 'Managing land under ownership or in the supply chain to prevent degradation and maintain soil carbon stocks.',
    esrsReference: 'ESRS E4',
    griReference: 'GRI 304',
    sectorTags: ['agriculture', 'food_beverage', 'land_management'],
  },
  {
    id: 'packaging',
    name: 'Packaging and Product Design',
    category: 'environmental',
    description: 'Designing products and packaging to reduce environmental impact across the product lifecycle.',
    esrsReference: 'ESRS E5',
    griReference: 'GRI 306',
    sectorTags: ['food_beverage', 'retail', 'manufacturing', 'consumer_goods'],
  },
  {
    id: 'transport-logistics',
    name: 'Transport and Logistics Emissions',
    category: 'environmental',
    description: 'Reducing Scope 3 emissions from inbound and outbound logistics, including freight and last-mile delivery.',
    esrsReference: 'ESRS E1',
    griReference: 'GRI 305',
    sectorTags: ['food_beverage', 'retail', 'manufacturing', 'logistics'],
  },
  {
    id: 'product-lifecycle',
    name: 'Product Environmental Impact',
    category: 'environmental',
    description: 'The environmental footprint of products throughout their lifecycle — from raw material extraction to end-of-life.',
    esrsReference: 'ESRS E1, E5',
    griReference: 'GRI 301',
    sectorTags: ['food_beverage', 'consumer_goods', 'manufacturing', 'retail'],
  },

  // ──── SOCIAL ───────────────────────────────────────────────────────────────

  {
    id: 'health-safety',
    name: 'Health and Safety',
    category: 'social',
    description: 'Protecting the physical and mental health of employees, contractors, and the public from work-related hazards.',
    esrsReference: 'ESRS S1',
    griReference: 'GRI 403',
    sectorTags: ['all'],
  },
  {
    id: 'fair-wages',
    name: 'Fair Wages and Working Conditions',
    category: 'social',
    description: 'Paying at least the real living wage and providing fair, legal, and safe working conditions for all employees.',
    esrsReference: 'ESRS S1',
    griReference: 'GRI 202',
    sectorTags: ['all'],
  },
  {
    id: 'diversity-inclusion',
    name: 'Diversity, Equity, and Inclusion',
    category: 'social',
    description: 'Creating a diverse and inclusive workplace free from discrimination, with equitable opportunities for all employees.',
    esrsReference: 'ESRS S1',
    griReference: 'GRI 405',
    sectorTags: ['all'],
  },
  {
    id: 'gender-equality',
    name: 'Gender Pay and Career Equality',
    category: 'social',
    description: 'Addressing the gender pay gap and ensuring equal career progression opportunities for women.',
    esrsReference: 'ESRS S1',
    griReference: 'GRI 405',
    sectorTags: ['all'],
  },
  {
    id: 'training-development',
    name: 'Training and Skills Development',
    category: 'social',
    description: 'Investing in employee training, skills development, and career progression.',
    esrsReference: 'ESRS S1',
    griReference: 'GRI 404',
    sectorTags: ['all'],
  },
  {
    id: 'employee-wellbeing',
    name: 'Employee Wellbeing and Engagement',
    category: 'social',
    description: 'Supporting employees\' physical, mental, and financial wellbeing, and measuring engagement.',
    esrsReference: 'ESRS S1',
    griReference: 'GRI 401',
    sectorTags: ['all'],
  },
  {
    id: 'supply-chain-labour',
    name: 'Labour Rights in the Value Chain',
    category: 'social',
    description: 'Ensuring suppliers and contract workers are treated fairly, with no forced or child labour.',
    esrsReference: 'ESRS S2',
    griReference: 'GRI 408, 409',
    sectorTags: ['all'],
  },
  {
    id: 'community-impact',
    name: 'Community Investment and Impact',
    category: 'social',
    description: 'Contributing positively to local communities through employment, charitable giving, and volunteering.',
    esrsReference: 'ESRS S3',
    griReference: 'GRI 413',
    sectorTags: ['all'],
  },
  {
    id: 'local-economic-development',
    name: 'Local Economic Development',
    category: 'social',
    description: 'Supporting local suppliers, producers, and the local economy through procurement and employment decisions.',
    esrsReference: 'ESRS S3',
    griReference: 'GRI 204',
    sectorTags: ['food_beverage', 'retail', 'hospitality'],
  },
  {
    id: 'consumer-health',
    name: 'Consumer Health and Safety',
    category: 'social',
    description: 'Ensuring products are safe, accurately labelled, and responsibly marketed.',
    esrsReference: 'ESRS S4',
    griReference: 'GRI 416',
    sasbReference: 'FB-NB-250a',
    sectorTags: ['food_beverage', 'consumer_goods', 'retail', 'hospitality'],
  },
  {
    id: 'responsible-marketing',
    name: 'Responsible Marketing and Communication',
    category: 'social',
    description: 'Marketing products ethically, avoiding greenwashing, and providing transparent product information.',
    esrsReference: 'ESRS S4',
    griReference: 'GRI 417',
    sectorTags: ['food_beverage', 'consumer_goods', 'retail'],
  },
  {
    id: 'human-rights',
    name: 'Human Rights Due Diligence',
    category: 'social',
    description: 'Identifying and addressing human rights risks in operations and the supply chain.',
    esrsReference: 'ESRS S1, S2',
    griReference: 'GRI 412',
    sectorTags: ['all'],
  },
  {
    id: 'indigenous-rights',
    name: 'Indigenous and Land Rights',
    category: 'social',
    description: 'Respecting the rights of indigenous peoples and communities in land-use and sourcing decisions.',
    esrsReference: 'ESRS S3',
    griReference: 'GRI 411',
    sectorTags: ['agriculture', 'land_management', 'food_beverage'],
  },

  // ──── GOVERNANCE ───────────────────────────────────────────────────────────

  {
    id: 'board-composition',
    name: 'Board Composition and Diversity',
    category: 'governance',
    description: 'The diversity, independence, and expertise of the board, including representation of women and non-executive directors.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 405-1',
    sectorTags: ['all'],
  },
  {
    id: 'sustainability-governance',
    name: 'Sustainability Governance and Accountability',
    category: 'governance',
    description: 'How sustainability is overseen at board and executive level, with clear ownership and accountability.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 2-12',
    sectorTags: ['all'],
  },
  {
    id: 'ethics-anti-corruption',
    name: 'Business Ethics and Anti-Corruption',
    category: 'governance',
    description: 'Policies and controls preventing bribery, corruption, and unethical business conduct.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 205',
    sectorTags: ['all'],
  },
  {
    id: 'transparency-disclosure',
    name: 'Transparency and Disclosure',
    category: 'governance',
    description: 'Commitment to open, accurate, and timely reporting on sustainability performance and risks.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 2-5',
    sectorTags: ['all'],
  },
  {
    id: 'stakeholder-engagement',
    name: 'Stakeholder Engagement',
    category: 'governance',
    description: 'How the organisation identifies, listens to, and responds to the concerns of key stakeholders.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 2-29',
    sectorTags: ['all'],
  },
  {
    id: 'risk-management',
    name: 'Climate and Sustainability Risk Management',
    category: 'governance',
    description: 'Identifying, assessing, and managing material sustainability risks including physical and transition climate risks (TCFD).',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 2-25',
    sectorTags: ['all'],
  },
  {
    id: 'regulatory-compliance',
    name: 'Regulatory Compliance',
    category: 'governance',
    description: 'Compliance with environmental, social, and governance laws and regulations including CSRD.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 2-27',
    sectorTags: ['all'],
  },
  {
    id: 'tax-policy',
    name: 'Tax Policy and Transparency',
    category: 'governance',
    description: 'Responsible tax practices, country-by-country reporting, and transparency on tax strategy.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 207',
    sectorTags: ['all'],
  },
  {
    id: 'data-privacy-security',
    name: 'Data Privacy and Cybersecurity',
    category: 'governance',
    description: 'Protecting customer and employee data, and maintaining resilient cybersecurity systems.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 418',
    sectorTags: ['all'],
  },
  {
    id: 'sbti-targets',
    name: 'Science-Based Targets and Net Zero',
    category: 'governance',
    description: 'Setting and committing to emission reduction targets aligned with the Science Based Targets initiative (SBTi).',
    esrsReference: 'ESRS E1',
    sectorTags: ['all'],
  },
  {
    id: 'bcorp-certification',
    name: 'B Corp and Legal Mission Alignment',
    category: 'governance',
    description: 'Legal commitment to stakeholder governance — including B Corp certification or benefit company status.',
    sectorTags: ['all'],
  },
  {
    id: 'supply-chain-transparency',
    name: 'Supply Chain Transparency and Traceability',
    category: 'governance',
    description: 'Mapping the supply chain and providing traceability of key ingredients and materials.',
    esrsReference: 'ESRS G1',
    griReference: 'GRI 2-6',
    sectorTags: ['food_beverage', 'retail', 'manufacturing'],
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/** Returns topics pre-filtered for relevance to a given sector */
export function getTopicsForSector(sector: string): typeof TOPIC_LIBRARY {
  const normalised = sector.toLowerCase().replace(/\s+/g, '_');
  return TOPIC_LIBRARY.filter(t =>
    t.sectorTags.includes('all') || t.sectorTags.some(tag => normalised.includes(tag))
  );
}

/** Groups topics by category */
export function groupTopicsByCategory(topics: typeof TOPIC_LIBRARY) {
  return {
    environmental: topics.filter(t => t.category === 'environmental'),
    social: topics.filter(t => t.category === 'social'),
    governance: topics.filter(t => t.category === 'governance'),
  };
}

/** Scores a topic by combined materiality (impact × financial), used to rank priority topics */
export function getTopicMaterialityScore(topic: MaterialityTopic): number {
  return (topic.impactScore || 1) * (topic.financialScore || 1);
}

/** Returns the top N most material topics, sorted by combined score */
export function getTopPriorityTopics(topics: MaterialityTopic[], n = 8): MaterialityTopic[] {
  return topics
    .filter(t => t.status === 'material')
    .sort((a, b) => getTopicMaterialityScore(b) - getTopicMaterialityScore(a))
    .slice(0, n);
}

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  environmental: 'Environmental',
  social: 'Social',
  governance: 'Governance',
};

export const CATEGORY_COLOURS: Record<TopicCategory, string> = {
  environmental: '#22c55e',
  social: '#3b82f6',
  governance: '#8b5cf6',
};

export const STATUS_LABELS: Record<TopicStatus, string> = {
  material: 'Material',
  monitoring: 'Monitoring',
  not_material: 'Not Material',
};
