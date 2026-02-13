import { describe, it, expect } from 'vitest';
import {
  mapActivityToRPD,
  mapRPDToActivity,
  mapMaterialToRPD,
  deriveMaterialSubtype,
  mapNationToRPD,
  mapRPDToNation,
  mapRAMRatingToRPD,
  derivePackagingType,
  derivePackagingClass,
  categoryToPackagingLevel,
} from '@/lib/epr/mappings';

// =============================================================================
// mapActivityToRPD
// =============================================================================

describe('mapActivityToRPD', () => {
  it('maps "brand" to "SO"', () => {
    expect(mapActivityToRPD('brand')).toBe('SO');
  });

  it('maps "packed_filled" to "PF"', () => {
    expect(mapActivityToRPD('packed_filled')).toBe('PF');
  });

  it('maps "imported" to "IM"', () => {
    expect(mapActivityToRPD('imported')).toBe('IM');
  });

  it('maps "empty" to "SE"', () => {
    expect(mapActivityToRPD('empty')).toBe('SE');
  });

  it('maps "hired" to "HL"', () => {
    expect(mapActivityToRPD('hired')).toBe('HL');
  });

  it('maps "marketplace" to "OM"', () => {
    expect(mapActivityToRPD('marketplace')).toBe('OM');
  });
});

// =============================================================================
// mapRPDToActivity (reverse mapping)
// =============================================================================

describe('mapRPDToActivity', () => {
  it('maps "SO" back to "brand"', () => {
    expect(mapRPDToActivity('SO')).toBe('brand');
  });

  it('maps "PF" back to "packed_filled"', () => {
    expect(mapRPDToActivity('PF')).toBe('packed_filled');
  });

  it('maps "IM" back to "imported"', () => {
    expect(mapRPDToActivity('IM')).toBe('imported');
  });

  it('maps "SE" back to "empty"', () => {
    expect(mapRPDToActivity('SE')).toBe('empty');
  });

  it('maps "HL" back to "hired"', () => {
    expect(mapRPDToActivity('HL')).toBe('hired');
  });

  it('maps "OM" back to "marketplace"', () => {
    expect(mapRPDToActivity('OM')).toBe('marketplace');
  });

  it('defaults to "brand" for unknown RPD code', () => {
    // Cast to bypass type checking for edge case
    expect(mapRPDToActivity('XX' as any)).toBe('brand');
  });
});

// =============================================================================
// mapMaterialToRPD
// =============================================================================

describe('mapMaterialToRPD', () => {
  it('maps "aluminium" to "AL"', () => {
    expect(mapMaterialToRPD('aluminium')).toBe('AL');
  });

  it('maps "fibre_composite" to "FC"', () => {
    expect(mapMaterialToRPD('fibre_composite')).toBe('FC');
  });

  it('maps "glass" to "GL"', () => {
    expect(mapMaterialToRPD('glass')).toBe('GL');
  });

  it('maps "paper_cardboard" to "PC"', () => {
    expect(mapMaterialToRPD('paper_cardboard')).toBe('PC');
  });

  it('maps "plastic_rigid" to "PL"', () => {
    expect(mapMaterialToRPD('plastic_rigid')).toBe('PL');
  });

  it('maps "plastic_flexible" to "PL"', () => {
    expect(mapMaterialToRPD('plastic_flexible')).toBe('PL');
  });

  it('maps "steel" to "ST"', () => {
    expect(mapMaterialToRPD('steel')).toBe('ST');
  });

  it('maps "wood" to "WD"', () => {
    expect(mapMaterialToRPD('wood')).toBe('WD');
  });

  it('maps "other" to "OT"', () => {
    expect(mapMaterialToRPD('other')).toBe('OT');
  });

  // Sub-component materials
  it('maps "adhesive" to "OT"', () => {
    expect(mapMaterialToRPD('adhesive')).toBe('OT');
  });

  it('maps "ink" to "OT"', () => {
    expect(mapMaterialToRPD('ink')).toBe('OT');
  });

  it('maps "coating" to "OT"', () => {
    expect(mapMaterialToRPD('coating')).toBe('OT');
  });

  it('maps "lacquer" to "OT"', () => {
    expect(mapMaterialToRPD('lacquer')).toBe('OT');
  });

  it('defaults to "OT" for unknown material type', () => {
    expect(mapMaterialToRPD('unknown_material' as any)).toBe('OT');
  });
});

