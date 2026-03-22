/**
 * Auto-extraction of structured data from Xero invoice descriptions
 * and transaction references.
 *
 * Parses common patterns to pre-fill upgrade forms:
 * - Airport IATA codes (e.g. "LHR-CDG", "LHR to JFK")
 * - Hotel night counts (e.g. "3 nights")
 * - Freight weights (e.g. "500 kg", "2.4 tonnes")
 * - Energy quantities (e.g. "4,200 kWh")
 * - Fuel quantities (e.g. "500 litres", "500L")
 * - Water volumes (e.g. "120 m³")
 */

export interface ExtractedData {
  /** Pair of IATA airport codes [origin, destination] */
  airportCodes?: [string, string]
  /** Number of hotel nights */
  nightCount?: number
  /** Freight weight */
  weight?: { value: number; unit: 'kg' | 'tonnes' }
  /** Energy or fuel quantity */
  quantity?: { value: number; unit: string }
  /** Water volume */
  waterVolume?: { value: number; unit: 'm3' }
}

// Shared number pattern: handles "4200", "4,200", "4200.5", "4,200.5"
const NUM_PATTERN = '(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)'

/** Parse a captured number string, stripping comma thousands separators. */
function parseNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''))
}

// Known IATA codes for validation (major airports only, to reduce false positives)
const KNOWN_IATA_CODES = new Set([
  // UK
  'LHR', 'LGW', 'STN', 'LTN', 'MAN', 'BHX', 'EDI', 'GLA', 'BRS', 'NCL',
  'EMA', 'LPL', 'ABZ', 'BFS', 'CWL', 'SOU', 'EXT', 'INV', 'JER', 'GCI',
  // Europe
  'CDG', 'ORY', 'AMS', 'FRA', 'MUC', 'BER', 'MAD', 'BCN', 'FCO', 'MXP',
  'LIS', 'ATH', 'VIE', 'ZRH', 'GVA', 'BRU', 'CPH', 'OSL', 'ARN', 'HEL',
  'DUB', 'PRG', 'WAW', 'BUD', 'OTP', 'IST', 'SAW',
  // North America
  'JFK', 'EWR', 'LAX', 'SFO', 'ORD', 'ATL', 'DFW', 'MIA', 'BOS', 'SEA',
  'IAD', 'DEN', 'PHX', 'LAS', 'MSP', 'DTW', 'PHL', 'CLT', 'IAH', 'YYZ',
  'YVR', 'YUL', 'YYC', 'MEX', 'CUN',
  // Asia Pacific
  'HKG', 'SIN', 'NRT', 'HND', 'ICN', 'BKK', 'KUL', 'SYD', 'MEL', 'AKL',
  'PEK', 'PVG', 'DEL', 'BOM', 'DXB', 'DOH', 'AUH',
  // Africa / South America
  'JNB', 'CPT', 'NBO', 'LOS', 'CAI', 'GRU', 'EZE', 'BOG', 'LIM', 'SCL',
])

/**
 * Extract structured data from a transaction description and/or contact name.
 *
 * @param description - Invoice line item description or reference
 * @param contactName - Xero contact (supplier) name
 * @returns Extracted data object (empty fields are undefined)
 */
export function extractFromDescription(
  description: string | null | undefined,
  contactName: string | null | undefined
): ExtractedData {
  const result: ExtractedData = {}
  const text = [description, contactName].filter(Boolean).join(' ')

  if (!text) return result

  // 1. Airport IATA code pairs
  // Matches: LHR-CDG, LHR–CDG, LHR to CDG, LHR/CDG
  const airportPattern = /\b([A-Z]{3})\s*[-–\/]\s*([A-Z]{3})\b/
  const airportToPattern = /\b([A-Z]{3})\s+to\s+([A-Z]{3})\b/i
  const airportMatch = text.match(airportPattern) || text.match(airportToPattern)
  if (airportMatch) {
    const origin = airportMatch[1].toUpperCase()
    const dest = airportMatch[2].toUpperCase()
    // Only accept if both are known IATA codes (reduces false positives like "DHL-EXP")
    if (KNOWN_IATA_CODES.has(origin) && KNOWN_IATA_CODES.has(dest)) {
      result.airportCodes = [origin, dest]
    }
  }

  // 2. Hotel night counts
  // Matches: "3 nights", "12 night", "1 night stay"
  const nightPattern = /(\d+)\s*nights?\b/i
  const nightMatch = text.match(nightPattern)
  if (nightMatch) {
    result.nightCount = parseInt(nightMatch[1], 10)
  }

  // 3. Freight weights
  // Matches: "500 kg", "2.4 tonnes", "1.5t", "500kg", "4,200 kg", "4,200.5 kg"
  const weightPattern = new RegExp(NUM_PATTERN + '\\s*(kg|tonnes?|t)\\b', 'i')
  const weightMatch = text.match(weightPattern)
  if (weightMatch) {
    const value = parseNumber(weightMatch[1])
    const rawUnit = weightMatch[2].toLowerCase()
    const unit: 'kg' | 'tonnes' = rawUnit === 'kg' ? 'kg' : 'tonnes'
    result.weight = { value, unit }
  }

  // 4. Energy quantities (kWh)
  // Matches: "4,200 kWh", "4200kWh", "4,200.5 kWh"
  const kwhPattern = new RegExp(NUM_PATTERN + '\\s*kWh\\b', 'i')
  const kwhMatch = text.match(kwhPattern)
  if (kwhMatch) {
    const value = parseNumber(kwhMatch[1])
    result.quantity = { value, unit: 'kWh' }
  }

  // 5. Fuel quantities (litres)
  // Matches: "500 litres", "500L", "1,200 liters", "1,200.5 litres"
  if (!result.quantity) {
    const litrePattern = new RegExp(NUM_PATTERN + '\\s*(litres?|liters?|L)\\b', 'i')
    const litreMatch = text.match(litrePattern)
    if (litreMatch) {
      const value = parseNumber(litreMatch[1])
      result.quantity = { value, unit: 'litres' }
    }
  }

  // 6. Water volume (m³)
  // Matches: "120 m³", "120 m3", "120 cubic metres"
  // Normalise Unicode superscript ³ to ASCII 3 for cross-environment reliability
  const normText = text.replace(/\u00B3/g, '3')
  const waterPattern = new RegExp(NUM_PATTERN + '\\s*(?:m3|cubic\\s*met(?:re|er)s?)\\b', 'i')
  const waterMatch = normText.match(waterPattern)
  if (waterMatch) {
    const value = parseNumber(waterMatch[1])
    result.waterVolume = { value, unit: 'm3' }
  }

  return result
}

/**
 * Check if any meaningful data was extracted.
 */
export function hasExtractedData(data: ExtractedData): boolean {
  return !!(
    data.airportCodes ||
    data.nightCount ||
    data.weight ||
    data.quantity ||
    data.waterVolume
  )
}
