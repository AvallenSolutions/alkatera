/**
 * OpenLCA Calculator - Orchestrates complete LCA calculation workflow
 * Handles product system building, calculation execution, and result extraction
 */

import {
  CalculationSetup,
  CalculationType,
  LinkingConfig,
  ProviderLinking,
  Ref,
  ImpactResult,
  UpstreamNode,
  AllocationType,
} from './schema';
import { OpenLCAClient } from './client';

/**
 * Impact method configuration
 */
export interface ImpactMethodConfig {
  methodName: string;
  methodId?: string;
  categories?: string[];
}

/**
 * Calculation options
 */
export interface CalculationOptions {
  impactMethod: ImpactMethodConfig;
  calculationType?: CalculationType;
  allocationMethod?: AllocationType;
  withRegionalization?: boolean;
  withCosts?: boolean;
  numberOfRuns?: number;
  linkingConfig?: LinkingConfig;
}

/**
 * Detailed calculation result
 */
export interface LCAResult {
  totalImpacts: Array<{
    category: string;
    value: number;
    unit: string;
  }>;
  hotspots?: Array<{
    category: string;
    contributions: Array<{
      processName: string;
      value: number;
      share: number;
    }>;
  }>;
  productSystemId: string;
  calculationTime: number;
  metadata: {
    impactMethod: string;
    calculationType: string;
    allocationMethod?: string;
    numberOfProcesses?: number;
  };
}

/**
 * GHG-specific breakdown per ISO 14067
 */
export interface GHGBreakdown {
  total: number;
  fossil: number;
  biogenic: number;
  landUseChange: number;
  gasInventory?: {
    co2Fossil: number;
    co2Biogenic: number;
    methane: number;
    nitrousOxide: number;
    hfcPfc: number;
  };
}

/**
 * Calculator Class
 */
export class OpenLCACalculator {
  private client: OpenLCAClient;

  constructor(client: OpenLCAClient) {
    this.client = client;
  }

  /**
   * Build product system from process
   */
  async buildProductSystem(
    processId: string,
    options?: {
      preferUnitProcesses?: boolean;
      providerLinking?: ProviderLinking;
      cutoff?: number;
    }
  ): Promise<Ref> {
    const config: LinkingConfig = {
      preferUnitProcesses: options?.preferUnitProcesses ?? true,
      providerLinking: options?.providerLinking ?? ProviderLinking.PREFER_DEFAULTS,
      cutoff: options?.cutoff,
    };

    console.log('Building product system with config:', config);
    const startTime = Date.now();

    const systemRef = await this.client.createProductSystem(processId, config);

    const duration = Date.now() - startTime;
    console.log(`Product system built in ${duration}ms`);

    return systemRef;
  }

  /**
   * Find or create impact method reference
   */
  private async getImpactMethodRef(
    config: ImpactMethodConfig
  ): Promise<Ref> {
    if (config.methodId) {
      const method = await this.client.getImpactMethod(config.methodId);
      return {
        '@type': 'ImpactMethod',
        '@id': config.methodId,
        name: method.name,
      };
    }

    const methodRef = await this.client.findImpactMethod(config.methodName);
    if (!methodRef) {
      throw new Error(
        `Impact method not found: ${config.methodName}. ` +
        'Ensure the method is imported into the OpenLCA database.'
      );
    }

    return methodRef;
  }

  /**
   * Execute calculation
   */
  async calculate(
    productSystemId: string,
    options: CalculationOptions
  ): Promise<LCAResult> {
    console.log('Starting LCA calculation...');
    const startTime = Date.now();

    const impactMethodRef = await this.getImpactMethodRef(options.impactMethod);

    const setup: CalculationSetup = {
      '@type': 'CalculationSetup',
      calculationType:
        options.calculationType ?? CalculationType.CONTRIBUTION_ANALYSIS,
      productSystem: {
        '@type': 'ProductSystem',
        '@id': productSystemId,
      },
      impactMethod: impactMethodRef,
      amount: 1.0,
      withRegionalization: options.withRegionalization ?? true,
      withCosts: options.withCosts ?? false,
    };

    if (options.allocationMethod) {
      setup.allocationMethod = options.allocationMethod;
    }

    if (options.numberOfRuns && options.numberOfRuns > 1) {
      setup.calculationType = CalculationType.MONTE_CARLO_SIMULATION;
      setup.numberOfRuns = options.numberOfRuns;
    }

    const resultRef = await this.client.calculate(setup);
    console.log('Calculation complete, extracting results...');

    const impacts = await this.client.getTotalImpacts(resultRef['@id']);

    const totalImpacts = impacts.map((impact) => ({
      category: impact.impactCategory?.name || 'Unknown',
      value: impact.amount ?? impact.value ?? 0,
      unit: impact.impactCategory?.description || '',
    }));

    let hotspots: LCAResult['hotspots'] = undefined;

    if (
      setup.calculationType === CalculationType.CONTRIBUTION_ANALYSIS ||
      setup.calculationType === CalculationType.UPSTREAM_ANALYSIS
    ) {
      console.log('Extracting hotspot analysis...');
      hotspots = await this.extractHotspots(
        resultRef['@id'],
        impacts.map((i) => i.impactCategory).filter((c): c is Ref => c !== undefined)
      );
    }

    await this.client.dispose(resultRef['@id']);

    const calculationTime = Date.now() - startTime;

    return {
      totalImpacts,
      hotspots,
      productSystemId,
      calculationTime,
      metadata: {
        impactMethod: impactMethodRef.name || options.impactMethod.methodName,
        calculationType: setup.calculationType,
        allocationMethod: options.allocationMethod,
      },
    };
  }

