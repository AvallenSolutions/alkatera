import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import type { EPROrganizationSettings } from '@/lib/epr/types';

interface UseEPRSettingsResult {
  settings: EPROrganizationSettings | null;
  loading: boolean;
  error: string | null;
  saveSettings: (data: Partial<EPROrganizationSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export function useEPRSettings(): UseEPRSettingsResult {
  const { currentOrganization } = useOrganization();
  const [settings, setSettings] = useState<EPROrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        organizationId: currentOrganization.id,
      });

      const response = await fetch(`/api/epr/settings?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch EPR settings');
      }

      const data = await response.json();
      setSettings(data.settings || null);
    } catch (err: any) {
      console.error('Error fetching EPR settings:', err);
      const message = err.message || 'Failed to load EPR settings';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(
    async (data: Partial<EPROrganizationSettings>) => {
      if (!currentOrganization?.id) return;

      try {
        const response = await fetch('/api/epr/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            ...data,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Failed to save EPR settings');
        }

        const result = await response.json();
        setSettings(result.settings || null);
        toast.success('EPR settings saved');
      } catch (err: any) {
        console.error('Error saving EPR settings:', err);
        const message = err.message || 'Failed to save EPR settings';
        toast.error(message);
        throw err;
      }
    },
    [currentOrganization?.id]
  );

  return {
    settings,
    loading,
    error,
    saveSettings,
    refreshSettings: fetchSettings,
  };
}
