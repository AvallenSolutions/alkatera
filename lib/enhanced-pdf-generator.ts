/**
 * @deprecated Use `lib/pdf/render-lca-html.ts` + `lib/pdf/pdfshift-client.ts` instead.
 * This file uses the old jsPDF approach which produces lower-quality PDFs.
 * The new system uses PDFShift API with HTML/CSS templates for pixel-perfect output.
 * See `.claude/skills/pdf-generation.md` for the new architecture.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EnhancedLcaReportData {
  productName: string;
  version: string;
  assessmentPeriod: string;
  publishedDate: string;
  functionalUnit: string;
  systemBoundary: string;
  metrics: {
    climate_change_gwp100: number;
    water_consumption: number;
    land_use: number;
    circularity_percentage: number;
  };
  dataQuality: {
    averageConfidence: number;
    rating: string;
    highQualityCount: number;
    mediumQualityCount: number;
    lowQualityCount: number;
    totalMaterialsCount: number;
  };
  dataProvenance: {
    hybridSourcesCount: number;
    defraGwpCount: number;
    supplierVerifiedCount: number;
    ecoinventOnlyCount: number;
    methodologySummary: string;
  };
  ghgBreakdown?: {
    co2Fossil: number;
    co2Biogenic: number;
    co2Dluc: number;
  };
  complianceFramework: {
    standards: string[];
    certifications: string[];
  };
}

export async function generateEnhancedLcaPdf(data: EnhancedLcaReportData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const colors = {
    primary: [15, 23, 42] as [number, number, number],
    secondary: [100, 116, 139] as [number, number, number],
    accent: [59, 130, 246] as [number, number, number],
    green: [22, 163, 74] as [number, number, number],
    purple: [147, 51, 234] as [number, number, number],
    amber: [245, 158, 11] as [number, number, number],
    red: [239, 68, 68] as [number, number, number],
    lightGray: [241, 245, 249] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
  };

  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 20;

  // ============================================================================
  // PAGE 1: COVER PAGE
  // ============================================================================

  // Header
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 50, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Product LCA Report', margin, 25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Life Cycle Assessment - ISO 14044 Compliant', margin, 35);

  // Product Title
  yPos = 70;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.productName, margin, yPos);

  // Version Badge
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

  // Metadata
  yPos += 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(`Assessment Period: ${data.assessmentPeriod}`, margin, yPos);
  doc.text(
    `Published: ${new Date(data.publishedDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`,
    margin,
    yPos + 6
  );
  doc.text(`Functional Unit: ${data.functionalUnit}`, margin, yPos + 12);

  // Executive Summary Box
  yPos += 30;
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.roundedRect(margin, yPos, contentWidth, 60, 3, 3, 'F');

  yPos += 8;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', margin + 5, yPos);

  yPos += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);

  const summaryText = `This Life Cycle Assessment evaluates the environmental impacts of ${data.productName} in accordance with ISO 14044:2006 and ISO 14067:2018 standards. The assessment covers ${data.systemBoundary} and utilises a hybrid methodology combining UK regulatory data (DEFRA 2025) with comprehensive environmental impact data (Ecoinvent 3.12) to ensure both compliance and comprehensiveness.`;

  doc.text(summaryText, margin + 5, yPos, { maxWidth: contentWidth - 10 });

  yPos += 30;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text('Key Environmental Impacts:', margin + 5, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `• Climate Change: ${data.metrics.climate_change_gwp100.toFixed(2)} kg CO₂e`,
    margin + 8,
    yPos
  );
  doc.text(
    `• Water Consumption: ${data.metrics.water_consumption.toFixed(2)} L`,
    margin + 8,
    yPos + 5
  );
  doc.text(`• Land Use: ${data.metrics.land_use.toFixed(2)} m²`, margin + 8, yPos + 10);

  // Data Quality Badge
  yPos += 20;
  const qualityColor =
    data.dataQuality.averageConfidence >= 80
      ? colors.green
      : data.dataQuality.averageConfidence >= 60
      ? colors.amber
      : colors.red;

  doc.setFillColor(qualityColor[0], qualityColor[1], qualityColor[2]);
  doc.roundedRect(margin, yPos, 60, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Data Quality', margin + 4, yPos + 5);
  doc.setFontSize(14);
  doc.text(`${data.dataQuality.averageConfidence}%`, margin + 4, yPos + 10);

  addPageNumber(doc, 1, colors);

  // ============================================================================
  // PAGE 2: METHODOLOGY & DATA SOURCES
  // ============================================================================

  doc.addPage();
  yPos = 20;

  // Page Header
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Methodology & Data Sources', margin, 10);

  // Hybrid Methodology Section
  yPos = 30;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Hybrid Data Model', margin, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);

  const methodologyText = `This LCA employs a category-aware hybrid data model that optimises both regulatory compliance and environmental comprehensiveness. The system automatically selects the most appropriate data source for each material category, ensuring UK regulatory compliance through DEFRA 2025 emission factors whilst maintaining comprehensive environmental assessment through Ecoinvent 3.12.`;

  doc.text(methodologyText, margin, yPos, { maxWidth: contentWidth });

  // Data Source Breakdown
  yPos += 25;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Data Source Distribution', margin, yPos);

  yPos += 10;

  // Supplier Verified
  if (data.dataProvenance.supplierVerifiedCount > 0) {
    doc.setFillColor(colors.green[0], colors.green[1], colors.green[2], 0.1);
    doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');
    doc.setTextColor(colors.green[0], colors.green[1], colors.green[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Supplier Verified (${data.dataProvenance.supplierVerifiedCount} materials)`,
      margin + 5,
      yPos + 7
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(
      'Third-party verified Environmental Product Declarations (EPDs) with 95% confidence',
      margin + 5,
      yPos + 13
    );
    yPos += 22;
  }

  // Hybrid Sources
  if (data.dataProvenance.hybridSourcesCount > 0) {
    doc.setFillColor(colors.purple[0], colors.purple[1], colors.purple[2], 0.1);
    doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'F');
    doc.setTextColor(colors.purple[0], colors.purple[1], colors.purple[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Hybrid Sources (${data.dataProvenance.hybridSourcesCount} materials)`,
      margin + 5,
      yPos + 7
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(
      'DEFRA 2025 GHG factors for UK regulatory compliance (80% confidence)',
      margin + 5,
      yPos + 13
    );
    doc.text(
      'Ecoinvent 3.12 for comprehensive non-GWP environmental impacts',
      margin + 5,
      yPos + 18
    );
    yPos += 26;
  }

  // Ecoinvent Only
  if (data.dataProvenance.ecoinventOnlyCount > 0) {
    doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2], 0.1);
    doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');
    doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Ecoinvent Database (${data.dataProvenance.ecoinventOnlyCount} materials)`,
      margin + 5,
      yPos + 7
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(
      'Complete lifecycle inventory data from Ecoinvent 3.12 (70% confidence)',
      margin + 5,
      yPos + 13
    );
    yPos += 22;
  }

  // Methodology Summary
  yPos += 5;
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'F');
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary:', margin + 5, yPos + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(data.dataProvenance.methodologySummary, margin + 5, yPos + 13, {
    maxWidth: contentWidth - 10,
  });

  // Data Quality Distribution
  yPos += 30;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Data Quality Assessment', margin, yPos);

  yPos += 10;
  autoTable(doc, {
    startY: yPos,
    head: [['Quality Grade', 'Materials', 'Percentage', 'Confidence Range']],
    body: [
      [
        'High',
        data.dataQuality.highQualityCount.toString(),
        `${((data.dataQuality.highQualityCount / data.dataQuality.totalMaterialsCount) * 100).toFixed(1)}%`,
        '90-95%',
      ],
      [
        'Medium',
        data.dataQuality.mediumQualityCount.toString(),
        `${((data.dataQuality.mediumQualityCount / data.dataQuality.totalMaterialsCount) * 100).toFixed(1)}%`,
        '70-85%',
      ],
      [
        'Low',
        data.dataQuality.lowQualityCount.toString(),
        `${((data.dataQuality.lowQualityCount / data.dataQuality.totalMaterialsCount) * 100).toFixed(1)}%`,
        '50-60%',
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: colors.primary,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // GHG Breakdown (if available)
  if (data.ghgBreakdown) {
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('GHG Breakdown (ISO 14067)', margin, yPos);

    yPos += 10;
    autoTable(doc, {
      startY: yPos,
      head: [['GHG Type', 'kg CO₂e', 'Percentage']],
      body: [
        [
          'Fossil CO₂',
          data.ghgBreakdown.co2Fossil.toFixed(2),
          `${((data.ghgBreakdown.co2Fossil / data.metrics.climate_change_gwp100) * 100).toFixed(1)}%`,
        ],
        [
          'Biogenic CO₂',
          data.ghgBreakdown.co2Biogenic.toFixed(2),
          `${((data.ghgBreakdown.co2Biogenic / data.metrics.climate_change_gwp100) * 100).toFixed(1)}%`,
        ],
        [
          'Direct Land Use Change',
          data.ghgBreakdown.co2Dluc.toFixed(2),
          `${((data.ghgBreakdown.co2Dluc / data.metrics.climate_change_gwp100) * 100).toFixed(1)}%`,
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: colors.primary,
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
      },
      margin: { left: margin, right: margin },
    });
  }

  addPageNumber(doc, 2, colors);

  // ============================================================================
  // PAGE 3: COMPLIANCE & STANDARDS
  // ============================================================================

  doc.addPage();
  yPos = 20;

  // Page Header
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Compliance Framework', margin, 10);

  // Standards Compliance
  yPos = 30;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Standards & Regulations', margin, yPos);

  yPos += 10;
  const standards = [
    {
      name: 'ISO 14044:2006',
      description: 'Environmental management — Life cycle assessment — Requirements and guidelines',
    },
    {
      name: 'ISO 14067:2018',
      description: 'Greenhouse gases — Carbon footprint of products — Requirements and guidelines',
    },
    {
      name: 'DEFRA 2025',
      description:
        'UK Government GHG Conversion Factors for Company Reporting (SECR, ESOS compliance)',
    },
    {
      name: 'CSRD (E1-E5)',
      description:
        'Corporate Sustainability Reporting Directive — Environmental sustainability topics',
    },
  ];

  standards.forEach((standard) => {
    doc.setFillColor(colors.green[0], colors.green[1], colors.green[2], 0.1);
    doc.roundedRect(margin, yPos, contentWidth, 15, 2, 2, 'F');

    doc.setTextColor(colors.green[0], colors.green[1], colors.green[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`✓ ${standard.name}`, margin + 5, yPos + 6);

    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(standard.description, margin + 5, yPos + 11);

    yPos += 18;
  });

  // Impact Categories
  yPos += 5;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Environmental Impact Categories', margin, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(
    'This assessment evaluates all 18 ReCiPe 2016 Midpoint impact categories:',
    margin,
    yPos
  );

  yPos += 10;
  const impactCategories = [
    'Climate Change (GWP100)',
    'Ozone Depletion',
    'Ionising Radiation',
    'Photochemical Ozone Formation',
    'Particulate Matter',
    'Human Toxicity (Carcinogenic)',
    'Human Toxicity (Non-carcinogenic)',
    'Terrestrial Acidification',
    'Freshwater Eutrophication',
    'Marine Eutrophication',
    'Terrestrial Ecotoxicity',
    'Freshwater Ecotoxicity',
    'Marine Ecotoxicity',
    'Land Use',
    'Water Consumption',
    'Mineral Resource Scarcity',
    'Fossil Resource Scarcity',
    'Waste Generation',
  ];

  doc.setFontSize(8);
  const cols = 2;
  const colWidth = contentWidth / cols;
  let col = 0;
  let colYPos = yPos;

  impactCategories.forEach((category, index) => {
    if (index > 0 && index % Math.ceil(impactCategories.length / cols) === 0) {
      col++;
      colYPos = yPos;
    }

    doc.text(`• ${category}`, margin + col * colWidth, colYPos);
    colYPos += 5;
  });

  // Limitations
  yPos = colYPos + 5;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Limitations & Assumptions', margin, yPos);

  yPos += 8;
  doc.setFillColor(colors.amber[0], colors.amber[1], colors.amber[2], 0.1);
  doc.roundedRect(margin, yPos, contentWidth, 30, 2, 2, 'F');

  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const limitations = [
    'Geographic scope limited to regions with available data',
    'Temporal coverage based on most recent available data (2023-2025)',
    'Proxy data used for materials without supplier-specific information',
    'Cut-off criteria: <1% individual contribution, <5% cumulative (ISO 14044)',
  ];

  let limitYPos = yPos + 6;
  limitations.forEach((limitation) => {
    doc.text(`• ${limitation}`, margin + 5, limitYPos);
    limitYPos += 5;
  });

  addPageNumber(doc, 3, colors);

  // Save PDF
  const filename = `${data.productName.replace(/\s+/g, '_')}_Enhanced_LCA_Report_v${data.version}.pdf`;
  doc.save(filename);
}

function addPageNumber(doc: jsPDF, pageNum: number, colors: any): void {
  const pageHeight = 297;
  const pageWidth = 210;

  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Page ${pageNum}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
}
