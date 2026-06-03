'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Check, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  brandId: string;
  initialWebsite: string | null;
  canEdit: boolean;
}

/**
 * Inline website editor on the brand-detail Overview page. Setting a
 * website here is the single most useful thing a distributor can do
 * for a brand — without it, the brand-website source has nothing to
 * fetch. The "Find data now" button queues a fresh discovery job so
 * the user can immediately see new findings without waiting for the
 * next cron tick.
 */
export function WebsiteEditor({ brandId, initialWebsite, canEdit }: Props) {
  const router = useRouter();
  const [website, setWebsite] = useState(initialWebsite ?? '');
  const [savedWebsite, setSavedWebsite] = useState(initialWebsite ?? '');
  const [busy, setBusy] = useState<'save' | 'find' | 'findweb' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const dirty = website.trim() !== savedWebsite;

  async function save() {
    setBusy('save');
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: website.trim() || null }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        brand?: { website: string | null };
        error?: string;
      };
      if (!res.ok || !body.brand) {
        setFeedback({ type: 'err', text: `Save failed (${body.error ?? res.status}).` });
        return;
      }
      setSavedWebsite(body.brand.website ?? '');
      setWebsite(body.brand.website ?? '');
      setFeedback({ type: 'ok', text: 'Website saved.' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function findNow() {
    setBusy('find');
    setFeedback(null);
    try {
      const res = await fetch('/api/distributor/scraping/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_profile_id: brandId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        queued?: number;
        skipped_already_queued?: number;
        error?: string;
      };
      if (!res.ok) {
        setFeedback({ type: 'err', text: `Could not queue (${body.error ?? res.status}).` });
        return;
      }
      if (body.queued && body.queued > 0) {
        setFeedback({
          type: 'ok',
          text: 'Queued. Watch the status indicator below — findings appear within a few minutes.',
        });
      } else {
        setFeedback({
          type: 'ok',
          text: "We're already finding data for this brand — wait for it to finish.",
        });
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function findWebsiteAndData() {
    setBusy('findweb');
    setFeedback(null);
    try {
      const res = await fetch('/api/distributor/brands/find-websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_profile_id: brandId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        found?: number;
        queued?: number;
        missingApiKey?: boolean;
        errors?: string[];
        error?: string;
      };
      if (!res.ok) {
        setFeedback({ type: 'err', text: `Could not run (${body.error ?? res.status}).` });
        return;
      }
      if (body.found && body.found > 0) {
        setFeedback({
          type: 'ok',
          text: 'Found a website and queued data finding. Findings appear within a few minutes.',
        });
        router.refresh();
      } else {
        setFeedback({
          type: 'err',
          text: body.missingApiKey
            ? 'Website finding is not configured (GEMINI_API_KEY missing).'
            : `Could not find an official website automatically${
                body.errors && body.errors.length > 0 ? ` (${body.errors.join('; ')})` : ''
              }. Paste it above and hit Save.`,
        });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
          <Globe className="h-4 w-4 text-sky-300" />
        </div>
        <span className="text-sm font-semibold">Brand website</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Setting a website lets us find this brand's sustainability data, the single biggest lever
        for populating the Data tab. Once saved, hit <em>Find data now</em> to refresh findings.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://www.avallenspirits.com"
          disabled={!canEdit || busy !== null}
          className="flex-1 min-w-[220px]"
        />
        {canEdit && (
          <Button
            variant={dirty ? 'default' : 'outline'}
            disabled={!dirty || busy !== null}
            onClick={save}
            size="sm"
            className={
              dirty
                ? 'bg-sky-400 hover:bg-sky-300 text-black font-semibold'
                : 'border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100'
            }
          >
            {busy === 'save' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Save
              </>
            )}
          </Button>
        )}
        {savedWebsite && (
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="text-muted-foreground hover:text-sky-200 hover:bg-sky-500/10"
          >
            <a href={savedWebsite} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>
      {canEdit && savedWebsite && !dirty && (
        <Button
          size="sm"
          variant="outline"
          onClick={findNow}
          disabled={busy !== null}
          className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
        >
          {busy === 'find' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Queuing…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Find data now
            </>
          )}
        </Button>
      )}
      {canEdit && !savedWebsite && !dirty && (
        <Button
          size="sm"
          variant="outline"
          onClick={findWebsiteAndData}
          disabled={busy !== null}
          className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
        >
          {busy === 'findweb' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Finding website…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Find website &amp; data
            </>
          )}
        </Button>
      )}
      {feedback && (
        <div
          className={`text-xs ${
            feedback.type === 'ok' ? 'text-emerald-300' : 'text-destructive'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
