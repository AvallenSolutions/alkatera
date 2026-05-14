# Distributor SKU List — Field Reference

This document lists the columns the alka**tera** distributor portal recognises when you upload a product list (CSV, XLSX, or PDF). Use it to generate a sample spreadsheet for testing.

The parser auto-detects columns from a wide range of common header names — pick whichever feels natural for your data source.

---

## Required fields

| Column | What it is | Recognised header names | Example values |
|---|---|---|---|
| **brand_name** | The brand the SKU belongs to. Brands are deduplicated by name, so consistency matters across rows. | `brand`, `brand name`, `producer`, `supplier`, `winery`, `distillery`, `brewery`, `manufacturer`, `vendor`, `maker` | `Avallen Spirits`, `Chapel Down`, `Penderyn` |
| **product_name** | The full product name (one per row). | `product`, `product name`, `description`, `item`, `item description`, `name`, `sku name`, `wine name`, `product description` | `Avallen Calvados`, `Chapel Down Brut NV`, `Penderyn Madeira Finish` |

---

## Optional fields

| Column | What it is | Recognised header names | Example values |
|---|---|---|---|
| **sku_code** | Your internal SKU / item code. Just stored — not used to dedupe brands. | `sku`, `sku code`, `sku id`, `item code`, `product code`, `code`, `article`, `article number`, `item number`, `reference`, `ref` | `AVL-001`, `CD-VRB-22`, `PEN-MAD-50CL` |
| **category** | Drinks category. Used for filters in the brand list, the pillar tagging on the dashboard, and the public directory faceting. | `category`, `type`, `product type`, `product category`, `segment`, `class` | `Wine`, `Spirits`, `Beer`, `Soft Drinks`, `Cider`, `Fortified Wine`, `RTD` |
| **country_of_origin** | Where the product is made. The scraping pipeline may override this with what it finds on the brand's Wikipedia page. | `country`, `origin`, `country of origin`, `producing country`, `origin country` | `France`, `United Kingdom`, `Wales`, `Scotland`, `Italy`, `USA` |
| **website** | The brand's official website. **Highly recommended** — the scraping pipeline's main source is the brand's own website. Without it, only Wikipedia and the B Corp directory are tried and findings are sparse. The same value on every SKU row for a given brand is fine; only the first non-empty value per brand is used. | `website`, `url`, `web`, `web address`, `site`, `homepage`, `brand website`, `brand url`, `producer website` | `https://www.avallenspirits.com`, `chapeldown.com` |
| **listing_status** | Whether the SKU is currently active in your portfolio or has been delisted. Defaults to `active` if omitted. | `status`, `listing status`, `active`, `state` | `active`, `delisted` |

---

## Things to know when building your test sheet

- **Scale**: aim for **20–50 SKUs across 6–10 brands**. That gives the scraping pipeline, conflict-resolution, and dashboard distribution chart something to chew on without burning a lot of Anthropic credit. You can always add more later.
- **Brand name consistency**: write the brand name the same way on every row. The normaliser already strips `Ltd`, `SAS`, `Inc`, accents, and case differences — so `"Penderyn"` and `"Penderyn Distillery Co Ltd"` will dedupe to the same brand profile automatically. Whitespace and apostrophe variants are also normalised (`"Lyre's"` ≡ `"Lyres"`).
- **Real, scrape-able brands are most fun**: brands with active sustainability pages will produce richer scraping output than fictional ones. Good candidates: Avallen Spirits, Chapel Down, Pukka Herbs, Lyre's, Innocent, Belu, Karma Drinks, Tony's Chocolonely. Include at least one brand you know has a B Corp page so you can verify certification detection.
- **Mix in something fictional**: include one or two made-up brand names so you can see the "no website / no Wikipedia → cleanly skipped" path. Useful for sanity-checking that the agent doesn't fail loudly on unknown brands.
- **File format**: CSV, XLSX (`.xlsx`), or PDF. CSV is most reliable; XLSX is fine; PDF is best-effort (only structured tables are extracted). The first row must be the header.

---

## Minimum viable example

The absolute floor — two columns, two rows:

```csv
Brand,Product Name
Avallen Spirits,Avallen Calvados
Chapel Down,Chapel Down Brut NV
```

This produces 2 brand profiles, 2 SKUs, and triggers the scraping pipeline for both.

---

## Fuller example

A realistic 6-brand portfolio with mixed categories and SKU codes:

```csv
SKU,Brand,Product Name,Category,Country,Website
AVL-001,Avallen Spirits,Avallen Calvados,Spirits,France,https://www.avallenspirits.com
AVL-002,Avallen Spirits,Avallen Apple Cocktail Reserve,Spirits,France,https://www.avallenspirits.com
PEN-101,Penderyn,Penderyn Madeira Finish Single Malt,Spirits,Wales,https://penderyn.wales
PEN-102,Penderyn,Penderyn Sherrywood Single Malt,Spirits,Wales,https://penderyn.wales
PEN-103,Penderyn,Penderyn Rich Oak Single Malt,Spirits,Wales,https://penderyn.wales
CD-001,Chapel Down,Chapel Down Brut NV,Wine,United Kingdom,https://www.chapeldown.com
CD-002,Chapel Down,Chapel Down Vintage Reserve Brut,Wine,United Kingdom,https://www.chapeldown.com
CD-003,Chapel Down,Chapel Down Rosé Brut NV,Wine,United Kingdom,https://www.chapeldown.com
HAW-001,Hawkstone,Hawkstone Premium Lager,Beer,United Kingdom,https://hawkstone.co
HAW-002,Hawkstone,Hawkstone Premium IPA,Beer,United Kingdom,https://hawkstone.co
LYR-001,Lyre's,Lyre's American Malt,Soft Drinks,United Kingdom,https://lyres.co.uk
LYR-002,Lyre's,Lyre's Italian Orange,Soft Drinks,United Kingdom,https://lyres.co.uk
LYR-003,Lyre's,Lyre's Dry London Spirit,Soft Drinks,United Kingdom,https://lyres.co.uk
TH-001,Two Hoots Brewing Co,Two Hoots Session IPA,Beer,United Kingdom,
TH-002,Two Hoots Brewing Co,Two Hoots Pale Ale,Beer,United Kingdom,
```

15 SKUs across 6 brands (five real with live websites, one fictional with no website to test the graceful-skip path). Drop this into `/distributor/sku-lists/upload` to get a realistic test portfolio.