// =============================================================================
// deriveMaterialSubtype
// =============================================================================

describe('deriveMaterialSubtype', () => {
  it('returns "Rigid" for plastic_rigid', () => {
    expect(deriveMaterialSubtype('plastic_rigid')).toBe('Rigid');
  });

  it('returns "Flexible" for plastic_flexible', () => {
    expect(deriveMaterialSubtype('plastic_flexible')).toBe('Flexible');
  });

  it('returns null for glass', () => {
    expect(deriveMaterialSubtype('glass')).toBeNull();
  });

  it('returns null for aluminium', () => {
    expect(deriveMaterialSubtype('aluminium')).toBeNull();
  });

  it('returns null for steel', () => {
    expect(deriveMaterialSubtype('steel')).toBeNull();
  });

  it('returns null for paper_cardboard', () => {
    expect(deriveMaterialSubtype('paper_cardboard')).toBeNull();
  });
});

// =============================================================================
// mapNationToRPD
// =============================================================================

describe('mapNationToRPD', () => {
  it('maps "england" to "EN"', () => {
    expect(mapNationToRPD('england')).toBe('EN');
  });

  it('maps "scotland" to "SC"', () => {
    expect(mapNationToRPD('scotland')).toBe('SC');
  });

  it('maps "wales" to "WS"', () => {
    expect(mapNationToRPD('wales')).toBe('WS');
  });

  it('maps "northern_ireland" to "NI"', () => {
    expect(mapNationToRPD('northern_ireland')).toBe('NI');
  });
});

// =============================================================================
// mapRPDToNation (reverse mapping)
// =============================================================================

describe('mapRPDToNation', () => {
  it('maps "EN" back to "england"', () => {
    expect(mapRPDToNation('EN')).toBe('england');
  });

  it('maps "SC" back to "scotland"', () => {
    expect(mapRPDToNation('SC')).toBe('scotland');
  });

  it('maps "WS" back to "wales"', () => {
    expect(mapRPDToNation('WS')).toBe('wales');
  });

  it('maps "NI" back to "northern_ireland"', () => {
    expect(mapRPDToNation('NI')).toBe('northern_ireland');
  });

  it('defaults to "england" for unknown RPD nation code', () => {
    expect(mapRPDToNation('XX' as any)).toBe('england');
  });
});

// =============================================================================
// mapRAMRatingToRPD
// =============================================================================

describe('mapRAMRatingToRPD', () => {
  describe('when modulated (Year 2+)', () => {
    it('maps "red" to "R-M"', () => {
      expect(mapRAMRatingToRPD('red', true)).toBe('R-M');
    });

    it('maps "amber" to "A-M"', () => {
      expect(mapRAMRatingToRPD('amber', true)).toBe('A-M');
    });

    it('maps "green" to "G-M"', () => {
      expect(mapRAMRatingToRPD('green', true)).toBe('G-M');
    });
  });

  describe('when not modulated (Year 1)', () => {
    it('maps "red" to "R"', () => {
      expect(mapRAMRatingToRPD('red', false)).toBe('R');
    });

    it('maps "amber" to "A"', () => {
      expect(mapRAMRatingToRPD('amber', false)).toBe('A');
    });

    it('maps "green" to "G"', () => {
      expect(mapRAMRatingToRPD('green', false)).toBe('G');
    });
  });

  describe('with null/undefined rating', () => {
    it('returns null for null rating (modulated)', () => {
      expect(mapRAMRatingToRPD(null, true)).toBeNull();
    });

    it('returns null for undefined rating (modulated)', () => {
      expect(mapRAMRatingToRPD(undefined, true)).toBeNull();
    });

    it('returns null for null rating (not modulated)', () => {
      expect(mapRAMRatingToRPD(null, false)).toBeNull();
    });

    it('returns null for undefined rating (not modulated)', () => {
      expect(mapRAMRatingToRPD(undefined, false)).toBeNull();
    });
  });
});

// =============================================================================
// derivePackagingType
// =============================================================================

