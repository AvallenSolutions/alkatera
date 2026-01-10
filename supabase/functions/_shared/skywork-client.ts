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

// Pure JavaScript MD5 implementation (no external dependencies)
function md5(string: string): string {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift));
  }

  function addUnsigned(x: number, y: number): number {
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);
    if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
    if (x4 | y4) {
      if (result & 0x40000000) return result ^ 0xc0000000 ^ x8 ^ y8;
      return result ^ 0x40000000 ^ x8 ^ y8;
    }
    return result ^ x8 ^ y8;
  }

  function F(x: number, y: number, z: number): number { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function I(x: number, y: number, z: number): number { return y ^ (x | ~z); }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str: string): number[] {
    const wordCount = ((str.length + 8) >>> 6) + 1;
    const wordArray = new Array(wordCount * 16).fill(0);
    let bytePos = 0;
    let byteCount = 0;
    while (byteCount < str.length) {
      bytePos = (byteCount >>> 2);
      wordArray[bytePos] |= (str.charCodeAt(byteCount) & 0xff) << ((byteCount % 4) * 8);
      byteCount++;
    }
    bytePos = (byteCount >>> 2);
    wordArray[bytePos] |= 0x80 << ((byteCount % 4) * 8);
    wordArray[wordCount * 16 - 2] = str.length * 8;
    return wordArray;
  }

  function wordToHex(value: number): string {
    let hex = '';
    for (let i = 0; i <= 3; i++) {
      const byte = (value >>> (i * 8)) & 0xff;
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  }

  const x = convertToWordArray(string);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;

    a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
    b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);

    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);

    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x04881d05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);

    a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);

    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
}

export class SkyworkClient {
  private config: SkyworkConfig;
  private baseUrl = 'https://api.skywork.ai';

  constructor(config: SkyworkConfig) {
    this.config = config;
  }

  private generateSignature(): string {
    const signatureInput = `${this.config.secretId}:${this.config.secretKey}`;
    return md5(signatureInput);
  }

  async generate(options: SkyworkGenerateOptions): Promise<SkyworkResult> {
    const sign = this.generateSignature();
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
  // Support both credential naming conventions for flexibility
  const secretId = Deno.env.get('SKYWORK_SECRET_ID') || Deno.env.get('SKYWORK_API_KEY');
  const secretKey = Deno.env.get('SKYWORK_SECRET_KEY') || Deno.env.get('SKYWORK_API_SECRET');

  console.log('[Skywork] Checking credentials:', {
    hasSecretId: !!secretId,
    hasSecretKey: !!secretKey,
  });

  if (!secretId || !secretKey) {
    console.warn('[Skywork] ❌ Credentials not configured. Please set either:');
    console.warn('  - SKYWORK_SECRET_ID and SKYWORK_SECRET_KEY, or');
    console.warn('  - SKYWORK_API_KEY and SKYWORK_API_SECRET');
    return null;
  }

  return new SkyworkClient({ secretId, secretKey });
}
