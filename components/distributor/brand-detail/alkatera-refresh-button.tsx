'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  brandId: string;
  brandName: string;
  alkateraOrgName?: string | null;
}

/**
 * "Refresh alka**tera** data" button. Shown only for brands with a
 * confirmed alkatera link. Hits the manual refresh endpoint and
 * surfaces a one-line outcome inline.
 */
export function AlkateraRefreshButton({ brandId, brandName, alkateraOrgName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/brands/${brandId}/refresh-alkatera`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        fields_written?: number;
        fields_skipped?: string[];
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setFeedback({ ok: false, text: `Refresh failed: ${body.error ?? res.status}` });
        return;
      }
      const written = body.fields_written ?? 0;
      setFeedback({
        ok: true,
        text:
          written > 0
            ? `Refreshed ${written} field${written === 1 ? '' : 's'} from ${alkateraOrgName ?? 'alkatera'}.`
            : `No new alkatera data for ${alkateraOrgName ?? brandName}.`,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-sky-400/30 rounded-lg p-4 bg-sky-400/5 space-y-3">
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-sky-300 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium">
            Connected to alka<strong>tera</strong>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            This brand shares verified sustainability data with you directly. Hit refresh to pull
            the latest figures (the daily sync also runs automatically each morning).
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={busy}
          className="border-sky-400/40"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Refreshing…' : 'Refresh alkatera data'}
        </Button>
        {feedback && (
          <div
            className={`text-xs flex items-center gap-1.5 ${
              feedback.ok ? 'text-emerald-400' : 'text-destructive'
            }`}
          >
            {feedback.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  );
}
