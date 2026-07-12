'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { confirmRosaAction, cancelRosaAction } from '@/lib/gaia';

export interface ActionProposal {
  id: string;
  tool_name?: string;
  preview: string;
}

type Status = 'pending' | 'executing' | 'done' | 'cancelled' | 'failed';

interface Props {
  proposal: ActionProposal;
  onResolved?: (status: Exclude<Status, 'pending' | 'executing'>, result?: any) => void;
}

export function ActionProposalCard({ proposal, onResolved }: Props) {
  const [status, setStatus] = useState<Status>('pending');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setStatus('executing');
    setError(null);
    const res = await confirmRosaAction(proposal.id);
    if (res.ok) {
      setStatus('done');
      setResult(res.result);
      toast.success('Done');
      onResolved?.('done', res.result);
    } else {
      setStatus('failed');
      setError(res.error ?? 'Could not complete action');
      toast.error(res.error ?? 'Could not complete action');
      onResolved?.('failed');
    }
  };

  const onCancel = async () => {
    setStatus('executing');
    const res = await cancelRosaAction(proposal.id);
    if (res.ok) {
      setStatus('cancelled');
      onResolved?.('cancelled');
    } else {
      setStatus('failed');
      setError(res.error ?? 'Could not cancel');
    }
  };

  return (
    <Card className="my-2 rounded-[6px] border-border bg-card">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Rosa wants to
            </p>
            <p className="text-sm">{proposal.preview}</p>
            {error && <p className="text-xs text-studio-stale mt-2">{error}</p>}
            {status === 'done' && result && (
              <p className="text-xs text-studio-good mt-2">Done. {formatResult(result)}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === 'pending' && (
              <>
                <Button size="sm" variant="outline" onClick={onCancel}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  No
                </Button>
                <Button size="sm" onClick={onConfirm}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Confirm
                </Button>
              </>
            )}
            {status === 'executing' && (
              <span className="text-xs text-muted-foreground">Working…</span>
            )}
            {status === 'done' && (
              <span className="text-xs font-medium text-studio-good inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            {status === 'cancelled' && (
              <span className="text-xs text-muted-foreground">Cancelled</span>
            )}
            {status === 'failed' && (
              <span className="text-xs text-studio-stale">Failed</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatResult(r: any): string {
  if (!r || typeof r !== 'object') return '';
  if (r.entry_id) return `Entry id: ${r.entry_id}`;
  if (r.target_id) return `Target id: ${r.target_id}`;
  if (r.supplier_id) return `Supplier id: ${r.supplier_id}`;
  if (r.ticket_id) return 'A member of the team will pick this up shortly.';
  return '';
}
