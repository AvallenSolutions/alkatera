import { describe, it, expect } from 'vitest';
import {
  derivePackFormatName,
  definingComponent,
  assignPackFormatNames,
  type NameablePack,
} from '../pack-name';
import type { PackComponent } from '../pack-identity';

const component = (over: Partial<PackComponent> = {}): PackComponent => ({
  material_name: null,
  packaging_category: null,
  net_weight_g: null,
  ...over,
});

const BOTTLE = component({
  material_name: '700ml Flint Glass Bottle',
  packaging_category: 'container',
  net_weight_g: 530,
});
const LABEL = component({
  material_name: 'Paper Label (Front & Back)',
  packaging_category: 'label',
  net_weight_g: 3,
});
const CASE = component({
  material_name: 'Cardboard Case (6pk)',
  packaging_category: 'secondary',
  net_weight_g: 40,
});
const GIFT_BOX = component({
  material_name: 'Presentation Gift Box',
  packaging_category: 'secondary',
  net_weight_g: 120,
});

describe('definingComponent', () => {
  it('picks the container even when something else is heavier', () => {
    const heavyCase = component({
      material_name: 'Wooden Crate',
      packaging_category: 'secondary',
      net_weight_g: 4000,
    });
    expect(definingComponent([heavyCase, BOTTLE])).toBe(BOTTLE);
  });

  it('picks the heaviest container when there are several', () => {
    const small = component({
      material_name: '50ml Miniature',
      packaging_category: 'container',
      net_weight_g: 90,
    });
    expect(definingComponent([small, BOTTLE])).toBe(BOTTLE);
  });

  it('falls back to the heaviest component when there is no container', () => {
    // A shipper-only pack: all secondary, no bottle of its own.
    expect(definingComponent([LABEL, GIFT_BOX])).toBe(GIFT_BOX);
  });

  it('has nothing to say about a pack with no components', () => {
    expect(definingComponent([])).toBeNull();
  });
});

describe('derivePackFormatName', () => {
  it('names a pack after its container', () => {
    expect(derivePackFormatName([BOTTLE, LABEL, CASE])).toBe('700ml Flint Glass Bottle');
  });

  it('prefers the parametric class and variant when the row has them', () => {
    const can = component({
      material_name: 'SKU 4471-A',
      packaging_category: 'container',
      packaging_material_class: 'Can',
      packaging_material_variant: 'Aluminium',
      net_weight_g: 16,
    });
    // "SKU 4471-A" tells a user nothing; the class does.
    expect(derivePackFormatName([can])).toBe('aluminium can');
  });

  it('returns null when there is nothing to derive from', () => {
    expect(derivePackFormatName([])).toBeNull();
    expect(derivePackFormatName([component({ material_name: '   ' })])).toBeNull();
  });
});

describe('assignPackFormatNames', () => {
  const pack = (id: string, components: PackComponent[], over: Partial<NameablePack> = {}): NameablePack => ({
    id,
    name: `Product ${id}`,
    components,
    ...over,
  });

  it('names every pack after what it is', () => {
    const names = assignPackFormatNames([pack('a', [BOTTLE, LABEL, CASE])]);
    expect(names.get('a')).toBe('700ml Flint Glass Bottle');
  });

  it('never touches a pack a human has named', () => {
    const names = assignPackFormatNames([
      pack('a', [BOTTLE], { name: 'The squat 70', name_is_custom: true }),
    ]);
    expect(names.has('a')).toBe(false);
  });

  it('lets two packs sharing a container share a name', () => {
    // The real case: Bath Gin and Highland Reserve are both a 700ml flint
    // bottle and differ only in the outer. Both become "700ml Flint Glass
    // Bottle", which is the honest answer — they are near-duplicates, and the
    // shelf shows the components and products that tell them apart.
    const names = assignPackFormatNames([
      pack('sixpack', [BOTTLE, LABEL, CASE]),
      pack('gift', [BOTTLE, LABEL, GIFT_BOX]),
    ]);
    expect(names.get('sixpack')).toBe('700ml Flint Glass Bottle');
    expect(names.get('gift')).toBe('700ml Flint Glass Bottle');
  });

  it('leaves a pack alone when its name is already what we would derive', () => {
    const names = assignPackFormatNames([
      pack('a', [BOTTLE, LABEL], { name: '700ml Flint Glass Bottle' }),
    ]);
    expect(names.has('a')).toBe(false);
  });

  it('leaves a lone pack undecorated', () => {
    const names = assignPackFormatNames([
      pack('a', [BOTTLE, LABEL, CASE]),
      pack('b', [component({ material_name: '330ml Aluminium Can', packaging_category: 'container', net_weight_g: 13 })]),
    ]);
    expect(names.get('a')).toBe('700ml Flint Glass Bottle');
    expect(names.get('b')).toBe('330ml Aluminium Can');
  });

  it('does not invent a distinction that is not there', () => {
    // Two genuinely identical packs keep the same name. They are duplicates,
    // and pack-identity proposes the merge; inventing different names here
    // would hide exactly the thing the user should see.
    const names = assignPackFormatNames([
      pack('a', [BOTTLE, LABEL, CASE]),
      pack('b', [BOTTLE, LABEL, CASE]),
    ]);
    expect(names.get('a')).toBe('700ml Flint Glass Bottle');
    expect(names.get('b')).toBe('700ml Flint Glass Bottle');
  });

  it('skips packs with nothing to derive from, rather than blanking them', () => {
    const names = assignPackFormatNames([pack('empty', [])]);
    expect(names.has('empty')).toBe(false);
  });
});
