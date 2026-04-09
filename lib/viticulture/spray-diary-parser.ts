/**
 * Spray Diary Parser
 *
 * Converts any vineyard spray diary xlsx into structured chemical application data.
 * Uses the xlsx package for spreadsheet parsing and the Claude API for format-agnostic
 * data extraction — handles any column layout, merged cells, or naming convention.
 *
 * Called only from API routes — never from client code.
 */

import type { SprayChemicalDraft } from '@/lib/types/viticulture';

// Lazy-load xlsx to avoid bundling issues
async function readWorkbook(buffer: Buffer) {
  const XLSX = await import('xlsx');
  return XLSX.read(buffer, { type: 'buffer', cellDates: true });
}

// Lazy-load Anthropic SDK
let AnthropicSdk: any = null;
async function getAnthropic() {
  if (!AnthropicSdk) {
    AnthropicSdk = (await import('@anthropic-ai/sdk')).default;
  }
  return AnthropicSdk;
}

/**
 * Convert a workbook to a concise text representation for Claude.
 * Skips sheets that are clearly reference/lookup tables (e.g. "Menus", "Block Info").
 */
async function workbookToText(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const skipSheets = ['menus', 'block info', 'blocks', 'reference', 'lookup'];

  const parts: string[] = [];

  for (const name of workbook.SheetNames) {
    if (skipSheets.some((s) => name.toLowerCase().includes(s))) continue;

    const ws = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });

    // Trim very long sheets to keep prompt size manageable
    const lines = csv.split('\n').filter((l) => l.replace(/,/g, '').trim().length > 0);
    const trimmed = lines.slice(0, 500).join('\n');

    parts.push(`=== Sheet: ${name} ===\n${trimmed}`);
  }

  return parts.join('\n\n');
}

/**
 * Parse a spray diary xlsx and return normalised chemical summary data.
 *
 * Aggregates by chemical name: sums total_ha_sprayed and total_amount_used
 * across all spray rounds, counts applications.
 */
