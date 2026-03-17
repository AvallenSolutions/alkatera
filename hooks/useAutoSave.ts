import { useEffect, useRef, useCallback, useState } from 'react';

interface UseAutoSaveOptions {
  onSave: () => Promise<void>;
  delay?: number; // milliseconds
  enabled?: boolean;
}

/**
 * Auto-save hook with debounced saves on inactivity.
 *
 * Prevents data loss by automatically saving after a period of inactivity.
 * Supports cancellation, immediate flush, and exposes saving state for UI.
 *
 * @param onSave - Function to call when auto-saving
 * @param delay - Delay in milliseconds before auto-save (default: 3000ms)
 * @param enabled - Whether auto-save is enabled (default: true)
 */
export function useAutoSave({ onSave, delay = 3000, enabled = true }: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const onSaveRef = useRef(onSave);

  // Keep onSave ref current to avoid stale closures in the timeout
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const executeSave = useCallback(async () => {
    if (isSavingRef.current) return;
    try {
      isSavingRef.current = true;
      setIsSaving(true);
      await onSaveRef.current();
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (!enabled) return;
    cancel();
    timeoutRef.current = setTimeout(executeSave, delay);
  }, [enabled, delay, cancel, executeSave]);

  const saveNow = useCallback(async () => {
    cancel();
    if (!enabled) return;
    await executeSave();
  }, [enabled, cancel, executeSave]);

  // Cleanup on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  return { scheduleSave, cancel, saveNow, isSaving };
}
