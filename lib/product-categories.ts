export interface ProductCategory {
  value: string;
  label: string;
  group: string;
  description?: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    value: "Spirits",
    label: "Gin",
    group: "Spirits",
    description: "Distilled gin including London Dry, Old Tom, Navy Strength",
  },
  {
    value: "Spirits",
    label: "Vodka",
    group: "Spirits",
    description: "Distilled vodka from various base materials",
  },
  {
    value: "Spirits",
    label: "Rum",
    group: "Spirits",
    description: "Rum including white, gold, dark, and spiced varieties",
  },
  {
    value: "Spirits",
    label: "Whisky",
    group: "Spirits",
    description: "Whisky including Scotch, Irish, Bourbon, and Rye",
  },
  {
    value: "Spirits",
    label: "Tequila",
    group: "Spirits",
    description: "Tequila including Blanco, Reposado, Añejo",
  },
  {
    value: "Spirits",
    label: "Mezcal",
    group: "Spirits",
    description: "Artisanal mezcal and similar agave spirits",
  },
  {
    value: "Spirits",
    label: "Brandy",
    group: "Spirits",
    description: "Brandy and Cognac",
  },
  {
    value: "Spirits",
    label: "Liqueur",
    group: "Spirits",
    description: "Sweetened spirits and liqueurs",
  },
  {
    value: "Spirits",
    label: "Bourbon",
    group: "Spirits",
    description: "American bourbon whiskey",
  },
  {
    value: "Spirits",
    label: "Rye Whiskey",
    group: "Spirits",
    description: "Rye-based whiskey",
  },
  {
    value: "Spirits",
    label: "Calvados",
    group: "Spirits",
    description: "Apple brandy from Normandy",
  },
  {
    value: "Spirits",
    label: "Baijiu",
    group: "Spirits",
    description: "Chinese distilled spirit",
  },
  {
    value: "Spirits",
    label: "Aquavit",
    group: "Spirits",
    description: "Scandinavian distilled spirit flavoured with botanicals",
  },

  {
    value: "Beer",
    label: "Lager",
    group: "Beer & Cider",
    description: "Bottom-fermented lager beer",
  },
  {
    value: "Beer",
    label: "Ale",
    group: "Beer & Cider",
    description: "Top-fermented ales including pale ale and bitter",
  },
  {
    value: "Beer",
    label: "IPA",
    group: "Beer & Cider",
    description: "India Pale Ale including West Coast, New England, and session styles",
  },
  {
    value: "Beer",
    label: "Stout & Porter",
    group: "Beer & Cider",
    description: "Dark beers including stout and porter",
  },
  {
    value: "Beer",
    label: "Wheat Beer",
    group: "Beer & Cider",
    description: "Wheat-based beers including Hefeweizen and Witbier",
  },
  {
    value: "Beer",
    label: "Sour Beer",
    group: "Beer & Cider",
    description: "Sour and wild-fermented beers",
  },
  {
    value: "Cider",
    label: "Cider",
    group: "Beer & Cider",
    description: "Fermented apple cider",
  },
  {
    value: "Cider",
    label: "Perry",
    group: "Beer & Cider",
    description: "Fermented pear cider",
  },

  {
    value: "Wine",
    label: "Red Wine",
    group: "Wine",
    description: "Red wine varieties",
  },
  {
    value: "Wine",
    label: "White Wine",
    group: "Wine",
    description: "White wine varieties",
  },
  {
    value: "Wine",
    label: "Rosé",
    group: "Wine",
    description: "Rosé and blush wines",
  },
  {
    value: "Wine",
    label: "Sparkling Wine",
    group: "Wine",
    description: "Champagne, Prosecco, and other sparkling wines",
  },
  {
    value: "Wine",
    label: "Fortified Wine",
    group: "Wine",
    description: "Port, Sherry, Vermouth, and other fortified wines",
  },
  {
    value: "Wine",
    label: "Natural Wine",
    group: "Wine",
    description: "Low-intervention, organic, and biodynamic wines",
  },

  {
    value: "Ready-to-Drink",
    label: "Spirit-based RTD",
    group: "Ready-to-Drink & Cocktails",
    description: "Pre-mixed cocktails and spirit-based RTDs",
  },
  {
    value: "Ready-to-Drink",
    label: "Wine-based RTD",
    group: "Ready-to-Drink & Cocktails",
    description: "Wine coolers and wine-based ready-to-drink beverages",
  },
  {
    value: "Ready-to-Drink",
    label: "Canned Cocktail",
    group: "Ready-to-Drink & Cocktails",
    description: "Canned cocktails including Margarita, Mojito, Espresso Martini",
  },
  {
    value: "Ready-to-Drink",
    label: "Bottled Cocktail",
    group: "Ready-to-Drink & Cocktails",
    description: "Bottled cocktails and premium pre-mixed drinks",
  },
  {
    value: "Ready-to-Drink",
    label: "Hard Seltzer",
    group: "Ready-to-Drink & Cocktails",
    description: "Alcoholic sparkling water and hard seltzers",
  },
  {
    value: "Ready-to-Drink",
    label: "Hard Kombucha",
    group: "Ready-to-Drink & Cocktails",
    description: "Fermented tea with alcohol",
  },
  {
    value: "Ready-to-Drink",
    label: "Alcopop",
    group: "Ready-to-Drink & Cocktails",
    description: "Flavoured alcoholic beverages and alcopops",
  },

  {
    value: "Soft Drink",
    label: "Carbonated Soft Drink",
    group: "Non-Alcoholic",
    description: "Carbonated sodas and fizzy drinks",
  },
  {
    value: "Soft Drink",
    label: "Still Soft Drink",
    group: "Non-Alcoholic",
    description: "Non-carbonated soft drinks",
  },
  {
    value: "Soft Drink",
    label: "Energy Drink",
    group: "Non-Alcoholic",
    description: "Caffeinated energy drinks",
  },
  {
    value: "Soft Drink",
    label: "Sports Drink",
    group: "Non-Alcoholic",
    description: "Isotonic and sports hydration drinks",
  },
  {
    value: "Juice",
    label: "100% Juice",
    group: "Non-Alcoholic",
    description: "Pure fruit or vegetable juice",
  },
  {
    value: "Juice",
    label: "Juice Drink",
    group: "Non-Alcoholic",
    description: "Juice-based drinks with added ingredients",
  },
  {
    value: "Juice",
    label: "Smoothie",
    group: "Non-Alcoholic",
    description: "Blended fruit and vegetable smoothies",
  },
  {
    value: "Water",
    label: "Still Water",
    group: "Non-Alcoholic",
    description: "Bottled still water",
  },
  {
    value: "Water",
    label: "Sparkling Water",
    group: "Non-Alcoholic",
    description: "Carbonated bottled water",
  },
  {
    value: "Water",
    label: "Flavoured Water",
    group: "Non-Alcoholic",
    description: "Water with natural flavourings",
  },
  {
    value: "Soft Drink",
    label: "Functional Beverage",
    group: "Non-Alcoholic",
    description: "Wellness drinks with added functional ingredients",
  },
  {
    value: "Soft Drink",
    label: "Plant-based Milk",
    group: "Non-Alcoholic",
    description: "Oat, almond, soy, and other plant-based milks",
  },
  {
    value: "Soft Drink",
    label: "Coffee Drink",
    group: "Non-Alcoholic",
    description: "Ready-to-drink coffee beverages",
  },
  {
    value: "Soft Drink",
    label: "Tea Drink",
    group: "Non-Alcoholic",
    description: "Ready-to-drink tea beverages including iced tea",
  },
  {
    value: "Soft Drink",
    label: "Kombucha (Non-Alcoholic)",
    group: "Non-Alcoholic",
    description: "Fermented tea without significant alcohol",
  },
  {
    value: "Non-Alcoholic Alternative",
    label: "Non-Alcoholic Spirit",
    group: "Non-Alcoholic",
    description: "Zero-alcohol spirit alternatives",
  },
  {
    value: "Non-Alcoholic Alternative",
    label: "Non-Alcoholic Liqueur",
    group: "Non-Alcoholic",
    description: "Zero-alcohol liqueur alternatives",
  },
  {
    value: "Non-Alcoholic Alternative",
    label: "Non-Alcoholic Beer",
    group: "Non-Alcoholic",
    description: "Zero-alcohol and low-alcohol beer",
  },
  {
    value: "Non-Alcoholic Alternative",
    label: "Non-Alcoholic Wine",
    group: "Non-Alcoholic",
    description: "Dealcoholised wine and zero-alcohol wine alternatives",
  },
  {
    value: "Non-Alcoholic Alternative",
    label: "Non-Alcoholic Cider",
    group: "Non-Alcoholic",
    description: "Zero-alcohol cider alternatives",
  },
];

export const PRODUCT_CATEGORY_GROUPS = [
  "Spirits",
  "Beer & Cider",
  "Wine",
  "Ready-to-Drink & Cocktails",
  "Non-Alcoholic",
];

export function getCategoriesByGroup(group: string): ProductCategory[] {
  return PRODUCT_CATEGORIES.filter((cat) => cat.group === group);
}

export function getCategoryByValue(value: string): ProductCategory | undefined {
  return PRODUCT_CATEGORIES.find((cat) => cat.value === value);
}
