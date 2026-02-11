import { describe, it, expect } from 'vitest';
import {
  getPreferredDatabase,
  getAgribalysePatterns,
  AGRIBALYSE_PREFERRED_ALIASES,
  ECOINVENT_PREFERRED_CATEGORIES,
} from '../openlca/agribalyse-aliases';

// ============================================================================
// getPreferredDatabase()
// ============================================================================

describe('getPreferredDatabase', () => {
  // ── Agribalyse-preferred ingredients ──────────────────────────────────

  describe('routes drinks-specific ingredients to Agribalyse', () => {
    const agribalyseIngredients = [
      // Wine & Viticulture
      'wine grape', 'Wine Grapes', 'grape for wine', 'raisin de cuve',
      'cider apple', 'Cider Apples',
      // Grains
      'barley', 'Barley Grain', 'orge',
      'wheat', 'Wheat Grain', 'blé',
      // Sweeteners
      'beet sugar', 'Sugar Beet', 'sucre betterave',
      'honey', 'Miel',
      // Dairy & Plant Milks
      'cow milk', 'Whole Milk', 'dairy milk', 'lait',
      'cream', 'Dairy Cream', 'crème',
      'oat milk', 'Oat Drink',
      'soy milk', 'Soya Milk',
      'almond milk', 'Almond Drink',
      'coconut milk', 'Coconut Drink',
      // Fruits
      'orange', 'Orange Juice',
      'lemon', 'citron',
      'pineapple', 'ananas',
      // Coffee & Tea
      'coffee', 'Coffee Bean', 'café',
      'green tea', 'thé vert',
      'black tea', 'thé noir',
      'cocoa', 'Cocoa Powder', 'cacao',
      // Spices & Botanicals
      'ginger', 'gingembre',
      'cinnamon', 'cannelle',
      'vanilla', 'vanille',
      'mint', 'menthe',
      // Nuts
      'almond', 'Almonds', 'amande',
      'hazelnut', 'Hazelnuts', 'noisette',
      'coconut', 'noix de coco',
    ];

    it.each(agribalyseIngredients)('"%s" → agribalyse', (name) => {
      expect(getPreferredDatabase(name)).toBe('agribalyse');
    });
  });

  // ── Ecoinvent-preferred categories ────────────────────────────────────

  describe('routes energy, transport, packaging, chemicals to ecoinvent', () => {
    const ecoinventIngredients = [
      'electricity, medium voltage',
      'natural gas, high pressure',
      'diesel, burned in machine',
      'fuel oil, light',
      'heating, natural gas',
      'transport, freight, lorry',
      'HGV transport 40t',
      'lorry 16-32t',
      'freight, sea',
      'shipping, transoceanic',
      'glass bottle production',
      'aluminium can',
      'PET bottle',
      'cardboard box',
      'steel sheet',
      'plastic film',
      'polyethylene, high density',
      'polypropylene, granulate',
      'sodium hydroxide production',
      'chlorine, gaseous',
      'nitrogen gas',
    ];

    it.each(ecoinventIngredients)('"%s" → ecoinvent', (name) => {
      expect(getPreferredDatabase(name)).toBe('ecoinvent');
    });
  });

  // ── Ecoinvent-preferred takes precedence ──────────────────────────────

  describe('ecoinvent categories take priority over Agribalyse aliases', () => {
    it('routes "electricity from barley straw" to ecoinvent (electricity keyword wins)', () => {
      expect(getPreferredDatabase('electricity from barley straw')).toBe('ecoinvent');
    });

    it('routes "transport of honey" to ecoinvent (transport keyword wins)', () => {
      expect(getPreferredDatabase('transport of honey')).toBe('ecoinvent');
    });

    it('routes "glass bottle for orange juice" to ecoinvent (glass bottle keyword wins)', () => {
      expect(getPreferredDatabase('glass bottle for orange juice')).toBe('ecoinvent');
    });
  });

  // ── Default fallback ──────────────────────────────────────────────────

  describe('defaults to ecoinvent for unmapped ingredients', () => {
    const unmappedIngredients = [
      'calcium carbonate',
      'activated carbon',
      'bentonite clay',
      'sulfur dioxide',
      'potassium metabisulfite',
      'yeast, generic',
      'diatomaceous earth',
    ];

    it.each(unmappedIngredients)('"%s" → ecoinvent (default)', (name) => {
      expect(getPreferredDatabase(name)).toBe('ecoinvent');
    });
  });

  // ── Case insensitivity ────────────────────────────────────────────────

  describe('is case-insensitive', () => {
    it('WINE GRAPE → agribalyse', () => {
      expect(getPreferredDatabase('WINE GRAPE')).toBe('agribalyse');
    });

    it('ELECTRICITY → ecoinvent', () => {
      expect(getPreferredDatabase('ELECTRICITY')).toBe('ecoinvent');
    });

    it('CoFfEe BeAn → agribalyse', () => {
      expect(getPreferredDatabase('CoFfEe BeAn')).toBe('agribalyse');
    });
  });

  // ── Partial matching ──────────────────────────────────────────────────

  describe('matches partial strings (substring matching)', () => {
    it('"organic barley malt" matches barley → agribalyse', () => {
      expect(getPreferredDatabase('organic barley malt')).toBe('agribalyse');
    });

    it('"French honey, lavender" matches honey → agribalyse', () => {
      expect(getPreferredDatabase('French honey, lavender')).toBe('agribalyse');
    });
  });
});

