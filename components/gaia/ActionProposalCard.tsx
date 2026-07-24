'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Panel, Eyebrow, PillButton, StateChip } from '@/components/studio';
import { confirmRosaAction, cancelRosaAction } from '@/lib/gaia';

/**
 * "Rosa wants to …": the one card that asks before she acts.
 *
 * Studio grammar, because this is the moment a user hands over control and
 * it should look like the rest of the house: a hairline panel on cream, a
 * mono eyebrow naming what is about to happen, the proposal in plain words,
 * and two pills — ink to confirm, outline to decline. States are
 * typographic (StateChip), never badges: "WORKING", "SAVED", "DECLINED".
 */

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

  const settled = formatResult(result);

  return (
    <Panel className="my-3 p-4">
      <Eyebrow tone="dim">Rosa wants to</Eyebrow>
      <p className="mt-2 font-display text-sm font-semibold leading-snug text-foreground">
        {proposal.preview}
      </p>

      {error && <p className="mt-2 text-xs text-studio-stale">{error}</p>}
      {status === 'done' && settled && (
        <p className="mt-2 text-xs text-muted-foreground">{settled}</p>
      )}

      {/* The ask sits below the sentence, not beside it: a decision reads
          better on its own line than squeezed into a right-hand gutter. */}
      <div className="mt-4 flex items-center gap-2">
        {status === 'pending' && (
          <>
            <PillButton size="sm" onClick={onConfirm}>
              Yes, do it
            </PillButton>
            <PillButton size="sm" variant="ghost" onClick={onCancel}>
              No
            </PillButton>
          </>
        )}
        {status === 'executing' && <StateChip>Working</StateChip>}
        {status === 'done' && <StateChip tone="good">Done</StateChip>}
        {status === 'cancelled' && <StateChip>Declined</StateChip>}
        {status === 'failed' && <StateChip tone="stale">Failed</StateChip>}
      </div>
    </Panel>
  );
}

/** One plain sentence about what landed. Ids are for logs, not for people. */
function formatResult(r: any): string {
  if (!r || typeof r !== 'object') return '';
  if (r.entry_id) return 'Saved to your data.';
  if (r.target_id) return 'Your target is set.';
  if (r.supplier_id) return 'Added to your suppliers.';
  if (r.ticket_id) return 'A member of the team will pick this up shortly.';
  return '';
}
