import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';

export interface AuditPackage {
  id: string;
  organization_id: string;
  framework_id: string;
  package_name: string;
  package_type: 'full_assessment' | 'partial_update' | 'annual_review';
  description: string | null;
  created_date: string;
  submission_deadline: string | null;
  submitted_date: string | null;
  status: 'draft' | 'in_review' | 'submitted' | 'accepted' | 'rejected';
  included_requirements: string[];
  included_evidence: string[];
  executive_summary: string | null;
  methodology: string | null;
  review_notes: string | null;
  generated_documents: { name: string; url: string; generated_at: string }[] | null;
  created_at: string;
  updated_at: string;
  framework?: {
    id: string;
    framework_name: string;
    framework_code: string;
    framework_version: string;
  };
}

export interface CreateAuditPackageInput {
  framework_id: string;
  package_name: string;
  package_type?: AuditPackage['package_type'];
  description?: string;
  submission_deadline?: string;
  included_requirements?: string[];
  included_evidence?: string[];
  executive_summary?: string;
  methodology?: string;
}

export interface UpdateAuditPackageInput {
  id: string;
  package_name?: string;
  package_type?: AuditPackage['package_type'];
  description?: string;
  submission_deadline?: string;
  status?: AuditPackage['status'];
  included_requirements?: string[];
  included_evidence?: string[];
  executive_summary?: string;
  methodology?: string;
  review_notes?: string;
  generated_documents?: AuditPackage['generated_documents'];
}

export function useAuditPackages(frameworkId?: string) {
  const { currentOrganization } = useOrganization();
  const [packages, setPackages] = useState<AuditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        organization_id: currentOrganization.id,
        ...(frameworkId && { framework_id: frameworkId }),
      });

      const response = await fetch(`/api/certifications/audit-packages?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit packages');
      }

      const data = await response.json();
      setPackages(data.packages || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching audit packages:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, frameworkId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const createPackage = async (input: CreateAuditPackageInput) => {
    if (!currentOrganization?.id) return null;

    const response = await fetch('/api/certifications/audit-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: currentOrganization.id,
        ...input,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create audit package');
    }

    const data = await response.json();
    await fetchPackages();
    return data;
  };

  const updatePackage = async (input: UpdateAuditPackageInput) => {
    const response = await fetch('/api/certifications/audit-packages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update audit package');
    }

    const data = await response.json();
    await fetchPackages();
    return data;
  };

  const deletePackage = async (id: string) => {
    const response = await fetch(`/api/certifications/audit-packages?id=${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete audit package');
    }

    await fetchPackages();
    return true;
  };

  const statusSummary = {
    total: packages.length,
    draft: packages.filter(p => p.status === 'draft').length,
    in_review: packages.filter(p => p.status === 'in_review').length,
    submitted: packages.filter(p => p.status === 'submitted').length,
    accepted: packages.filter(p => p.status === 'accepted').length,
    rejected: packages.filter(p => p.status === 'rejected').length,
  };

  return {
    packages,
    statusSummary,
    loading,
    error,
    refetch: fetchPackages,
    createPackage,
    updatePackage,
    deletePackage,
  };
}
