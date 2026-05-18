'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface StandardsVersion {
  version_code: string;
  summary: string | null;
  released_at: string | null;
}

interface StandardsResponse {
  versions: StandardsVersion[];
  latest: StandardsVersion | null;
  current: string | null;
  needsReview: boolean;
}

export function StandardsBanner({
  onApplied,
}: {
  onApplied?: () => Promise<void> | void;
}) {
  const [data, setData] = useState<StandardsResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/certifications/standards');
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data || !data.needsReview || !data.latest) return null;

  const apply = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/certifications/standards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_code: data.latest!.version_code }),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      toast.success(
        `Standards ${json.version} applied. ${json.affected} requirement(s) flagged for review.`,
      );
      await load();
      if (onApplied) await onApplied();
    } catch (err) {
      console.error(err);
      toast.error('Could not apply the standards update');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-200">
              Standards updated: {data.latest.version_code}
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {data.latest.summary ??
                'A newer version of the B Corp standards is available.'}
            </p>
          </div>
        </div>
        <Button size="sm" disabled={busy} onClick={apply} className="shrink-0">
          {busy ? 'Applying...' : 'Review changes'}
        </Button>
      </div>
    </div>
  );
}
