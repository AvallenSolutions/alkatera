'use client';

import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PillButton } from '@/components/studio/pill-button';
import type { ProvenanceBlocker } from '@/lib/provenance/gate';

interface ProvenanceGateDialogProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "Your report" / "This passport" — used in the opening line. */
  subject: string;
  blockers: ProvenanceBlocker[];
}

/**
 * The polite dialog behind the confirmed-share gate
 * (lib/provenance/gate.ts): instead of a bare "blocked" error, names what's
 * still unconfirmed and links straight to it. Never offers a way past the
 * gate from here — the only way through is to go confirm the numbers.
 */
export function ProvenanceGateDialog({ open, onClose, subject, blockers }: ProvenanceGateDialogProps) {
  const totalUnconfirmed = blockers.reduce((sum, b) => sum + b.unconfirmedCount, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {subject} needs {totalUnconfirmed > 0 ? `${totalUnconfirmed} number${totalUnconfirmed === 1 ? '' : 's'}` : 'more data'} confirmed first.
          </DialogTitle>
          <DialogDescription>
            Anything leaving alkatera needs a human to have looked at the numbers behind it. Internal dashboards
            work fine with estimates — this doesn&apos;t.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {blockers.map((blocker) => (
            <Link
              key={blocker.area}
              href={blocker.deepLink}
              onClick={onClose}
              className="flex items-center justify-between gap-3 rounded-[6px] border border-border bg-card px-3 py-2 text-sm hover:border-room-accent"
            >
              <span className="text-foreground">{blocker.label}</span>
              <span className="text-xs text-muted-foreground">
                {blocker.confirmedPct}% confirmed
                {blocker.unconfirmedCount > 0 ? ` · ${blocker.unconfirmedCount} to check` : ''}
              </span>
            </Link>
          ))}
        </div>

        <DialogFooter>
          <PillButton variant="ghost" size="sm" onClick={onClose}>
            Close
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
