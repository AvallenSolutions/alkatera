'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, BadgeCheck } from 'lucide-react';

interface Props {
  description: string | null;
  source: string | null;
  updatedAt: string | null;
  /** Source URL the description was generated from (homepage typically). */
  sourceUrl: string | null;
}

const COLLAPSED_CHAR_LIMIT = 480;

/**
 * Brand-overview description card. Shows the AI-generated narrative
 * with a clear "auto-generated" stamp. Long descriptions collapse
 * after ~480 chars with a "Show more" toggle.
 */
export function CompanyDescription({ description, source, updatedAt, sourceUrl }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!description) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 mb-2">
          <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
          </div>
          <span className="text-sm font-semibold text-foreground">Brand overview</span>
        </div>
        <p>
          No description yet. Once the brand has a website on file and a finding run completes, an
          AI-generated overview focused on sustainability will appear here.
        </p>
      </div>
    );
  }

  const needsToggle = description.length > COLLAPSED_CHAR_LIMIT;
  const visible =
    !needsToggle || expanded
      ? description
      : truncateAtBoundary(description, COLLAPSED_CHAR_LIMIT);

  const isAlkateraSourced = source === 'alkatera_live';
  const chipBg = isAlkateraSourced ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-sky-500/10 border-sky-400/30';
  const chipText = isAlkateraSourced ? 'text-emerald-300' : 'text-sky-300';
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`rounded-md ${chipBg} border p-1.5`}>
            {isAlkateraSourced ? (
              <BadgeCheck className={`h-3.5 w-3.5 ${chipText}`} />
            ) : (
              <Sparkles className={`h-3.5 w-3.5 ${chipText}`} />
            )}
          </div>
          <span className="text-sm font-semibold">Brand overview</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {isAlkateraSourced ? (
            <>Written by the brand on alka<strong>tera</strong></>
          ) : (
            <>Auto-generated from {sourceLabel(source, sourceUrl)}</>
          )}
          {updatedAt && <> · {formatRelative(updatedAt)}</>}
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
        {visible}
        {needsToggle && !expanded && <span className="text-muted-foreground">…</span>}
      </div>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-sky-300 hover:text-sky-200 inline-flex items-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

function sourceLabel(source: string | null, sourceUrl: string | null): React.ReactNode {
  if (sourceUrl) {
    let host = sourceUrl;
    try {
      host = new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      // fall through with the raw URL
    }
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground hover:text-sky-300 underline-offset-2 hover:underline"
      >
        {host}
      </a>
    );
  }
  return source ?? 'the brand website';
}

function truncateAtBoundary(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  // Try to break at the last sentence or word boundary so we don't cut mid-word.
  const lastSentence = slice.lastIndexOf('. ');
  if (lastSentence > limit * 0.6) return slice.slice(0, lastSentence + 1);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) return slice.slice(0, lastSpace);
  return slice;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
