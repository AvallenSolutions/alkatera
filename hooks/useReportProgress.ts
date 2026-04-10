import { useState, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

interface ReportProgressState {
  status: string;
  documentUrl: string | null;
  error: string | null;
}

const STALE_TIMEOUT_MS = 300_000; // If stuck on same status for 5 minutes, mark as failed
const SYNC_AFTER_MS = 30_000; // After 30 seconds on generating_document, start polling SlideSpeak directly as a webhook fallback

export function useReportProgress(reportId: string | null) {
  const [state, setState] = useState<ReportProgressState>({
    status: 'pending',
    documentUrl: null,
    error: null,
  });
  const supabase = getSupabaseBrowserClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastChangeRef = useRef<number>(Date.now());
  const lastStatusRef = useRef<string>('pending');
  const requestIdRef = useRef(0);
  const lastSyncRef = useRef<number>(0);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (!reportId) return;

    // Increment request ID so stale responses from a previous reportId are discarded
    const currentRequestId = ++requestIdRef.current;

    // Fetch current state
    async function fetchStatus() {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('status, document_url, error_message')
        .eq('id', reportId)
        .single();

      if (data) {
        // Discard stale response if reportId changed since this request started
        if (currentRequestId !== requestIdRef.current) return;

        // Track if status changed
        if (data.status !== lastStatusRef.current) {
          lastStatusRef.current = data.status;
          lastChangeRef.current = Date.now();
        }

        setState({
          status: data.status,
          documentUrl: data.document_url,
          error: data.error_message,
        });

        // Stop polling if terminal state
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return;
        }

        // Webhook fallback: if stuck in generating_document, poll SlideSpeak directly every 10s
        if (
          data.status === 'generating_document' &&
          Date.now() - lastChangeRef.current > SYNC_AFTER_MS &&
          Date.now() - lastSyncRef.current > 10_000 &&
          !syncInFlightRef.current
        ) {
          syncInFlightRef.current = true;
          lastSyncRef.current = Date.now();
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;
            if (authToken) {
              await fetch(`/api/reports/${reportId}/sync-slidespeak`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
              });
              // Next poll tick will pick up any DB changes from the sync
            }
          } catch (err) {
            console.warn('[useReportProgress] SlideSpeak sync failed:', err);
          } finally {
            syncInFlightRef.current = false;
          }
        }

        // Timeout: if stuck on same non-terminal status for too long
        if (Date.now() - lastChangeRef.current > STALE_TIMEOUT_MS) {
          setState({
            status: 'failed',
            documentUrl: null,
            error: 'Report generation timed out. The edge function may not be deployed or encountered an error. Please try again.',
          });
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      }
    }

    // Initial fetch
    fetchStatus();

    // Poll every 3 seconds as primary mechanism (Realtime requires server config)
    pollRef.current = setInterval(fetchStatus, 3000);

    // Also try Realtime subscription as a bonus (faster updates if enabled)
    const channel = supabase
      .channel(`report-progress-${reportId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generated_reports',
          filter: `id=eq.${reportId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setState({
            status: row.status,
            documentUrl: row.document_url,
            error: row.error_message,
          });

          // Stop polling if terminal state
          if (row.status === 'completed' || row.status === 'failed') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [reportId]);

  return state;
}
