'use client';

/**
 * Pulse -- Rosa commentary block.
 *
 * Drop-in block for expanded drill views that want a short Claude-written
 * narrative about the widget's current data. Fires one call to
 * /api/pulse/rosa-commentary and renders the result as Markdown-lite bullets.
 *
 * Keep it cheap: call this only from expanded views (not compact cards) so
 * we don't fire on every Pulse mount.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCcw, Sparkles, Wrench } from 'lucide-react';

export interface RosaCommentaryProps {
  widgetId: string;
  context: Record<string, unknown>;
  /** Optional label in the block header. Defaults to "Rosa's take". */
  title?: string;
}

interface ApiPayload {
  ok: boolean;
  text: string;
  tools_used: string[];
}

export function RosaCommentaryBlock({
  widgetId,
  context,
  title = "Rosa's take",
}: RosaCommentaryProps) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pulse/rosa-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widget_id: widgetId, context }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? `HTTP ${res.status}`);
      } else {
        setData(json as ApiPayload);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }, [widgetId, JSON.stringify(context)]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-2 rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/5 p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-[#ccff00]" />
          {title}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-[#ccff00]/40 hover:text-foreground disabled:opacity-50"
          title="Regenerate commentary"
        >
          <RefreshCcw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
          Refresh
        </button>
      </header>

      {loading && !data && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Rosa is reading your data…
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500">Could not generate commentary: {error}</p>
      )}

      {data && (
        <>
          <CommentaryText text={data.text} />
          {data.tools_used.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Rosa called:
              </span>
              {data.tools_used.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  <Wrench className="h-2.5 w-2.5" />
                  {t}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Render Rosa's bullets. Accepts very small Markdown (bullet prefixes, bold)
 * -- full Markdown rendering isn't worth the dep weight for a three-bullet
 * paragraph.
 */
function CommentaryText({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const bullets = lines.filter(l => /^[-*•]\s/.test(l));
  if (bullets.length === 0) {
    return <p className="text-sm leading-relaxed text-foreground">{text}</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed text-foreground">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-[#ccff00]">•</span>
          <span>{renderInline(b.replace(/^[-*•]\s+/, ''))}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tiny inline renderer: **bold** and `code`. Anything else passes through. */
function renderInline(s: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      out.push(
        <strong key={i++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      out.push(
        <code key={i++} className="rounded bg-muted px-1 text-[11px]">
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
