/**
 * Hospitality menu importer — read a menu from a spreadsheet, PDF or photo and
 * return a normalised list of meals/drinks so they can be batch-created instead
 * of added one by one.
 *
 * Two paths:
 *  - Spreadsheet (XLSX / XLS): parsed deterministically with the `xlsx` package.
 *  - PDF / image: Claude Opus 4.6 vision (same approach as the Smart Upload
 *    classifier in lib/ingest/classify-document.ts), with a single forced tool.
 *
 * We deliberately capture ingredient *names only*, never quantities — a menu
 * almost never lists amounts, and guessing them would bake wrong numbers into
 * an LCA. The user fills quantities per dish afterwards in the recipe editor.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

export type ImportedItemKind = 'meal' | 'drink'

export interface ImportedMenuItem {
  name: string
  kind: ImportedItemKind
  /** Ingredient names only — no quantities. */
  ingredients: string[]
}

export interface MenuExtractionResult {
  menu_name: string | null
  items: ImportedMenuItem[]
}

export interface MenuExtractionInput {
  fileBytes: Uint8Array
  fileName: string
  fileMime: string
}

// Guards so one malformed upload can't create thousands of rows.
const MAX_ITEMS = 200
const MAX_INGREDIENTS_PER_ITEM = 40
const MAX_NAME_LEN = 200

function cleanName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN)
}

function coerceKind(value: unknown): ImportedItemKind {
  const v = String(value ?? '').toLowerCase()
  if (/drink|bever|cocktail|wine|beer|spirit|juice|coffee|tea|soft|aperitif|digestif/.test(v)) {
    return 'drink'
  }
  return 'meal'
}

/** Split a free-text ingredient cell ("Gin, Campari; sweet vermouth") into names. */
function splitIngredients(value: unknown): string[] {
  return String(value ?? '')
    .split(/[,;\n•|]+/)
    .map((s) => cleanName(s))
    .filter((s) => s.length > 0)
    .slice(0, MAX_INGREDIENTS_PER_ITEM)
}

function normaliseItems(raw: Array<{ name?: unknown; kind?: unknown; ingredients?: unknown }>): ImportedMenuItem[] {
  const items: ImportedMenuItem[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const name = cleanName(r?.name)
    if (!name) continue
    const dedupeKey = name.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    const ingredients = Array.isArray(r?.ingredients)
      ? Array.from(new Set(r!.ingredients!.map((i) => cleanName(i)).filter(Boolean))).slice(0, MAX_INGREDIENTS_PER_ITEM)
      : []
    items.push({ name, kind: coerceKind(r?.kind), ingredients })
    if (items.length >= MAX_ITEMS) break
  }
  return items
}

// ── Spreadsheet path ─────────────────────────────────────────────────────────

const NAME_KEYS = ['name', 'item', 'dish', 'meal', 'drink', 'product', 'title', 'menu item']
const KIND_KEYS = ['kind', 'type', 'category', 'course', 'section']
const INGREDIENT_KEYS = ['ingredients', 'ingredient', 'recipe', 'contains', 'components', 'made with', 'description']

function matchKey(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase())
  for (const cand of candidates) {
    const idx = lower.indexOf(cand)
    if (idx >= 0) return headers[idx]
  }
  // Fall back to a substring match (e.g. "Item name", "Drink type").
  for (let i = 0; i < lower.length; i++) {
    if (candidates.some((c) => lower[i].includes(c))) return headers[i]
  }
  return null
}

function extractFromXlsx(input: MenuExtractionInput): MenuExtractionResult {
  const { fileBytes } = input
  const buffer = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength)
  const wb = XLSX.read(buffer, { type: 'array' })

  const raw: Array<{ name: unknown; kind: unknown; ingredients: string[] }> = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (rows.length === 0) continue
    const headers = Object.keys(rows[0])
    const nameKey = matchKey(headers, NAME_KEYS)
    if (!nameKey) continue // sheet without an obvious name column — skip it
    const kindKey = matchKey(headers, KIND_KEYS)
    const ingKey = matchKey(headers, INGREDIENT_KEYS)
    // A sheet named like a kind (e.g. "Drinks") biases items lacking a kind cell.
    const sheetKind = /drink|bever|cocktail|bar/.test(sheetName.toLowerCase()) ? 'drink' : null

    for (const row of rows) {
      const name = row[nameKey]
      if (!cleanName(name)) continue
      raw.push({
        name,
        kind: kindKey ? row[kindKey] : sheetKind,
        ingredients: ingKey ? splitIngredients(row[ingKey]) : [],
      })
    }
  }

  return { menu_name: deriveMenuName(input.fileName), items: normaliseItems(raw) }
}

function deriveMenuName(fileName: string): string | null {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base ? cleanName(base) : null
}

// ── Vision path (PDF / image) ─────────────────────────────────────────────────

const EXTRACT_MENU_TOOL: Anthropic.Tool = {
  name: 'extract_menu',
  description:
    'Record every food and drink item on this menu so they can be created as recipes. Classify each as a meal (food) or a drink (any beverage, cocktail, wine, beer, soft drink, coffee). Capture ingredient NAMES only where the menu describes them — never invent quantities or amounts. Ignore prices, section headings, allergen notes and marketing copy.',
  input_schema: {
    type: 'object',
    properties: {
      menu_name: {
        type: 'string',
        description: 'The menu title if one is shown (e.g. "Autumn dinner menu"). Omit if there is no clear title.',
      },
      items: {
        type: 'array',
        description: 'Every distinct dish or drink on the menu.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The dish or drink name as written on the menu.' },
            kind: {
              type: 'string',
              enum: ['meal', 'drink'],
              description: 'meal for food, drink for any beverage.',
            },
            ingredients: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Ingredient names only, taken from the item description if present (e.g. ["Gin","Campari","Sweet vermouth"]). No quantities. Empty array if the menu lists only the name.',
            },
          },
          required: ['name', 'kind'],
        },
      },
    },
    required: ['items'],
  },
}

async function extractFromDocument(input: MenuExtractionInput): Promise<MenuExtractionResult> {
  const { fileBytes, fileMime, fileName } = input
  const isPdf = fileMime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
  const base64Data = Buffer.from(fileBytes).toString('base64')

  const fileContent = isPdf
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data },
      })
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: fileMime as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64Data,
        },
      })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    tools: [EXTRACT_MENU_TOOL],
    tool_choice: { type: 'tool', name: 'extract_menu' },
    messages: [
      {
        role: 'user',
        content: [
          fileContent,
          {
            type: 'text',
            text: 'This is a restaurant, bar or venue menu. Extract every food and drink item using the extract_menu tool. Capture ingredient names only — do not guess quantities.',
          },
        ],
      },
    ],
  })

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const payload = (toolUse?.input ?? {}) as { menu_name?: unknown; items?: unknown }
  const rawItems = Array.isArray(payload.items) ? (payload.items as any[]) : []
  return {
    menu_name: cleanName(payload.menu_name) || deriveMenuName(fileName),
    items: normaliseItems(rawItems),
  }
}

// ── Public entry point ─────────────────────────────────────────────────────────

export async function extractMenu(input: MenuExtractionInput): Promise<MenuExtractionResult> {
  const lowerName = input.fileName.toLowerCase()
  const isXlsx =
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    input.fileMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    input.fileMime === 'application/vnd.ms-excel'
  const isCsv = lowerName.endsWith('.csv') || input.fileMime === 'text/csv' || input.fileMime === 'application/csv'
  if (isXlsx || isCsv) return extractFromXlsx(input)
  return extractFromDocument(input)
}
