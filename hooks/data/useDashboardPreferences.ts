'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface DashboardWidget {
  id: string;
  name: string;
  description: string | null;
  category: string;
  default_size: 'compact' | 'standard' | 'expanded';
  min_col_span: number;
  max_col_span: number;
  icon: string | null;
  is_active: boolean;
  requires_data: string[];
  sort_order: number;
}

export interface UserWidgetPreference {
  id: string;
  user_id: string;
  organization_id: string;
  widget_id: string;
  enabled: boolean;
  display_order: number;
  col_span: number;
  row_span: number;
  widget?: DashboardWidget;
}

interface UseDashboardPreferencesResult {
  widgets: DashboardWidget[];
  preferences: UserWidgetPreference[];
  enabledWidgets: (UserWidgetPreference & { widget: DashboardWidget })[];
  loading: boolean;
  error: string | null;
  updatePreference: (widgetId: string, updates: Partial<Pick<UserWidgetPreference, 'enabled' | 'display_order' | 'col_span' | 'row_span'>>) => Promise<void>;
  toggleWidget: (widgetId: string) => Promise<void>;
  reorderWidgets: (orderedWidgetIds: string[]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useDashboardPreferences(): UseDashboardPreferencesResult {
  const { currentOrganization } = useOrganization();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [preferences, setPreferences] = useState<UserWidgetPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    }
    getUser();
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId || !currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: widgetsData, error: widgetsError } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (widgetsError) throw widgetsError;
      setWidgets(widgetsData || []);

      let { data: prefsData, error: prefsError } = await supabase
        .from('user_dashboard_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', currentOrganization.id)
        .order('display_order');

      if (prefsError) throw prefsError;

      if (!prefsData || prefsData.length === 0) {
        const { error: initError } = await supabase.rpc('initialize_dashboard_preferences', {
          p_user_id: userId,
          p_organization_id: currentOrganization.id,
        });

        if (initError) throw initError;

        const { data: newPrefs, error: refetchError } = await supabase
          .from('user_dashboard_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', currentOrganization.id)
          .order('display_order');

        if (refetchError) throw refetchError;
        prefsData = newPrefs;
      }

      setPreferences(prefsData || []);
    } catch (err: any) {
      console.error('Error fetching dashboard preferences:', err);
      setError(err.message || 'Failed to load dashboard preferences');
    } finally {
      setLoading(false);
    }
  }, [userId, currentOrganization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enabledWidgets = useMemo(() => {
    return preferences
      .filter((p) => p.enabled)
      .map((p) => ({
        ...p,
        widget: widgets.find((w) => w.id === p.widget_id)!,
      }))
      .filter((p) => p.widget)
      .sort((a, b) => a.display_order - b.display_order);
  }, [preferences, widgets]);

  const updatePreference = async (
    widgetId: string,
    updates: Partial<Pick<UserWidgetPreference, 'enabled' | 'display_order' | 'col_span' | 'row_span'>>
  ) => {
    if (!userId || !currentOrganization?.id) return;

    try {
      const { error } = await supabase
        .from('user_dashboard_preferences')
        .update(updates)
        .eq('user_id', userId)
        .eq('organization_id', currentOrganization.id)
        .eq('widget_id', widgetId);

      if (error) throw error;

      setPreferences((prev) =>
        prev.map((p) => (p.widget_id === widgetId ? { ...p, ...updates } : p))
      );
    } catch (err: any) {
      console.error('Error updating preference:', err);
      throw err;
    }
  };

  const toggleWidget = async (widgetId: string) => {
    const pref = preferences.find((p) => p.widget_id === widgetId);
    if (pref) {
      await updatePreference(widgetId, { enabled: !pref.enabled });
    }
  };

  const reorderWidgets = async (orderedWidgetIds: string[]) => {
    if (!userId || !currentOrganization?.id) return;

    try {
      const updates = orderedWidgetIds.map((widgetId, index) => ({
        user_id: userId,
        organization_id: currentOrganization.id,
        widget_id: widgetId,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('user_dashboard_preferences')
          .update({ display_order: update.display_order })
          .eq('user_id', update.user_id)
          .eq('organization_id', update.organization_id)
          .eq('widget_id', update.widget_id);
      }

      setPreferences((prev) =>
        prev.map((p) => {
          const newOrder = orderedWidgetIds.indexOf(p.widget_id);
          return newOrder >= 0 ? { ...p, display_order: newOrder } : p;
        })
      );
    } catch (err: any) {
      console.error('Error reordering widgets:', err);
      throw err;
    }
  };

  const resetToDefaults = async () => {
    if (!userId || !currentOrganization?.id) return;

    try {
      await supabase
        .from('user_dashboard_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', currentOrganization.id);

      await supabase.rpc('initialize_dashboard_preferences', {
        p_user_id: userId,
        p_organization_id: currentOrganization.id,
      });

      await fetchData();
    } catch (err: any) {
      console.error('Error resetting to defaults:', err);
      throw err;
    }
  };

  return {
    widgets,
    preferences,
    enabledWidgets,
    loading,
    error,
    updatePreference,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
    refetch: fetchData,
  };
}
