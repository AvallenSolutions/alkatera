/**
 * OpenLCA REST API Client
 * Wrapper around gdt-server REST API for OpenLCA server communication
 *
 * Compatible with OpenLCA 2.x gdt-server
 * Reference: https://github.com/GreenDelta/gdt-server
 *
 * Migrated from JSON-RPC 2.0 to REST API for cloud deployment
 */

import {
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

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

export type OpenLCADatabaseSource = 'ecoinvent' | 'agribalyse';

export class OpenLCAClient {
  private baseUrl: string;
  private apiKey?: string;
  private retryConfig: RetryConfig;

  constructor(serverUrl: string, apiKey?: string, retryConfig?: Partial<RetryConfig>) {
    this.baseUrl = serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`;
    this.apiKey = apiKey;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  // ============================================================
  // HTTP helpers (REST API)
  // ============================================================

  /**
   * Build headers including API key if configured
   */
  private getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  /**
   * Execute a fetch request with retry logic and timeout
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    timeoutMs: number = 30000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`OpenLCA server error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Handle empty responses (e.g., dispose)
        const text = await response.text();
        if (!text || text.trim() === '') {
          return undefined as T;
        }

        return JSON.parse(text) as T;
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (error.message?.includes('40') && !error.message?.includes('429')) {
          throw lastError;
        }

        // Don't retry on abort (timeout)
        if (error.name === 'AbortError') {
          throw new Error(`OpenLCA request timed out after ${timeoutMs}ms`);
        }

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelayMs * Math.pow(2, attempt),
            this.retryConfig.maxDelayMs
          );
          console.warn(
            `[OpenLCA] Request failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), retrying in ${delay}ms...`,
            lastError.message
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('OpenLCA request failed after all retries');
  }

  /**
   * Send GET request to OpenLCA REST API
   */
  private async get<T>(path: string, timeoutMs: number = 30000): Promise<T> {
    return this.fetchWithRetry<T>(
      `${this.baseUrl}${path}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      timeoutMs
    );
  }

  /**
   * Send POST request to OpenLCA REST API
   */
  private async post<T>(path: string, body?: any, timeoutMs: number = 300000): Promise<T> {
    return this.fetchWithRetry<T>(
      `${this.baseUrl}${path}`,
      {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: body ? JSON.stringify(body) : undefined,
      },
      timeoutMs
    );
  }

  /**
   * Send PUT request to OpenLCA REST API
   */
  private async put<T>(path: string, body: any, timeoutMs: number = 30000): Promise<T> {
    return this.fetchWithRetry<T>(
      `${this.baseUrl}${path}`,
      {
        method: 'PUT',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(body),
      },
      timeoutMs
    );
  }

  // ============================================================
  // Search methods
  // ============================================================

  /**
   * Search for processes in the database
   * Note: gdt-server REST API doesn't have a dedicated search endpoint,
   * so we fetch all processes and filter client-side (results are cached
   * at the API route level with a 5-minute TTL)
   */
  async searchProcesses(query: string, pageSize: number = 50): Promise<Ref[]> {
    const allProcesses = await this.getAllProcesses();
    const lowerQuery = query.toLowerCase();
    return allProcesses
      .filter((p) => p.name?.toLowerCase().includes(lowerQuery))
      .slice(0, pageSize);
  }

  /**
   * Search for flows in the database
   */
  async searchFlows(query: string, pageSize: number = 50): Promise<Ref[]> {
    const allFlows = await this.getAllFlows();
    const lowerQuery = query.toLowerCase();
    return allFlows
      .filter((f) => f.name?.toLowerCase().includes(lowerQuery))
      .slice(0, pageSize);
  }

  // ============================================================
  // Data retrieval methods
  // ============================================================

  /**
   * Get a process by ID
   */
  async getProcess(id: string): Promise<Process> {
    return this.get<Process>(`data/processes/${id}`);
  }

  /**
   * Get a flow by ID
   */
  async getFlow(id: string): Promise<Flow> {
    return this.get<Flow>(`data/flows/${id}`);
  }

  /**
   * Get an impact method by ID
   */
  async getImpactMethod(id: string): Promise<ImpactMethod> {
    return this.get<ImpactMethod>(`data/impact-methods/${id}`);
  }

  /**
   * Get all process descriptors (use with caution - can be large: 23k+ for ecoinvent)
   */
  async getAllProcesses(): Promise<Ref[]> {
    return this.get<Ref[]>('data/processes', 60000);
  }

  /**
   * Get all flow descriptors
   */
  async getAllFlows(): Promise<Ref[]> {
    return this.get<Ref[]>('data/flows', 60000);
  }

  /**
   * Get all impact method descriptors
   */
  async getAllImpactMethods(): Promise<Ref[]> {
    return this.get<Ref[]>('data/impact-methods', 30000);
  }

  /**
   * Create or update a process
   */
  async putProcess(process: Process): Promise<Ref> {
    return this.put<Ref>('data/processes', process);
  }

  /**
   * Create a product system from a process
   */
  async createProductSystem(
    processId: string,
    config?: LinkingConfig
  ): Promise<Ref> {
    const params: any = {
      process: {
        '@type': 'Process',
        '@id': processId,
      },
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

    return this.post<Ref>('data/create-system', params);
  }

  /**
   * Get a product system by ID
   */
  async getProductSystem(id: string): Promise<ProductSystem> {
    return this.get<ProductSystem>(`data/product-systems/${id}`);
  }

  // ============================================================
  // Calculation methods
  // ============================================================

  /**
   * Start an LCA calculation (async - returns immediately)
   * Returns a result reference that must be polled and then disposed after use
   */
  async calculate(setup: CalculationSetup): Promise<ResultRef> {
    return this.post<ResultRef>('result/calculate', setup, 300000);
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
        // gdt-server REST API: GET /result/{id}/state
        const state = await this.get<{ isReady?: boolean; isScheduled?: boolean; error?: string }>(
          `result/${resultId}/state`,
          10000
        );

        if (state.error) {
          throw new Error(`Calculation failed: ${state.error}`);
        }

        if (state.isReady) {
          return;
        }

        console.log(`[OpenLCA] Waiting for calculation... (${Math.round((Date.now() - start) / 1000)}s)`);
      } catch (error: any) {
        // If state endpoint returns an error, the calculation may have failed
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          throw new Error(`Calculation result ${resultId} not found - it may have been disposed or failed`);
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
    return this.get<SimpleResult>(`result/${resultId}/state`);
  }

  /**
   * Get contribution analysis results
   */
  async getContributionResult(resultId: string): Promise<ContributionResult> {
    return this.get<ContributionResult>(`result/${resultId}/state`);
  }

  /**
   * Get upstream tree for a specific impact category
   */
  async getUpstreamTree(
    resultId: string,
    impactCategory: Ref
  ): Promise<UpstreamTree> {
    return this.get<UpstreamTree>(
      `result/${resultId}/upstream-impacts-of/${impactCategory['@id']}`
    );
  }

  /**
   * Get total impact results for all categories (OpenLCA 2.x API)
   */
  async getTotalImpacts(resultId: string): Promise<ImpactResult[]> {
    return this.get<ImpactResult[]>(`result/${resultId}/total-impacts`);
  }

  /**
   * Get total elementary flows (inventory results)
   */
  async getTotalFlows(resultId: string): Promise<Array<{
    flow: Ref;
    value: number;
    isInput: boolean;
  }>> {
    return this.get<Array<{
      flow: Ref;
      value: number;
      isInput: boolean;
    }>>(`result/${resultId}/total-flows`);
  }

  /**
   * Dispose of calculation result (free server memory)
   * IMPORTANT: Always call this after getting results to prevent memory leaks
   */
  async dispose(resultId: string): Promise<void> {
    try {
      await this.post<void>(`result/${resultId}/dispose`);
    } catch (error) {
      // Ignore dispose errors - result might already be disposed
      console.warn('Failed to dispose result:', error);
    }
  }

  // ============================================================
  // Health & version
  // ============================================================

  /**
   * Health check - verify server is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get<any>('api/version', 10000);
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
      const response = await fetch(`${this.baseUrl}api/version`, {
        headers: this.getHeaders(),
      });
      return await response.text();
    } catch {
      return 'unknown';
    }
  }

  // ============================================================
  // Convenience methods
  // ============================================================

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
   * Handles the full flow: calculate, wait, get results, dispose
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
  const apiKey = process.env.OPENLCA_API_KEY;

  if (!serverUrl || !enabled) {
    return null;
  }

  return new OpenLCAClient(serverUrl, apiKey);
}

/**
 * Resolve which server URL and API key to use for a given database source.
 * Each database is served by its own independent gdt-server instance.
 *
 * @param source - Which database to target ('ecoinvent' or 'agribalyse')
 * @returns Server config, or null if the server for that source is not configured
 */
export function resolveServerConfig(source: OpenLCADatabaseSource): {
  serverUrl: string;
  apiKey?: string;
} | null {
  if (source === 'agribalyse') {
    const serverUrl = process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
    const apiKey = process.env.OPENLCA_AGRIBALYSE_API_KEY || process.env.OPENLCA_API_KEY;
    if (!serverUrl) return null;
    return { serverUrl, apiKey };
  }
  // Default: ecoinvent
  const serverUrl = process.env.OPENLCA_SERVER_URL;
  const apiKey = process.env.OPENLCA_API_KEY;
  if (!serverUrl) return null;
  return { serverUrl, apiKey };
}

/**
 * Create an OpenLCA client pre-configured for a specific database server.
 * Each database source maps to its own gdt-server instance.
 *
 * @param source - Which database to target ('ecoinvent' or 'agribalyse')
 * @returns Configured client, or null if the server for that source is not configured
 */
export function createOpenLCAClientForDatabase(
  source: OpenLCADatabaseSource
): OpenLCAClient | null {
  const config = resolveServerConfig(source);
  if (!config) return null;
  return new OpenLCAClient(config.serverUrl, config.apiKey);
}

/**
 * Check whether the Agribalyse server is configured and available
 */
export function isAgribalyseConfigured(): boolean {
  return !!(process.env.OPENLCA_AGRIBALYSE_SERVER_URL);
}
