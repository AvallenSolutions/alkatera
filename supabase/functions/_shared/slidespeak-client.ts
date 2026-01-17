/**
 * SlideSpeak API Client
 *
 * Handles presentation generation via SlideSpeak's API.
 * Uses async polling model for generation status.
 */

export interface SlideSpeakConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface GeneratePresentationOptions {
  /** Markdown/text content for the presentation */
  content: string;
  /** Target number of slides (default: 15) */
  slideCount?: number;
  /** Template ID - use "default" or a branded template ID */
  template?: string;
  /** Language setting - "ORIGINAL" keeps source language */
  language?: string;
  /** Custom instructions for tone, audience, formatting */
  customInstructions?: string;
}

export interface BrandedTemplateOptions {
  /** Organization name for the template */
  name: string;
  /** Logo URL (must be publicly accessible) */
  logoUrl?: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Secondary brand color (hex) */
  secondaryColor?: string;
}

export interface TaskStatus {
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  progress?: number;
  downloadUrl?: string;
  error?: string;
}

export interface SlideSpeakResult {
  success: boolean;
  taskId?: string;
  downloadUrl?: string;
  error?: string;
}

const DEFAULT_BASE_URL = 'https://api.slidespeak.co/api/v1';
const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds
const DEFAULT_MAX_POLL_TIME = 120000; // 2 minutes
const MAX_RETRIES = 4;
const RETRY_BACKOFF = [2000, 4000, 8000, 16000];

export class SlideSpeakClient {
  private config: SlideSpeakConfig;
  private baseUrl: string;

