/**
 * OpenLCA IPC Client
 * Wrapper around JSON-RPC 2.0 protocol for OpenLCA server communication
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
    return this.request<T>('get', {
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
    return this.request<Ref[]>('get/descriptors', {
      '@type': 'Process',
    });
  }

  /**
   * Get all flows
   */
  async getAllFlows(): Promise<Ref[]> {
    return this.request<Ref[]>('get/descriptors', {
      '@type': 'Flow',
    });
  }

  /**
   * Get all impact methods
   */
  async getAllImpactMethods(): Promise<Ref[]> {
    return this.request<Ref[]>('get/descriptors', {
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
   * Calculate a product system
   */
  async calculate(setup: CalculationSetup): Promise<ResultRef> {
    return this.request<ResultRef>('calculate', setup);
  }

  /**
   * Get simple calculation results
   */
  async getSimpleResult(resultId: string): Promise<SimpleResult> {
    return this.request<SimpleResult>('get/result', {
      '@id': resultId,
    });
  }

  /**
   * Get contribution analysis results
   */
  async getContributionResult(resultId: string): Promise<ContributionResult> {
    return this.request<ContributionResult>('get/result', {
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
    return this.request<UpstreamTree>('get/upstream_tree', {
      resultId,
      impactCategory,
    });
  }

  /**
   * Get total impact results for all categories
   */
  async getTotalImpacts(resultId: string): Promise<Array<{
    impactCategory: Ref;
    value: number;
  }>> {
    const result = await this.getSimpleResult(resultId);
    return result.impactResults || [];
  }

  /**
   * Dispose of calculation result (free server memory)
   */
  async dispose(resultId: string): Promise<void> {
    await this.request<void>('dispose', {
      '@id': resultId,
    });
  }

  /**
   * Health check - verify server is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<Ref[]>('get/descriptors', {
        '@type': 'Process',
      });
      return true;
    } catch (error) {
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
    const match = methods.find((m) =>
      m.name?.toLowerCase().includes(name.toLowerCase())
    );
    return match || null;
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
