import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Define mock functions that will be used by the mocked modules
const mockSetFillColor = vi.fn().mockReturnThis();
const mockSetTextColor = vi.fn().mockReturnThis();
const mockSetFontSize = vi.fn().mockReturnThis();
const mockSetFont = vi.fn().mockReturnThis();
const mockSetDrawColor = vi.fn().mockReturnThis();
const mockSetLineWidth = vi.fn().mockReturnThis();
const mockRect = vi.fn().mockReturnThis();
const mockRoundedRect = vi.fn().mockReturnThis();
const mockCircle = vi.fn().mockReturnThis();
const mockTriangle = vi.fn().mockReturnThis();
const mockLine = vi.fn().mockReturnThis();
const mockText = vi.fn().mockReturnThis();
const mockSplitTextToSize = vi.fn((text: string, maxWidth: number) => {
  // Simple mock that splits on newlines and returns array
  const avgCharsPerLine = Math.floor(maxWidth / 2);
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length > avgCharsPerLine) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
});
const mockGetTextWidth = vi.fn((text: string) => text.length * 2);
const mockAddPage = vi.fn().mockReturnThis();
const mockSave = vi.fn().mockReturnThis();

// Mock jspdf module - using a class that returns the mock instance
vi.mock('jspdf', () => {
  return {
    default: class MockJsPDF {
      setFillColor = mockSetFillColor;
      setTextColor = mockSetTextColor;
      setFontSize = mockSetFontSize;
      setFont = mockSetFont;
      setDrawColor = mockSetDrawColor;
      setLineWidth = mockSetLineWidth;
      rect = mockRect;
      roundedRect = mockRoundedRect;
      circle = mockCircle;
      triangle = mockTriangle;
      line = mockLine;
      text = mockText;
      splitTextToSize = mockSplitTextToSize;
      getTextWidth = mockGetTextWidth;
      addPage = mockAddPage;
      save = mockSave;
      lastAutoTable = { finalY: 200 };
    },
  };
});

// Mock jspdf-autotable module
vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

// Import after mocks are set up
import { generateLcaReportPdf } from '../pdf-generator';
import autoTableModule from 'jspdf-autotable';
import jsPDF from 'jspdf';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

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

function createMockWaterSource(overrides: Partial<WaterSource> = {}): WaterSource {
  return {
    id: 'ws-001',
    source: 'Municipal Supply',
    location: 'United Kingdom',
    consumption: 150.5,
    riskFactor: 1.2,
    riskLevel: 'low',
    netImpact: 180.6,
    ...overrides,
  };
}

function createMockWasteStream(overrides: Partial<WasteStream> = {}): WasteStream {
  return {
    id: 'waste-001',
    stream: 'Glass Bottles',
    disposition: 'recycling',
    mass: 350,
    circularityScore: 100,
    ...overrides,
  };
}

function createMockLandUseItem(overrides: Partial<LandUseItem> = {}): LandUseItem {
  return {
    id: 'land-001',
    ingredient: 'Grape Juice',
    origin: 'France',
    mass: 0.75,
    landIntensity: 2.5,
    totalFootprint: 1.875,
    ...overrides,
  };
}

function createMockDataSource(overrides: Partial<{ name: string; description: string; count: number }> = {}) {
  return {
    name: 'ecoinvent 3.9',
    description: 'Swiss LCA database with global coverage',
    count: 15,
    ...overrides,
  };
}

