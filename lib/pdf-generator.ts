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

  // Define colors matching the web design
  const colors = {
    primary: [15, 23, 42] as [number, number, number], // slate-900
    secondary: [100, 116, 139] as [number, number, number], // slate-500
    accent: [59, 130, 246] as [number, number, number], // blue-500
    green: [22, 163, 74] as [number, number, number], // green-600
    amber: [245, 158, 11] as [number, number, number], // amber-600
    red: [239, 68, 68] as [number, number, number], // red-600
    lightGray: [241, 245, 249] as [number, number, number], // slate-100
    border: [226, 232, 240] as [number, number, number], // slate-200
  };

  // Helper functions to avoid spread operator TypeScript errors
  const setFill = (color: [number, number, number]) => doc.setFillColor(color[0], color[1], color[2]);
  const setText = (color: [number, number, number]) => doc.setTextColor(color[0], color[1], color[2]);
  const setDraw = (color: [number, number, number]) => doc.setDrawColor(color[0], color[1], color[2]);

  let yPos = 20;
  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - 2 * margin;

  // Page 1: Cover Page
  // Header with brand
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 50, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Product LCA Report', margin, 25);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Environmental Product Declaration', margin, 35);

  // Report Title
  yPos = 70;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.productName, margin, yPos);

  yPos += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(data.title, margin, yPos);

  // Status badges
  yPos += 15;
  doc.setFillColor(colors.green[0], colors.green[1], colors.green[2]);
  doc.roundedRect(margin, yPos, 30, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Published', margin + 4, yPos + 5.5);

  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.roundedRect(margin + 35, yPos, 20, 8, 2, 2, 'FD');
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text(`v${data.version}`, margin + 39, yPos + 5.5);

  // Report metadata
  yPos += 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(`Assessment Period: ${data.assessmentPeriod}`, margin, yPos);
  doc.text(`Published: ${new Date(data.publishedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, yPos + 6);

  // DQI Score Section
  yPos += 25;
  drawDqiGauge(doc, margin + 10, yPos, data.dqiScore, colors);

  // Summary box
  yPos += 90;
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.roundedRect(margin, yPos, contentWidth, 50, 3, 3, 'F');

  yPos += 8;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Summary', margin + 5, yPos);

  yPos += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`System Boundary: ${data.systemBoundary}`, margin + 5, yPos);
  doc.text(`Functional Unit: ${data.functionalUnit}`, margin + 5, yPos + 6);
  doc.text('Standards: ISO 14044:2006, CSRD E1, GHG Protocol', margin + 5, yPos + 12);
  doc.text('Assessment Method: ReCiPe 2016 Midpoint (H)', margin + 5, yPos + 18);

  // Footer
  addFooter(doc, 1, colors);

  // Page 2: Environmental Impacts
  doc.addPage();
  yPos = 20;

  // Page header
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Environmental Impact Assessment', margin, 10);

  yPos = 30;

  // Climate Impact
  yPos = drawImpactCard(
    doc,
    margin,
    yPos,
    contentWidth,
    'Climate Change',
    `${data.metrics.total_impacts.climate_change_gwp100.toFixed(3)} kg CO₂eq`,
    'GHG emissions contributing to global warming',
    colors.green,
    colors
  );

  yPos += 10;

  // Water Impact
  yPos = drawImpactCard(
    doc,
    margin,
    yPos,
    contentWidth,
    'Water Consumption',
    `${data.metrics.total_impacts.water_consumption.toFixed(2)} L`,
    `Scarcity-weighted: ${data.metrics.total_impacts.water_scarcity_aware.toFixed(2)} m³ world eq`,
    colors.accent,
    colors
  );

  yPos += 10;

  // Circularity
  yPos = drawImpactCard(
    doc,
    margin,
    yPos,
    contentWidth,
    'Circularity',
    `${data.metrics.circularity_percentage}%`,
    'Material recovery and circular economy performance',
    colors.amber,
    colors
  );

  yPos += 10;

  // Land Use
  yPos = drawImpactCard(
    doc,
    margin,
    yPos,
    contentWidth,
    'Land Use',
    `${data.metrics.total_impacts.land_use.toFixed(2)} m²a`,
    'Agricultural and extraction land footprint',
    colors.green,
    colors
  );

  addFooter(doc, 2, colors);

  // Page 3: Water Impact Deep Dive
  doc.addPage();
  yPos = 20;

  setFill(colors.primary);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Water Impact Analysis', margin, 10);

  yPos = 30;
  setText(colors.primary);
  doc.setFontSize(12);
  doc.text('Water Consumption by Source', margin, yPos);

  yPos += 5;

  // Water sources table
  const waterTableData = data.waterSources.map(item => [
    item.source,
    item.location,
    `${item.consumption.toFixed(2)} L`,
    item.riskLevel.toUpperCase(),
    `${item.riskFactor.toFixed(1)}`,
    `${item.netImpact.toFixed(2)} m³ eq`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Source', 'Location', 'Volume', 'Risk', 'AWARE Factor', 'Net Impact']],
    body: waterTableData,
    theme: 'grid',
    headStyles: {
      fillColor: colors.accent,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 40 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 18 },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 27, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const riskLevel = data.cell.text[0];
        if (riskLevel === 'HIGH') {
          data.cell.styles.textColor = colors.red;
          data.cell.styles.fontStyle = 'bold';
        } else if (riskLevel === 'MEDIUM') {
          data.cell.styles.textColor = colors.amber;
        } else {
          data.cell.styles.textColor = colors.green;
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Key insight
  doc.setFillColor(59, 130, 246, 20);
  doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'F');
  yPos += 7;
  setText(colors.primary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Insight:', margin + 5, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const highRiskSource = data.waterSources.find(s => s.riskLevel === 'high');
  if (highRiskSource) {
    const impactPercent = Math.round((highRiskSource.netImpact / data.metrics.total_impacts.water_scarcity_aware) * 100);
    doc.text(
      `${highRiskSource.source} drives ${impactPercent}% of water scarcity impact due to high AWARE factor (${highRiskSource.riskFactor.toFixed(1)}).`,
      margin + 5,
      yPos,
      { maxWidth: contentWidth - 10 }
    );
  }

  addFooter(doc, 3, colors);

  // Page 4: Circularity Deep Dive
  doc.addPage();
  yPos = 20;

  setFill(colors.primary);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Circularity Analysis', margin, 10);

  yPos = 30;
  setText(colors.primary);
  doc.setFontSize(12);
  doc.text('Waste Stream Management', margin, yPos);

  yPos += 5;

  const wasteTableData = data.wasteStreams.map(item => [
    item.stream,
    item.disposition.charAt(0).toUpperCase() + item.disposition.slice(1),
    `${item.mass} g`,
    `${item.circularityScore}%`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Waste Stream', 'Disposition', 'Mass', 'Circularity']],
    body: wasteTableData,
    theme: 'grid',
    headStyles: {
      fillColor: colors.amber,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 60 },
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
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  const totalWaste = data.wasteStreams.reduce((sum, s) => sum + s.mass, 0) / 1000;
  const circularWaste = data.wasteStreams.reduce((sum, s) => sum + (s.mass * s.circularityScore / 100), 0) / 1000;
  const linearWaste = totalWaste - circularWaste;

  doc.setFillColor(245, 158, 11, 20);
  doc.roundedRect(margin, yPos, contentWidth, 30, 2, 2, 'F');
  yPos += 7;
  setText(colors.primary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Circularity Summary:', margin + 5, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total waste: ${totalWaste.toFixed(3)} kg`, margin + 5, yPos);
  doc.text(`Circular: ${circularWaste.toFixed(3)} kg (${data.metrics.circularity_percentage}%)`, margin + 5, yPos + 6);
  doc.text(`Linear: ${linearWaste.toFixed(3)} kg (${(100 - data.metrics.circularity_percentage)}%)`, margin + 5, yPos + 12);

  addFooter(doc, 4, colors);

  // Page 5: Land Use Deep Dive
  doc.addPage();
  yPos = 20;

  setFill(colors.primary);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Land Use Analysis', margin, 10);

  yPos = 30;
  setText(colors.primary);
  doc.setFontSize(12);
  doc.text('Material Land Footprint', margin, yPos);

  yPos += 5;

  const landTableData = data.landUseItems.map(item => [
    item.ingredient,
    item.origin,
    `${item.mass.toFixed(3)} kg`,
    `${item.landIntensity.toFixed(1)} m²a/kg`,
    `${item.totalFootprint.toFixed(2)} m²a`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Material', 'Origin', 'Mass', 'Intensity', 'Total Footprint']],
    body: landTableData,
    theme: 'grid',
    headStyles: {
      fillColor: colors.green,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  const topContributor = data.landUseItems.reduce((max, item) =>
    item.totalFootprint > max.totalFootprint ? item : max
  );
  const contributionPercent = Math.round((topContributor.totalFootprint / data.metrics.total_impacts.land_use) * 100);

  doc.setFillColor(22, 163, 74, 20);
  doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'F');
  yPos += 7;
  setText(colors.primary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Insight:', margin + 5, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${topContributor.ingredient} drives ${contributionPercent}% of land footprint due to high land intensity (${topContributor.landIntensity.toFixed(1)} m²a/kg).`,
    margin + 5,
    yPos,
    { maxWidth: contentWidth - 10 }
  );

  addFooter(doc, 5, colors);

  // Page 6: Data Provenance
  doc.addPage();
  yPos = 20;

  setFill(colors.primary);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Data Provenance & Transparency', margin, 10);

  yPos = 30;
  setText(colors.primary);
  doc.setFontSize(12);
  doc.text('Data Sources', margin, yPos);

  yPos += 10;

  data.dataSources.forEach((source) => {
    setFill(colors.lightGray);
    doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');

    setText(colors.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(source.name, margin + 5, yPos + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(colors.secondary);
    doc.text(source.description, margin + 5, yPos + 12);

    setFill(colors.border);
    doc.roundedRect(contentWidth + margin - 28, yPos + 4, 25, 6, 1, 1, 'F');
    setText(colors.primary);
    doc.setFontSize(8);
    doc.text(`${source.count} processes`, contentWidth + margin - 26, yPos + 8.5);

    yPos += 22;
  });

  yPos += 5;
  setText(colors.primary);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('System Boundary', margin, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Boundary Definition: ${data.systemBoundary}`, margin, yPos);

  yPos += 10;
  const includedItems = [
    'Raw material extraction',
    'Primary production',
    'Packaging manufacture',
    'Factory operations',
  ];

  doc.setFillColor(22, 163, 74, 20);
  doc.roundedRect(margin, yPos, (contentWidth / 2) - 2, 30, 2, 2, 'F');
  setText(colors.green);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Included:', margin + 3, yPos + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  includedItems.forEach((item, i) => {
    doc.text(`• ${item}`, margin + 3, yPos + 12 + i * 4);
  });

  const excludedItems = [
    'Distribution to retailers',
    'Consumer use phase',
    'End-of-life disposal',
    'Capital goods',
  ];

  doc.setFillColor(100, 116, 139, 20);
  doc.roundedRect(margin + (contentWidth / 2) + 2, yPos, (contentWidth / 2) - 2, 30, 2, 2, 'F');
  setText(colors.secondary);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Excluded:', margin + (contentWidth / 2) + 5, yPos + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  excludedItems.forEach((item, i) => {
    doc.text(`• ${item}`, margin + (contentWidth / 2) + 5, yPos + 12 + i * 4);
  });

  yPos += 35;
  doc.setFillColor(245, 158, 11, 20);
  doc.roundedRect(margin, yPos, contentWidth, 15, 2, 2, 'F');
  setText(colors.primary);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Cut-off Criteria:', margin + 3, yPos + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Processes contributing <1% to total impact and cumulatively <5% were excluded per ISO 14044.',
    margin + 3,
    yPos + 11,
    { maxWidth: contentWidth - 6 }
  );

  addFooter(doc, 6, colors);

  // Save the PDF
  const filename = `${data.productName.replace(/\s+/g, '_')}_LCA_Report_${data.version}.pdf`;
  doc.save(filename);
}

function drawDqiGauge(
  doc: jsPDF,
  x: number,
  y: number,
  score: number,
  colors: any
): void {
  const gaugeSize = 35;
  const centerX = x + gaugeSize;
  const centerY = y + gaugeSize;
  const radius = gaugeSize;

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
    confidenceLevel = 'Modelled/Estimate';
  }

  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.circle(centerX, centerY, radius, 'F');

  const startAngle = 135;
  const endAngle = startAngle + (270 * score) / 100;

  doc.setFillColor(gaugeColor[0], gaugeColor[1], gaugeColor[2]);
  drawArc(doc, centerX, centerY, radius, startAngle, endAngle);

  doc.setFillColor(255, 255, 255);
  doc.circle(centerX, centerY, radius - 10, 'F');

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(score.toString(), centerX, centerY - 5, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text('/ 100', centerX, centerY + 3, { align: 'center' });

  y = centerY + radius + 10;
  doc.setFillColor(gaugeColor[0], gaugeColor[1], gaugeColor[2]);
  doc.roundedRect(x, y, 70, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(confidenceLevel, x + 35, y + 5.5, { align: 'center' });

  y += 12;
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Data Quality Index', x, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Primary data with full traceability.', x, y, { maxWidth: 70 });
  doc.text('Suitable for CSRD and ISO 14044', x, y + 4, { maxWidth: 70 });
  doc.text('compliance.', x, y + 8, { maxWidth: 70 });
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

    const x1 = cx + Math.cos(angle1) * (radius - 10);
    const y1 = cy + Math.sin(angle1) * (radius - 10);
    const x2 = cx + Math.cos(angle1) * radius;
    const y2 = cy + Math.sin(angle1) * radius;
    const x3 = cx + Math.cos(angle2) * radius;
    const y3 = cy + Math.sin(angle2) * radius;
    const x4 = cx + Math.cos(angle2) * (radius - 10);
    const y4 = cy + Math.sin(angle2) * (radius - 10);

    doc.triangle(x1, y1, x2, y2, x3, y3, 'F');
    doc.triangle(x1, y1, x3, y3, x4, y4, 'F');
  }
}

function drawImpactCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  value: string,
  description: string,
  accentColor: number[],
  colors: any
): number {
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.roundedRect(x, y, width, 25, 2, 2, 'F');

  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(0.5);
  doc.line(x, y, x, y + 25);

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x + 5, y + 8);

  doc.setFontSize(16);
  doc.text(value, x + 5, y + 17);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(description, x + 5, y + 22);

  return y + 25;
}

function addFooter(doc: jsPDF, pageNum: number, colors: any): void {
  const pageHeight = 297;
  const pageWidth = 210;

  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.setLineWidth(0.3);
  doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);

  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('AlkaTera Carbon Management Platform', 20, pageHeight - 10);
  doc.text(`Page ${pageNum}`, pageWidth - 20, pageHeight - 10, { align: 'right' });

  doc.setFontSize(7);
  doc.text('Generated: ' + new Date().toLocaleDateString('en-GB'), 20, pageHeight - 6);
}
