import { describe, it, expect } from 'vitest';
import {
  mapSupplierEoLPathway,
  certificationsImplyOrganic,
  packagingDeclaredFacts,
  ingredientDeclaredFacts,
  supplierDeliveryDefaults,
} from '../declared-facts';

/**
 * Propagating what a supplier has already declared. The two link handlers this
 * replaces had no test at all, which is how three fields with a home on the
 * material row (recyclability, end-of-life pathway, organic certification)
 * came to be silently dropped.
 *
 * Two rules matter more than the copying itself: never overwrite an answer the
 * user gave, and never assert a certification the supplier did not claim.
 */

describe('mapSupplierEoLPathway', () => {
  it('passes through the pathways the form can show', () => {
    for (const p of ['landfill', 'incineration', 'recycling', 'composting', 'reuse', 'unknown']) {
      expect(mapSupplierEoLPathway(p)).toBe(p);
    }
  });

  it('refuses the two supplier pathways the form has no option for', () => {
    // supplier_products allows these; the packaging form does not. Copying one
    // across would set a value the user can neither see nor change.
    expect(mapSupplierEoLPathway('anaerobic_digestion')).toBeNull();
    expect(mapSupplierEoLPathway('mixed')).toBeNull();
  });

  it('handles absent values', () => {
    expect(mapSupplierEoLPathway(null)).toBeNull();
    expect(mapSupplierEoLPathway(undefined)).toBeNull();
    expect(mapSupplierEoLPathway('')).toBeNull();
  });
});

describe('certificationsImplyOrganic', () => {
  it('recognises an organic claim', () => {
    expect(certificationsImplyOrganic(['EU Organic'])).toBe(true);
    expect(certificationsImplyOrganic(['Soil Association'])).toBe(true);
    expect(certificationsImplyOrganic(['Ecocert'])).toBe(true);
    expect(certificationsImplyOrganic(['B Corp', 'organic'])).toBe(true);
  });

  it('is case insensitive', () => {
    expect(certificationsImplyOrganic(['ORGANIC'])).toBe(true);
    expect(certificationsImplyOrganic(['soil association'])).toBe(true);
  });

  it('does not infer organic from unrelated certifications', () => {
    // Ticking an organic box the supplier never claimed is a compliance
    // problem, not a convenience.
    expect(certificationsImplyOrganic(['B Corp'])).toBe(false);
    expect(certificationsImplyOrganic(['Fairtrade', 'Rainforest Alliance'])).toBe(false);
    expect(certificationsImplyOrganic([])).toBe(false);
    expect(certificationsImplyOrganic(null)).toBe(false);
    expect(certificationsImplyOrganic(undefined)).toBe(false);
  });
});

describe('packagingDeclaredFacts', () => {
  const SUPPLIER = {
    recyclability_pct: 92,
    end_of_life_pathway: 'recycling',
    primary_material: 'glass',
  };

  it('fills the three fields that used to be dropped', () => {
    expect(packagingDeclaredFacts(SUPPLIER, {})).toEqual({
      recyclability_percent: 92,
      end_of_life_pathway: 'recycling',
      container_material: 'glass',
    });
  });

  it('never overwrites an answer the user already gave', () => {
    expect(
      packagingDeclaredFacts(SUPPLIER, {
        recyclability_percent: 40,
        end_of_life_pathway: 'landfill',
        container_material: 'aluminium',
      })
    ).toEqual({});
  });

  it('treats an empty string as unanswered, since that is how the form holds blank', () => {
    expect(
      packagingDeclaredFacts(SUPPLIER, {
        recyclability_percent: '',
        end_of_life_pathway: '',
        container_material: '',
      })
    ).toEqual({
      recyclability_percent: 92,
      end_of_life_pathway: 'recycling',
      container_material: 'glass',
    });
  });

  it('keeps a recyclability of zero, which is a real answer', () => {
    expect(packagingDeclaredFacts({ recyclability_pct: 0 }, {})).toEqual({
      recyclability_percent: 0,
    });
  });

  it('does not fill a pathway the form cannot display', () => {
    expect(
      packagingDeclaredFacts({ end_of_life_pathway: 'anaerobic_digestion' }, {})
    ).toEqual({});
  });

  it('copies nothing when the supplier declared nothing', () => {
    expect(packagingDeclaredFacts({}, {})).toEqual({});
  });
});

