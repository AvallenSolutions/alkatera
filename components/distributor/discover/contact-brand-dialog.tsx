'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  brandDirectoryId: string;
  brandName: string;
  /** Hint to the user about which channel will receive the message. */
  hasAlkateraLink: boolean;
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; recipient: string }
  | { kind: 'error'; message: string };

export function ContactBrandDialog({ brandDirectoryId, brandName, hasAlkateraLink }: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  function reset() {
    setSubject('');
    setMessage('');
    setState({ kind: 'idle' });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Delay the state reset so the success/error message doesn't
      // disappear mid-fade-out.
      setTimeout(reset, 200);
    }
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setState({ kind: 'sending' });
    try {
      const res = await fetch(
        `/api/distributor/discover/brands/${brandDirectoryId}/contact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: subject.trim() || undefined,
            message: message.trim(),
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        recipient_redacted?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setState({
          kind: 'error',
          message: body.detail ?? body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setState({
        kind: 'sent',
        recipient: body.recipient_redacted ?? 'the brand',
      });
    } catch (err: unknown) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Send failed',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
        >
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          Contact brand
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contact {brandName}</DialogTitle>
          <DialogDescription>
            Send a one-off message. The brand will see your name, your distributor and your reply-to
            email so they can write back directly.
            {!hasAlkateraLink && (
              <span className="block mt-2 text-amber-300/80 text-xs">
                This brand isn't on alka<strong>tera</strong> yet. We'll try to reach the contact
                address on file (typically a brand-website press inbox).
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {state.kind === 'sent' ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Message sent</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Delivered to {state.recipient}. Their reply will land in your inbox.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Subject <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={`${brandName} — interest from our portfolio team`}
                maxLength={120}
                disabled={state.kind === 'sending'}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi, we're looking at adding ${brandName} to our portfolio and would love to hear more about your sustainability story…`}
                maxLength={5000}
                rows={7}
                disabled={state.kind === 'sending'}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 resize-none"
              />
              <div className="text-right text-[10px] text-muted-foreground mt-1 tabular-nums">
                {message.length} / 5000
              </div>
            </div>
            {state.kind === 'error' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <div>{state.message}</div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {state.kind === 'sent' ? (
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={state.kind === 'sending'}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={!message.trim() || state.kind === 'sending'}
                onClick={handleSubmit}
                className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
              >
                {state.kind === 'sending' && (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                )}
                Send message
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
