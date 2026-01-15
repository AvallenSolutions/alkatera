import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';

interface Framework {
  id: string;
  name: string;
  code: string;
  version: string;
  description: string;
  category: string;
  passing_score: number;
  total_points: number;
  is_active: boolean;
  display_order: number;
  requirements: Requirement[];
}

interface Requirement {
  id: string;
  framework_id: string;
  requirement_code: string;
  requirement_name: string;
  description: string;
  category: string;
  sub_category: string;
  points_available: number;
  is_required: boolean;
  guidance: string;
  data_sources: string[];
}

interface OrganizationCertification {
  id: string;
  organization_id: string;
  framework_id: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'certified' | 'expired';
  target_date: string | null;
  certification_date: string | null;
  expiry_date: string | null;
  certificate_number: string | null;
  current_score: number | null;
}

export function useCertificationFrameworks(activeOnly = true) {
  const { currentOrganization } = useOrganization();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [certifications, setCertifications] = useState<OrganizationCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFrameworks = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        organization_id: currentOrganization.id,
        ...(activeOnly && { active_only: 'true' }),
      });

      const response = await fetch(`/api/certifications/frameworks?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch frameworks');
      }

      const data = await response.json();
      setFrameworks(data.frameworks || []);
      setCertifications(data.certifications || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching frameworks:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, activeOnly]);

  useEffect(() => {
    fetchFrameworks();
  }, [fetchFrameworks]);

  const startCertification = async (frameworkId: string, targetDate?: string) => {
    if (!currentOrganization?.id) return null;

    try {
      const response = await fetch('/api/certifications/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          framework_id: frameworkId,
          status: 'in_progress',
          target_date: targetDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start certification');
      }

      const data = await response.json();
      await fetchFrameworks();
      return data;
    } catch (err) {
      console.error('Error starting certification:', err);
      throw err;
    }
  };

  const updateCertificationStatus = async (
    frameworkId: string,
    status: OrganizationCertification['status'],
    additionalData?: Partial<OrganizationCertification>
  ) => {
    if (!currentOrganization?.id) return null;

    try {
      const response = await fetch('/api/certifications/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          framework_id: frameworkId,
          status,
          ...additionalData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update certification');
      }

      const data = await response.json();
      await fetchFrameworks();
      return data;
    } catch (err) {
      console.error('Error updating certification:', err);
      throw err;
    }
  };

  // Get framework with certification status
  const getFrameworkWithStatus = (frameworkId: string) => {
    const framework = frameworks.find(f => f.id === frameworkId);
    const certification = certifications.find(c => c.framework_id === frameworkId);
    return { framework, certification };
  };

  return {
    frameworks,
    certifications,
    loading,
    error,
    refetch: fetchFrameworks,
    startCertification,
    updateCertificationStatus,
    getFrameworkWithStatus,
  };
}
