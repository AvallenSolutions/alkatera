# Cowork task brief — daily directory enrichment

Paste this whole file as the recurring task prompt in your Claude Cowork
schedule. It tells Cowork exactly what to research per brand and the
exact CSV format the alka**tera** industry-directory importer expects.

The importer is **idempotent** — re-running with the same brands links
rather than duplicates, and only fills blank columns (it never
overwrites data already on a record). So a daily run is safe.

---

## Your job

For each brand in the input list, research its public profile and
product range, then output **two CSV files** with the exact headers
below:

- `brands.csv` — one row per brand
- `products.csv` — one row per product (referencing the brand by name)

Use the brand's own website first, then reputable secondary sources
(Wikipedia, B Corp directory, official retailers). Only record values
you can verify from a source. **Leave a cell blank rather than
guessing** — the importer fills blanks later from other sources, but a
wrong value is sticky.

### Input

A list of brand names (and websites if known). If no list is supplied,
fetch the current directory's brands that still have thin data from
`GET /api/admin/directory/uploads` context, or ask for a list.

---

## brands.csv — columns

| Column | Required | Rules |
|--------|----------|-------|
| `name` | yes | The brand's display name, e.g. `Hayman's Gin`. |
| `website` | no | Full URL incl. `https://`. The brand's primary site. |
| `category` | no | One of exactly: `spirits`, `wine`, `beer`, `non_alc`, `other`. |
| `country_of_origin` | no | ISO-2 code (`GB`, `FR`, `US`) or full country name. |
| `founding_year` | no | 4-digit year, e.g. `1863`. Integer only. |
| `parent_company` | no | Owning group if any, else blank. |
| `description` | no | 1–3 sentences. **Lead with the brand's sustainability story** (certifications, carbon, packaging, sourcing) where one exists; otherwise a neutral factual summary. Plain language, no jargon. British English. No em dashes. |
| `aliases` | no | Alternate spellings the matcher should recognise, **semicolon-separated**, e.g. `Haymans;Hayman Distillers`. |

Notes:
- `name` is the dedup key. Use the brand's canonical public name; put
  variants in `aliases`.
- Wrap any cell containing a comma in double quotes (standard CSV).

## products.csv — columns

| Column | Required | Rules |
|--------|----------|-------|
| `brand_name` | yes | Must match the `name` of a brand in `brands.csv` exactly (the importer matches products to brands by name; unmatched rows are skipped and reported). |
| `product_name` | yes | Include size in the name where it varies, e.g. `Hayman's London Dry Gin 70cl`. |
| `gtin` | no | The barcode (EAN-13 / UPC). Digits only — the importer strips spaces. This is the strongest dedup key, so capture it whenever a retailer or the brand lists it. |
| `category` | no | Same enum as brand `category`. |
| `abv` | no | Alcohol by volume %, e.g. `41.2`. Number only, no `%` sign. |
| `container_size_ml` | no | Integer millilitres, e.g. `700`. |
| `container_format` | no | One of exactly: `bottle`, `can`, `keg`, `bag_in_box`, `other`. |

---

## Quality rules

1. **Verify, don't invent.** Blank > wrong.
2. **Enums are exact.** `spirits` not `Spirits`, `non_alc` not `non-alcoholic`.
3. **One brand row per brand.** If the same brand appears twice in the
   input, merge into a single row and combine aliases.
4. **Products reference brands by exact name.** If you add a product,
   make sure its `brand_name` is present in `brands.csv`.
5. **British English, no em dashes**, in any description text.
6. Skip brands you cannot find a primary source for — note them in a
   short summary at the end of the run rather than padding the CSV.

---

## Where the data goes

### Preferred for a scheduled run: the JSON ingest endpoint (hands-free)

POST a single JSON body to the ingest endpoint — no file upload, no
clicking. Keys are the field names directly. Brands are processed
before products automatically.

```
POST https://www.alkatera.com/api/admin/directory/ingest
Authorization: Bearer {DIRECTORY_INGEST_TOKEN}     # falls back to CRON_SECRET
Content-Type: application/json

{
  "brands": [
    { "name": "Hayman's Gin", "website": "https://haymansgin.com",
      "category": "spirits", "country_of_origin": "GB",
      "founding_year": 1863, "description": "…", "aliases": "Haymans" }
  ],
  "products": [
    { "brand_name": "Hayman's Gin", "product_name": "Hayman's London Dry 70cl",
      "gtin": "5021692100019", "abv": 41.2, "container_size_ml": 700,
      "container_format": "bottle" }
  ]
}
```

Response reports created/linked counts and any skipped rows with reasons:

```json
{ "ok": true,
  "brands":   { "processed": 1, "created": 1, "linked": 0, "errors": [] },
  "products": { "processed": 1, "created": 1, "linked": 0, "errors": [] } }
```

Numbers and strings are both accepted (e.g. `founding_year` can be
`1863` or `"1863"`). Same idempotency + blank-fill rules as the CSV
path. Cap: 5000 rows per array per call — batch larger runs.

### Manual fallback: CSV upload in the admin panel

If you'd rather review before importing, produce two CSVs and upload
them (brands first, then products):

1. **Brands** → <https://www.alkatera.com/admin/directory/brands/upload>
2. **Products** → <https://www.alkatera.com/admin/directory/products/upload>

Templates with worked examples live alongside this brief:
- `tasks/templates/brands-template.csv`
- `tasks/templates/products-template.csv`
