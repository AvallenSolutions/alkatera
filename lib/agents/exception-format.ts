// Title + summary strings the Agent Console shows for each exception kind.
// Centralised here so the queue UI doesn't have to know how to render each
// of the ~10 ingest result shapes: it just renders title/summary and trusts
// that the agent filled them in correctly at insert time.

interface FormatInput {
  fileName?: string | null
}

interface Formatted {
  title: string
  summary: string | null
  confidence: number | null
}

function fmtPeriod(start?: string | null, end?: string | null): string {
  if (!start && !end) return ''
  if (start && end) return ` ${start} → ${end}`
  return ` ${start || end}`
}

function fmtNumber(n: number | null | undefined, unit?: string | null): string {
  if (n == null) return ''
  const rounded = Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2)
  return unit ? `${rounded} ${unit}` : rounded
}

export function titleAndSummaryForExceptionPayload(
  kind: string,
  payload: any,
  input: FormatInput = {},
): Formatted {
  const fileName = input.fileName || ''

  switch (kind) {
    case 'utility_bill': {
      const bill = payload?.utilityBill || payload || {}
      const supplier = bill.supplier_name || 'Utility'
      const period = fmtPeriod(bill.period_start, bill.period_end)
      const lines = (bill.entries || [])
        .map((e: any) => `${e.utility_type || 'energy'} ${fmtNumber(e.quantity, e.unit)}`)
        .filter(Boolean)
      return {
        title: `${supplier} bill${period}`,
        summary: lines.length ? lines.join(' · ') : fileName || null,
        confidence: lines.length ? 0.9 : 0.6,
      }
    }
    case 'water_bill': {
      const bill = payload?.waterBill || payload || {}
      const supplier = bill.supplier_name || 'Water utility'
      const period = fmtPeriod(bill.period_start, bill.period_end)
      const lines = (bill.entries || []).map(
        (e: any) => `${e.activity_category} ${fmtNumber(e.quantity, e.unit)}`,
      )
      return {
        title: `${supplier} water${period}`,
        summary: lines.join(' · ') || null,
        confidence: 0.85,
      }
    }
    case 'waste_bill': {
      const bill = payload?.wasteBill || payload || {}
      const supplier = bill.supplier_name || 'Waste contractor'
      const period = fmtPeriod(bill.period_start, bill.period_end)
      const lines = (bill.entries || []).map(
        (e: any) => `${e.activity_category} ${fmtNumber(e.quantity, e.unit)}`,
      )
      return {
        title: `${supplier} waste${period}`,
        summary: lines.join(' · ') || null,
        confidence: 0.85,
      }
    }
    case 'historical_sustainability_report': {
      const r = payload?.historicalSustainabilityReport || payload || {}
      const org = r.organization_name || 'Organisation'
      const year = r.reporting_year ? ` ${r.reporting_year}` : ''
      const scope3 = r.scope3_tco2e ? `Scope 3 ${fmtNumber(r.scope3_tco2e, 'tCO₂e')}` : null
      const scope12 = (r.scope1_tco2e ?? r.scope2_tco2e_market) != null
        ? `Scope 1+2 ${fmtNumber((r.scope1_tco2e || 0) + (r.scope2_tco2e_market || r.scope2_tco2e_location || 0), 'tCO₂e')}`
        : null
      return {
        title: `Historical sustainability report: ${org}${year}`,
        summary: [scope12, scope3].filter(Boolean).join(' · ') || null,
        confidence: 0.75,
      }
    }
    case 'historical_lca_report': {
      const r = payload?.historicalLcaReport || payload || {}
      const product = r.product_name || 'Product'
      const total = r.total_gwp_kgco2e
        ? ` ${fmtNumber(r.total_gwp_kgco2e, 'kgCO₂e')} per ${r.functional_unit || 'unit'}`
        : ''
      return {
        title: `Historical LCA: ${product}`,
        summary: total ? `${total} (${r.system_boundary || 'cradle-to-gate'})` : null,
        confidence: 0.7,
      }
    }
    case 'refrigerant_service': {
      const r = payload?.refrigerantService || payload || {}
      const label = r.refrigerant_type ? String(r.refrigerant_type).toUpperCase() : 'refrigerant'
      const qty = r.quantity_kg != null ? fmtNumber(r.quantity_kg, 'kg') : null
      return {
        title: `Refrigerant service: ${label}`,
        summary: qty ? `${qty} recharged${r.service_date ? ` on ${r.service_date}` : ''}` : fileName || null,
        confidence: qty ? 0.85 : 0.5,
      }
    }
    case 'supplier_invoice': {
      const r = payload?.supplierInvoice || payload || {}
      const supplier = r.supplier_name || 'Supplier'
      const lineCount = Array.isArray(r.line_items) ? r.line_items.length : 0
      return {
        title: `Supplier invoice: ${supplier}`,
        summary: lineCount ? `${lineCount} line item${lineCount === 1 ? '' : 's'}${r.invoice_date ? ` · ${r.invoice_date}` : ''}` : fileName || null,
        confidence: lineCount ? 0.8 : 0.5,
      }
    }
    case 'freight_invoice': {
      const r = payload?.freightInvoice || payload || {}
      const carrier = r.carrier_name || 'Freight'
      const activity = r.transport_mode && r.weight_kg && r.distance_km
        ? `${r.transport_mode}, ${fmtNumber(r.weight_kg, 'kg')} × ${fmtNumber(r.distance_km, 'km')}`
        : null
      return {
        title: `Freight invoice: ${carrier}`,
        summary: activity || fileName || null,
        confidence: activity ? 0.8 : 0.5,
      }
    }
    case 'bom': {
      const r = payload?.bom || payload || {}
      const product = r.product_name || r.product_sku || 'Product'
      return {
        title: `Bill of materials: ${product}`,
        summary: r.note || fileName || null,
        confidence: 0.6,
      }
    }
    case 'bulk_xlsx': {
      const r = payload?.xlsx || payload || {}
      const s = r.summary || {}
      const counts = [
        s.products && `${s.products} products`,
        s.ingredients && `${s.ingredients} ingredients`,
        s.packaging && `${s.packaging} packaging`,
      ].filter(Boolean).join(' · ')
      return {
        title: `Bulk import: ${fileName || 'workbook'}`,
        summary: counts || null,
        confidence: 0.95,
      }
    }
    case 'spray_diary': {
      const r = payload?.sprayDiary || payload || {}
      return {
        title: `Spray diary: ${fileName || 'workbook'}`,
        summary: r.sheetNames?.length ? `${r.sheetNames.length} sheet(s)` : null,
        confidence: 0.6,
      }
    }
    case 'soil_carbon_evidence': {
      const r = payload?.soilCarbonEvidence || payload || {}
      return {
        title: `Soil carbon evidence: ${fileName || 'document'}`,
        summary: r.note || null,
        confidence: 0.5,
      }
    }
    case 'accounts_csv':
      return {
        title: `Accounting CSV: ${fileName || 'export'}`,
        summary: 'Route via Xero / spend-data import.',
        confidence: 0.4,
      }
    case 'unsupported':
      return {
        title: `Unsupported document: ${fileName || 'file'}`,
        summary: payload?.reason || null,
        confidence: 0.0,
      }
    default:
      return {
        title: `${kind.replace(/_/g, ' ')}: ${fileName || 'document'}`,
        summary: null,
        confidence: null,
      }
  }
}
