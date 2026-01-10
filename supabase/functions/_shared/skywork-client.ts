import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

export interface SkyworkConfig {
  secretId: string;
  secretKey: string;
}

export interface SkyworkGenerateOptions {
  tool: 'gen_doc' | 'gen_ppt' | 'gen_ppt_fast' | 'gen_excel';
  query: string;
  useNetwork?: boolean;
  timeoutMs?: number;
}

export interface SkyworkResult {
  success: boolean;
  downloadUrl?: string;
  documentId?: string;
  error?: string;
  rawResponse?: unknown;
}

async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class SkyworkClient {
  private config: SkyworkConfig;
  private baseUrl = 'https://api.skywork.ai';

  constructor(config: SkyworkConfig) {
    this.config = config;
  }

  private async generateSignature(): Promise<string> {
    const signatureInput = `${this.config.secretId}:${this.config.secretKey}`;
    return await md5(signatureInput);
  }

  async generate(options: SkyworkGenerateOptions): Promise<SkyworkResult> {
    const sign = await this.generateSignature();
    const timeoutMs = options.timeoutMs || 120000;

    const queryParams = new URLSearchParams({
      secret_id: this.config.secretId,
      sign: sign,
      tool: options.tool,
      query: options.query,
      use_network: (options.useNetwork ?? false).toString(),
    });

    const sseUrl = `${this.baseUrl}/open/sse?${queryParams.toString()}`;

    console.log('[Skywork] Establishing SSE connection...');

    try {
      const response = await fetch(sseUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `SSE connection failed: ${response.status} ${errorText}`,
        };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return {
          success: false,
          error: 'Failed to get response reader',
        };
      }

      const decoder = new TextDecoder();
      let messageEndpoint: string | null = null;
      let sessionId: string | null = null;
      let documentUrl: string | null = null;
      let isComplete = false;

      const timeoutHandle = setTimeout(() => {
        reader.cancel();
      }, timeoutMs);

      try {
        let buffer = '';

        while (!isComplete) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: endpoint')) {
              continue;
            }

            if (line.startsWith('data: ')) {
              const data = line.substring(6).trim();

              if (data.startsWith('/open/message')) {
                messageEndpoint = data;
                const url = new URL(data, this.baseUrl);
                sessionId = url.searchParams.get('sessionId');
                console.log('[Skywork] Message endpoint established:', sessionId);
                continue;
              }

              try {
                const jsonData = JSON.parse(data);

                if (jsonData.method === 'ping') {
                  continue;
                }

                if (jsonData.result?.output) {
                  console.log('[Skywork] Received output:', jsonData.result.output.substring(0, 100));
                }

                if (jsonData.result?.download_url) {
                  documentUrl = jsonData.result.download_url;
                  console.log('[Skywork] Document ready:', documentUrl);
                  isComplete = true;
                  break;
                }

                if (jsonData.result?.status === 'completed') {
                  isComplete = true;
                  break;
                }

                if (jsonData.error) {
                  clearTimeout(timeoutHandle);
                  return {
                    success: false,
                    error: `Skywork API error: ${JSON.stringify(jsonData.error)}`,
                    rawResponse: jsonData,
                  };
                }
              } catch (e) {
                console.log('[Skywork] Non-JSON data:', data.substring(0, 100));
              }
            }
          }
        }

        clearTimeout(timeoutHandle);

        if (documentUrl) {
          return {
            success: true,
            downloadUrl: documentUrl,
            documentId: sessionId || undefined,
          };
        }

        return {
          success: false,
          error: 'Document generation completed but no download URL received',
        };

      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('[Skywork] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async generateDocument(query: string, useNetwork = false): Promise<SkyworkResult> {
    return this.generate({
      tool: 'gen_doc',
      query,
      useNetwork,
    });
  }

  async generatePresentation(query: string, fast = false, useNetwork = false): Promise<SkyworkResult> {
    return this.generate({
      tool: fast ? 'gen_ppt_fast' : 'gen_ppt',
      query,
      useNetwork,
    });
  }

  async generateSpreadsheet(query: string, useNetwork = false): Promise<SkyworkResult> {
    return this.generate({
      tool: 'gen_excel',
      query,
      useNetwork,
    });
  }
}

export function createSkyworkClient(): SkyworkClient | null {
  const secretId = Deno.env.get('SKYWORK_SECRET_ID');
  const secretKey = Deno.env.get('SKYWORK_SECRET_KEY');

  if (!secretId || !secretKey) {
    console.warn('[Skywork] Credentials not configured');
    return null;
  }

  return new SkyworkClient({ secretId, secretKey });
}