export async function parseSprayDiary(fileBuffer: Buffer): Promise<SprayChemicalDraft[]> {
  const sheetText = await workbookToText(fileBuffer);

  const Anthropic = await getAnthropic();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are analysing a vineyard spray diary spreadsheet. Extract all chemical/product applications and return structured JSON.

CRITICAL: Classify each chemical by what the PRODUCT ACTUALLY IS, not by the spray round type it appeared in.
Many vineyards mix foliar fertilisers and biostimulants into fungicide spray tanks — these are still "fertiliser" even though they appear in a "Fungicide" spray round.

Chemical type classification rules (apply in this order):
1. "herbicide" — if the product or sheet is for weed control (e.g. glyphosate, MCPA, Powermax, Escort, Metribuzin, Touchdown, Roundup)
2. "insecticide" — if the product controls insects or mites (e.g. Karate, Mavrik, Dimethoate, Vertimec, Calypso, chlorpyrifos, cypermethrin)
3. "fertiliser" — if the product is a plant nutrient, foliar feed, biostimulant, or soil amendment:
   - Magnesium/sulphur products: Bittersalz, Epsom salts, MgSO4, kieserite, thiosulphate
   - Calcium products: calcium chloride, calcium nitrate, Stopit, Brexil Ca
   - Potassium products: potassium sulphate, SOP, MOP, Polysulphate
   - Foliar feeds and biostimulants: CropLift, Cropaid, Maxicrop, Seamac, Iodus, PhysioCrop, Kelpak, Biochel, amino acid products, humic acid products, seaweed extracts
   - Nitrogen fertilisers: urea, ammonium nitrate, CAN, liquid nitrogen
   - Phosphorus: MAP, DAP, mono-ammonium phosphate
   - Micronutrients: boron, zinc, manganese, iron chelates (EDTA/DTPA products), Brexil, Librel
   - Note: products with "Fe", "Zn", "Mn", "B", "Ca", "Mg", "K" suffixes are usually fertilisers
4. "fungicide" — if the product controls fungal disease (e.g. copper, sulphur/sulfur, mancozeb, captan, chlorothalonil, triazoles, strobilurins, SDHIs, Switch, Amistar, Signum, Delan, Electis, Pergado, Scala, Flint, Serenade, Talius, Vayo, Thiopron, Headland/FMC Copper, Xerxes, Cantus, Revus, Vivando, Cabriotop, Onyx, Luna, Forum, Melody)
5. "other" — anything that doesn't fit above (adjuvants, spreader-stickers, pH adjusters, chlorine, etc.)

For FERTILISERS only, also determine:
- n_content_percent: the nitrogen (N) content of the commercial product as a percentage by weight (0–100).
  Use your knowledge of the product's label or typical formulation:
  • Urea: 46%
  • Ammonium nitrate (AN): 34.5%
  • Calcium ammonium nitrate (CAN): 27%
  • UAN (liquid): 28–32%
  • Ammonium sulphate (AS): 21%
  • MAP (mono-ammonium phosphate): 11%
  • DAP (di-ammonium phosphate): 18%
  • Calcium nitrate: 15.5%
  • Potassium nitrate: 13%
  • Bittersalz / Epsom salts (MgSO4): 0%
  • Calcium chloride: 0%
  • Potassium sulphate / SOP: 0%
  • Copper sulphate: 0%
  • Sulphur / sulfur: 0%
  • Seaweed / kelp extracts (Maxicrop, Kelpak, Seamac): 0–1% (use 0.5 if unsure)
  • Amino acid biostimulants: 8–16% (use 12 if unsure)
  • Humic acid: 0–2% (use 1 if unsure)
  • CropLift: ~5%
  • Iron/zinc/manganese chelates (Brexil, Librel, EDTA): 0%
  • If you are unsure, set to 0 and note it

- fertiliser_subtype: categorise the nitrogen source for IPCC emission factor selection:
  • "synthetic_n" — inorganic nitrogen fertilisers (urea, AN, CAN, UAN, AS, MAP, DAP, calcium nitrate, potassium nitrate)
  • "organic_manure" — animal manures, slurry, digestate
  • "organic_compost" — compost, biosolids, organic mulches, seaweed/kelp, amino acid products, biostimulants
  • "mixed" — clearly a blend of synthetic and organic N
  • null — if the product contains no nitrogen (n_content_percent = 0)

For NON-FERTILISER products, always set n_content_percent to 0 and fertiliser_subtype to null.

For each unique chemical product, aggregate across ALL spray rounds and return:
- chemical_name: product name as written in the spreadsheet
- chemical_type: one of "fertiliser" | "fungicide" | "herbicide" | "insecticide" | "other"
- unit: application unit such as "L", "kg", "g", "mL" — per hectare
- rate_per_ha: application rate per hectare as a number (use the most common rate if it varies)
- water_rate_l_per_ha: water carrier volume per hectare in litres as a number, or null if not recorded
- total_ha_sprayed: sum of all hectares this product was applied to across every spray round
- total_amount_used: total product used = sum of (rate_per_ha × ha_sprayed) for each application
- applications_count: number of separate spray rounds this product was used in
- n_content_percent: nitrogen % in the commercial product (fertilisers only — see rules above; 0 for all others)
- fertiliser_subtype: IPCC subtype (fertilisers with N only — see rules above; null for all others)

Additional rules:
- If the same product appears with slightly different spellings, merge under the most complete name
- Ignore blank rows and header/title rows
- Do not include water itself as a chemical
- Any sheet named "Herbicide" or similar should classify all its chemicals as "herbicide" unless clearly otherwise

Spreadsheet data:
${sheetText}

Return ONLY a valid JSON array with no markdown fences, no explanation:
[{"chemical_name":"...","chemical_type":"...","unit":"...","rate_per_ha":0,"water_rate_l_per_ha":null,"total_ha_sprayed":0,"total_amount_used":0,"applications_count":1,"n_content_percent":0,"fertiliser_subtype":null}]`,
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';

  // Strip markdown fences if Claude included them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  const parsed = JSON.parse(cleaned) as SprayChemicalDraft[];

  // Sanitise numeric fields and ensure N% fields are present
  return parsed.map((c) => ({
    ...c,
    rate_per_ha: Number(c.rate_per_ha) || 0,
    water_rate_l_per_ha: c.water_rate_l_per_ha != null ? Number(c.water_rate_l_per_ha) : null,
    total_ha_sprayed: Number(c.total_ha_sprayed) || 0,
    total_amount_used: Number(c.total_amount_used) || 0,
    applications_count: Number(c.applications_count) || 1,
    n_content_percent: Number(c.n_content_percent) || 0,
    fertiliser_subtype: c.fertiliser_subtype ?? null,
  }));
}
