import { describe, it, expect } from 'vitest';
import { htmlToText, findProductLinks, sanitise } from '@/lib/outreach/enrich-brand-for-report';

describe('htmlToText', () => {
  it('strips scripts, styles, tags and collapses whitespace', () => {
    const html = `<html><head><style>.a{color:red}</style><script>var x=1</script></head>
      <body><h1>Avallen</h1><p>The world's first&nbsp;carbon-negative <b>Calvados</b>.</p></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Avallen');
    expect(text).toContain('Calvados');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('var x');
    expect(text).not.toMatch(/<[^>]+>/); // no tags left
  });
});

describe('findProductLinks', () => {
  const base = 'https://avallenspirits.com';

  it('finds same-host product/shop links and resolves relative URLs', () => {
    const html = `
      <a href="/shop">Shop</a>
      <a href="/products/avallen-calvados">Avallen Calvados</a>
      <a href="https://avallenspirits.com/our-range">Our range</a>
    `;
    const links = findProductLinks(html, base);
    expect(links).toContain('https://avallenspirits.com/shop');
    expect(links).toContain('https://avallenspirits.com/products/avallen-calvados');
    expect(links).toContain('https://avallenspirits.com/our-range');
  });

  it('excludes nav/legal/social and off-host links', () => {
    const html = `
      <a href="/cart">Basket</a>
      <a href="/privacy">Privacy</a>
      <a href="/blog/news">Journal</a>
      <a href="https://instagram.com/avallen">Instagram</a>
      <a href="https://otherbrand.com/shop">Other shop</a>
    `;
    const links = findProductLinks(html, base);
    expect(links).toEqual([]); // none qualify
  });

  it('dedupes and is bounded', () => {
    const html = Array.from({ length: 20 }, (_, i) => `<a href="/shop">Shop ${i}</a>`).join('');
    const links = findProductLinks(html, base);
    expect(links).toEqual(['https://avallenspirits.com/shop']); // deduped to one
  });
});

describe('sanitise', () => {
  it('keeps a specific category, country and de-duped products with rounded sizes', () => {
    const out = sanitise(
      {
        category: ' Calvados ',
        country_of_origin: 'France',
        products: [
          { name: 'Avallen Calvados', container_size_ml: 700 },
          { name: 'Avallen Calvados', container_size_ml: 700 }, // dup name
          { name: 'Avallen Calvados 4.5L', container_size_ml: 4500 },
          { name: 'Gift card', container_size_ml: 0 }, // size 0 → null
        ],
      },
      3,
    );
    expect(out.category).toBe('Calvados');
    expect(out.countryOfOrigin).toBe('France');
    expect(out.products).toHaveLength(3);
    expect(out.products[0]).toEqual({ name: 'Avallen Calvados', containerSizeMl: 700 });
    expect(out.products[2].containerSizeMl).toBeNull(); // 0 → null
    expect(out.pagesRead).toBe(3);
  });

  it('coerces the literal string "null" and missing fields to null/empty', () => {
    const out = sanitise({ category: 'null', country_of_origin: '', products: 'not-an-array' }, 0);
    expect(out.category).toBeNull();
    expect(out.countryOfOrigin).toBeNull();
    expect(out.products).toEqual([]);
  });
});
