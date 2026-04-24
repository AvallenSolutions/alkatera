'use client';

/**
 * Pulse -- Insight share dialog.
 *
 * One dialog, two actions:
 *   1. Email to a list of recipients (with optional personal note).
 *   2. Download a board-ready PDF.
 *
 * Slack arrives in a future phase. The UI deliberately does not pretend to
 * support it now -- adding it later means adding a tab, no rework.
 */

import { useState } from 'react';
import { Download, Loader2, Mail, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insightId: string;
  insightHeadline: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InsightShareDialog({ open, onOpenChange, insightId, insightHeadline }: Props) {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function commitDraft() {
    const candidate = draft.trim().replace(/[,;]\s*$/, '');
    if (!candidate) return;
    if (!EMAIL_RE.test(candidate)) {
      toast({ title: 'Not a valid email', description: candidate, variant: 'destructive' });
      return;
    }
    if (recipients.includes(candidate)) {
      setDraft('');
      return;
    }
    setRecipients([...recipients, candidate]);
    setDraft('');
  }

  async function sendEmail() {
    if (recipients.length === 0) {
      toast({ title: 'Add at least one recipient', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/pulse/insights/${insightId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email', recipients, message: message.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed (${res.status})`);
      }
      toast({
        title: 'Sent',
        description: `Delivered to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.`,
      });
      onOpenChange(false);
      setRecipients([]);
      setMessage('');
    } catch (err: any) {
      toast({ title: 'Send failed', description: err?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/pulse/insights/${insightId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'pdf' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-insight-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF ready', description: 'Saved to your downloads.' });
    } catch (err: any) {
      toast({ title: 'PDF failed', description: err?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share insight</DialogTitle>
          <DialogDescription className="line-clamp-2">{insightHeadline}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Email block */}
          <section className="space-y-3 rounded-lg border border-border/60 p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Email</h4>
            </div>

            <div>
              <Label htmlFor="recipients" className="text-xs">Recipients</Label>
              <div className="mt-1 flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
                {recipients.map(r => (
                  <Badge key={r} variant="secondary" className="gap-1 pr-1">
                    {r}
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted-foreground/10"
                      onClick={() => setRecipients(recipients.filter(x => x !== r))}
                      aria-label={`Remove ${r}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  id="recipients"
                  type="email"
                  className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none"
                  placeholder={recipients.length === 0 ? 'name@company.com' : ''}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
                      e.preventDefault();
                      commitDraft();
                    } else if (e.key === 'Backspace' && draft === '' && recipients.length > 0) {
                      setRecipients(recipients.slice(0, -1));
                    }
                  }}
                  onBlur={() => { if (draft.trim()) commitDraft(); }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Press Enter, comma, or space to add. Up to 20 recipients.
              </p>
            </div>

            <div>
              <Label htmlFor="message" className="text-xs">Personal note (optional)</Label>
              <Textarea
                id="message"
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Sharing this week's brief..."
                className="mt-1"
              />
            </div>

            <Button onClick={sendEmail} disabled={sending || recipients.length === 0} className="w-full">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send email
            </Button>
          </section>

          {/* PDF block */}
          <section className="space-y-2 rounded-lg border border-border/60 p-4">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Board-ready PDF</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              A4, branded, with the headline, narrative and supporting metrics. Drop it
              straight into a board pack.
            </p>
            <Button variant="outline" onClick={downloadPdf} disabled={downloading} className="w-full">
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