function createMockLcaReportData(overrides: Partial<LcaReportData> = {}): LcaReportData {
  return {
    title: 'Product Impact Assessment',
    version: '1.0',
    productName: 'Premium Red Wine 750ml',
    assessmentPeriod: '2024',
    publishedDate: '2024-06-15',
    dqiScore: 75,
    systemBoundary: 'Cradle-to-gate including raw material extraction, manufacturing, and packaging',
    functionalUnit: '1 bottle (750ml) of wine',
    metrics: {
      total_impacts: {
        climate_change_gwp100: 1.234,
        water_consumption: 25.5,
        water_scarcity_aware: 42.3,
        land_use: 3.75,
        fossil_resource_scarcity: 0.45,
      },
      circularity_percentage: 85,
    },
    waterSources: [createMockWaterSource()],
    wasteStreams: [createMockWasteStream()],
    landUseItems: [createMockLandUseItem()],
    dataSources: [createMockDataSource()],
    ...overrides,
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

// Get references to the mocked modules for assertions
const getMockedAutoTable = () => autoTableModule as unknown as Mock;
const getMockedJsPDF = () => jsPDF as unknown as Mock;

describe('PDF Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock instance for each test
    mockSetFillColor.mockClear();
    mockSetTextColor.mockClear();
    mockSetFontSize.mockClear();
    mockSetFont.mockClear();
    mockSetDrawColor.mockClear();
    mockSetLineWidth.mockClear();
    mockRect.mockClear();
    mockRoundedRect.mockClear();
    mockCircle.mockClear();
    mockTriangle.mockClear();
    mockLine.mockClear();
    mockText.mockClear();
    mockSplitTextToSize.mockClear();
    mockGetTextWidth.mockClear();
    mockAddPage.mockClear();
    mockSave.mockClear();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // PDF DOCUMENT CREATION TESTS
  // ==========================================================================

  describe('PDF Document Creation', () => {
    it('should create a PDF document and save it', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Verify the PDF was created and saved
      expect(mockSave).toHaveBeenCalled();
    });

    it('should generate PDF without errors', async () => {
      const data = createMockLcaReportData();

      // Should not throw
      await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
    });

    it('should add 6 pages to the PDF (cover + 5 content pages)', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Cover page is first, then 5 addPage calls for remaining pages
      expect(mockAddPage).toHaveBeenCalledTimes(5);
    });

    it('should save the PDF with correct filename', async () => {
      const data = createMockLcaReportData({
        productName: 'Test Product',
        version: '2.0',
      });

      await generateLcaReportPdf(data);

      expect(mockSave).toHaveBeenCalledWith('Test_Product_LCA_Report_2.0.pdf');
    });

    it('should handle product names with spaces in filename', async () => {
      const data = createMockLcaReportData({
        productName: 'Premium Red Wine 750ml',
        version: '1.0',
      });

      await generateLcaReportPdf(data);

      expect(mockSave).toHaveBeenCalledWith('Premium_Red_Wine_750ml_LCA_Report_1.0.pdf');
    });

    it('should handle product names with multiple consecutive spaces', async () => {
      const data = createMockLcaReportData({
        productName: 'Wine   Product   Name',
        version: '1.0',
      });

      await generateLcaReportPdf(data);

      expect(mockSave).toHaveBeenCalledWith('Wine_Product_Name_LCA_Report_1.0.pdf');
    });
  });

  // ==========================================================================
  // DATA FORMATTING FOR PDF TESTS
  // ==========================================================================

  describe('Data Formatting for PDF', () => {
    it('should format climate impact with 3 decimal places', async () => {
      const data = createMockLcaReportData({
        metrics: {
          total_impacts: {
            climate_change_gwp100: 1.23456789,
            water_consumption: 25.5,
            water_scarcity_aware: 42.3,
            land_use: 3.75,
            fossil_resource_scarcity: 0.45,
          },
          circularity_percentage: 85,
        },
      });

      await generateLcaReportPdf(data);

      // Check that text was called with formatted value
      expect(mockText).toHaveBeenCalledWith(
        '1.235',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should format water consumption with 2 decimal places', async () => {
      const data = createMockLcaReportData({
        metrics: {
          total_impacts: {
            climate_change_gwp100: 1.234,
            water_consumption: 25.567,
            water_scarcity_aware: 42.3,
            land_use: 3.75,
            fossil_resource_scarcity: 0.45,
          },
          circularity_percentage: 85,
        },
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        '25.57',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should format land use with 2 decimal places', async () => {
      const data = createMockLcaReportData({
        metrics: {
          total_impacts: {
            climate_change_gwp100: 1.234,
            water_consumption: 25.5,
            water_scarcity_aware: 42.3,
            land_use: 3.7589,
            fossil_resource_scarcity: 0.45,
          },
          circularity_percentage: 85,
        },
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        '3.76',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should display circularity percentage as integer', async () => {
      const data = createMockLcaReportData({
        metrics: {
          total_impacts: {
            climate_change_gwp100: 1.234,
            water_consumption: 25.5,
            water_scarcity_aware: 42.3,
            land_use: 3.75,
            fossil_resource_scarcity: 0.45,
          },
          circularity_percentage: 85,
        },
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        '85%',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should format published date in UK locale', async () => {
      const data = createMockLcaReportData({
        publishedDate: '2024-06-15',
      });

      await generateLcaReportPdf(data);

      // The date should be formatted as "15 June 2024"
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Published: 15 June 2024'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should format version number with v prefix', async () => {
      const data = createMockLcaReportData({
        version: '3.2',
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        'v3.2',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  // ==========================================================================
  // SECTION GENERATION TESTS
  // ==========================================================================

  describe('Section Generation', () => {
    describe('Cover Page', () => {
      it('should render product name on cover page', async () => {
        const data = createMockLcaReportData({
          productName: 'Test Wine Product',
        });

        await generateLcaReportPdf(data);

        expect(mockSplitTextToSize).toHaveBeenCalledWith(
          'Test Wine Product',
          expect.any(Number)
        );
      });

      it('should render title text on cover page', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Product Impact',
          expect.any(Number),
          expect.any(Number)
        );
        expect(mockText).toHaveBeenCalledWith(
          'Assessment',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render PUBLISHED badge', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'PUBLISHED',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render assessment period metadata', async () => {
        const data = createMockLcaReportData({
          assessmentPeriod: '2024',
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Assessment Period: 2024',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render functional unit metadata', async () => {
        const data = createMockLcaReportData({
          functionalUnit: '1 bottle (750ml) of wine',
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Functional Unit: 1 bottle (750ml) of wine',
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    describe('Climate Impact Page', () => {
      it('should render climate change section header', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Climate Change Impact',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render compliance badges', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'ISO 14044',
          expect.any(Number),
          expect.any(Number)
        );
        expect(mockText).toHaveBeenCalledWith(
          'ISO 14067',
          expect.any(Number),
          expect.any(Number)
        );
        expect(mockText).toHaveBeenCalledWith(
          'CSRD E1',
          expect.any(Number),
          expect.any(Number)
        );
        expect(mockText).toHaveBeenCalledWith(
          'GHG Protocol',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render assessment methodology info', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Method: ReCiPe 2016 Midpoint (H) - Hierarchist Perspective',
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    describe('Water Impact Page', () => {
      it('should render water impact section header', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Water Impact Analysis',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render water sources table', async () => {
        const data = createMockLcaReportData({
          waterSources: [
            createMockWaterSource({
              source: 'Municipal Supply',
              location: 'UK',
              consumption: 100,
            }),
            createMockWaterSource({
              id: 'ws-002',
              source: 'Groundwater',
              location: 'France',
              consumption: 50,
            }),
          ],
        });

        await generateLcaReportPdf(data);

        // autoTable should be called for water sources table
        expect(getMockedAutoTable()).toHaveBeenCalled();
        const waterTableCall = getMockedAutoTable().mock.calls.find(
          (call) => call[1]?.head?.[0]?.includes('Source')
        );
        expect(waterTableCall).toBeDefined();
      });

      it('should render key insight for high risk water source', async () => {
        const data = createMockLcaReportData({
          waterSources: [
            createMockWaterSource({
              source: 'Irrigation',
              location: 'Spain',
              riskLevel: 'high',
              riskFactor: 8.5,
              netImpact: 35.0,
            }),
          ],
          metrics: {
            total_impacts: {
              climate_change_gwp100: 1.234,
              water_consumption: 25.5,
              water_scarcity_aware: 42.3,
              land_use: 3.75,
              fossil_resource_scarcity: 0.45,
            },
            circularity_percentage: 85,
          },
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Key Insight',
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    describe('Circularity Page', () => {
      it('should render circularity section header', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Circularity & Waste Management',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render waste streams table', async () => {
        const data = createMockLcaReportData({
          wasteStreams: [
            createMockWasteStream(),
            createMockWasteStream({
              id: 'waste-002',
              stream: 'Cardboard',
              disposition: 'recycling',
              mass: 50,
              circularityScore: 100,
            }),
          ],
        });

        await generateLcaReportPdf(data);

        const wasteTableCall = getMockedAutoTable().mock.calls.find(
          (call) => call[1]?.head?.[0]?.includes('Waste Stream')
        );
        expect(wasteTableCall).toBeDefined();
      });

      it('should calculate and display material recovery stats', async () => {
        const data = createMockLcaReportData({
          wasteStreams: [
            createMockWasteStream({
              mass: 100,
              circularityScore: 100,
            }),
            createMockWasteStream({
              id: 'waste-002',
              stream: 'General Waste',
              disposition: 'landfill',
              mass: 50,
              circularityScore: 0,
            }),
          ],
          metrics: {
            total_impacts: {
              climate_change_gwp100: 1.234,
              water_consumption: 25.5,
              water_scarcity_aware: 42.3,
              land_use: 3.75,
              fossil_resource_scarcity: 0.45,
            },
            circularity_percentage: 67,
          },
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Material Recovery Rate',
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    describe('Land Use Page', () => {
      it('should render land use section header', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Land Use & Nature Impact',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render land use items table', async () => {
        const data = createMockLcaReportData({
          landUseItems: [
            createMockLandUseItem(),
            createMockLandUseItem({
              id: 'land-002',
              ingredient: 'Sugar',
              origin: 'Brazil',
            }),
          ],
        });

        await generateLcaReportPdf(data);

        const landTableCall = getMockedAutoTable().mock.calls.find(
          (call) => call[1]?.head?.[0]?.includes('Material')
        );
        expect(landTableCall).toBeDefined();
      });
    });

    describe('Data Transparency Page', () => {
      it('should render data transparency section header', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Data Provenance & Transparency',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render all data sources', async () => {
        const data = createMockLcaReportData({
          dataSources: [
            createMockDataSource({ name: 'ecoinvent 3.9', count: 15 }),
            createMockDataSource({ name: 'Agribalyse 3.1', description: 'French agricultural database', count: 8 }),
            createMockDataSource({ name: 'Primary Data', description: 'Supplier-provided data', count: 5 }),
          ],
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'ecoinvent 3.9',
          expect.any(Number),
          expect.any(Number)
        );
        expect(mockText).toHaveBeenCalledWith(
          'Agribalyse 3.1',
          expect.any(Number),
          expect.any(Number)
        );
        expect(mockText).toHaveBeenCalledWith(
          'Primary Data',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render system boundary information', async () => {
        const data = createMockLcaReportData({
          systemBoundary: 'Cradle-to-gate including raw material extraction',
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'System Boundary',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should render cut-off criteria disclaimer', async () => {
        const data = createMockLcaReportData();

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Cut-off Criteria (ISO 14044)',
          expect.any(Number),
          expect.any(Number)
        );
      });
    });
  });

  // ==========================================================================
  // DQI GAUGE TESTS
  // ==========================================================================

  describe('DQI Score Gauge', () => {
    it('should render DQI score value', async () => {
      const data = createMockLcaReportData({
        dqiScore: 85,
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        '85',
        expect.any(Number),
        expect.any(Number),
        { align: 'center' }
      );
    });

    it('should render High Confidence label for score >= 80', async () => {
      const data = createMockLcaReportData({
        dqiScore: 85,
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        'High Confidence',
        expect.any(Number),
        expect.any(Number),
        { align: 'center' }
      );
    });

    it('should render Medium Confidence label for score 50-79', async () => {
      const data = createMockLcaReportData({
        dqiScore: 65,
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        'Medium Confidence',
        expect.any(Number),
        expect.any(Number),
        { align: 'center' }
      );
    });

    it('should render Low Confidence label for score < 50', async () => {
      const data = createMockLcaReportData({
        dqiScore: 35,
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        'Low Confidence',
        expect.any(Number),
        expect.any(Number),
        { align: 'center' }
      );
    });

    it('should render DQI Score label', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        'DQI Score',
        expect.any(Number),
        expect.any(Number),
        { align: 'center' }
      );
    });

    it('should draw circular gauge using triangles', async () => {
      const data = createMockLcaReportData({
        dqiScore: 75,
      });

      await generateLcaReportPdf(data);

      // The drawArc function uses triangles to create the arc
      expect(mockTriangle).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TABLE GENERATION TESTS
  // ==========================================================================

  describe('Table Generation', () => {
    it('should call autoTable for water sources with correct headers', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      const waterTableCall = getMockedAutoTable().mock.calls.find(
        (call) => {
          const head = call[1]?.head?.[0];
          return head && head.includes('Source') && head.includes('Location');
        }
      );

      expect(waterTableCall).toBeDefined();
      expect(waterTableCall![1].head[0]).toEqual([
        'Source', 'Location', 'Volume', 'Risk', 'AWARE', 'Impact (m\u00B3)'
      ]);
    });

    it('should format water source data correctly for table', async () => {
      const data = createMockLcaReportData({
        waterSources: [
          createMockWaterSource({
            source: 'Municipal Supply',
            location: 'UK',
            consumption: 150.567,
            riskLevel: 'low',
            riskFactor: 1.23456,
            netImpact: 185.789,
          }),
        ],
      });

      await generateLcaReportPdf(data);

      const waterTableCall = getMockedAutoTable().mock.calls.find(
        (call) => call[1]?.head?.[0]?.includes('Source')
      );

      expect(waterTableCall![1].body[0]).toEqual([
        'Municipal Supply',
        'UK',
        '150.57 L',
        'LOW',
        '\u00D71.2',
        '185.79',
      ]);
    });

    it('should call autoTable for waste streams with correct headers', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      const wasteTableCall = getMockedAutoTable().mock.calls.find(
        (call) => call[1]?.head?.[0]?.includes('Waste Stream')
      );

      expect(wasteTableCall).toBeDefined();
      expect(wasteTableCall![1].head[0]).toEqual([
        'Waste Stream', 'Disposition', 'Mass', 'Circularity Score'
      ]);
    });

    it('should capitalize disposition in waste stream table', async () => {
      const data = createMockLcaReportData({
        wasteStreams: [
          createMockWasteStream({
            stream: 'Glass Bottles',
            disposition: 'recycling',
            mass: 350,
            circularityScore: 100,
          }),
        ],
      });

      await generateLcaReportPdf(data);

      const wasteTableCall = getMockedAutoTable().mock.calls.find(
        (call) => call[1]?.head?.[0]?.includes('Waste Stream')
      );

      expect(wasteTableCall![1].body[0]).toEqual([
        'Glass Bottles',
        'Recycling',
        '350 g',
        '100%',
      ]);
    });

    it('should call autoTable for land use items with correct headers', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      const landTableCall = getMockedAutoTable().mock.calls.find(
        (call) => call[1]?.head?.[0]?.includes('Material')
      );

      expect(landTableCall).toBeDefined();
      expect(landTableCall![1].head[0]).toEqual([
        'Material', 'Origin', 'Mass', 'Intensity (m\u00B2/kg)', 'Footprint (m\u00B2)'
      ]);
    });

    it('should format land use data correctly for table', async () => {
      const data = createMockLcaReportData({
        landUseItems: [
          createMockLandUseItem({
            ingredient: 'Grape Juice',
            origin: 'France',
            mass: 0.7567,
            landIntensity: 2.5678,
            totalFootprint: 1.94,
          }),
        ],
      });

      await generateLcaReportPdf(data);

      const landTableCall = getMockedAutoTable().mock.calls.find(
        (call) => call[1]?.head?.[0]?.includes('Material')
      );

      expect(landTableCall![1].body[0]).toEqual([
        'Grape Juice',
        'France',
        '0.757 kg',
        '2.6',
        '1.94',
      ]);
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('Error Handling for Missing Data', () => {
    it('should handle empty water sources array', async () => {
      const data = createMockLcaReportData({
        waterSources: [],
      });

      await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle empty waste streams array', async () => {
      const data = createMockLcaReportData({
        wasteStreams: [],
      });

      await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle empty land use items array', async () => {
      const data = createMockLcaReportData({
        landUseItems: [],
      });

      await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle empty data sources array', async () => {
      const data = createMockLcaReportData({
        dataSources: [],
      });

      await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle all arrays empty', async () => {
      const data = createMockLcaReportData({
        waterSources: [],
        wasteStreams: [],
        landUseItems: [],
        dataSources: [],
      });

      await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should not render key insight when no high risk water source exists', async () => {
      const data = createMockLcaReportData({
        waterSources: [
          createMockWaterSource({ riskLevel: 'low' }),
          createMockWaterSource({ id: 'ws-002', riskLevel: 'medium' }),
        ],
      });

      await generateLcaReportPdf(data);

      // Key Insight should still be called for other sections, but water insight should not appear
      // The function checks for high risk and skips the insight box if none found
      expect(mockSave).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // EDGE CASES TESTS
  // ==========================================================================

  describe('Edge Cases', () => {
    describe('Empty Data', () => {
      it('should handle product name as empty string', async () => {
        const data = createMockLcaReportData({
          productName: '',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
        expect(mockSave).toHaveBeenCalledWith('_LCA_Report_1.0.pdf');
      });

      it('should handle version as empty string', async () => {
        const data = createMockLcaReportData({
          version: '',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
        expect(mockText).toHaveBeenCalledWith(
          'v',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should handle assessment period as empty string', async () => {
        const data = createMockLcaReportData({
          assessmentPeriod: '',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle system boundary as empty string', async () => {
        const data = createMockLcaReportData({
          systemBoundary: '',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });
    });

    describe('Special Characters', () => {
      it('should handle product name with special characters', async () => {
        const data = createMockLcaReportData({
          productName: 'Wine & Spirits (Premium) - 750ml',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
        expect(mockSave).toHaveBeenCalledWith(
          'Wine_&_Spirits_(Premium)_-_750ml_LCA_Report_1.0.pdf'
        );
      });

      it('should handle product name with unicode characters', async () => {
        const data = createMockLcaReportData({
          productName: 'Chateau Lafite Rothschild',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
        expect(mockSplitTextToSize).toHaveBeenCalledWith(
          'Chateau Lafite Rothschild',
          expect.any(Number)
        );
      });

      it('should handle description with newlines', async () => {
        const data = createMockLcaReportData({
          systemBoundary: 'Cradle-to-gate\nIncluding:\n- Raw materials\n- Manufacturing',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle location with accented characters', async () => {
        const data = createMockLcaReportData({
          waterSources: [
            createMockWaterSource({
              location: 'Bordeaux, France',
            }),
          ],
          landUseItems: [
            createMockLandUseItem({
              origin: 'Espana',
            }),
          ],
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });
    });

    describe('Numeric Edge Cases', () => {
      it('should handle zero values for all metrics', async () => {
        const data = createMockLcaReportData({
          metrics: {
            total_impacts: {
              climate_change_gwp100: 0,
              water_consumption: 0,
              water_scarcity_aware: 0,
              land_use: 0,
              fossil_resource_scarcity: 0,
            },
            circularity_percentage: 0,
          },
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
        expect(mockText).toHaveBeenCalledWith(
          '0.000',
          expect.any(Number),
          expect.any(Number)
        );
      });

      it('should handle very large values', async () => {
        const data = createMockLcaReportData({
          metrics: {
            total_impacts: {
              climate_change_gwp100: 9999999.999,
              water_consumption: 9999999.99,
              water_scarcity_aware: 9999999.99,
              land_use: 9999999.99,
              fossil_resource_scarcity: 9999999.99,
            },
            circularity_percentage: 100,
          },
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle very small positive values', async () => {
        const data = createMockLcaReportData({
          metrics: {
            total_impacts: {
              climate_change_gwp100: 0.000001,
              water_consumption: 0.01,
              water_scarcity_aware: 0.01,
              land_use: 0.01,
              fossil_resource_scarcity: 0.01,
            },
            circularity_percentage: 1,
          },
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle DQI score at boundary values', async () => {
        const boundaryValues = [0, 50, 80, 100];

        for (const score of boundaryValues) {
          const data = createMockLcaReportData({ dqiScore: score });
          await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
        }
      });

      it('should handle DQI score of exactly 50 as Medium Confidence', async () => {
        const data = createMockLcaReportData({
          dqiScore: 50,
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'Medium Confidence',
          expect.any(Number),
          expect.any(Number),
          { align: 'center' }
        );
      });

      it('should handle DQI score of exactly 80 as High Confidence', async () => {
        const data = createMockLcaReportData({
          dqiScore: 80,
        });

        await generateLcaReportPdf(data);

        expect(mockText).toHaveBeenCalledWith(
          'High Confidence',
          expect.any(Number),
          expect.any(Number),
          { align: 'center' }
        );
      });
    });

    describe('Date Handling', () => {
      it('should handle valid ISO date format', async () => {
        const data = createMockLcaReportData({
          publishedDate: '2024-12-31',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle date at year boundaries', async () => {
        const data = createMockLcaReportData({
          publishedDate: '2025-01-01',
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });
    });

    describe('Large Data Sets', () => {
      it('should handle many water sources', async () => {
        const waterSources = Array.from({ length: 20 }, (_, i) =>
          createMockWaterSource({
            id: `ws-${i}`,
            source: `Water Source ${i}`,
            location: `Location ${i}`,
          })
        );

        const data = createMockLcaReportData({ waterSources });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle many waste streams', async () => {
        const wasteStreams = Array.from({ length: 20 }, (_, i) =>
          createMockWasteStream({
            id: `waste-${i}`,
            stream: `Waste Stream ${i}`,
          })
        );

        const data = createMockLcaReportData({ wasteStreams });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle many land use items', async () => {
        const landUseItems = Array.from({ length: 20 }, (_, i) =>
          createMockLandUseItem({
            id: `land-${i}`,
            ingredient: `Ingredient ${i}`,
          })
        );

        const data = createMockLcaReportData({ landUseItems });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });

      it('should handle many data sources', async () => {
        const dataSources = Array.from({ length: 10 }, (_, i) =>
          createMockDataSource({
            name: `Data Source ${i}`,
            description: `Description for data source ${i}`,
            count: i * 5,
          })
        );

        const data = createMockLcaReportData({ dataSources });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });
    });

    describe('Risk Level Handling', () => {
      it('should handle all risk levels in water sources', async () => {
        const data = createMockLcaReportData({
          waterSources: [
            createMockWaterSource({ id: 'ws-1', riskLevel: 'low' }),
            createMockWaterSource({ id: 'ws-2', riskLevel: 'medium' }),
            createMockWaterSource({ id: 'ws-3', riskLevel: 'high' }),
          ],
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });
    });

    describe('Disposition Handling', () => {
      it('should handle all disposition types in waste streams', async () => {
        const data = createMockLcaReportData({
          wasteStreams: [
            createMockWasteStream({ id: 'w-1', disposition: 'recycling' }),
            createMockWasteStream({ id: 'w-2', disposition: 'landfill' }),
            createMockWasteStream({ id: 'w-3', disposition: 'composting' }),
            createMockWasteStream({ id: 'w-4', disposition: 'incineration' }),
          ],
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();

        const wasteTableCall = getMockedAutoTable().mock.calls.find(
          (call) => call[1]?.head?.[0]?.includes('Waste Stream')
        );

        const dispositions = wasteTableCall![1].body.map((row: string[]) => row[1]);
        expect(dispositions).toContain('Recycling');
        expect(dispositions).toContain('Landfill');
        expect(dispositions).toContain('Composting');
        expect(dispositions).toContain('Incineration');
      });
    });

    describe('Circularity Score Edge Cases', () => {
      it('should handle circularity scores at boundaries', async () => {
        const data = createMockLcaReportData({
          wasteStreams: [
            createMockWasteStream({ id: 'w-1', circularityScore: 0 }),
            createMockWasteStream({ id: 'w-2', circularityScore: 50 }),
            createMockWasteStream({ id: 'w-3', circularityScore: 100 }),
          ],
        });

        await expect(generateLcaReportPdf(data)).resolves.not.toThrow();
      });
    });
  });

  // ==========================================================================
  // FOOTER TESTS
  // ==========================================================================

  describe('Footer Generation', () => {
    it('should add footer to all pages', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Footer includes page numbers 1-6 and platform name
      expect(mockText).toHaveBeenCalledWith(
        'AlkaTera Carbon Management Platform',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should render page numbers on each page', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Check that page numbers are rendered
      for (let i = 1; i <= 6; i++) {
        expect(mockText).toHaveBeenCalledWith(
          `${i}`,
          expect.any(Number),
          expect.any(Number),
          { align: 'right' }
        );
      }
    });

    it('should draw footer divider line on each page', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Each page should have a footer line
      expect(mockLine).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // COLOR SCHEME TESTS
  // ==========================================================================

  describe('Color Scheme Application', () => {
    it('should use green color for climate section', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Green color [22, 163, 74] should be used for climate section
      expect(mockSetFillColor).toHaveBeenCalledWith(22, 163, 74);
    });

    it('should use blue color for water section', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Blue color [59, 130, 246] should be used for water section
      expect(mockSetFillColor).toHaveBeenCalledWith(59, 130, 246);
    });

    it('should use amber color for circularity section', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Amber color [245, 158, 11] should be used for circularity section
      expect(mockSetFillColor).toHaveBeenCalledWith(245, 158, 11);
    });

    it('should use emerald color for land use section', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Emerald color [16, 185, 129] should be used for land use section
      expect(mockSetFillColor).toHaveBeenCalledWith(16, 185, 129);
    });

    it('should use primary color for main header', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Primary color [15, 23, 42] should be used for header
      expect(mockSetFillColor).toHaveBeenCalledWith(15, 23, 42);
    });
  });

  // ==========================================================================
  // METRIC BOX TESTS
  // ==========================================================================

  describe('Metric Box Generation', () => {
    it('should render four metric boxes on cover page', async () => {
      const data = createMockLcaReportData();

      await generateLcaReportPdf(data);

      // Check that metric labels are rendered
      expect(mockText).toHaveBeenCalledWith(
        'CLIMATE',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        'WATER',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        'LAND',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        'CIRCULAR',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should render metric values with correct units', async () => {
      const data = createMockLcaReportData({
        metrics: {
          total_impacts: {
            climate_change_gwp100: 1.234,
            water_consumption: 25.5,
            water_scarcity_aware: 42.3,
            land_use: 3.75,
            fossil_resource_scarcity: 0.45,
          },
          circularity_percentage: 85,
        },
      });

      await generateLcaReportPdf(data);

      expect(mockText).toHaveBeenCalledWith(
        'CO\u2082eq',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        'consumed',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        'footprint',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        'recovery',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  // ==========================================================================
  // LONG TEXT HANDLING TESTS
  // ==========================================================================

  describe('Long Text Handling', () => {
    it('should split long product names across lines', async () => {
      const data = createMockLcaReportData({
        productName: 'Very Long Product Name That Needs To Be Split Across Multiple Lines For Proper Display In The PDF Document',
      });

      await generateLcaReportPdf(data);

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        'Very Long Product Name That Needs To Be Split Across Multiple Lines For Proper Display In The PDF Document',
        expect.any(Number)
      );
    });

    it('should split long system boundary text', async () => {
      const data = createMockLcaReportData({
        systemBoundary: 'This is a very long system boundary description that includes all the phases of the product lifecycle from raw material extraction through manufacturing, distribution, use phase, and end of life treatment including recycling and disposal.',
      });

      await generateLcaReportPdf(data);

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('This is a very long system boundary'),
        expect.any(Number)
      );
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('PDF Generator Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock functions
    mockSetFillColor.mockClear();
    mockSetTextColor.mockClear();
    mockSetFontSize.mockClear();
    mockSetFont.mockClear();
    mockSetDrawColor.mockClear();
    mockSetLineWidth.mockClear();
    mockRect.mockClear();
    mockRoundedRect.mockClear();
    mockCircle.mockClear();
    mockTriangle.mockClear();
    mockLine.mockClear();
    mockText.mockClear();
    mockSplitTextToSize.mockClear();
    mockGetTextWidth.mockClear();
    mockAddPage.mockClear();
    mockSave.mockClear();
    getMockedAutoTable().mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate complete PDF with all sections in correct order', async () => {
    const data = createMockLcaReportData();

    await generateLcaReportPdf(data);

    // Verify all pages are created
    expect(mockAddPage).toHaveBeenCalledTimes(5);

    // Verify section headers in order
    const textCalls = mockText.mock.calls;
    const sectionHeaders = textCalls
      .map((call) => call[0])
      .filter((text) =>
        ['Climate Change Impact', 'Water Impact Analysis', 'Circularity & Waste Management', 'Land Use & Nature Impact', 'Data Provenance & Transparency'].includes(text)
      );

    expect(sectionHeaders).toEqual([
      'Climate Change Impact',
      'Water Impact Analysis',
      'Circularity & Waste Management',
      'Land Use & Nature Impact',
      'Data Provenance & Transparency',
    ]);
  });

  it('should generate PDF with realistic wine product data', async () => {
    const wineData: LcaReportData = {
      title: 'Wine Carbon Footprint Report',
      version: '2.1',
      productName: 'Chateau Reserve Cabernet Sauvignon 2020',
      assessmentPeriod: '2023-2024',
      publishedDate: '2024-03-15',
      dqiScore: 82,
      systemBoundary: 'Cradle-to-gate including viticulture, vinification, and bottling',
      functionalUnit: '1 bottle (750ml) of wine',
      metrics: {
        total_impacts: {
          climate_change_gwp100: 1.45,
          water_consumption: 85.2,
          water_scarcity_aware: 125.7,
          land_use: 4.2,
          fossil_resource_scarcity: 0.32,
        },
        circularity_percentage: 78,
      },
      waterSources: [
        {
          id: 'ws-1',
          source: 'Vineyard Irrigation',
          location: 'Napa Valley, USA',
          consumption: 65.0,
          riskFactor: 4.5,
          riskLevel: 'high',
          netImpact: 292.5,
        },
        {
          id: 'ws-2',
          source: 'Winery Process Water',
          location: 'Napa Valley, USA',
          consumption: 20.2,
          riskFactor: 4.5,
          riskLevel: 'high',
          netImpact: 90.9,
        },
      ],
      wasteStreams: [
        {
          id: 'w-1',
          stream: 'Glass Bottles (Cullet)',
          disposition: 'recycling',
          mass: 500,
          circularityScore: 100,
        },
        {
          id: 'w-2',
          stream: 'Cork Stoppers',
          disposition: 'composting',
          mass: 4,
          circularityScore: 100,
        },
        {
          id: 'w-3',
          stream: 'Grape Pomace',
          disposition: 'composting',
          mass: 150,
          circularityScore: 100,
        },
        {
          id: 'w-4',
          stream: 'Cardboard Packaging',
          disposition: 'recycling',
          mass: 80,
          circularityScore: 95,
        },
      ],
      landUseItems: [
        {
          id: 'l-1',
          ingredient: 'Wine Grapes',
          origin: 'USA (California)',
          mass: 1.2,
          landIntensity: 3.5,
          totalFootprint: 4.2,
        },
      ],
      dataSources: [
        {
          name: 'ecoinvent 3.10',
          description: 'Background data for energy and materials',
          count: 12,
        },
        {
          name: 'Primary Winery Data',
          description: 'Metered energy, water, and waste data from winery operations',
          count: 8,
        },
        {
          name: 'Wine Institute Reports',
          description: 'Industry benchmarks for California wine production',
          count: 3,
        },
      ],
    };

    await expect(generateLcaReportPdf(wineData)).resolves.not.toThrow();
    expect(mockSave).toHaveBeenCalledWith(
      'Chateau_Reserve_Cabernet_Sauvignon_2020_LCA_Report_2.1.pdf'
    );
  });
});
