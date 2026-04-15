/**
 * Arable Spray Diary Parser
 *
 * Converts any arable spray diary xlsx into structured chemical application data.
 * Uses the xlsx package for spreadsheet parsing and the Claude API for format-agnostic
 * data extraction — handles any column layout, merged cells, or naming convention.
 *
 * Adapted from the vineyard spray diary parser with arable-specific chemical
 * classification rules (growth regulators, seed treatments, cereal fungicides,
 * pre/post-emergence herbicides).
 *
 * Called only from API routes — never from client code.
 */

import type { ArableSprayChemicalDraft } from '@/lib/types/arable';

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
 * Skips sheets that are clearly reference/lookup tables.
 */
async function workbookToText(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const skipSheets = ['menus', 'block info', 'blocks', 'reference', 'lookup', 'settings'];

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
 * Parse an arable spray diary xlsx and return normalised chemical summary data.
 *
 * Aggregates by chemical name: sums total_ha_sprayed and total_amount_used
 * across all spray rounds, counts applications.
 */
export async function parseArableSprayDiary(fileBuffer: Buffer): Promise<ArableSprayChemicalDraft[]> {
  const sheetText = await workbookToText(fileBuffer);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const Anthropic = await getAnthropic();
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are analysing an arable/cereal crop spray diary spreadsheet. Extract all chemical/product applications and return structured JSON.

CRITICAL: Classify each chemical by what the PRODUCT ACTUALLY IS, not by the spray round type it appeared in.
Farmers often tank-mix foliar fertilisers with fungicide sprays — these are still "fertiliser" even though they appear in a fungicide round.

Chemical type classification rules (apply in this order):

1. "growth_regulator" — plant growth regulators used to shorten stems and prevent lodging:
   - Chlormequat (CCC 720, Adjust, Manipulator, chlormequat chloride)
   - Trinexapac-ethyl (Moddus, Moddus Evo)
   - Ethephon (Cerone, Terpal)
   - Mepiquat chloride (Medax Max, Canopy)
   - Prohexadione-calcium

2. "seed_treatment" — products applied to seed before or at sowing:
   - Redigo Pro, Raxil Star, Vibrance Duo, Celest Extra
   - Any product described as a "seed dressing" or "seed treatment"

3. "herbicide" — weed control products:
   - Pre-emergence: pendimethalin (Stomp Aqua), flufenacet (Liberator, Crystal), prosulfocarb (Defy), diflufenican
   - Post-emergence grass weeds: pinoxaden (Axial), mesosulfuron (Atlantis), clodinafop (Hawk)
   - Post-emergence broadleaf: florasulam (Broadway Star), fluroxypyr (Starane, Pixxaro), MCPA, metsulfuron (Ally Max), clopyralid
   - Total: glyphosate (Roundup, PowerMax, ProActive)

4. "insecticide" — insect and pest control:
   - Pyrethroids: lambda-cyhalothrin (Hallmark), deltamethrin (Decis), cypermethrin, tau-fluvalinate (Mavrik)
   - Neonicotinoids: thiacloprid (Biscaya)
   - Carbamates: pirimicarb (Aphox)

5. "fungicide" — disease control in cereals:
   - Triazoles: prothioconazole (Proline), tebuconazole, epoxiconazole, metconazole, mefentrifluconazole (Revystar)
   - SDHIs: fluxapyroxad (Imtrex), bixafen, benzovindiflupyr (Elatus), fluopyram
   - Strobilurins: azoxystrobin (Amistar), pyraclostrobin
   - Multi-site: chlorothalonil (Bravo), mancozeb
   - Combination products: Aviator Xpro, Ascra Xpro, Adexar, Siltra, Ceriax, Prosaro, Fandango

6. "fertiliser" — plant nutrients, foliar feeds, biostimulants, or soil amendments:
   - Nitrogen: urea, ammonium nitrate (AN), CAN, UAN, ammonium sulphate
   - Manganese: manganese sulphate, ManganMax
   - Magnesium: Epsom salts, Bittersalz, kieserite
   - Trace elements: boron, zinc, copper, iron chelates
   - Organic: compost, FYM, digestate, seaweed
   - Note: products with "Fe", "Zn", "Mn", "B", "Ca", "Mg", "K" suffixes are usually fertilisers

7. "other" — anything that doesn't fit above (adjuvants, spreader-stickers, pH adjusters, etc.)

For FERTILISERS only, also determine:
- n_content_percent: the nitrogen (N) content of the commercial product as a percentage by weight (0-100).
  Use your knowledge of the product's label or typical formulation:
  * Urea: 46%
  * Ammonium nitrate (AN): 34.5%
  * Calcium ammonium nitrate (CAN): 27%
  * UAN (liquid): 28-32%
  * Ammonium sulphate (AS): 21%
  * Manganese sulphate: 0%
  * Epsom salts (MgSO4): 0%
  * Seaweed/kelp extracts: 0-1% (use 0.5 if unsure)
  * FYM: 0.6%
  * Compost: 1%
  * Digestate: 0.5%
  * If you are unsure, set to 0

- fertiliser_subtype: categorise the nitrogen source for IPCC emission factor selection:
  * "synthetic_n" — inorganic nitrogen fertilisers (urea, AN, CAN, UAN, AS)
  * "organic_manure" — animal manures, slurry, digestate
  * "organic_compost" — compost, biosolids, organic mulches, seaweed/kelp
  * "mixed" — clearly a blend of synthetic and organic N
  * null — if the product contains no nitrogen (n_content_percent = 0)

For NON-FERTILISER products, always set n_content_percent to 0 and fertiliser_subtype to null.

For each unique chemical product, aggregate across ALL spray rounds and return:
- chemical_name: product name as written in the spreadsheet
- chemical_type: one of "fertiliser" | "fungicide" | "herbicide" | "insecticide" | "growth_regulator" | "seed_treatment" | "other"
- unit: application unit such as "L", "kg", "g", "mL" — per hectare
- rate_per_ha: application rate per hectare as a number (use the most common rate if it varies)
- water_rate_l_per_ha: water carrier volume per hectare in litres as a number, or null if not recorded
- total_ha_sprayed: sum of all hectares this product was applied to across every spray round
- total_amount_used: total product used = sum of (rate_per_ha x ha_sprayed) for each application
- applications_count: number of separate spray rounds this product was used in
- n_content_percent: nitrogen % in the commercial product (fertilisers only — see rules above; 0 for all others)
- fertiliser_subtype: IPCC subtype (fertilisers with N only — see rules above; null for all others)

Additional rules:
- If the same product appears with slightly different spellings, merge under the most complete name
- Ignore blank rows and header/title rows
- Do not include water itself as a chemical
- Any sheet named "Herbicide" or similar should classify all its chemicals as "herbicide" unless clearly otherwise
- Growth regulator applications (e.g. chlormequat) must ALWAYS be classified as "growth_regulator", even if in a fungicide spray round

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

  const parsed = JSON.parse(cleaned) as ArableSprayChemicalDraft[];

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
    library_matched: false,
  }));
}