  constructor(config: SlideSpeakConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  /**
   * Makes an authenticated request to the SlideSpeak API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'X-API-Key': this.config.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SlideSpeak API error: ${response.status} ${errorText}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;

        // Only retry on network errors, not API errors
        if (error instanceof TypeError || (error as Error).message.includes('fetch')) {
          if (attempt < MAX_RETRIES) {
            console.log(`[SlideSpeak] Request failed, retrying in ${RETRY_BACKOFF[attempt]}ms...`);
            await this.sleep(RETRY_BACKOFF[attempt]);
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Generates a presentation from content
   * Returns a task ID that can be polled for status
   */
  async generatePresentation(options: GeneratePresentationOptions): Promise<SlideSpeakResult> {
    console.log('[SlideSpeak] Starting presentation generation...');
    console.log('[SlideSpeak] Content length:', options.content.length, 'characters');
    console.log('[SlideSpeak] Slide count:', options.slideCount || 15);
    console.log('[SlideSpeak] Template:', options.template || 'DEFAULT');

    try {
      // Build request body - SlideSpeak uses 'plain_text' and 'length'
      const requestBody: Record<string, unknown> = {
        plain_text: options.content,
        length: options.slideCount || 15,
        template: (options.template || 'DEFAULT').toUpperCase(),
        language: options.language || 'ORIGINAL',
      };

      // Add custom instructions if provided
      if (options.customInstructions) {
        requestBody.fetch_instructions = options.customInstructions;
      }

      const response = await this.request<{ task_id: string }>('/presentation/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('[SlideSpeak] Generation started, task ID:', response.task_id);

      return {
        success: true,
        taskId: response.task_id,
      };
    } catch (error) {
      console.error('[SlideSpeak] Generation request failed:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Checks the status of a generation task
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await this.request<{
      task_id: string;
      task_status: string;
      task_result?: {
        url?: string;
        presentation_id?: string;
        request_id?: string;
      } | null;
      task_info?: unknown;
    }>(`/task_status/${taskId}`);

    // Map SlideSpeak statuses to our internal statuses
    // SlideSpeak uses: PENDING, SENT, STARTED, SUCCESS, FAILED
    let status: TaskStatus['status'];
    switch (response.task_status) {
      case 'SUCCESS':
        status = 'SUCCESS';
        break;
      case 'FAILED':
        status = 'FAILED';
        break;
      case 'STARTED':
        status = 'PROCESSING';
        break;
      case 'PENDING':
      case 'SENT':
      default:
        status = 'PENDING';
    }

    return {
      status,
      downloadUrl: response.task_result?.url,
      error: response.task_status === 'FAILED' ? 'Generation failed' : undefined,
    };
  }

  /**
   * Polls for task completion and returns the download URL
   */
  async pollUntilComplete(
    taskId: string,
    options: {
      pollInterval?: number;
      maxPollTime?: number;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<SlideSpeakResult> {
    const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
    const maxPollTime = options.maxPollTime || DEFAULT_MAX_POLL_TIME;
    const startTime = Date.now();

    console.log('[SlideSpeak] Polling for task completion:', taskId);

    while (Date.now() - startTime < maxPollTime) {
      try {
        const status = await this.getTaskStatus(taskId);

        if (options.onProgress && status.progress !== undefined) {
          options.onProgress(status.progress);
        }

        switch (status.status) {
          case 'SUCCESS':
            console.log('[SlideSpeak] Generation complete, download URL:', status.downloadUrl);
            return {
              success: true,
              taskId,
              downloadUrl: status.downloadUrl,
            };

          case 'FAILED':
            console.error('[SlideSpeak] Generation failed:', status.error);
            return {
              success: false,
              taskId,
              error: status.error || 'Generation failed',
            };

          case 'PENDING':
          case 'PROCESSING':
            console.log(`[SlideSpeak] Status: ${status.status}, progress: ${status.progress || 0}%`);
            await this.sleep(pollInterval);
            break;

          default:
            console.warn('[SlideSpeak] Unknown status:', status.status);
            await this.sleep(pollInterval);
        }
      } catch (error) {
        console.error('[SlideSpeak] Polling error:', error);
        // Continue polling on transient errors
        await this.sleep(pollInterval);
      }
    }

    return {
      success: false,
      taskId,
      error: `Generation timed out after ${maxPollTime / 1000} seconds`,
    };
  }

  /**
   * Generates a presentation and waits for completion
   * Combines generatePresentation and pollUntilComplete
   */
  async generateAndWait(
    options: GeneratePresentationOptions,
    pollOptions?: {
      pollInterval?: number;
      maxPollTime?: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<SlideSpeakResult> {
    const generateResult = await this.generatePresentation(options);

    if (!generateResult.success || !generateResult.taskId) {
      return generateResult;
    }

    return this.pollUntilComplete(generateResult.taskId, pollOptions);
  }

  /**
   * Lists available templates
   */
  async getTemplates(): Promise<{ name: string; images: { cover: string; content: string } }[]> {
    // SlideSpeak returns an array of templates directly
    const response = await this.request<{ name: string; images: { cover: string; content: string } }[]>(
      '/presentation/templates'
    );
    return response;
  }

  /**
   * Lists branded templates for the account
   */
  async getBrandedTemplates(): Promise<{ id: string; name: string; logoUrl?: string }[]> {
    const response = await this.request<{
      templates: { id: string; name: string; logo_url?: string }[]
    }>('/presentation/templates/branded');

    return response.templates.map(t => ({
      id: t.id,
      name: t.name,
      logoUrl: t.logo_url,
    }));
  }

  /**
   * Creates a branded template for an organization
   * Note: Logo must be a publicly accessible URL
   */
  async createBrandedTemplate(options: BrandedTemplateOptions): Promise<{ id: string } | null> {
    try {
      console.log('[SlideSpeak] Creating branded template:', options.name);

      const response = await this.request<{ template_id: string }>('/presentation/templates/branded', {
        method: 'POST',
        body: JSON.stringify({
          name: options.name,
          logo_url: options.logoUrl,
          primary_color: options.primaryColor,
          secondary_color: options.secondaryColor,
        }),
      });

      console.log('[SlideSpeak] Branded template created:', response.template_id);
      return { id: response.template_id };
    } catch (error) {
      console.error('[SlideSpeak] Failed to create branded template:', error);
      return null;
    }
  }

  /**
   * Uploads a document (PDF, etc.) for use in presentation generation
   * Returns a document ID that can be referenced in generation requests
   */
  async uploadDocument(file: Blob, filename: string): Promise<{ documentId: string } | null> {
    try {
      const formData = new FormData();
      formData.append('file', file, filename);

      const response = await fetch(`${this.baseUrl}/document/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.config.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json() as { task_id: string };

      // Poll for upload completion
      const result = await this.pollUntilComplete(data.task_id);

      if (result.success) {
        return { documentId: data.task_id };
      }

      return null;
    } catch (error) {
      console.error('[SlideSpeak] Document upload failed:', error);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Creates a SlideSpeak client from environment variables
 * Returns null if API key is not configured
 */
export function createSlideSpeakClient(): SlideSpeakClient | null {
  const apiKey = Deno.env.get('SLIDESPEAK_API_KEY');

  console.log('[SlideSpeak] Checking credentials:', {
    hasApiKey: !!apiKey,
  });

  if (!apiKey) {
    console.warn('[SlideSpeak] API key not configured. Set SLIDESPEAK_API_KEY environment variable.');
    return null;
  }

  return new SlideSpeakClient({ apiKey });
}