describe('ingredientDeclaredFacts', () => {
  it('ticks organic when the supplier declared it', () => {
    expect(
      ingredientDeclaredFacts({ certifications: ['EU Organic'] }, { is_organic_certified: false })
    ).toEqual({ is_organic_certified: true });
  });

  it('never clears a flag the user set themselves', () => {
    // Silence about organic certification is not evidence of conventional.
    expect(
      ingredientDeclaredFacts({ certifications: ['B Corp'] }, { is_organic_certified: true })
    ).toEqual({});
    expect(ingredientDeclaredFacts({}, { is_organic_certified: true })).toEqual({});
  });

  it('leaves the flag alone for unrelated certifications', () => {
    expect(
      ingredientDeclaredFacts({ certifications: ['Fairtrade'] }, { is_organic_certified: false })
    ).toEqual({});
  });
});

describe('supplierDeliveryDefaults', () => {
  const SUPPLIER = {
    origin_address: 'Speyside, Scotland',
    origin_lat: 57.4,
    origin_lng: -3.2,
    origin_country_code: 'GB',
    transport_legs: [{ id: 'l1', transportMode: 'truck', distanceKm: 120 }],
    inbound_container_type: 'ibc',
    inbound_container_volume_l: 1000,
    inbound_container_tare_kg: 55,
    inbound_container_reuse_cycles: 20,
    inbound_container_material: 'hdpe',
  };

  it('fills origin, route and container from the supplier', () => {
    const d = supplierDeliveryDefaults(SUPPLIER, {});
    expect(d.origin_address).toBe('Speyside, Scotland');
    expect(d.origin_lat).toBe(57.4);
    expect(d.origin_lng).toBe(-3.2);
    expect(d.origin_country_code).toBe('GB');
    expect(d.origin_country).toBe('GB');
    expect(d.transport_legs).toHaveLength(1);
    expect(d.inbound_container_type).toBe('ibc');
    expect(d.inbound_container_volume_l).toBe(1000);
    expect(d.inbound_container_reuse_cycles).toBe(20);
  });

  it('falls back to the supplier profile when the product has no origin', () => {
    const d = supplierDeliveryDefaults(
      { supplier_city: 'Cognac', supplier_country: 'France' },
      {}
    );
    expect(d.origin_address).toBe('Cognac, France');
  });

  it('never overwrites an origin the row already carries', () => {
    const d = supplierDeliveryDefaults(SUPPLIER, {
      origin_address: 'Islay',
      origin_lat: 55.7,
      origin_lng: -6.2,
      origin_country_code: 'GB',
    });
    expect(d.origin_address).toBeUndefined();
    expect(d.origin_lat).toBeUndefined();
    expect(d.origin_country_code).toBeUndefined();
  });

  it('only copies coordinates as a complete pair', () => {
    // product_materials has an origin_coordinates_completeness CHECK, so half
    // a pair is rejected by the database, not merely useless.
    expect(supplierDeliveryDefaults({ origin_lat: 57.4 }, {}).origin_lat).toBeUndefined();
    expect(supplierDeliveryDefaults({ origin_lng: -3.2 }, {}).origin_lng).toBeUndefined();
  });

  it('does not replace a route the row already has', () => {
    const d = supplierDeliveryDefaults(SUPPLIER, {
      transport_legs: [{ id: 'own', transportMode: 'ship', distanceKm: 900 }],
    });
    expect(d.transport_legs).toBeUndefined();
  });

  it('treats an empty leg array as no route', () => {
    const d = supplierDeliveryDefaults(SUPPLIER, { transport_legs: [] });
    expect(d.transport_legs).toHaveLength(1);
  });

  it('carries container dimensions only alongside a container type', () => {
    // A tare weight attached to no container is meaningless.
    const d = supplierDeliveryDefaults(
      { inbound_container_tare_kg: 55, inbound_container_volume_l: 1000 },
      {}
    );
    expect(d.inbound_container_type).toBeUndefined();
    expect(d.inbound_container_tare_kg).toBeUndefined();
    expect(d.inbound_container_volume_l).toBeUndefined();
  });

  it('leaves the container alone when the row already names one', () => {
    const d = supplierDeliveryDefaults(SUPPLIER, { inbound_container_type: 'drum' });
    expect(d.inbound_container_type).toBeUndefined();
    expect(d.inbound_container_tare_kg).toBeUndefined();
  });

  it('copies nothing from an empty supplier product', () => {
    expect(supplierDeliveryDefaults({}, {})).toEqual({});
  });
});
