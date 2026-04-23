'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Loader2, X } from 'lucide-react';
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
    <Card className="my-2 border-[#ccff00]/40 bg-[#ccff00]/5">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Rosa wants to
            </p>
            <p className="text-sm">{proposal.preview}</p>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            {status === 'done' && result && (
              <p className="text-xs text-emerald-600 mt-2">Done. {formatResult(result)}</p>
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
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {status === 'done' && (
              <span className="text-xs font-medium text-emerald-600 inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            {status === 'cancelled' && (
              <span className="text-xs text-muted-foreground">Cancelled</span>
            )}
            {status === 'failed' && (
              <span className="text-xs text-red-600">Failed</span>
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
  return '';
}
