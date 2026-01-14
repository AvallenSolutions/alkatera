'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

export interface BoardMember {
  id: string;
  organization_id: string;
  member_name: string;
  role: string;
  member_type: 'executive' | 'non_executive' | 'independent';
  gender: string | null;
  age_bracket: string | null;
  ethnicity: string | null;
  disability_status: string | null;
  expertise_areas: string[] | null;
  industry_experience: string | null;
  appointment_date: string | null;
  term_end_date: string | null;
  is_current: boolean;
  committee_memberships: string[] | null;
  is_independent: boolean | null;
  independence_assessment: string | null;
  meeting_attendance_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface BoardMetrics {
  total_members: number;
  independent_count: number;
  executive_count: number;
  non_executive_count: number;
  gender_breakdown: {
    male: number;
    female: number;
    other: number;
    not_disclosed: number;
  };
  average_attendance: number;
  independence_ratio: number;
  gender_diversity_ratio: number;
  terms_expiring_soon: number;
}

export interface UseBoardCompositionResult {
  members: BoardMember[];
  metrics: BoardMetrics;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addMember: (member: Partial<BoardMember>) => Promise<BoardMember>;
  updateMember: (member: Partial<BoardMember> & { id: string }) => Promise<BoardMember>;
}

export function useBoardComposition(): UseBoardCompositionResult {
  const { organization } = useOrganization();
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [metrics, setMetrics] = useState<BoardMetrics>({
    total_members: 0,
    independent_count: 0,
    executive_count: 0,
    non_executive_count: 0,
    gender_breakdown: { male: 0, female: 0, other: 0, not_disclosed: 0 },
    average_attendance: 0,
    independence_ratio: 0,
    gender_diversity_ratio: 0,
    terms_expiring_soon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/governance/board?organization_id=${organization.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch board composition');
      }

      const data = await response.json();
      setMembers(data.members || []);

      // Calculate additional metrics
      const currentMembers = (data.members || []).filter((m: BoardMember) => m.is_current);
      const apiMetrics = data.metrics || {};

      const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const termsExpiringSoon = currentMembers.filter((m: BoardMember) =>
        m.term_end_date && new Date(m.term_end_date) <= ninetyDaysFromNow
      ).length;

      const maleCount = apiMetrics.gender_breakdown?.male || 0;
      const femaleCount = apiMetrics.gender_breakdown?.female || 0;
      const totalGendered = maleCount + femaleCount;
      const genderDiversityRatio = totalGendered > 0
        ? Math.min(maleCount, femaleCount) / totalGendered
        : 0;

      setMetrics({
        total_members: apiMetrics.total_members || 0,
        independent_count: apiMetrics.independent_count || 0,
        executive_count: apiMetrics.executive_count || 0,
        non_executive_count: apiMetrics.non_executive_count || 0,
        gender_breakdown: apiMetrics.gender_breakdown || { male: 0, female: 0, other: 0, not_disclosed: 0 },
        average_attendance: apiMetrics.average_attendance || 0,
        independence_ratio: apiMetrics.total_members > 0
          ? (apiMetrics.independent_count || 0) / apiMetrics.total_members
          : 0,
        gender_diversity_ratio: genderDiversityRatio,
        terms_expiring_soon: termsExpiringSoon,
      });
    } catch (err) {
      console.error('Error fetching board composition:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch board');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const addMember = useCallback(async (member: Partial<BoardMember>): Promise<BoardMember> => {
    if (!organization?.id) {
      throw new Error('No organization selected');
    }

    const response = await fetch('/api/governance/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...member,
        organization_id: organization.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add board member');
    }

    const newMember = await response.json();
    await fetchBoard();
    return newMember;
  }, [organization?.id, fetchBoard]);

  const updateMember = useCallback(async (member: Partial<BoardMember> & { id: string }): Promise<BoardMember> => {
    const response = await fetch('/api/governance/board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update board member');
    }

    const updated = await response.json();
    await fetchBoard();
    return updated;
  }, [fetchBoard]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  return {
    members,
    metrics,
    loading,
    error,
    refetch: fetchBoard,
    addMember,
    updateMember,
  };
}
