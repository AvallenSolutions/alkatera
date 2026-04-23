'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';

interface BriefingResponse {
  insight: { headline: string; generated_at: string } | null;
  anomalies: { open_count: number; top_severity: 'low' | 'medium' | 'high' | null };
  next_deadline: {
    title: string;
    regime_label: string;
    due_date: string;
    days_away: number;
    action_href: string;
  } | null;
  next_gap: { step: string; why: string; href: string } | null;
}

const STORAGE_KEY = 'rosa_briefing_dismissed_at';
const DISMISS_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function RosaBriefing() {
  const router = useRouter();
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setDismissed(true);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rosa/briefing', { cache: 'no-store' });
        if (!res.ok) throw new Error(`briefing ${res.status}`);
        const json = (await res.json()) as BriefingResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const askRosa = (prompt: string) => {
    router.push(`/rosa?prompt=${encodeURIComponent(prompt)}`);
  };

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
  };

  if (dismissed) return null;

  if (loading) {
    return (
      <div className="border-b bg-background/95 px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading your briefing...
      </div>
    );
  }

  if (!data) return null;

  const severityColor = (s: 'low' | 'medium' | 'high' | null) =>
    s === 'high' ? 'bg-red-500/10 text-red-600 border-red-500/30'
    : s === 'medium' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
    : 'bg-muted text-muted-foreground border-border';

  const deadlineUrgent = data.next_deadline && data.next_deadline.days_away <= 30;

  return (
    <div className="border-b bg-background/95">
      <div className="px-4 py-3 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            For you today
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss briefing"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Insight */}
          <Card className="border-[#ccff00]/30">
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[#ccff00]" />
                Latest insight
              </div>
              <p className="text-xs line-clamp-2">
                {data.insight?.headline ?? 'No insight generated yet. Rosa will write one once there is activity to comment on.'}
              </p>
              {data.insight && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => askRosa('Walk me through the latest insight and what I should do about it.')}
                >
                  Ask Rosa <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Anomalies */}
          <Card className={data.anomalies.open_count > 0 ? 'border-amber-500/30' : ''}>
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Anomalies open
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold">{data.anomalies.open_count}</span>
                {data.anomalies.top_severity && (
                  <Badge variant="outline" className={`text-[10px] ${severityColor(data.anomalies.top_severity)}`}>
                    {data.anomalies.top_severity} severity
                  </Badge>
                )}
              </div>
              {data.anomalies.open_count > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => askRosa('What anomalies are open, which should I look at first, and why?')}
                >
                  Ask Rosa <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground">Nothing flagged in the last 14 days.</p>
              )}
            </CardContent>
          </Card>

          {/* Next deadline */}
          <Card className={deadlineUrgent ? 'border-red-500/30' : ''}>
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClock className={`h-3.5 w-3.5 ${deadlineUrgent ? 'text-red-500' : 'text-muted-foreground'}`} />
                Next deadline
              </div>
              {data.next_deadline ? (
                <>
                  <p className="text-xs font-medium line-clamp-1">{data.next_deadline.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {data.next_deadline.regime_label} · {data.next_deadline.days_away >= 0
                      ? `${data.next_deadline.days_away} days`
                      : `${Math.abs(data.next_deadline.days_away)} days ago`}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => askRosa(`Tell me what I need to do for: ${data.next_deadline!.title}`)}
                  >
                    Ask Rosa <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">No deadlines in the next year.</p>
              )}
            </CardContent>
          </Card>

          {/* Data gap */}
          <Card>
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                Next best step
              </div>
              {data.next_gap ? (
                <>
                  <p className="text-xs font-medium line-clamp-2">{data.next_gap.step}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => askRosa(`Help me with: ${data.next_gap!.step}. ${data.next_gap!.why}`)}
                  >
                    Ask Rosa <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">Nothing obvious right now.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
