/**
 * Recipe templates for drinks products.
 *
 * When a user creates a new product recipe, these templates show them
 * a checklist of typical ingredients and packaging for their product
 * category. Each item includes a pre-loaded search query so users can
 * find the right emission factor with one click.
 *
 * Templates are organised by product group (Spirits, Beer & Cider, etc.)
 * with category-level overrides where ingredients differ meaningfully.
 */

import type { PackagingCategory } from '@/lib/types/lca';

export interface RecipeTemplateItem {
  /** Display label shown in the checklist */
  label: string;
  /** Hint text explaining why this item is needed */
  hint: string;
  /** Pre-loaded search query for the emission factor search */
  searchQuery: string;
  /** Whether this item is expected in most recipes of this type */
  required: boolean;
  /** Ingredient or packaging */
  type: 'ingredient' | 'packaging';
  /** Packaging sub-category (container, label, closure, secondary) */
  packagingCategory?: PackagingCategory;
}

export interface RecipeTemplate {
  /** Product category value (e.g. "Gin", "Lager") or group name */
  category: string;
  /** Product group (e.g. "Spirits", "Beer & Cider") */
  group: string;
  /** Ordered list of typical recipe items */
  items: RecipeTemplateItem[];
}

// ─── SHARED PACKAGING ITEMS ────────────────────────────────────────────────

const GLASS_BOTTLE_750ML: RecipeTemplateItem = {
  label: 'Glass bottle (750ml)',
  hint: 'Standard 750ml glass bottle',
  searchQuery: 'glass bottle',
  required: true,
  type: 'packaging',
  packagingCategory: 'container',
};

const GLASS_BOTTLE_330ML: RecipeTemplateItem = {
  label: 'Glass bottle (330ml)',
  hint: 'Standard 330ml glass bottle',
  searchQuery: 'glass bottle',
  required: false,
  type: 'packaging',
  packagingCategory: 'container',
};

const ALUMINIUM_CAN: RecipeTemplateItem = {
  label: 'Aluminium can',
  hint: 'Standard aluminium beverage can',
  searchQuery: 'aluminium can',
  required: false,
  type: 'packaging',
  packagingCategory: 'container',
};

const BOTTLE_LABEL: RecipeTemplateItem = {
  label: 'Bottle label',
  hint: 'Paper or plastic label',
  searchQuery: 'label',
  required: true,
  type: 'packaging',
  packagingCategory: 'label',
};

const CLOSURE_CROWN_CORK: RecipeTemplateItem = {
  label: 'Crown cork / bottle cap',
  hint: 'Metal crown cork closure',
  searchQuery: 'crown cork',
  required: true,
  type: 'packaging',
  packagingCategory: 'closure',
};

const CLOSURE_CORK: RecipeTemplateItem = {
  label: 'Cork',
  hint: 'Natural or synthetic cork',
  searchQuery: 'cork',
  required: true,
  type: 'packaging',
  packagingCategory: 'closure',
};

const CLOSURE_SCREWCAP: RecipeTemplateItem = {
  label: 'Screw cap',
  hint: 'Aluminium or plastic screw cap',
  searchQuery: 'polypropylene',
  required: true,
  type: 'packaging',
  packagingCategory: 'closure',
};

const CORRUGATED_BOX: RecipeTemplateItem = {
  label: 'Corrugated cardboard box',
  hint: 'Secondary packaging for transport',
  searchQuery: 'corrugated box',
  required: false,
  type: 'packaging',
  packagingCategory: 'secondary',
};

const PROCESS_WATER: RecipeTemplateItem = {
  label: 'Process water',
  hint: 'Water used in production (brewing liquor, dilution water, etc.)',
  searchQuery: 'tap water',
  required: true,
  type: 'ingredient',
};

// ─── SPIRITS ────────────────────────────────────────────────────────────────

