'use client';

/**
 * Pulse -- Ask Rosa.
 *
 * Embedded conversational widget that talks to /api/rosa/chat over SSE.
 * Streams Rosa's reply token-by-token, surfaces tool-call audit chips inline,
 * and persists the conversation_id between turns so context is preserved
 * within a single Pulse session. Each refresh starts a fresh thread.
 *
 * Designed for "what does this number mean?" questions without leaving the
 * dashboard. A "Open full chat" link drops the user into the dedicated Rosa
 * page if they want a roomier view.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Send, Sparkles, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToolChip {
  name: string;
  is_error: boolean;
  preview: string;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  tools?: ToolChip[];
}

const SUGGESTIONS = [
  'Which facility had the biggest emissions jump this quarter?',
  'How are we tracking against our 2030 net-zero target?',
  "What's flagged in the alerts inbox right now?",
  'Compare water use across our sites for the last 90 days.',
];

export function AskRosaWidget() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [turns]);

  const send = useCallback(async (message: string) => {
    if (!message.trim() || streaming) return;
    setStreaming(true);
    setInput('');
    setTurns(prev => [
      ...prev,
      { role: 'user', text: message },
      { role: 'assistant', text: '', tools: [] },
    ]);

    try {
      const res = await fetch('/api/rosa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationIdRef.current ?? undefined,
          message,
          context: { source: 'pulse_widget' },
        }),
      });
      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Rosa request failed (${res.status}): ${errBody.slice(0, 120)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // SSE parser: split on blank lines, then on the first ":" within each
      // "event: ..." / "data: ..." pair. Keeps partial frames in `buffer`.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          handleSseFrame(frame);
        }
      }
    } catch (err: any) {
      setTurns(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          last.text = `Sorry, something went wrong: ${err?.message ?? 'unknown error'}`;
        }
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [streaming]);

  const handleSseFrame = (frame: string) => {
    let event = '';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!event) return;
    let payload: any = null;
    try {
      payload = data ? JSON.parse(data) : null;
    } catch {
      return;
    }
    if (event === 'text' && payload?.delta) {
      setTurns(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') last.text += payload.delta;
        return next;
      });
    } else if (event === 'tool_use' && payload?.name) {
      setTurns(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          last.tools = [
            ...(last.tools ?? []),
            { name: payload.name, is_error: false, preview: '' },
          ];
        }
        return next;
      });
    } else if (event === 'tool_result' && payload?.name) {
      setTurns(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && last.tools) {
          // Update the latest matching tool chip with its result.
          for (let i = last.tools.length - 1; i >= 0; i -= 1) {
            if (last.tools[i].name === payload.name) {
              last.tools[i] = {
                name: payload.name,
                is_error: Boolean(payload.is_error),
                preview: String(payload.preview ?? ''),
              };
              break;
            }
          }
        }
        return next;
      });
    } else if (event === 'done' && payload?.conversation_id) {
      conversationIdRef.current = payload.conversation_id;
    } else if (event === 'error' && payload?.message) {
      setTurns(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          last.text = `Sorry, something went wrong: ${payload.message}`;
        }
        return next;
      });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-5">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#ccff00]" />
            <h3 className="text-sm font-semibold text-foreground">Ask Rosa</h3>
            <span className="rounded-full bg-[#ccff00]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ccff00]">
              Tool-aware
            </span>
          </div>
          <Link
            href="/rosa"
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Open full chat <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </header>

        <div
          ref={scrollerRef}
          className="max-h-72 min-h-[8rem] space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-3"
        >
          {turns.length === 0 ? (
            <EmptyState onPick={s => void send(s)} />
          ) : (
            turns.map((t, i) => <TurnBubble key={i} turn={t} />)
          )}
          {streaming && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about anything you can see on this page…"
            disabled={streaming}
            className="flex-1 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-[#ccff00]/60 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="sm"
            disabled={streaming || !input.trim()}
            className="bg-[#ccff00] text-black hover:bg-[#b8e600]"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Rosa can read your live data. Try one of these, or type your own:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] text-foreground transition hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnBubble({ turn }: { turn: Turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#ccff00]/15 px-3 py-2 text-sm text-foreground">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {turn.tools && turn.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {turn.tools.map((t, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                t.is_error
                  ? 'border-red-500/40 bg-red-500/10 text-red-500'
                  : 'border-border/60 bg-muted/40 text-muted-foreground',
              )}
              title={t.preview}
            >
              <Wrench className="h-2.5 w-2.5" />
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="rounded-2xl rounded-tl-sm bg-card/60 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
        {turn.text || (
          <span className="text-muted-foreground">…</span>
        )}
      </div>
    </div>
  );
}
