'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function RecertBanner({ active }: { active: boolean }) {
  const [busy, setBusy] = useState(false);
  if (!active) return null;

  const downloadReport = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/certifications/recert-report', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error(err);
      toast.error('Could not generate the recertification report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Preparing for Recertification
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your certification expires in approximately 12 months. Start
              preparing your recertification submission now, focusing on Year 5
              requirements.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={downloadReport}
          className="shrink-0 border-amber-400"
        >
          {busy ? 'Generating...' : 'Download readiness report'}
        </Button>
      </div>
    </div>
  );
}