const SPIRITS_BASE: RecipeTemplateItem[] = [
  PROCESS_WATER,
  {
    label: 'Yeast',
    hint: 'Fermentation yeast',
    searchQuery: 'yeast',
    required: false,
    type: 'ingredient',
  },
  GLASS_BOTTLE_750ML,
  BOTTLE_LABEL,
  CLOSURE_SCREWCAP,
  CORRUGATED_BOX,
];

const GIN_TEMPLATE: RecipeTemplate = {
  category: 'Gin',
  group: 'Spirits',
  items: [
    {
      label: 'Base spirit grain',
      hint: 'Most gins use wheat or barley as the base spirit',
      searchQuery: 'wheat grain',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Juniper berries',
      hint: 'The defining botanical in all gins',
      searchQuery: 'juniper berry',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Botanicals',
      hint: 'Coriander, citrus peel, angelica root, etc.',
      searchQuery: 'coriander',
      required: false,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const VODKA_TEMPLATE: RecipeTemplate = {
  category: 'Vodka',
  group: 'Spirits',
  items: [
    {
      label: 'Base grain or potato',
      hint: 'Wheat, rye, or potato are the most common bases',
      searchQuery: 'wheat grain',
      required: true,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const RUM_TEMPLATE: RecipeTemplate = {
  category: 'Rum',
  group: 'Spirits',
  items: [
    {
      label: 'Molasses or sugar cane',
      hint: 'Most rums are made from molasses; some use fresh sugar cane juice',
      searchQuery: 'molasses',
      required: true,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const WHISKY_TEMPLATE: RecipeTemplate = {
  category: 'Whisky',
  group: 'Spirits',
  items: [
    {
      label: 'Malted barley',
      hint: 'Primary grain for Scotch and Irish whisky',
      searchQuery: 'malted barley',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Other grains',
      hint: 'Wheat, maize, or rye used in blended or grain whiskies',
      searchQuery: 'wheat grain',
      required: false,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const TEQUILA_TEMPLATE: RecipeTemplate = {
  category: 'Tequila',
  group: 'Spirits',
  items: [
    {
      label: 'Agave',
      hint: 'Blue agave (Agave tequilana)',
      searchQuery: 'agave',
      required: true,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const MEZCAL_TEMPLATE: RecipeTemplate = {
  category: 'Mezcal',
  group: 'Spirits',
  items: [
    {
      label: 'Agave',
      hint: 'Various agave species (espadín, tobalá, etc.)',
      searchQuery: 'agave',
      required: true,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const BRANDY_TEMPLATE: RecipeTemplate = {
  category: 'Brandy',
  group: 'Spirits',
  items: [
    {
      label: 'Grapes / wine',
      hint: 'Distilled from grape wine',
      searchQuery: 'grape',
      required: true,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const LIQUEUR_TEMPLATE: RecipeTemplate = {
  category: 'Liqueur',
  group: 'Spirits',
  items: [
    {
      label: 'Base spirit',
      hint: 'Neutral spirit or specific spirit base',
      searchQuery: 'ethanol',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Sugar / sweetener',
      hint: 'Liqueurs require a minimum sugar content',
      searchQuery: 'sugar',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Flavourings / botanicals',
      hint: 'Fruit, herbs, spices, cream, etc.',
      searchQuery: 'coriander',
      required: false,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const BOURBON_TEMPLATE: RecipeTemplate = {
  category: 'Bourbon',
  group: 'Spirits',
  items: [
    {
      label: 'Corn / maize',
      hint: 'Bourbon must be at least 51% corn',
      searchQuery: 'maize',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Malted barley',
      hint: 'Used for enzymes in the mash bill',
      searchQuery: 'malted barley',
      required: false,
      type: 'ingredient',
    },
    {
      label: 'Rye or wheat',
      hint: 'Secondary grain in the mash bill',
      searchQuery: 'rye grain',
      required: false,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

const CALVADOS_TEMPLATE: RecipeTemplate = {
  category: 'Calvados',
  group: 'Spirits',
  items: [
    {
      label: 'Apples',
      hint: 'Apple varieties specific to Calvados production',
      searchQuery: 'apple',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Pears',
      hint: 'Some Calvados blends include pear',
      searchQuery: 'pear',
      required: false,
      type: 'ingredient',
    },
    ...SPIRITS_BASE,
  ],
};

// ─── BEER & CIDER ───────────────────────────────────────────────────────────

const BEER_BASE: RecipeTemplateItem[] = [
  {
    label: 'Malted barley',
    hint: 'Primary malt — the backbone of most beers',
    searchQuery: 'malted barley',
    required: true,
    type: 'ingredient',
  },
  {
    label: 'Hops',
    hint: 'For bitterness, flavour, and aroma',
    searchQuery: 'hops',
    required: true,
    type: 'ingredient',
  },
  {
    label: 'Yeast',
    hint: 'Brewing yeast for fermentation',
    searchQuery: 'yeast',
    required: true,
    type: 'ingredient',
  },
  PROCESS_WATER,
  ALUMINIUM_CAN,
  GLASS_BOTTLE_330ML,
  BOTTLE_LABEL,
  CLOSURE_CROWN_CORK,
  CORRUGATED_BOX,
];

const LAGER_TEMPLATE: RecipeTemplate = {
  category: 'Lager',
  group: 'Beer & Cider',
  items: [
    ...BEER_BASE,
    {
      label: 'Adjuncts (rice/maize)',
      hint: 'Some lagers use rice or maize for a lighter body',
      searchQuery: 'rice',
      required: false,
      type: 'ingredient',
    },
  ],
};

const ALE_TEMPLATE: RecipeTemplate = {
  category: 'Ale',
  group: 'Beer & Cider',
  items: [...BEER_BASE],
};

const IPA_TEMPLATE: RecipeTemplate = {
  category: 'IPA',
  group: 'Beer & Cider',
  items: [...BEER_BASE],
};

const STOUT_TEMPLATE: RecipeTemplate = {
  category: 'Stout & Porter',
  group: 'Beer & Cider',
  items: [
    ...BEER_BASE,
    {
      label: 'Roasted barley / chocolate malt',
      hint: 'Speciality malts for colour and flavour',
      searchQuery: 'malted barley',
      required: false,
      type: 'ingredient',
    },
  ],
};

const WHEAT_BEER_TEMPLATE: RecipeTemplate = {
  category: 'Wheat Beer',
  group: 'Beer & Cider',
  items: [
    {
      label: 'Wheat malt',
      hint: 'Wheat makes up 50%+ of the grist in wheat beers',
      searchQuery: 'wheat grain',
      required: true,
      type: 'ingredient',
    },
    ...BEER_BASE,
  ],
};

const SOUR_BEER_TEMPLATE: RecipeTemplate = {
  category: 'Sour Beer',
  group: 'Beer & Cider',
  items: [
    ...BEER_BASE,
    {
      label: 'Fruit additions',
      hint: 'Many sour beers include fruit (cherry, raspberry, etc.)',
      searchQuery: 'cherry',
      required: false,
      type: 'ingredient',
    },
  ],
};

const CIDER_TEMPLATE: RecipeTemplate = {
  category: 'Cider',
  group: 'Beer & Cider',
  items: [
    {
      label: 'Apples / apple juice',
      hint: 'Primary ingredient — fresh-pressed or from concentrate',
      searchQuery: 'apple',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Yeast',
      hint: 'Cider yeast for fermentation',
      searchQuery: 'yeast',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Sugar',
      hint: 'Added to some ciders for sweetness or carbonation',
      searchQuery: 'sugar',
      required: false,
      type: 'ingredient',
    },
    PROCESS_WATER,
    ALUMINIUM_CAN,
    GLASS_BOTTLE_330ML,
    BOTTLE_LABEL,
    CLOSURE_CROWN_CORK,
    CORRUGATED_BOX,
  ],
};

const PERRY_TEMPLATE: RecipeTemplate = {
  category: 'Perry',
  group: 'Beer & Cider',
  items: [
    {
      label: 'Pears / pear juice',
      hint: 'Primary ingredient — perry pear varieties',
      searchQuery: 'pear',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Yeast',
      hint: 'Fermentation yeast',
      searchQuery: 'yeast',
      required: true,
      type: 'ingredient',
    },
    PROCESS_WATER,
    GLASS_BOTTLE_330ML,
    BOTTLE_LABEL,
    CLOSURE_CROWN_CORK,
    CORRUGATED_BOX,
  ],
};

// ─── WINE ───────────────────────────────────────────────────────────────────

const WINE_BASE: RecipeTemplateItem[] = [
  {
    label: 'Grapes',
    hint: 'Wine grapes — variety depends on wine style',
    searchQuery: 'grape',
    required: true,
    type: 'ingredient',
  },
  {
    label: 'Yeast',
    hint: 'Wine yeast for fermentation',
    searchQuery: 'yeast',
    required: true,
    type: 'ingredient',
  },
  {
    label: 'Sulphites (SO₂)',
    hint: 'Potassium metabisulphite used as preservative',
    searchQuery: 'potassium sorbate',
    required: false,
    type: 'ingredient',
  },
  GLASS_BOTTLE_750ML,
  BOTTLE_LABEL,
  CLOSURE_CORK,
  CORRUGATED_BOX,
];

const RED_WINE_TEMPLATE: RecipeTemplate = {
  category: 'Red Wine',
  group: 'Wine',
  items: [...WINE_BASE],
};

const WHITE_WINE_TEMPLATE: RecipeTemplate = {
  category: 'White Wine',
  group: 'Wine',
  items: [...WINE_BASE],
};

const ROSE_TEMPLATE: RecipeTemplate = {
  category: 'Rosé',
  group: 'Wine',
  items: [...WINE_BASE],
};

const SPARKLING_WINE_TEMPLATE: RecipeTemplate = {
  category: 'Sparkling Wine',
  group: 'Wine',
  items: [
    ...WINE_BASE,
    {
      label: 'Sugar (dosage)',
      hint: 'Sugar added during secondary fermentation',
      searchQuery: 'sugar',
      required: false,
      type: 'ingredient',
    },
  ],
};

const FORTIFIED_WINE_TEMPLATE: RecipeTemplate = {
  category: 'Fortified Wine',
  group: 'Wine',
  items: [
    ...WINE_BASE,
    {
      label: 'Grape spirit / brandy',
      hint: 'Neutral spirit added to fortify the wine',
      searchQuery: 'ethanol',
      required: true,
      type: 'ingredient',
    },
  ],
};

const NATURAL_WINE_TEMPLATE: RecipeTemplate = {
  category: 'Natural Wine',
  group: 'Wine',
  items: [
    {
      label: 'Grapes',
      hint: 'Organically or biodynamically grown grapes',
      searchQuery: 'grape',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Yeast',
      hint: 'Often wild/ambient yeast rather than commercial',
      searchQuery: 'yeast',
      required: false,
      type: 'ingredient',
    },
    GLASS_BOTTLE_750ML,
    BOTTLE_LABEL,
    CLOSURE_CORK,
    CORRUGATED_BOX,
  ],
};

// ─── READY-TO-DRINK & COCKTAILS ─────────────────────────────────────────────

const RTD_BASE: RecipeTemplateItem[] = [
  PROCESS_WATER,
  {
    label: 'Carbon dioxide (CO₂)',
    hint: 'Carbonation for sparkling RTDs',
    searchQuery: 'carbon dioxide',
    required: false,
    type: 'ingredient',
  },
  ALUMINIUM_CAN,
  BOTTLE_LABEL,
  CORRUGATED_BOX,
];

const SPIRIT_RTD_TEMPLATE: RecipeTemplate = {
  category: 'Spirit-based RTD',
  group: 'Ready-to-Drink & Cocktails',
  items: [
    {
      label: 'Base spirit',
      hint: 'Gin, vodka, rum, or other spirit base',
      searchQuery: 'ethanol',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Juice / flavouring',
      hint: 'Fruit juice, tonic, or flavouring',
      searchQuery: 'orange',
      required: false,
      type: 'ingredient',
    },
    {
      label: 'Sugar / sweetener',
      hint: 'Sugar, agave syrup, or artificial sweetener',
      searchQuery: 'sugar',
      required: false,
      type: 'ingredient',
    },
    ...RTD_BASE,
  ],
};

const CANNED_COCKTAIL_TEMPLATE: RecipeTemplate = {
  category: 'Canned Cocktail',
  group: 'Ready-to-Drink & Cocktails',
  items: [
    {
      label: 'Base spirit',
      hint: 'Spirit appropriate to the cocktail style',
      searchQuery: 'ethanol',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Juice / mixer',
      hint: 'Fruit juice, tonic, soda, or mixer',
      searchQuery: 'orange',
      required: false,
      type: 'ingredient',
    },
    {
      label: 'Sugar / sweetener',
      hint: 'Sugar or syrup',
      searchQuery: 'sugar',
      required: false,
      type: 'ingredient',
    },
    ...RTD_BASE,
  ],
};

const HARD_SELTZER_TEMPLATE: RecipeTemplate = {
  category: 'Hard Seltzer',
  group: 'Ready-to-Drink & Cocktails',
  items: [
    {
      label: 'Sugar / glucose (fermentable base)',
      hint: 'The base sugar fermented to produce alcohol',
      searchQuery: 'sugar',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Yeast',
      hint: 'Fermentation yeast',
      searchQuery: 'yeast',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Natural flavouring',
      hint: 'Fruit extract or natural flavour',
      searchQuery: 'lemon',
      required: false,
      type: 'ingredient',
    },
    ...RTD_BASE,
  ],
};

const HARD_KOMBUCHA_TEMPLATE: RecipeTemplate = {
  category: 'Hard Kombucha',
  group: 'Ready-to-Drink & Cocktails',
  items: [
    {
      label: 'Tea',
      hint: 'Black or green tea base',
      searchQuery: 'tea',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Sugar',
      hint: 'Cane sugar for fermentation',
      searchQuery: 'sugar',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Yeast / SCOBY culture',
      hint: 'Symbiotic culture for kombucha fermentation',
      searchQuery: 'yeast',
      required: true,
      type: 'ingredient',
    },
    ...RTD_BASE,
  ],
};

// ─── NON-ALCOHOLIC ──────────────────────────────────────────────────────────

const SOFT_DRINK_BASE: RecipeTemplateItem[] = [
  PROCESS_WATER,
  {
    label: 'Sugar / sweetener',
    hint: 'Cane sugar, HFCS, or artificial sweetener',
    searchQuery: 'sugar',
    required: true,
    type: 'ingredient',
  },
  ALUMINIUM_CAN,
  BOTTLE_LABEL,
  CORRUGATED_BOX,
];

const CARBONATED_SOFT_DRINK_TEMPLATE: RecipeTemplate = {
  category: 'Carbonated Soft Drink',
  group: 'Non-Alcoholic',
  items: [
    {
      label: 'Flavouring / extract',
      hint: 'Natural or artificial flavour concentrate',
      searchQuery: 'citric acid',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Carbon dioxide (CO₂)',
      hint: 'For carbonation',
      searchQuery: 'carbon dioxide',
      required: true,
      type: 'ingredient',
    },
    ...SOFT_DRINK_BASE,
  ],
};

const STILL_SOFT_DRINK_TEMPLATE: RecipeTemplate = {
  category: 'Still Soft Drink',
  group: 'Non-Alcoholic',
  items: [
    {
      label: 'Juice / flavouring',
      hint: 'Fruit juice, botanical extract, or flavouring',
      searchQuery: 'orange',
      required: true,
      type: 'ingredient',
    },
    ...SOFT_DRINK_BASE,
  ],
};

const JUICE_TEMPLATE: RecipeTemplate = {
  category: '100% Juice',
  group: 'Non-Alcoholic',
  items: [
    {
      label: 'Fruit juice',
      hint: 'Fresh-pressed or from concentrate',
      searchQuery: 'orange',
      required: true,
      type: 'ingredient',
    },
    PROCESS_WATER,
    ALUMINIUM_CAN,
    BOTTLE_LABEL,
    CORRUGATED_BOX,
  ],
};

const COFFEE_DRINK_TEMPLATE: RecipeTemplate = {
  category: 'Coffee Drink',
  group: 'Non-Alcoholic',
  items: [
    {
      label: 'Coffee',
      hint: 'Coffee beans or extract',
      searchQuery: 'coffee',
      required: true,
      type: 'ingredient',
    },
    {
      label: 'Milk / plant milk',
      hint: 'Dairy milk or oat/almond/soy alternative',
      searchQuery: 'milk',
      required: false,
      type: 'ingredient',
    },
    ...SOFT_DRINK_BASE,
  ],
};

const TEA_DRINK_TEMPLATE: RecipeTemplate = {
  category: 'Tea Drink',
  group: 'Non-Alcoholic',
  items: [
    {
      label: 'Tea',
      hint: 'Black, green, or herbal tea',
      searchQuery: 'tea',
      required: true,
      type: 'ingredient',
    },
    ...SOFT_DRINK_BASE,
  ],
};

const NA_BEER_TEMPLATE: RecipeTemplate = {
  category: 'Non-Alcoholic Beer',
  group: 'Non-Alcoholic',
  items: [...BEER_BASE],
};

const NA_WINE_TEMPLATE: RecipeTemplate = {
  category: 'Non-Alcoholic Wine',
  group: 'Non-Alcoholic',
  items: [...WINE_BASE],
};

const NA_SPIRIT_TEMPLATE: RecipeTemplate = {
  category: 'Non-Alcoholic Spirit',
  group: 'Non-Alcoholic',
  items: [
    {
      label: 'Botanicals / flavourings',
      hint: 'The botanical blend that defines the flavour profile',
      searchQuery: 'coriander',
      required: true,
      type: 'ingredient',
    },
    PROCESS_WATER,
    {
      label: 'Sugar / sweetener',
      hint: 'Sugar or other sweetener for balance',
      searchQuery: 'sugar',
      required: false,
      type: 'ingredient',
    },
    GLASS_BOTTLE_750ML,
    BOTTLE_LABEL,
    CLOSURE_SCREWCAP,
    CORRUGATED_BOX,
  ],
};

// ─── GENERIC FALLBACK ───────────────────────────────────────────────────────

const GENERIC_BEVERAGE_TEMPLATE: RecipeTemplate = {
  category: 'Generic Beverage',
  group: 'All',
  items: [
    {
      label: 'Primary ingredient',
      hint: 'The main ingredient in your product',
      searchQuery: '',
      required: true,
      type: 'ingredient',
    },
    PROCESS_WATER,
    {
      label: 'Container (bottle or can)',
      hint: 'Glass bottle, aluminium can, or other container',
      searchQuery: 'glass bottle',
      required: true,
      type: 'packaging',
      packagingCategory: 'container',
    },
    BOTTLE_LABEL,
    {
      label: 'Closure',
      hint: 'Cap, cork, or screw cap',
      searchQuery: 'cork',
      required: true,
      type: 'packaging',
      packagingCategory: 'closure',
    },
    CORRUGATED_BOX,
  ],
};

// ─── TEMPLATE REGISTRY ──────────────────────────────────────────────────────

const CATEGORY_TEMPLATES: RecipeTemplate[] = [
  // Spirits
  GIN_TEMPLATE,
  VODKA_TEMPLATE,
  RUM_TEMPLATE,
  WHISKY_TEMPLATE,
  TEQUILA_TEMPLATE,
  MEZCAL_TEMPLATE,
  BRANDY_TEMPLATE,
  LIQUEUR_TEMPLATE,
  BOURBON_TEMPLATE,
  CALVADOS_TEMPLATE,
  // Beer & Cider
  LAGER_TEMPLATE,
  ALE_TEMPLATE,
  IPA_TEMPLATE,
  STOUT_TEMPLATE,
  WHEAT_BEER_TEMPLATE,
  SOUR_BEER_TEMPLATE,
  CIDER_TEMPLATE,
  PERRY_TEMPLATE,
  // Wine
  RED_WINE_TEMPLATE,
  WHITE_WINE_TEMPLATE,
  ROSE_TEMPLATE,
  SPARKLING_WINE_TEMPLATE,
  FORTIFIED_WINE_TEMPLATE,
  NATURAL_WINE_TEMPLATE,
  // RTD
  SPIRIT_RTD_TEMPLATE,
  CANNED_COCKTAIL_TEMPLATE,
  HARD_SELTZER_TEMPLATE,
  HARD_KOMBUCHA_TEMPLATE,
  // Non-Alcoholic
  CARBONATED_SOFT_DRINK_TEMPLATE,
  STILL_SOFT_DRINK_TEMPLATE,
  JUICE_TEMPLATE,
  COFFEE_DRINK_TEMPLATE,
  TEA_DRINK_TEMPLATE,
  NA_BEER_TEMPLATE,
  NA_WINE_TEMPLATE,
  NA_SPIRIT_TEMPLATE,
];

// Group-level fallback templates for categories without a specific template
const GROUP_TEMPLATES: Record<string, RecipeTemplate> = {
  Spirits: {
    category: 'Spirits',
    group: 'Spirits',
    items: [
      {
        label: 'Base ingredient',
        hint: 'Grain, fruit, or other base material for distillation',
        searchQuery: 'wheat grain',
        required: true,
        type: 'ingredient',
      },
      ...SPIRITS_BASE,
    ],
  },
  'Beer & Cider': {
    category: 'Beer & Cider',
    group: 'Beer & Cider',
    items: [...BEER_BASE],
  },
  Wine: {
    category: 'Wine',
    group: 'Wine',
    items: [...WINE_BASE],
  },
  'Ready-to-Drink & Cocktails': {
    category: 'Ready-to-Drink & Cocktails',
    group: 'Ready-to-Drink & Cocktails',
    items: [
      {
        label: 'Base spirit or fermentable',
        hint: 'Spirit, fermented sugar, or malt base',
        searchQuery: 'ethanol',
        required: true,
        type: 'ingredient',
      },
      ...RTD_BASE,
    ],
  },
  'Non-Alcoholic': {
    category: 'Non-Alcoholic',
    group: 'Non-Alcoholic',
    items: [...SOFT_DRINK_BASE],
  },
};

/**
 * Look up the recipe template for a product category.
 *
 * Resolution order:
 * 1. Exact category match (e.g. "Gin")
 * 2. Group-level fallback (e.g. "Spirits")
 * 3. Generic beverage template
 */
export function getRecipeTemplate(productCategory?: string | null): RecipeTemplate {
  if (!productCategory) return GENERIC_BEVERAGE_TEMPLATE;

  // 1. Exact category match
  const exact = CATEGORY_TEMPLATES.find(
    t => t.category.toLowerCase() === productCategory.toLowerCase()
  );
  if (exact) return exact;

  // 2. Group-level fallback — look up which group this category belongs to
  // Import dynamically would create a circular dep, so we do a simple lookup
  const categoryToGroup: Record<string, string> = {};
  for (const t of CATEGORY_TEMPLATES) {
    categoryToGroup[t.category.toLowerCase()] = t.group;
  }

  const group = categoryToGroup[productCategory.toLowerCase()];
  if (group && GROUP_TEMPLATES[group]) {
    return GROUP_TEMPLATES[group];
  }

  // Check if the category string IS a group name
  if (GROUP_TEMPLATES[productCategory]) {
    return GROUP_TEMPLATES[productCategory];
  }

  return GENERIC_BEVERAGE_TEMPLATE;
}