describe('derivePackagingType', () => {
  describe('drinks containers', () => {
    it('returns "HDC" for household drinks container', () => {
      expect(derivePackagingType('container', true, true)).toBe('HDC');
    });

    it('returns "NDC" for non-household drinks container', () => {
      expect(derivePackagingType('container', false, true)).toBe('NDC');
    });

    it('returns "HDC" for drinks container label (household)', () => {
      expect(derivePackagingType('label', true, true)).toBe('HDC');
    });

    it('returns "NDC" for drinks container closure (non-household)', () => {
      expect(derivePackagingType('closure', false, true)).toBe('NDC');
    });
  });

  describe('primary packaging (not drinks container)', () => {
    it('returns "HH" for household container', () => {
      expect(derivePackagingType('container', true, false)).toBe('HH');
    });

    it('returns "NH" for non-household container', () => {
      expect(derivePackagingType('container', false, false)).toBe('NH');
    });

    it('returns "HH" for household label', () => {
      expect(derivePackagingType('label', true, false)).toBe('HH');
    });

    it('returns "NH" for non-household label', () => {
      expect(derivePackagingType('label', false, false)).toBe('NH');
    });

    it('returns "HH" for household closure', () => {
      expect(derivePackagingType('closure', true, false)).toBe('HH');
    });

    it('returns "NH" for non-household closure', () => {
      expect(derivePackagingType('closure', false, false)).toBe('NH');
    });
  });

  describe('secondary/shipment/tertiary (always non-household)', () => {
    it('returns "NH" for secondary even when household flag is true', () => {
      expect(derivePackagingType('secondary', true, false)).toBe('NH');
    });

    it('returns "NH" for shipment even when household flag is true', () => {
      expect(derivePackagingType('shipment', true, false)).toBe('NH');
    });

    it('returns "NH" for tertiary even when household flag is true', () => {
      expect(derivePackagingType('tertiary', true, false)).toBe('NH');
    });

    it('returns "NH" for secondary when household flag is false', () => {
      expect(derivePackagingType('secondary', false, false)).toBe('NH');
    });
  });
});

// =============================================================================
// derivePackagingClass
// =============================================================================

describe('derivePackagingClass', () => {
  describe('with explicit packaging level', () => {
    it('returns "P1" for primary level', () => {
      expect(derivePackagingClass('primary', 'container')).toBe('P1');
    });

    it('returns "O1" for secondary level', () => {
      expect(derivePackagingClass('secondary', 'container')).toBe('O1');
    });

    it('returns "O2" for shipment level', () => {
      expect(derivePackagingClass('shipment', 'container')).toBe('O2');
    });

    it('returns "B1" for tertiary level', () => {
      expect(derivePackagingClass('tertiary', 'container')).toBe('B1');
    });
  });

  describe('derived from packaging category (null/undefined level)', () => {
    it('returns "P1" for container category', () => {
      expect(derivePackagingClass(null, 'container')).toBe('P1');
    });

    it('returns "P1" for label category', () => {
      expect(derivePackagingClass(null, 'label')).toBe('P1');
    });

    it('returns "P1" for closure category', () => {
      expect(derivePackagingClass(null, 'closure')).toBe('P1');
    });

    it('returns "O1" for secondary category', () => {
      expect(derivePackagingClass(null, 'secondary')).toBe('O1');
    });

    it('returns "O2" for shipment category', () => {
      expect(derivePackagingClass(null, 'shipment')).toBe('O2');
    });

    it('returns "B1" for tertiary category', () => {
      expect(derivePackagingClass(null, 'tertiary')).toBe('B1');
    });

    it('returns "P1" for undefined packaging level', () => {
      expect(derivePackagingClass(undefined, 'container')).toBe('P1');
    });
  });

  describe('edge cases', () => {
    it('defaults to "P1" for unknown category with null level', () => {
      expect(derivePackagingClass(null, 'unknown' as any)).toBe('P1');
    });
  });
});

// =============================================================================
// categoryToPackagingLevel
// =============================================================================

describe('categoryToPackagingLevel', () => {
  it('maps "container" to "primary"', () => {
    expect(categoryToPackagingLevel('container')).toBe('primary');
  });

  it('maps "label" to "primary"', () => {
    expect(categoryToPackagingLevel('label')).toBe('primary');
  });

  it('maps "closure" to "primary"', () => {
    expect(categoryToPackagingLevel('closure')).toBe('primary');
  });

  it('maps "secondary" to "secondary"', () => {
    expect(categoryToPackagingLevel('secondary')).toBe('secondary');
  });

  it('maps "shipment" to "shipment"', () => {
    expect(categoryToPackagingLevel('shipment')).toBe('shipment');
  });

  it('maps "tertiary" to "tertiary"', () => {
    expect(categoryToPackagingLevel('tertiary')).toBe('tertiary');
  });
});
