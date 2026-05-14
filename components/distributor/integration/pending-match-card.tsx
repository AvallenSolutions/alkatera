'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface PendingMatch {
  brand_profile_id: string;
  brand_name: string;
  alkatera_org_id: string;
  alkatera_org_name: string;
  similarity: number;
}

interface Props {
  matches: PendingMatch[];
  canConfirm: boolean;
}

export function PendingMatchesUI({ matches, canConfirm }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(matches);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function confirm(brandId: string, alkateraOrgId: string) {
    setBusy(brandId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/brands/${brandId}/link-alkatera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alkatera_org_id: alkateraOrgId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Could not link (${body.error ?? res.status}).` });
        return;
      }
      setItems((prev) => prev.filter((m) => m.brand_profile_id !== brandId));
      setFeedback({ type: 'ok', text: 'Linked. The brand has been emailed to confirm.' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function dismiss(brandId: string) {
    // Dismissal is purely UI for now — the suggestion came from a
    // pending_match notification, and dismissing simply hides it from
    // this view. The notification record itself can be marked read
    // from the bell drawer or the /notifications page.
    setItems((prev) => prev.filter((m) => m.brand_profile_id !== brandId));
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No pending alkatera matches to review.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <div
          className={`text-xs px-3 py-2 rounded border ${
            feedback.type === 'ok'
              ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'
              : 'border-destructive/30 text-destructive bg-destructive/5'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {items.map((m) => (
        <Card key={m.brand_profile_id} className="border-amber-500/30">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <Link2 className="h-4 w-4 text-amber-400 mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{m.brand_name}</span>
                  <span className="text-xs text-muted-foreground">may be the alka<strong>tera</strong> brand</span>
                  <span className="text-sm font-medium">{m.alkatera_org_name}</span>
                  <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/30">
                    {Math.round(m.similarity * 100)}% similar
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Confirming will send the brand an email asking them to accept the link before any
                  data syncs.
                </div>

                {canConfirm && (
                  <div className="flex gap-2 pt-3">
                    <Button
                      size="sm"
                      disabled={busy === m.brand_profile_id}
                      onClick={() => confirm(m.brand_profile_id, m.alkatera_org_id)}
                      className="bg-sky-400 hover:bg-sky-300 text-black"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Confirm match
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === m.brand_profile_id}
                      onClick={() => dismiss(m.brand_profile_id)}
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
