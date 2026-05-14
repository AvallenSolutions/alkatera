import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FIELD_DEFINITIONS, type FieldKey, type Pillar } from '../scraping/field-definitions';

export interface BrandSheetField {
  field_key: FieldKey;
  value: string | null;
  numeric: number | null;
  source: string | null;
  confidence: number | null;
  updated_at: string | null;
}

export interface BrandSheetInput {
  brandName: string;
  distributorName: string;
  category: string | null;
  country_of_origin: string | null;
  alkatera_tier: number;
  completeness_score: number | null;
  fields: BrandSheetField[];
  generated_at: Date;
}

const PILLAR_ORDER: Pillar[] = ['carbon', 'water', 'packaging', 'agriculture', 'governance', 'corporate'];

const PILLAR_LABELS: Record<Pillar, string> = {
  carbon: 'Carbon',
  water: 'Water',
  packaging: 'Packaging',
  agriculture: 'Agriculture & ingredients',
  governance: 'Governance & certification',
  corporate: 'Corporate',
};

/**
 * Generate a 1–2 page PDF data sheet for a single brand. The layout
 * is intentionally simple — brand identity, headline score, then a
 * grouped table of every field grouped by pillar with the source +
 * confidence shown next to each value.
 *
 * Returns the PDF as a Buffer so the API route can stream it directly.
 */
export function buildBrandSheetPdf(input: BrandSheetInput): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

  // --- Header strip ---------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(input.brandName, marginX, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const subtitle = `Sustainability data sheet · prepared for ${input.distributorName} · ${formatDate(input.generated_at)}`;
  doc.text(subtitle, marginX, y);
  y += 22;

  doc.setTextColor(0, 0, 0);

  // --- Summary box ----------------------------------------------------
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(247, 247, 245);
  doc.roundedRect(marginX, y, pageWidth - 2 * marginX, 60, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('COMPLETENESS', marginX + 16, y + 18);
  doc.text('alkatera TIER', marginX + 180, y + 18);
  doc.text('CATEGORY', marginX + 320, y + 18);
  doc.text('ORIGIN', marginX + 440, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(
    input.completeness_score != null ? `${Math.round(input.completeness_score)}%` : '—',
    marginX + 16,
    y + 42,
  );
  doc.text(`Tier ${input.alkatera_tier}`, marginX + 180, y + 42);
  doc.setFontSize(12);
  doc.text(input.category ?? '—', marginX + 320, y + 42);
  doc.text(input.country_of_origin ?? '—', marginX + 440, y + 42);

  y += 80;

  // --- Company description (if present) -----------------------------
  const descriptionField = input.fields.find((f) => f.field_key === 'company_description');
  if (descriptionField?.value) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('BRAND OVERVIEW', marginX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(descriptionField.value, pageWidth - 2 * marginX);
    doc.text(wrapped, marginX, y + 16);
    // splitTextToSize returns an array; height is roughly lineHeight*lines.
    const lineHeight = 13;
    y += 16 + wrapped.length * lineHeight + 12;
  }

  // --- Field tables, one per pillar ----------------------------------
  for (const pillar of PILLAR_ORDER) {
    const pillarFields = FIELD_DEFINITIONS.filter((f) => f.pillar === pillar);
    if (pillarFields.length === 0) continue;

    const rows = pillarFields.map((def) => {
      const found = input.fields.find((f) => f.field_key === def.key);
      return [
        def.label,
        found?.value ? formatValue(found, def.type) : '—',
        found?.source ?? '—',
        found?.confidence != null ? `${Math.round(found.confidence * 100)}%` : '—',
        found?.updated_at ? formatDate(new Date(found.updated_at)) : '—',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [[PILLAR_LABELS[pillar], 'Value', 'Source', 'Confidence', 'Updated']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [240, 240, 235], textColor: 0, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [252, 252, 250] },
      margin: { left: marginX, right: marginX },
      didDrawPage: (data) => {
        // Footer on every page.
        const ph = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          'Brand-uploaded data is self-reported and unverified unless explicitly marked “alkatera verified”.',
          marginX,
          ph - 28,
        );
        doc.text(`Generated via alkatera distributor portal · ${formatDate(input.generated_at)}`, marginX, ph - 14);
        doc.setTextColor(0, 0, 0);
        // Track final y for next pillar table.
        y = data.cursor?.y ?? y;
      },
    });
    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 14;
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = 56;
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function formatValue(field: BrandSheetField, type: string): string {
  if (type === 'boolean') {
    if (field.value === 'true' || field.numeric === 1) return 'Yes';
    if (field.value === 'false' || field.numeric === 0) return 'No';
    return field.value ?? '—';
  }
  if (type === 'year' && field.numeric != null) return String(Math.round(field.numeric));
  if (type === 'number' && field.numeric != null) {
    return Number.isInteger(field.numeric)
      ? String(field.numeric)
      : field.numeric.toFixed(field.numeric < 1 ? 4 : 2);
  }
  if (type === 'longtext' && field.value) {
    // Show a single-line preview in the table cell — the full
    // description gets its own narrative section above the tables.
    return field.value.length > 90 ? `${field.value.slice(0, 87).trim()}…` : field.value;
  }
  return field.value ?? '—';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
