'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: string;
  version_date: string;
  content_summary: string | null;
  document_url: string | null;
  approved_by: string | null;
  approval_date: string | null;
  created_at: string;
}

export interface Policy {
  id: string;
  organization_id: string;
  policy_name: string;
  policy_code: string | null;
  policy_type: string;
  description: string | null;
  scope: string | null;
  owner_name: string | null;
  owner_department: string | null;
  status: 'draft' | 'active' | 'under_review' | 'archived';
  effective_date: string | null;
  review_date: string | null;
  last_reviewed_at: string | null;
  is_public: boolean;
  public_url: string | null;
  bcorp_requirement: string | null;
  csrd_requirement: string | null;
  created_at: string;
  updated_at: string;
  versions?: PolicyVersion[];
}

export interface PolicyMetrics {
  total_policies: number;
  active_policies: number;
  draft_policies: number;
  due_for_review: number;
  public_policies: number;
  by_type: Record<string, number>;
}

export interface UsePoliciesResult {
  policies: Policy[];
  metrics: PolicyMetrics;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createPolicy: (policy: Partial<Policy>) => Promise<Policy>;
  updatePolicy: (policy: Partial<Policy> & { id: string }) => Promise<Policy>;
}

export function usePolicies(): UsePoliciesResult {
  const { organization } = useOrganization();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateMetrics = (policies: Policy[]): PolicyMetrics => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const byType: Record<string, number> = {};
    policies.forEach(p => {
      byType[p.policy_type] = (byType[p.policy_type] || 0) + 1;
    });

    return {
      total_policies: policies.length,
      active_policies: policies.filter(p => p.status === 'active').length,
      draft_policies: policies.filter(p => p.status === 'draft').length,
      due_for_review: policies.filter(p =>
        p.review_date && new Date(p.review_date) <= thirtyDaysFromNow
      ).length,
      public_policies: policies.filter(p => p.is_public).length,
      by_type: byType,
    };
  };

  const fetchPolicies = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/governance/policies?organization_id=${organization.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch policies');
      }

      const data = await response.json();
      setPolicies(data || []);
    } catch (err) {
      console.error('Error fetching policies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const createPolicy = useCallback(async (policy: Partial<Policy>): Promise<Policy> => {
    if (!organization?.id) {
      throw new Error('No organization selected');
    }

    const response = await fetch('/api/governance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...policy,
        organization_id: organization.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create policy');
    }

    const newPolicy = await response.json();
    await fetchPolicies();
    return newPolicy;
  }, [organization?.id, fetchPolicies]);

  const updatePolicy = useCallback(async (policy: Partial<Policy> & { id: string }): Promise<Policy> => {
    const response = await fetch('/api/governance/policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update policy');
    }

    const updatedPolicy = await response.json();
    await fetchPolicies();
    return updatedPolicy;
  }, [fetchPolicies]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return {
    policies,
    metrics: calculateMetrics(policies),
    loading,
    error,
    refetch: fetchPolicies,
    createPolicy,
    updatePolicy,
  };
}
