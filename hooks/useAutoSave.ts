import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  onSave: () => Promise<void>;
  delay?: number; // milliseconds
  enabled?: boolean;
}

/**
 * Auto-save hook for blog post drafts
 *
 * Automatically saves content after a specified delay of inactivity.
 * Prevents data loss and provides a seamless editing experience.
 *
 * @param onSave - Function to call when auto-saving
 * @param delay - Delay in milliseconds before auto-save (default: 3000ms)
 * @param enabled - Whether auto-save is enabled (default: true)
 */
export function useAutoSave({ onSave, delay = 3000, enabled = true }: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  const scheduleSave = useCallback(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule new save
    timeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) return;

      try {
        isSavingRef.current = true;
        await onSave();
      } catch (error) {
        console.error('Auto-save error:', error);
      } finally {
        isSavingRef.current = false;
      }
    }, delay);
  }, [onSave, delay, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { scheduleSave };
}
