/**
 * @deprecated Use `lib/pdf/render-lca-html.ts` + `lib/pdf/pdfshift-client.ts` instead.
 * This file uses the old jsPDF approach which produces lower-quality PDFs.
 * The new system uses PDFShift API with HTML/CSS templates for pixel-perfect output.
 * See `.claude/skills/pdf-generation.md` for the new architecture.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WaterSource {
  id: string;
  source: string;
  location: string;
  consumption: number;
  riskFactor: number;
  riskLevel: 'low' | 'medium' | 'high';
  netImpact: number;
}

interface WasteStream {
  id: string;
  stream: string;
  disposition: 'recycling' | 'landfill' | 'composting' | 'incineration';
  mass: number;
  circularityScore: number;
}

interface LandUseItem {
  id: string;
  ingredient: string;
  origin: string;
  mass: number;
  landIntensity: number;
  totalFootprint: number;
}

interface LcaReportData {
  title: string;
  version: string;
  productName: string;
  assessmentPeriod: string;
  publishedDate: string;
  dqiScore: number;
  systemBoundary: string;
  functionalUnit: string;
  metrics: {
    total_impacts: {
      climate_change_gwp100: number;
      water_consumption: number;
      water_scarcity_aware: number;
      land_use: number;
      fossil_resource_scarcity: number;
    };
    circularity_percentage: number;
  };
  waterSources: WaterSource[];
  wasteStreams: WasteStream[];
  landUseItems: LandUseItem[];
  dataSources: Array<{ name: string; description: string; count: number }>;
}

export async function generateLcaReportPdf(data: LcaReportData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const colors = {
    primary: [15, 23, 42] as [number, number, number],
    secondary: [100, 116, 139] as [number, number, number],
    accent: [37, 99, 235] as [number, number, number],
    green: [22, 163, 74] as [number, number, number],
    blue: [59, 130, 246] as [number, number, number],
    amber: [245, 158, 11] as [number, number, number],
    emerald: [16, 185, 129] as [number, number, number],
    orange: [249, 115, 22] as [number, number, number],
    red: [239, 68, 68] as [number, number, number],
    lightGray: [248, 250, 252] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
  };

  let yPos = 20;
  const margin = 20;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - 2 * margin;

  // ============================================================================
  // PAGE 1: COVER PAGE WITH MODERN DESIGN
  // ============================================================================

  // Modern gradient header
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 80, 'F');

  // Accent stripe
  doc.setFillColor(colors.green[0], colors.green[1], colors.green[2]);
  doc.rect(0, 75, pageWidth, 5, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Product Impact', margin, 35);
  doc.text('Assessment', margin, 50);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Life Cycle Assessment Report', margin, 65);

  // Product name
  yPos = 100;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  const productNameLines = doc.splitTextToSize(data.productName, contentWidth);
  doc.text(productNameLines, margin, yPos);

  yPos += productNameLines.length * 10 + 10;

  // Status badges
  doc.setFillColor(colors.green[0], colors.green[1], colors.green[2]);
  doc.roundedRect(margin, yPos, 32, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PUBLISHED', margin + 4, yPos + 6);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.roundedRect(margin + 37, yPos, 24, 9, 2, 2, 'FD');
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text(`v${data.version}`, margin + 42, yPos + 6);

  // Metadata card
  yPos += 20;
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.roundedRect(margin, yPos, contentWidth, 35, 4, 4, 'F');

  yPos += 10;
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text(`Assessment Period: ${data.assessmentPeriod}`, margin + 5, yPos);
  doc.text(`Published: ${new Date(data.publishedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin + 5, yPos + 7);
  doc.text(`Functional Unit: ${data.functionalUnit}`, margin + 5, yPos + 14);
  doc.text(`System Boundary: ${data.systemBoundary}`, margin + 5, yPos + 21, { maxWidth: contentWidth - 10 });

  // DQI Score - Circular gauge
  yPos += 45;
  const gaugeX = pageWidth / 2;
  const gaugeY = yPos + 30;
  drawModernDqiGauge(doc, gaugeX, gaugeY, data.dqiScore, colors);

  // Key metrics preview
  yPos += 85;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text('Environmental Impact Summary', margin, yPos);

  yPos += 10;
  const metricBoxY = yPos;
  const boxWidth = (contentWidth - 9) / 4;

  drawMetricBox(doc, margin, metricBoxY, boxWidth, 'Climate', `${data.metrics.total_impacts.climate_change_gwp100.toFixed(3)} kg`, 'CO₂eq', colors.green, colors);
  drawMetricBox(doc, margin + boxWidth + 3, metricBoxY, boxWidth, 'Water', `${data.metrics.total_impacts.water_consumption.toFixed(2)} L`, 'consumed', colors.blue, colors);
  drawMetricBox(doc, margin + (boxWidth + 3) * 2, metricBoxY, boxWidth, 'Land', `${data.metrics.total_impacts.land_use.toFixed(2)} m²`, 'footprint', colors.emerald, colors);
  drawMetricBox(doc, margin + (boxWidth + 3) * 3, metricBoxY, boxWidth, 'Circular', `${data.metrics.circularity_percentage}%`, 'recovery', colors.amber, colors);

  addModernFooter(doc, 1, colors);

  // ============================================================================
  // PAGE 2: CLIMATE IMPACT
  // ============================================================================

  doc.addPage();
  yPos = 20;

  addSectionHeader(doc, 'Climate Change Impact', colors.green, colors);

  yPos = 45;

  // Hero metric card
  doc.setFillColor(colors.green[0], colors.green[1], colors.green[2], 10);
  doc.roundedRect(margin, yPos, contentWidth, 45, 4, 4, 'F');

  yPos += 15;
  doc.setTextColor(colors.green[0], colors.green[1], colors.green[2]);
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.text(data.metrics.total_impacts.climate_change_gwp100.toFixed(3), margin + 10, yPos);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('kg CO₂eq per functional unit', margin + 10, yPos + 15);

  doc.setFontSize(9);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text('GHG Protocol compliant • ISO 14067:2018 certified', margin + 10, yPos + 23);

  // Compliance badges
  yPos += 35;
  const badges = ['ISO 14044', 'ISO 14067', 'CSRD E1', 'GHG Protocol'];
  let badgeX = margin;
  badges.forEach(badge => {
    const badgeWidth = doc.getTextWidth(badge) + 8;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.roundedRect(badgeX, yPos, badgeWidth, 7, 2, 2, 'FD');
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(badge, badgeX + 4, yPos + 4.5);
    badgeX += badgeWidth + 3;
  });

  // Context section
  yPos += 20;
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.roundedRect(margin, yPos, contentWidth, 30, 4, 4, 'F');

  yPos += 8;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('What does this mean?', margin + 5, yPos);

  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  const contextText = `This product generates ${data.metrics.total_impacts.climate_change_gwp100.toFixed(3)} kg of CO₂ equivalent emissions across its lifecycle from raw materials to factory gate. This includes emissions from material extraction, processing, packaging manufacture, and production operations.`;
  const lines = doc.splitTextToSize(contextText, contentWidth - 10);
  lines.forEach((line: string, i: number) => {
    doc.text(line, margin + 5, yPos + (i * 5));
  });

  yPos += 30;

  // Assessment method
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Assessment Methodology', margin, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text('Method: ReCiPe 2016 Midpoint (H) - Hierarchist Perspective', margin, yPos);
  doc.text('Impact Category: Climate Change (GWP100)', margin, yPos + 6);
  doc.text('Characterisation Factors: IPCC AR6 (2021)', margin, yPos + 12);

  addModernFooter(doc, 2, colors);

  // ============================================================================
  // PAGE 3: WATER IMPACT
  // ============================================================================

  doc.addPage();
  yPos = 20;

  addSectionHeader(doc, 'Water Impact Analysis', colors.blue, colors);

  yPos = 45;

  // Dual metric card
  const halfWidth = (contentWidth - 4) / 2;

  // Consumption metric
  doc.setFillColor(colors.blue[0], colors.blue[1], colors.blue[2], 10);
  doc.roundedRect(margin, yPos, halfWidth, 40, 4, 4, 'F');

  doc.setTextColor(colors.blue[0], colors.blue[1], colors.blue[2]);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(data.metrics.total_impacts.water_consumption.toFixed(2), margin + 5, yPos + 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Litres consumed', margin + 5, yPos + 28);

  doc.setFontSize(8);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text('Total water withdrawal', margin + 5, yPos + 35);

  // Scarcity metric
  doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2], 10);
  doc.roundedRect(margin + halfWidth + 4, yPos, halfWidth, 40, 4, 4, 'F');

  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(data.metrics.total_impacts.water_scarcity_aware.toFixed(2), margin + halfWidth + 9, yPos + 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('m³ world eq', margin + halfWidth + 9, yPos + 28);

  doc.setFontSize(8);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text('Scarcity-weighted (AWARE)', margin + halfWidth + 9, yPos + 35);

  // Water sources table
  yPos += 50;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Water Sources by Location', margin, yPos);

  yPos += 5;

  const waterTableData = data.waterSources.map(item => [
    item.source,
    item.location,
    `${item.consumption.toFixed(2)} L`,
    item.riskLevel.toUpperCase(),
    `×${item.riskFactor.toFixed(1)}`,
    `${item.netImpact.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Source', 'Location', 'Volume', 'Risk', 'AWARE', 'Impact (m³)']],
    body: waterTableData,
    theme: 'plain',
    headStyles: {
      fillColor: colors.blue,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 40 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 15, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const riskLevel = data.cell.text[0];
        if (riskLevel === 'HIGH') {
          data.cell.styles.textColor = colors.red;
          data.cell.styles.fontStyle = 'bold';
        } else if (riskLevel === 'MEDIUM') {
          data.cell.styles.textColor = colors.amber;
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = colors.green;
        }
      }
    },
    alternateRowStyles: {
      fillColor: colors.lightGray,
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // Key insight
  const highRiskSource = data.waterSources.find(s => s.riskLevel === 'high');
  if (highRiskSource && yPos < pageHeight - 50) {
    doc.setFillColor(colors.blue[0], colors.blue[1], colors.blue[2], 10);
    doc.roundedRect(margin, yPos, contentWidth, 22, 4, 4, 'F');

    yPos += 8;
    doc.setTextColor(colors.blue[0], colors.blue[1], colors.blue[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Insight', margin + 5, yPos);

    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    const impactPercent = Math.round((highRiskSource.netImpact / data.metrics.total_impacts.water_scarcity_aware) * 100);
    const insightText = `${highRiskSource.source} represents ${impactPercent}% of total water scarcity impact due to high AWARE factor (×${highRiskSource.riskFactor.toFixed(1)}) in water-stressed region (${highRiskSource.location}).`;
    const insightLines = doc.splitTextToSize(insightText, contentWidth - 10);
    insightLines.forEach((line: string, i: number) => {
      doc.text(line, margin + 5, yPos + (i * 5));
    });
  }

  addModernFooter(doc, 3, colors);

  // ============================================================================
  // PAGE 4: CIRCULARITY & WASTE
  // ============================================================================

  doc.addPage();
  yPos = 20;

  addSectionHeader(doc, 'Circularity & Waste Management', colors.amber, colors);

  yPos = 45;

  // Circularity hero card
  doc.setFillColor(colors.amber[0], colors.amber[1], colors.amber[2], 10);
  doc.roundedRect(margin, yPos, contentWidth, 45, 4, 4, 'F');

  yPos += 15;
  doc.setTextColor(colors.amber[0], colors.amber[1], colors.amber[2]);
  doc.setFontSize(52);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.metrics.circularity_percentage}%`, margin + 10, yPos);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Material Recovery Rate', margin + 10, yPos + 15);

  const totalWaste = data.wasteStreams.reduce((sum, s) => sum + s.mass, 0) / 1000;
  const circularWaste = data.wasteStreams.reduce((sum, s) => sum + (s.mass * s.circularityScore / 100), 0) / 1000;

  doc.setFontSize(9);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(`${circularWaste.toFixed(3)} kg recovered • ${(totalWaste - circularWaste).toFixed(3)} kg linear waste`, margin + 10, yPos + 23);

  // Waste streams table
  yPos += 35;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Waste Stream Breakdown', margin, yPos);

  yPos += 5;

  const wasteTableData = data.wasteStreams.map(item => [
    item.stream,
    item.disposition.charAt(0).toUpperCase() + item.disposition.slice(1),
    `${item.mass} g`,
    `${item.circularityScore}%`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Waste Stream', 'Disposition', 'Mass', 'Circularity Score']],
    body: wasteTableData,
    theme: 'plain',
    headStyles: {
      fillColor: colors.amber,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const score = parseInt(data.cell.text[0]);
        if (score === 100) {
          data.cell.styles.textColor = colors.green;
          data.cell.styles.fontStyle = 'bold';
        } else if (score >= 50) {
          data.cell.styles.textColor = colors.amber;
        } else {
          data.cell.styles.textColor = colors.red;
        }
      }
    },
    alternateRowStyles: {
      fillColor: colors.lightGray,
    },
  });

  addModernFooter(doc, 4, colors);

  // ============================================================================
  // PAGE 5: LAND USE & NATURE
  // ============================================================================

  doc.addPage();
  yPos = 20;

  addSectionHeader(doc, 'Land Use & Nature Impact', colors.emerald, colors);

  yPos = 45;

  // Land use hero card
  doc.setFillColor(colors.emerald[0], colors.emerald[1], colors.emerald[2], 10);
  doc.roundedRect(margin, yPos, contentWidth, 40, 4, 4, 'F');

  yPos += 15;
  doc.setTextColor(colors.emerald[0], colors.emerald[1], colors.emerald[2]);
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.text(data.metrics.total_impacts.land_use.toFixed(2), margin + 10, yPos);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('m² per functional unit', margin + 10, yPos + 12);

  // Land use table
  yPos += 30;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Material Land Footprint', margin, yPos);

  yPos += 5;

  const landTableData = data.landUseItems.map(item => [
    item.ingredient,
    item.origin,
    `${item.mass.toFixed(3)} kg`,
    `${item.landIntensity.toFixed(1)}`,
    `${item.totalFootprint.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Material', 'Origin', 'Mass', 'Intensity (m²/kg)', 'Footprint (m²)']],
    body: landTableData,
    theme: 'plain',
    headStyles: {
      fillColor: colors.emerald,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: colors.lightGray,
    },
  });

  addModernFooter(doc, 5, colors);

  // ============================================================================
  // PAGE 6: DATA TRANSPARENCY
  // ============================================================================

  doc.addPage();
  yPos = 20;

  addSectionHeader(doc, 'Data Provenance & Transparency', colors.accent, colors);

  yPos = 45;

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Data Sources', margin, yPos);

  yPos += 10;

  data.dataSources.forEach((source) => {
    doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.roundedRect(margin, yPos, contentWidth, 20, 4, 4, 'F');

    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(source.name, margin + 5, yPos + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(source.description, margin + 5, yPos + 13);

    doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.roundedRect(contentWidth + margin - 30, yPos + 5, 25, 7, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${source.count}`, contentWidth + margin - 17.5, yPos + 10, { align: 'center' });

    yPos += 24;
  });

  // System boundary
  yPos += 5;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('System Boundary', margin, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  const boundaryLines = doc.splitTextToSize(data.systemBoundary, contentWidth);
  boundaryLines.forEach((line: string, i: number) => {
    doc.text(line, margin, yPos + (i * 5));
  });

  yPos += boundaryLines.length * 5 + 10;

  // Limitations
  doc.setFillColor(colors.amber[0], colors.amber[1], colors.amber[2], 10);
  doc.roundedRect(margin, yPos, contentWidth, 25, 4, 4, 'F');

  yPos += 8;
  doc.setTextColor(colors.amber[0], colors.amber[1], colors.amber[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Cut-off Criteria (ISO 14044)', margin + 5, yPos);

  yPos += 7;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const cutoffText = 'Processes contributing less than 1% to total impact individually and less than 5% cumulatively were excluded from the assessment in accordance with ISO 14044 requirements.';
  const cutoffLines = doc.splitTextToSize(cutoffText, contentWidth - 10);
  cutoffLines.forEach((line: string, i: number) => {
    doc.text(line, margin + 5, yPos + (i * 4.5));
  });

  addModernFooter(doc, 6, colors);

  const filename = `${data.productName.replace(/\s+/g, '_')}_LCA_Report_${data.version}.pdf`;
  doc.save(filename);
}

function drawModernDqiGauge(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  score: number,
  colors: any
): void {
  const radius = 28;

  let gaugeColor: [number, number, number];
  let confidenceLevel: string;

  if (score >= 80) {
    gaugeColor = colors.green;
    confidenceLevel = 'High Confidence';
  } else if (score >= 50) {
    gaugeColor = colors.amber;
    confidenceLevel = 'Medium Confidence';
  } else {
    gaugeColor = colors.red;
    confidenceLevel = 'Low Confidence';
  }

  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.circle(centerX, centerY, radius, 'F');

  const startAngle = 135;
  const endAngle = startAngle + (270 * score) / 100;

  doc.setFillColor(gaugeColor[0], gaugeColor[1], gaugeColor[2]);
  drawArc(doc, centerX, centerY, radius, startAngle, endAngle);

  doc.setFillColor(255, 255, 255);
  doc.circle(centerX, centerY, radius - 8, 'F');

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(score.toString(), centerX, centerY - 2, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text('DQI Score', centerX, centerY + 6, { align: 'center' });

  doc.setFillColor(gaugeColor[0], gaugeColor[1], gaugeColor[2]);
  doc.roundedRect(centerX - 35, centerY + radius + 8, 70, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(confidenceLevel, centerX, centerY + radius + 13.5, { align: 'center' });
}

function drawArc(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): void {
  const segments = 50;
  const angleStep = (endAngle - startAngle) / segments;

  for (let i = 0; i < segments; i++) {
    const angle1 = ((startAngle + i * angleStep) * Math.PI) / 180;
    const angle2 = ((startAngle + (i + 1) * angleStep) * Math.PI) / 180;

    const x1 = cx + Math.cos(angle1) * (radius - 8);
    const y1 = cy + Math.sin(angle1) * (radius - 8);
    const x2 = cx + Math.cos(angle1) * radius;
    const y2 = cy + Math.sin(angle1) * radius;
    const x3 = cx + Math.cos(angle2) * radius;
    const y3 = cy + Math.sin(angle2) * radius;
    const x4 = cx + Math.cos(angle2) * (radius - 8);
    const y4 = cy + Math.sin(angle2) * (radius - 8);

    doc.triangle(x1, y1, x2, y2, x3, y3, 'F');
    doc.triangle(x1, y1, x3, y3, x4, y4, 'F');
  }
}

function drawMetricBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  unit: string,
  color: [number, number, number],
  colors: any
): void {
  doc.setFillColor(color[0], color[1], color[2], 10);
  doc.roundedRect(x, y, width, 28, 3, 3, 'F');

  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), x + 3, y + 6);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + 3, y + 16);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(unit, x + 3, y + 23);
}

function addSectionHeader(doc: jsPDF, title: string, color: [number, number, number], colors: any): void {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 20);
}

function addModernFooter(doc: jsPDF, pageNum: number, colors: any): void {
  const pageHeight = 297;
  const pageWidth = 210;

  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.setLineWidth(0.2);
  doc.line(20, pageHeight - 18, pageWidth - 20, pageHeight - 18);

  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('AlkaTera Carbon Management Platform', 20, pageHeight - 12);

  doc.setFont('helvetica', 'bold');
  doc.text(`${pageNum}`, pageWidth - 20, pageHeight - 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Generated: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 20, pageHeight - 8);
}
