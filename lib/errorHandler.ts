import { toast } from 'sonner';

/**
 * Custom API Error class with additional context
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Contexts that should fail silently without showing toast notifications
 */
const SILENT_CONTEXTS = [
  'background-refresh',
  'prefetch',
  'polling',
  'silent',
];

/**
 * Handle API errors with proper logging and user feedback
 */
export const handleApiError = (
  error: unknown,
  context: string,
  options?: { silent?: boolean }
): void => {
  // Only log detailed errors in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  }

  // Check if this should be a silent failure
  if (
    options?.silent ||
    SILENT_CONTEXTS.some(ctx => context.toLowerCase().includes(ctx))
  ) {
    return;
  }

  // Determine user-friendly message
  let message = 'Something went wrong. Please try again.';

  if (error instanceof ApiError) {
    message = error.message;
  } else if (error instanceof Error) {
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes('failed to fetch') || errorMsg.includes('networkerror') || errorMsg.includes('network')) {
      message = 'Network error. Please check your connection.';
    } else if (errorMsg.includes('401') || errorMsg.includes('unauthorized') || errorMsg.includes('unauthenticated')) {
      message = 'Session expired. Please log in again.';
    } else if (errorMsg.includes('403') || errorMsg.includes('forbidden')) {
      message = 'You do not have permission to perform this action.';
    } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      message = 'The requested resource was not found.';
    } else if (errorMsg.includes('429') || errorMsg.includes('too many')) {
      message = 'Too many requests. Please wait a moment.';
    } else if (errorMsg.includes('timeout')) {
      message = 'Request timed out. Please try again.';
    } else if (errorMsg.includes('schema cache') || errorMsg.includes('table')) {
      // Supabase schema cache errors - likely table doesn't exist
      message = 'Database configuration error. Please contact support.';
    }
  }

  toast.error(message);
};

/**
 * Extract error message from various error types (including Supabase errors)
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    // Supabase error format
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }
    if ('error' in error && typeof (error as any).error === 'object') {
      const innerError = (error as any).error;
      if ('message' in innerError) {
        return innerError.message;
      }
    }
    // Try to stringify if nothing else works
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Wrapper for async operations with automatic error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
  options?: {
    silent?: boolean;
    fallback?: T;
    onError?: (error: unknown) => void;
  }
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    if (options?.onError) {
      options.onError(error);
    }

    if (!options?.silent) {
      handleApiError(error, context);
    }

    return options?.fallback;
  }
}

/**
 * Create a wrapped fetch function with automatic error handling
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit & { context?: string; silent?: boolean }
): Promise<T | null> {
  const context = options?.context || 'fetch';

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || `Request failed with status ${response.status}`,
        errorData.code,
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (!options?.silent) {
      handleApiError(error, context);
    }
    return null;
  }
}
