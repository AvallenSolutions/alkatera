import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

interface EvidenceLink {
  id: string;
  organization_id: string;
  framework_id: string;
  requirement_id: string;
  evidence_type: 'document' | 'data_link' | 'policy' | 'metric' | 'external_url';
  source_module: string | null;
  source_table: string | null;
  source_record_id: string | null;
  evidence_description: string;
  document_url: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_by: string | null;
  verification_date: string | null;
  notes: string | null;
  requirement?: {
    requirement_code: string;
    requirement_name: string;
    category: string;
  };
}

interface CreateEvidenceInput {
  framework_id: string;
  requirement_id: string;
  evidence_type: EvidenceLink['evidence_type'];
  evidence_description: string;
  source_module?: string;
  source_table?: string;
  source_record_id?: string;
  document_url?: string;
  notes?: string;
}

export function useCertificationEvidence(frameworkId?: string, requirementId?: string) {
  const { organization } = useOrganization();
  const [evidence, setEvidence] = useState<EvidenceLink[]>([]);
  const [byRequirement, setByRequirement] = useState<Record<string, EvidenceLink[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvidence = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        organization_id: organization.id,
        ...(frameworkId && { framework_id: frameworkId }),
        ...(requirementId && { requirement_id: requirementId }),
      });

      const response = await fetch(`/api/certifications/evidence?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch evidence');
      }

      const data = await response.json();
      setEvidence(data.evidence || []);
      setByRequirement(data.byRequirement || {});
      setError(null);
    } catch (err) {
      console.error('Error fetching evidence:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [organization?.id, frameworkId, requirementId]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const createEvidence = async (input: CreateEvidenceInput) => {
    if (!organization?.id) return null;

    try {
      const response = await fetch('/api/certifications/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organization.id,
          ...input,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create evidence');
      }

      const data = await response.json();
      await fetchEvidence();
      return data;
    } catch (err) {
      console.error('Error creating evidence:', err);
      throw err;
    }
  };

  const updateEvidence = async (id: string, updates: Partial<EvidenceLink>) => {
    try {
      const response = await fetch('/api/certifications/evidence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update evidence');
      }

      const data = await response.json();
      await fetchEvidence();
      return data;
    } catch (err) {
      console.error('Error updating evidence:', err);
      throw err;
    }
  };

  const deleteEvidence = async (id: string) => {
    try {
      const response = await fetch(`/api/certifications/evidence?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete evidence');
      }

      await fetchEvidence();
      return true;
    } catch (err) {
      console.error('Error deleting evidence:', err);
      throw err;
    }
  };

  const verifyEvidence = async (id: string, verifiedBy: string) => {
    return updateEvidence(id, {
      verification_status: 'verified',
      verified_by: verifiedBy,
      verification_date: new Date().toISOString().split('T')[0],
    });
  };

  // Get evidence count by requirement
  const evidenceCountByRequirement = Object.entries(byRequirement).reduce(
    (acc: Record<string, number>, [reqId, evidenceList]) => {
      acc[reqId] = evidenceList.length;
      return acc;
    },
    {}
  );

  // Get verification status summary
  const verificationSummary = {
    total: evidence.length,
    verified: evidence.filter(e => e.verification_status === 'verified').length,
    pending: evidence.filter(e => e.verification_status === 'pending').length,
    rejected: evidence.filter(e => e.verification_status === 'rejected').length,
  };

  return {
    evidence,
    byRequirement,
    evidenceCountByRequirement,
    verificationSummary,
    loading,
    error,
    refetch: fetchEvidence,
    createEvidence,
    updateEvidence,
    deleteEvidence,
    verifyEvidence,
  };
}