  /**
   * Extract hotspot analysis from contribution tree
   */
  private async extractHotspots(
    resultId: string,
    impactCategories: Ref[],
    topN: number = 10,
    minContribution: number = 0.01
  ): Promise<LCAResult['hotspots']> {
    const hotspots: LCAResult['hotspots'] = [];

    for (const category of impactCategories) {
      try {
        const tree = await this.client.getUpstreamTree(resultId, category);

        const contributions = this.flattenTree(tree.root)
          .filter((node) => node.share >= minContribution)
          .sort((a, b) => b.result - a.result)
          .slice(0, topN)
          .map((node) => ({
            processName: node.provider.name || 'Unknown process',
            value: node.result,
            share: node.share,
          }));

        hotspots.push({
          category: category.name || 'Unknown',
          contributions,
        });
      } catch (error) {
        console.error(
          `Failed to extract hotspots for ${category.name}:`,
          error
        );
      }
    }

    return hotspots;
  }

  /**
   * Flatten upstream tree into array of nodes with contribution shares
   */
  private flattenTree(
    node: UpstreamNode,
    totalResult?: number
  ): Array<UpstreamNode & { share: number }> {
    const total = totalResult ?? node.result;
    const share = total > 0 ? Math.abs(node.result / total) : 0;

    const flatNodes: Array<UpstreamNode & { share: number }> = [
      { ...node, share },
    ];

    if (node.children) {
      for (const child of node.children) {
        flatNodes.push(...this.flattenTree(child, total));
      }
    }

    return flatNodes;
  }

  /**
   * Calculate climate impact with GHG breakdown
   */
  async calculateGHG(
    productSystemId: string,
    options?: {
      linkingConfig?: LinkingConfig;
      allocationMethod?: AllocationType;
    }
  ): Promise<GHGBreakdown> {
    const result = await this.calculate(productSystemId, {
      impactMethod: {
        methodName: 'IPCC 2021',
      },
      calculationType: CalculationType.CONTRIBUTION_ANALYSIS,
      allocationMethod: options?.allocationMethod,
      withRegionalization: true,
      linkingConfig: options?.linkingConfig,
    });

    const climateImpacts = result.totalImpacts.filter((impact) =>
      impact.category.toLowerCase().includes('climate') ||
      impact.category.toLowerCase().includes('global warming')
    );

    const total =
      climateImpacts.find((i) => i.category.includes('GWP100'))?.value || 0;
    const fossil =
      climateImpacts.find((i) => i.category.includes('fossil'))?.value || 0;
    const biogenic =
      climateImpacts.find((i) => i.category.includes('biogenic'))?.value || 0;
    const landUseChange =
      climateImpacts.find((i) => i.category.includes('land use'))?.value || 0;

    return {
      total,
      fossil,
      biogenic,
      landUseChange,
    };
  }

  /**
   * Calculate water scarcity using AWARE
   */
  async calculateWaterScarcity(
    productSystemId: string
  ): Promise<{
    totalScarcity: number;
    unit: string;
    regionalBreakdown?: Array<{
      region: string;
      value: number;
    }>;
  }> {
    const result = await this.calculate(productSystemId, {
      impactMethod: {
        methodName: 'AWARE',
      },
      calculationType: CalculationType.CONTRIBUTION_ANALYSIS,
      withRegionalization: true,
    });

    const waterImpact = result.totalImpacts.find((impact) =>
      impact.category.toLowerCase().includes('water')
    );

    return {
      totalScarcity: waterImpact?.value || 0,
      unit: waterImpact?.unit || 'm3 world eq',
    };
  }

  /**
   * Complete multi-capital calculation
   */
  async calculateMultiCapital(
    productSystemId: string
  ): Promise<{
    climate: GHGBreakdown;
    water: { total: number; unit: string };
    waste: { total: number; unit: string };
    land: { total: number; unit: string };
  }> {
    const [climate, waterResult, landResult] = await Promise.all([
      this.calculateGHG(productSystemId),
      this.calculateWaterScarcity(productSystemId),
      this.calculate(productSystemId, {
        impactMethod: {
          methodName: 'EF 3.1',
        },
        calculationType: CalculationType.SIMPLE_CALCULATION,
      }),
    ]);

    const landImpact = landResult.totalImpacts.find((impact) =>
      impact.category.toLowerCase().includes('land use')
    );

    return {
      climate,
      water: {
        total: waterResult.totalScarcity,
        unit: waterResult.unit,
      },
      waste: {
        total: 0,
        unit: 'kg',
      },
      land: {
        total: landImpact?.value || 0,
        unit: landImpact?.unit || 'm2*year',
      },
    };
  }
}
