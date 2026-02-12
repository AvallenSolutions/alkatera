import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';

interface AuditPackage {
  id: string;
  organization_id: string;
  framework_id: string;
  package_name: string;
  package_type: string | null;
  description: string | null;
  created_date: string;
  submission_deadline: string | null;
  submitted_date: string | null;
  status: 'draft' | 'in_review' | 'submitted' | 'approved' | 'rejected';
  included_requirements: string[];
  included_evidence: string[];
  executive_summary: string | null;
  methodology: string | null;
  generated_documents: any | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  framework?: {
    id: string;
    framework_name: string;
    framework_code: string;
    framework_version: string;
  };
}

interface CreateAuditPackageInput {
  framework_id: string;
  package_name: string;
  package_type?: string;
  description?: string;
  submission_deadline?: string;
  included_requirements?: string[];
  included_evidence?: string[];
  executive_summary?: string;
  methodology?: string;
  notes?: string;
}

export function useCertificationAuditPackages(frameworkId?: string) {
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

    try {
      const response = await fetch('/api/certifications/audit-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          ...input,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create audit package');
      }

      const data = await response.json();
      await fetchPackages();
      return data;
    } catch (err) {
      console.error('Error creating audit package:', err);
      throw err;
    }
  };

  const updatePackage = async (id: string, updates: Partial<AuditPackage>) => {
    try {
      const response = await fetch('/api/certifications/audit-packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update audit package');
      }

      const data = await response.json();
      await fetchPackages();
      return data;
    } catch (err) {
      console.error('Error updating audit package:', err);
      throw err;
    }
  };

  const deletePackage = async (id: string) => {
    try {
      const response = await fetch(`/api/certifications/audit-packages?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete audit package');
      }

      await fetchPackages();
      return true;
    } catch (err) {
      console.error('Error deleting audit package:', err);
      throw err;
    }
  };

  // Summary stats
  const statusSummary = {
    total: packages.length,
    draft: packages.filter(p => p.status === 'draft').length,
    in_review: packages.filter(p => p.status === 'in_review').length,
    submitted: packages.filter(p => p.status === 'submitted').length,
    approved: packages.filter(p => p.status === 'approved').length,
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
