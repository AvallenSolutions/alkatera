'use client';

/**
 * Pulse Financial -- Board-pack export button.
 *
 * One-click download of a CFO-ready two-page PDF summarising the entire
 * financial view. Triggers /api/pulse/board-pack which composes every
 * financial endpoint into a single HTML template and PDFShift-converts.
 */

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export function BoardPackButton() {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!currentOrganization?.id || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/pulse/board-pack?organization_id=${currentOrganization.id}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-board-pack-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Board pack downloaded' });
    } catch (err: any) {
      toast({
        title: 'Board pack failed',
        description: err?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="default"
      onClick={download}
      disabled={busy}
      className="bg-[#ccff00] text-black hover:bg-[#b8e600]"
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5" />
      )}
      {busy ? 'Generating…' : 'Board pack'}
    </Button>
  );
}
