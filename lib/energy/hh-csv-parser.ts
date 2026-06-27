/**
 * Programme 2 / Phase 2: parse a half-hourly smart-meter CSV export.
 *
 * UK supplier / data-collector exports come in two dominant shapes:
 *   - LONG:  a datetime column + a kWh column, one row per half hour.
 *   - WIDE:  a date column + 48 half-hour columns (00:00, 00:30, …, 23:30).
 *
 * We detect the shape, parse to `{ recordedAt, kwh }`, and surface errors rather
 * than silently mis-reading kWh. Dates are read as UK day-first (DD/MM/YYYY)
 * since these are GB meters. Uses the `xlsx` lib so it also accepts .xlsx.
 */

import * as XLSX from 'xlsx'

export interface HHReading {
  recordedAt: string // ISO, 30-min boundary, UTC
  kwh: number
}

export interface HHParseResult {
  readings: HHReading[]
  format: 'long' | 'wide' | 'unknown'
  rowsParsed: number
  errors: string[]
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** Parse a date cell to YYYY-MM-DD (UK day-first), or null. */
export function parseDateCell(raw: unknown): string | null {
  if (raw == null) return null
  // xlsx may hand back a Date for date-typed cells.
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10)
  const s = String(raw).trim()
  if (!s) return null
  // ISO-ish YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // UK DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** Parse a datetime cell (long format) to an ISO half-hour, or null. */
export function parseDateTimeCell(raw: unknown): string | null {
  if (raw == null) return null
  if (raw instanceof Date && !isNaN(raw.getTime())) return `${raw.toISOString().slice(0, 16)}Z`
  const s = String(raw).trim()
  if (!s) return null
  // Split "<date> <time>" (space or T), fall back to date-only at 00:00.
  const parts = s.split(/[ T]/)
  const date = parseDateCell(parts[0])
  if (!date) return null
  const timePart = parts[1]?.trim() ?? '00:00'
  const tm = timePart.match(/^(\d{1,2}):(\d{2})/)
  const hh = tm ? tm[1].padStart(2, '0') : '00'
  const mm = tm ? tm[2] : '00'
  return `${date}T${hh}:${mm}Z`
}

function toKwh(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[, ]/g, ''))
  return Number.isFinite(n) ? n : null
}

function headerIndex(headers: string[], re: RegExp): number {
  return headers.findIndex((h) => re.test(h))
}

/** Minimal RFC-4180-ish CSV parser that keeps every cell as its raw string. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

/**
 * Normalise any input to rows of raw STRING cells. CSV text is parsed directly
 * (so timestamps stay strings, not Excel serials); only true binary .xlsx falls
 * back to the xlsx lib, read as formatted text.
 */
function toStringRows(input: ArrayBuffer | Uint8Array | string): string[][] {
  if (typeof input === 'string') return parseCsvRows(input)
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  // Real spreadsheets are binary containers: .xlsx is a ZIP ("PK"), legacy .xls
  // is an OLE doc (D0 CF). Anything else we treat as CSV/text and parse directly.
  if (!((bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf))) {
    return parseCsvRows(new TextDecoder('utf-8', { fatal: false }).decode(bytes))
  }
  return xlsxRows(bytes)
}

function xlsxRows(bytes: Uint8Array): string[][] {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null, raw: false }) as unknown[][]
  return aoa.map((r) => r.map((c) => (c == null ? '' : String(c))))
}

export function parseHalfHourlyCsv(input: ArrayBuffer | Uint8Array | string): HHParseResult {
  const errors: string[] = []
  let rows: string[][]
  try {
    rows = toStringRows(input)
  } catch (e) {
    return { readings: [], format: 'unknown', rowsParsed: 0, errors: [`Could not read file: ${e instanceof Error ? e.message : e}`] }
  }
  if (rows.length < 2) {
    return { readings: [], format: 'unknown', rowsParsed: 0, errors: ['File has no data rows.'] }
  }

  // Find the header row: the first row with a recognisable date/time or time columns.
  let headerRow = 0
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] ?? []).map((c) => String(c ?? '').trim())
    const hasTimeCols = cells.filter((c) => TIME_RE.test(c)).length >= 20
    const hasDateTimeHdr = cells.some((c) => /date|time|timestamp|interval|start|period/i.test(c))
    if (hasTimeCols || hasDateTimeHdr) {
      headerRow = i
      break
    }
  }
  const headers = (rows[headerRow] ?? []).map((c) => String(c ?? '').trim())
  const dataRows = rows.slice(headerRow + 1)
  const readings: HHReading[] = []

  // WIDE: >= 20 time-labelled columns.
  const timeCols = headers
    .map((h, idx) => ({ idx, m: h.match(TIME_RE) }))
    .filter((x) => x.m)
    .map((x) => ({ idx: x.idx, hh: x.m![1].padStart(2, '0'), mm: x.m![2] }))

  if (timeCols.length >= 20) {
    const dateIdx = headerIndex(headers, /date|day|read|settlement/i)
    const useIdx = dateIdx >= 0 ? dateIdx : 0
    let parsed = 0
    for (const r of dataRows) {
      const date = parseDateCell(r[useIdx])
      if (!date) continue
      parsed++
      for (const tc of timeCols) {
        const kwh = toKwh(r[tc.idx])
        if (kwh == null) continue
        readings.push({ recordedAt: `${date}T${tc.hh}:${tc.mm}Z`, kwh })
      }
    }
    if (readings.length === 0) errors.push('Wide format detected but no kWh values could be read.')
    return { readings, format: 'wide', rowsParsed: parsed, errors }
  }

  // LONG: a datetime column + a kWh column.
  const dtIdx = headerIndex(headers, /timestamp|date.*time|interval|start|period|^date$|^time$/i)
  const kwhIdx = headerIndex(headers, /kwh|consumption|usage|energy|kw h|units/i)
  if (dtIdx >= 0 && kwhIdx >= 0) {
    let parsed = 0
    for (const r of dataRows) {
      const recordedAt = parseDateTimeCell(r[dtIdx])
      const kwh = toKwh(r[kwhIdx])
      if (recordedAt == null || kwh == null) continue
      parsed++
      readings.push({ recordedAt, kwh })
    }
    if (readings.length === 0) errors.push('Long format detected but no rows parsed — check the date and kWh columns.')
    return { readings, format: 'long', rowsParsed: parsed, errors }
  }

  return {
    readings: [],
    format: 'unknown',
    rowsParsed: 0,
    errors: [
      'Could not detect a half-hourly layout. Expected either a timestamp + kWh column (long), ' +
        'or a date column plus 48 half-hour columns labelled 00:00…23:30 (wide).',
    ],
  }
}
