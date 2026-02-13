import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import type { EPRSubmission, EPRSubmissionLine } from '@/lib/epr/types';

interface UseEPRSubmissionsResult {
  submissions: EPRSubmission[];
  currentSubmission: EPRSubmission | null;
  lines: EPRSubmissionLine[];
  loading: boolean;
  error: string | null;
  generateSubmission: (params: {
    fee_year: string;
    submission_period: string;
  }) => Promise<EPRSubmission | null>;
  exportCSV: (submissionId: string) => Promise<Blob | null>;
  refreshSubmissions: () => Promise<void>;
  markSubmitted: (submissionId: string) => Promise<void>;
  selectSubmission: (submissionId: string | null) => void;
}

export function useEPRSubmissions(): UseEPRSubmissionsResult {
  const { currentOrganization } = useOrganization();
  const [submissions, setSubmissions] = useState<EPRSubmission[]>([]);
  const [currentSubmission, setCurrentSubmission] = useState<EPRSubmission | null>(null);
  const [lines, setLines] = useState<EPRSubmissionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('epr_submissions')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSubmissions((data as EPRSubmission[]) || []);
    } catch (err: any) {
      console.error('Error fetching EPR submissions:', err);
      const message = err.message || 'Failed to load submissions';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchLines = useCallback(async (submissionId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('epr_submission_lines')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setLines((data as EPRSubmissionLine[]) || []);
    } catch (err: any) {
      console.error('Error fetching submission lines:', err);
      toast.error('Failed to load submission line items');
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Fetch lines when currentSubmission changes
  useEffect(() => {
    if (currentSubmission?.id) {
      fetchLines(currentSubmission.id);
    } else {
      setLines([]);
    }
  }, [currentSubmission?.id, fetchLines]);

  const selectSubmission = useCallback(
    (submissionId: string | null) => {
      if (!submissionId) {
        setCurrentSubmission(null);
        return;
      }
      const found = submissions.find((s) => s.id === submissionId) || null;
      setCurrentSubmission(found);
    },
    [submissions]
  );

  const generateSubmission = useCallback(
    async (params: { fee_year: string; submission_period: string }): Promise<EPRSubmission | null> => {
      if (!currentOrganization?.id) return null;

      try {
        const response = await fetch('/api/epr/generate-submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            ...params,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Failed to generate submission');
        }

        const result = await response.json();
        toast.success('Submission generated successfully');
        await fetchSubmissions();

        const newSubmission = result.submission as EPRSubmission;
        setCurrentSubmission(newSubmission);
        return newSubmission;
      } catch (err: any) {
        console.error('Error generating submission:', err);
        const message = err.message || 'Failed to generate submission';
        toast.error(message);
        throw err;
      }
    },
    [currentOrganization?.id, fetchSubmissions]
  );

  const exportCSV = useCallback(
    async (submissionId: string): Promise<Blob | null> => {
      if (!currentOrganization?.id) return null;

      try {
        const response = await fetch('/api/epr/export-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            submissionId,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Failed to export CSV');
        }

        const blob = await response.blob();
        toast.success('CSV exported successfully');
        return blob;
      } catch (err: any) {
        console.error('Error exporting CSV:', err);
        const message = err.message || 'Failed to export CSV';
        toast.error(message);
        throw err;
      }
    },
    [currentOrganization?.id]
  );

  const markSubmitted = useCallback(
    async (submissionId: string) => {
      if (!currentOrganization?.id) return;

      try {
        const { error: updateError } = await supabase
          .from('epr_submissions')
          .update({
            status: 'submitted',
            submitted_to_rpd_at: new Date().toISOString(),
          })
          .eq('id', submissionId)
          .eq('organization_id', currentOrganization.id);

        if (updateError) throw updateError;

        toast.success('Submission marked as submitted to RPD');
        await fetchSubmissions();

        // Update currentSubmission if it was the one marked
        if (currentSubmission?.id === submissionId) {
          setCurrentSubmission((prev) =>
            prev ? { ...prev, status: 'submitted', submitted_to_rpd_at: new Date().toISOString() } : null
          );
        }
      } catch (err: any) {
        console.error('Error marking submission as submitted:', err);
        const message = err.message || 'Failed to update submission status';
        toast.error(message);
        throw err;
      }
    },
    [currentOrganization?.id, currentSubmission?.id, fetchSubmissions]
  );

  return {
    submissions,
    currentSubmission,
    lines,
    loading,
    error,
    generateSubmission,
    exportCSV,
    refreshSubmissions: fetchSubmissions,
    markSubmitted,
    selectSubmission,
  };
}
