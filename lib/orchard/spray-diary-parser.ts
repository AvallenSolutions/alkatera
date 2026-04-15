/**
 * Orchard Spray Diary Parser
 *
 * Converts any orchard spray diary xlsx into structured chemical application data.
 * Uses the xlsx package for spreadsheet parsing and the Claude API for format-agnostic
 * data extraction — handles any column layout, merged cells, or naming convention.
 *
 * Adapted from the arable/vineyard parsers with orchard-specific chemical
 * classification rules (fruit tree fungicides, codling moth products, thinning agents).
 *
 * Called only from API routes — never from client code.
 */

import type { OrchardSprayChemicalDraft } from '@/lib/types/orchard';

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
 * Parse an orchard spray diary xlsx and return normalised chemical summary data.
 *
 * Aggregates by chemical name: sums total_ha_sprayed and total_amount_used
 * across all spray rounds, counts applications.
 */
export async function parseOrchardSprayDiary(fileBuffer: Buffer): Promise<OrchardSprayChemicalDraft[]> {
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
        content: `You are analysing a fruit orchard spray diary spreadsheet (apples, pears, cherries, stone fruit, citrus). Extract all chemical/product applications and return structured JSON.

CRITICAL: Classify each chemical by what the PRODUCT ACTUALLY IS, not by the spray round type it appeared in.
Growers often tank-mix foliar fertilisers with fungicide sprays — these are still "fertiliser" even though they appear in a fungicide round.

Chemical type classification rules (apply in this order):

1. "herbicide" — weed control products:
   - Glyphosate (Roundup, PowerMax, Gallup, Touchdown)
   - Flazasulfuron (Chikara) — under-tree weed control
   - Pelargonic acid (Beloukha) — organic contact herbicide
   - Paraquat, diquat, MCPA, 2,4-D
   - Any product for inter-row or under-tree weed control

2. "insecticide" — insect and pest control:
   - Codling moth: granulovirus (Madex, CpGV, Carpovirusine, Granupom), chlorantraniliprole (Coragen), thiacloprid
   - Aphid control: pirimicarb (Aphox), spirotetramat (Movento), acetamiprid (Gazelle)
   - Pyrethroids: lambda-cyhalothrin (Hallmark, Karate), deltamethrin (Decis), cypermethrin, tau-fluvalinate (Mavrik)
   - Biologicals: spinosad (SpinTor, Tracer), Bacillus thuringiensis (Bt, Dipel)
   - Neem: azadirachtin (NeemAzal)
   - Kaolin clay (Surround) when used for pest deterrence

3. "fungicide" — disease control (scab, mildew, brown rot, canker):
   - Copper: copper hydroxide (Kocide, Headland Copper), copper oxychloride (Cuprokylt)
   - Sulphur: elemental sulphur (Thiopron, Microthiol, Kumulus)
   - Protectants: captan (Merpan), mancozeb (Dithane), dithianon (Delan), dodine (Syllit), folpet (Folpan)
   - Triazoles: myclobutanil (Systhane), penconazole (Topas), difenoconazole (Score), tebuconazole
   - Strobilurins: trifloxystrobin (Flint), kresoxim-methyl (Stroby), pyraclostrobin
   - SDHIs: boscalid (Bellis), fluopyram, fluxapyroxad
   - Biologicals: Bacillus subtilis (Serenade), potassium bicarbonate
   - Ametoctradin + dimethomorph (Zampro)

4. "fertiliser" — plant nutrients, foliar feeds, biostimulants, or soil amendments:
   - Nitrogen: urea, ammonium nitrate (AN), CAN, UAN, ammonium sulphate
   - Calcium: calcium chloride (Stopit), calcium nitrate, Brexil Ca
   - Magnesium: Epsom salts, Bittersalz, kieserite
   - Potassium: sulphate of potash, Polysulphate
   - Trace elements: boron (Bortrac, Solubor), zinc, manganese, iron chelates
   - Biostimulants: seaweed extracts (Kelpak, Maxicrop), amino acid products
   - Note: products with "Fe", "Zn", "Mn", "B", "Ca", "Mg", "K" suffixes are usually fertilisers

5. "other" — anything that doesn't fit above:
   - Adjuvants, spreader-stickers, pH adjusters (Agral, Silwet)
   - Fruit thinning agents: ethephon (Ethrel), NAA, BA (MaxCel), 6-benzyladenine
   - Kaolin clay when used as sunburn protection (not pest deterrence)

For FERTILISERS only, also determine:
- n_content_percent: the nitrogen (N) content of the commercial product as a percentage by weight (0-100).
  Use your knowledge of the product's label or typical formulation:
  * Urea: 46%
  * Ammonium nitrate (AN): 34.5%
  * Calcium ammonium nitrate (CAN): 27%
  * UAN (liquid): 28-32%
  * Ammonium sulphate (AS): 21%
  * Calcium chloride: 0%
  * Epsom salts (MgSO4): 0%
  * Sulphate of Potash / SOP: 0%
  * Seaweed/kelp extracts: 0-1% (use 0.5 if unsure)
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
- chemical_type: one of "fertiliser" | "fungicide" | "herbicide" | "insecticide" | "other"
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

  const parsed = JSON.parse(cleaned) as OrchardSprayChemicalDraft[];

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
