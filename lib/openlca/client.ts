/**
 * OpenLCA IPC Client
 * Wrapper around JSON-RPC 2.0 protocol for OpenLCA server communication
 *
 * Compatible with OpenLCA 2.x IPC API
 * Reference: https://greendelta.github.io/openLCA-ApiDoc/
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  Process,
  ProductSystem,
  ImpactMethod,
  CalculationSetup,
  SimpleResult,
  ContributionResult,
  UpstreamTree,
  LinkingConfig,
  Ref,
  Flow,
  ResultRef,
  ImpactCategory,
  ImpactResult,
} from './schema';

export class OpenLCAClient {
  private baseUrl: string;
  private requestId = 1;

  constructor(serverUrl: string) {
    this.baseUrl = serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`;
  }

  /**
   * Send JSON-RPC request to OpenLCA server
   */
  private async request<T>(method: string, params?: Record<string, any>): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params,
    };

    const response = await fetch(`${this.baseUrl}data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`OpenLCA server error: ${response.status} ${response.statusText}`);
    }

    const jsonResponse: JsonRpcResponse<T> = await response.json();

    if (jsonResponse.error) {
      throw new Error(`OpenLCA error: ${jsonResponse.error.message}`);
    }

    if (jsonResponse.result === undefined) {
      throw new Error('OpenLCA returned no result');
    }

    return jsonResponse.result;
  }

  /**
   * Search for processes in the database
   */
  async searchProcesses(query: string, pageSize: number = 50): Promise<Ref[]> {
    return this.request<Ref[]>('search/processes', {
      query,
      pageSize,
    });
  }

  /**
   * Search for flows in the database
   */
  async searchFlows(query: string, pageSize: number = 50): Promise<Ref[]> {
    return this.request<Ref[]>('search/flows', {
      query,
      pageSize,
    });
  }

  /**
   * Get a specific entity by type and ID
   */
  async get<T>(type: string, id: string): Promise<T> {
    return this.request<T>('data/get', {
      '@type': type,
      '@id': id,
    });
  }

  /**
   * Get a process by ID
   */
  async getProcess(id: string): Promise<Process> {
    return this.get<Process>('Process', id);
  }

  /**
   * Get a flow by ID
   */
  async getFlow(id: string): Promise<Flow> {
    return this.get<Flow>('Flow', id);
  }

  /**
   * Get an impact method by ID
   */
  async getImpactMethod(id: string): Promise<ImpactMethod> {
    return this.get<ImpactMethod>('ImpactMethod', id);
  }

  /**
   * Get all processes (use with caution - can be large)
   */
  async getAllProcesses(): Promise<Ref[]> {
    return this.request<Ref[]>('data/get/descriptors', {
      '@type': 'Process',
    });
  }

  /**
   * Get all flows
   */
  async getAllFlows(): Promise<Ref[]> {
    return this.request<Ref[]>('data/get/descriptors', {
      '@type': 'Flow',
    });
  }

  /**
   * Get all impact methods
   */
  async getAllImpactMethods(): Promise<Ref[]> {
    return this.request<Ref[]>('data/get/descriptors', {
      '@type': 'ImpactMethod',
    });
  }

  /**
   * Create or update a process
   */
  async putProcess(process: Process): Promise<Ref> {
    return this.request<Ref>('put', process);
  }

  /**
   * Create a product system from a process
   */
  async createProductSystem(
    processId: string,
    config?: LinkingConfig
  ): Promise<Ref> {
    const params: any = {
      processId,
    };

    if (config) {
      if (config.preferUnitProcesses !== undefined) {
        params.preferUnitProcesses = config.preferUnitProcesses;
      }
      if (config.providerLinking !== undefined) {
        params.providerLinking = config.providerLinking;
      }
      if (config.cutoff !== undefined) {
        params.cutoff = config.cutoff;
      }
    }

    return this.request<Ref>('create/product_system', params);
  }

  /**
   * Get a product system by ID
   */
  async getProductSystem(id: string): Promise<ProductSystem> {
    return this.get<ProductSystem>('ProductSystem', id);
  }

  /**
   * Calculate a product system (OpenLCA 2.x API)
   * Returns a result reference that must be disposed after use
   */
  async calculate(setup: CalculationSetup): Promise<ResultRef> {
    // OpenLCA 2.x uses 'result/calculate' method
    return this.request<ResultRef>('result/calculate', setup);
  }

  /**
   * Wait for calculation result to be ready (async calculations)
   * OpenLCA 2.x calculations are async and need polling
   */
  async waitForResult(resultId: string, timeoutMs: number = 60000): Promise<void> {
    const start = Date.now();
    const pollInterval = 1000; // Poll every 1 second (calculations take 10-30s)

    while (Date.now() - start < timeoutMs) {
      try {
        // OpenLCA 2.x returns { isReady: boolean, isScheduled: boolean }
        const state = await this.request<{ isReady?: boolean; isScheduled?: boolean; error?: string }>('result/state', {
          '@id': resultId,
        });

        if (state.error) {
          throw new Error(`Calculation failed: ${state.error}`);
        }

        // Check isReady (not ready) - this is the OpenLCA 2.x API response format
        if (state.isReady) {
          return;
        }

        console.log(`[OpenLCA] Waiting for calculation... (${Math.round((Date.now() - start) / 1000)}s)`);
      } catch (error: any) {
        // If state endpoint doesn't exist, assume result is ready (older API)
        if (error.message?.includes('method not found')) {
          return;
        }
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Calculation timed out after ${timeoutMs}ms`);
  }

  /**
   * Get simple calculation results
   */
  async getSimpleResult(resultId: string): Promise<SimpleResult> {
    return this.request<SimpleResult>('result/state', {
      '@id': resultId,
    });
  }

  /**
   * Get contribution analysis results
   */
  async getContributionResult(resultId: string): Promise<ContributionResult> {
    return this.request<ContributionResult>('result/state', {
      '@id': resultId,
    });
  }

  /**
   * Get upstream tree for a specific impact category
   */
  async getUpstreamTree(
    resultId: string,
    impactCategory: Ref
  ): Promise<UpstreamTree> {
    return this.request<UpstreamTree>('result/upstream-tree-of', {
      '@id': resultId,
      impactCategory,
    });
  }

  /**
   * Get total impact results for all categories (OpenLCA 2.x API)
   */
  async getTotalImpacts(resultId: string): Promise<ImpactResult[]> {
    return this.request<ImpactResult[]>('result/total-impacts', {
      '@id': resultId,
    });
  }

  /**
   * Get total elementary flows (inventory results)
   */
  async getTotalFlows(resultId: string): Promise<Array<{
    flow: Ref;
    value: number;
    isInput: boolean;
  }>> {
    return this.request<Array<{
      flow: Ref;
      value: number;
      isInput: boolean;
    }>>('result/total-flows', {
      '@id': resultId,
    });
  }

  /**
   * Dispose of calculation result (free server memory)
   * IMPORTANT: Always call this after getting results to prevent memory leaks
   */
  async dispose(resultId: string): Promise<void> {
    try {
      await this.request<void>('result/dispose', {
        '@id': resultId,
      });
    } catch (error) {
      // Ignore dispose errors - result might already be disposed
      console.warn('Failed to dispose result:', error);
    }
  }

  /**
   * Health check - verify server is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<Ref[]>('data/get/descriptors', {
        '@type': 'ImpactMethod',
      });
      return true;
    } catch (error) {
      console.warn('[OpenLCA] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get server version information
   */
  async getVersion(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}version`);
      return await response.text();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Find process by name and location
   * Useful for finding specific regional processes
   */
  async findProcess(
    name: string,
    location?: string
  ): Promise<Ref | null> {
    const results = await this.searchProcesses(name, 100);

    if (!location) {
      return results[0] || null;
    }

    const exactMatch = results.find((r) =>
      r.name?.toLowerCase().includes(name.toLowerCase()) &&
      r.category?.includes(location)
    );

    return exactMatch || results[0] || null;
  }

  /**
   * Find impact method by name (case-insensitive)
   */
  async findImpactMethod(name: string): Promise<Ref | null> {
    const methods = await this.getAllImpactMethods();

    // Prefer exact match first
    const exactMatch = methods.find((m) => m.name === name);
    if (exactMatch) return exactMatch;

    // Then try midpoint matches before endpoint (midpoint gives kg CO2-eq, endpoint gives DALY/species.yr)
    const midpointMatch = methods.find((m) =>
      m.name?.toLowerCase().includes(name.toLowerCase()) &&
      m.name?.toLowerCase().includes('midpoint')
    );
    if (midpointMatch) return midpointMatch;

    // Fall back to any includes match
    const anyMatch = methods.find((m) =>
      m.name?.toLowerCase().includes(name.toLowerCase())
    );
    return anyMatch || null;
  }

  /**
   * Calculate impacts for a process directly (convenience method)
   * Handles the full flow: create product system, calculate, get results, dispose
   *
   * @param processId - UUID of the process to calculate
   * @param impactMethodName - Name of impact method (e.g., 'ReCiPe 2016', 'IPCC 2021')
   * @param amount - Amount to calculate (default: 1)
   * @returns Impact results array
   */
  async calculateProcess(
    processId: string,
    impactMethodName: string,
    amount: number = 1
  ): Promise<ImpactResult[]> {
    let resultId: string | null = null;

    try {
      // Find impact method
      const impactMethod = await this.findImpactMethod(impactMethodName);
      if (!impactMethod) {
        throw new Error(`Impact method not found: ${impactMethodName}`);
      }

      // OpenLCA 2.x: Calculate directly from process using 'target' parameter
      // This avoids needing to create a product system first
      const setup = {
        target: {
          '@type': 'Process',
          '@id': processId,
        },
        impactMethod: {
          '@type': 'ImpactMethod',
          '@id': impactMethod['@id'],
        },
        amount,
      };

      // Run calculation (cast to unknown first to satisfy TypeScript)
      const resultRef = await this.calculate(setup as unknown as CalculationSetup);
      resultId = resultRef['@id'];

      // Wait for result to be ready
      await this.waitForResult(resultId);

      // Get impacts
      const impacts = await this.getTotalImpacts(resultId);

      return impacts;
    } finally {
      // Always dispose result to free memory
      if (resultId) {
        await this.dispose(resultId);
      }
    }
  }

  /**
   * Get process count for a quick health check
   */
  async getProcessCount(): Promise<number> {
    const processes = await this.getAllProcesses();
    return processes.length;
  }
}

/**
 * Create a client instance from environment configuration
 */
export function createOpenLCAClient(): OpenLCAClient | null {
  const serverUrl = process.env.OPENLCA_SERVER_URL;
  const enabled = process.env.OPENLCA_SERVER_ENABLED === 'true';

  if (!serverUrl || !enabled) {
    return null;
  }

  return new OpenLCAClient(serverUrl);
}
