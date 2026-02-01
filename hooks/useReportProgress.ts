import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { ReportProgressEvent } from '@/types/report-builder';

export function useReportProgress(reportId: string | null) {
  const [progress, setProgress] = useState<ReportProgressEvent>({
    status: 'aggregating_data',
    progress: 0,
  });

  const pollProgress = useCallback(async () => {
    if (!reportId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('generated_reports')
      .select('status, generation_progress, error_message, document_url')
      .eq('id', reportId)
      .single();

    if (error || !data) return;

    const statusProgressMap: Record<string, number> = {
      pending: 5,
      aggregating_data: 25,
      building_content: 50,
      generating_document: 75,
      completed: 100,
      failed: 0,
    };

    const mappedStatus = data.status as ReportProgressEvent['status'];
    setProgress({
      status: mappedStatus,
      progress: data.generation_progress ?? statusProgressMap[data.status] ?? 0,
      message: data.error_message || undefined,
      document_url: data.document_url || undefined,
    });
  }, [reportId]);

  useEffect(() => {
    if (!reportId) return;

    // Poll every 2 seconds
    const interval = setInterval(pollProgress, 2000);
    pollProgress(); // Initial poll

    return () => clearInterval(interval);
  }, [reportId, pollProgress]);

  return progress;
}
