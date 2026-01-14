'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

export interface StakeholderEngagement {
  id: string;
  stakeholder_id: string;
  organization_id: string;
  engagement_date: string;
  engagement_type: string;
  description: string | null;
  internal_participants: string[] | null;
  external_participants: number | null;
  key_topics: string[] | null;
  key_outcomes: string | null;
  follow_up_actions: string | null;
  evidence_url: string | null;
  created_at: string;
}

export interface Stakeholder {
  id: string;
  organization_id: string;
  stakeholder_name: string;
  stakeholder_type: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  engagement_frequency: string | null;
  engagement_method: string | null;
  last_engagement_date: string | null;
  next_scheduled_engagement: string | null;
  relationship_quality: 'excellent' | 'good' | 'developing' | 'challenging' | null;
  key_interests: string | null;
  influence_level: 'high' | 'medium' | 'low' | null;
  impact_level: 'high' | 'medium' | 'low' | null;
  created_at: string;
  updated_at: string;
  engagements?: StakeholderEngagement[];
}

export interface StakeholderMetrics {
  total_stakeholders: number;
  by_type: Record<string, number>;
  by_relationship_quality: Record<string, number>;
  engagement_overdue: number;
  high_priority: number;
  recent_engagements: number;
}

export interface UseStakeholdersResult {
  stakeholders: Stakeholder[];
  metrics: StakeholderMetrics;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createStakeholder: (stakeholder: Partial<Stakeholder>) => Promise<Stakeholder>;
  updateStakeholder: (stakeholder: Partial<Stakeholder> & { id: string }) => Promise<Stakeholder>;
  logEngagement: (engagement: Partial<StakeholderEngagement>) => Promise<void>;
}

export function useStakeholders(): UseStakeholdersResult {
  const { organization } = useOrganization();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateMetrics = (stakeholders: Stakeholder[]): StakeholderMetrics => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const byType: Record<string, number> = {};
    const byQuality: Record<string, number> = {};

    stakeholders.forEach(s => {
      byType[s.stakeholder_type] = (byType[s.stakeholder_type] || 0) + 1;
      if (s.relationship_quality) {
        byQuality[s.relationship_quality] = (byQuality[s.relationship_quality] || 0) + 1;
      }
    });

    return {
      total_stakeholders: stakeholders.length,
      by_type: byType,
      by_relationship_quality: byQuality,
      engagement_overdue: stakeholders.filter(s =>
        s.next_scheduled_engagement && new Date(s.next_scheduled_engagement) < now
      ).length,
      high_priority: stakeholders.filter(s =>
        s.influence_level === 'high' || s.impact_level === 'high'
      ).length,
      recent_engagements: stakeholders.filter(s =>
        s.last_engagement_date && new Date(s.last_engagement_date) >= ninetyDaysAgo
      ).length,
    };
  };

  const fetchStakeholders = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/governance/stakeholders?organization_id=${organization.id}&include_engagements=true`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch stakeholders');
      }

      const data = await response.json();
      setStakeholders(data || []);
    } catch (err) {
      console.error('Error fetching stakeholders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stakeholders');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const createStakeholder = useCallback(async (stakeholder: Partial<Stakeholder>): Promise<Stakeholder> => {
    if (!organization?.id) {
      throw new Error('No organization selected');
    }

    const response = await fetch('/api/governance/stakeholders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...stakeholder,
        organization_id: organization.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create stakeholder');
    }

    const newStakeholder = await response.json();
    await fetchStakeholders();
    return newStakeholder;
  }, [organization?.id, fetchStakeholders]);

  const updateStakeholder = useCallback(async (stakeholder: Partial<Stakeholder> & { id: string }): Promise<Stakeholder> => {
    const response = await fetch('/api/governance/stakeholders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stakeholder),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update stakeholder');
    }

    const updated = await response.json();
    await fetchStakeholders();
    return updated;
  }, [fetchStakeholders]);

  const logEngagement = useCallback(async (engagement: Partial<StakeholderEngagement>): Promise<void> => {
    // This would typically go to a separate engagements endpoint
    // For now, update the stakeholder's last_engagement_date
    if (engagement.stakeholder_id) {
      await updateStakeholder({
        id: engagement.stakeholder_id,
        last_engagement_date: engagement.engagement_date || new Date().toISOString().split('T')[0],
      });
    }
  }, [updateStakeholder]);

  useEffect(() => {
    fetchStakeholders();
  }, [fetchStakeholders]);

  return {
    stakeholders,
    metrics: calculateMetrics(stakeholders),
    loading,
    error,
    refetch: fetchStakeholders,
    createStakeholder,
    updateStakeholder,
    logEngagement,
  };
}