// ============================================================================
// getAgribalysePatterns()
// ============================================================================

describe('getAgribalysePatterns', () => {
  it('returns patterns for a known Agribalyse ingredient', () => {
    const patterns = getAgribalysePatterns('wine grape');
    expect(patterns).toEqual(['grape', 'raisin', 'viticulture']);
  });

  it('returns patterns for French search terms', () => {
    const patterns = getAgribalysePatterns('gingembre');
    expect(patterns).toEqual(['ginger', 'gingembre']);
  });

  it('returns patterns for plant milk', () => {
    const patterns = getAgribalysePatterns('oat milk');
    expect(patterns).toEqual(['oat milk', 'boisson avoine', 'lait avoine']);
  });

  it('returns null for unmapped ingredients', () => {
    expect(getAgribalysePatterns('calcium carbonate')).toBeNull();
  });

  it('returns null for ecoinvent-only categories', () => {
    expect(getAgribalysePatterns('electricity')).toBeNull();
  });

  it('is case-insensitive', () => {
    const patterns = getAgribalysePatterns('BARLEY');
    expect(patterns).toEqual(['barley', 'orge']);
  });

  it('matches partial strings', () => {
    const patterns = getAgribalysePatterns('organic honey from France');
    expect(patterns).toEqual(['honey', 'miel']);
  });
});

// ============================================================================
// Data integrity checks
// ============================================================================

describe('alias data integrity', () => {
  it('all AGRIBALYSE_PREFERRED_ALIASES have preferredDatabase = agribalyse', () => {
    for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
      expect(alias.preferredDatabase).toBe('agribalyse');
    }
  });

  it('all aliases have at least one search term', () => {
    for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
      expect(alias.searchTerms.length).toBeGreaterThan(0);
    }
  });

  it('all aliases have at least one Agribalyse pattern', () => {
    for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
      expect(alias.agribalysePatterns.length).toBeGreaterThan(0);
    }
  });

  it('all search terms are lowercase', () => {
    for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
      for (const term of alias.searchTerms) {
        expect(term).toBe(term.toLowerCase());
      }
    }
  });

  it('all ecoinvent preferred categories are lowercase', () => {
    for (const cat of ECOINVENT_PREFERRED_CATEGORIES) {
      expect(cat).toBe(cat.toLowerCase());
    }
  });

  it('no duplicate search terms across aliases', () => {
    const allTerms: string[] = [];
    for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
      allTerms.push(...alias.searchTerms);
    }
    const uniqueTerms = new Set(allTerms);
    expect(uniqueTerms.size).toBe(allTerms.length);
  });

  it('has valid category values', () => {
    const validCategories = ['ingredient', 'packaging', 'utility', 'transport'];
    for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
      expect(validCategories).toContain(alias.category);
    }
  });
});
