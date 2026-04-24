'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Loader2, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';

interface Explanation {
  headline: string;
  bullets: string[];
  tools_called?: Array<{ name: string; is_error?: boolean }>;
  model?: string;
  generated_at?: string;
}

interface Anomaly {
  id: string;
  metric_key: MetricKey;
  detected_at: string;
  severity: 'low' | 'medium' | 'high';
  observed: number;
  expected: number;
  z_score: number;
  status: 'open' | 'acknowledged' | 'dismissed';
  explanation?: Explanation | null;
  explanation_generated_at?: string | null;
}

const SEVERITY_RANK: Record<Anomaly['severity'], number> = { high: 0, medium: 1, low: 2 };

export function AlertsInbox() {
  const { currentOrganization } = useOrganization();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explainErrors, setExplainErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentOrganization?.id) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  async function refresh() {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('dashboard_anomalies')
      .select('id, metric_key, detected_at, severity, observed, expected, z_score, status, explanation, explanation_generated_at')
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'open')
      .order('detected_at', { ascending: false })
      .limit(20);
    setAnomalies(((data as Anomaly[]) ?? []).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]));
    setLoading(false);
  }

  async function act(id: string, action: 'acknowledge' | 'dismiss') {
    setAnomalies(prev => prev.filter(a => a.id !== id));
    await fetch(`/api/pulse/anomalies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  }

  async function explain(id: string, force = false) {
    setExplainingId(id);
    setExplainErrors(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/pulse/anomalies/${id}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed (${res.status})`);
      }
      setAnomalies(prev =>
        prev.map(a =>
          a.id === id
            ? { ...a, explanation: json.explanation, explanation_generated_at: json.explanation.generated_at }
            : a,
        ),
      );
      setExpandedId(id);
    } catch (err: any) {
      setExplainErrors(prev => ({ ...prev, [id]: err?.message ?? 'Could not explain' }));
    } finally {
      setExplainingId(null);
    }
  }

  function toggle(id: string) {
    setExpandedId(curr => (curr === id ? null : id));
  }

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex flex-col p-0">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
          </div>
          <span className="font-data text-[10px] uppercase tracking-wider text-muted-foreground">
            {anomalies.length} open
          </span>
        </header>

        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : anomalies.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No anomalies right now. We'll surface them here as soon as something looks unusual.
          </p>
        ) : (
          <ul className="max-h-[520px] divide-y divide-border/40 overflow-y-auto">
            {anomalies.map(a => {
              const def = METRIC_DEFINITIONS[a.metric_key];
              const direction = a.observed > a.expected ? '↑' : '↓';
              const deltaPct =
                a.expected !== 0
                  ? ((a.observed - a.expected) / Math.abs(a.expected)) * 100
                  : 0;
              const isExpanded = expandedId === a.id;
              const hasExplanation = Boolean(a.explanation);
              const isExplaining = explainingId === a.id;
              return (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-block h-2 w-2 rounded-full', severityDot(a.severity))} />
                        <p className="text-sm font-medium text-foreground">
                          {def?.label ?? a.metric_key}
                        </p>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider', severityChip(a.severity))}>
                          {a.severity}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {direction} {Math.abs(deltaPct).toFixed(1)}% vs baseline · z = {a.z_score.toFixed(1)} · {new Date(a.detected_at).toLocaleString('en-GB')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => (hasExplanation ? toggle(a.id) : explain(a.id))}
                        disabled={isExplaining}
                        title={hasExplanation ? (isExpanded ? 'Hide explanation' : 'Show explanation') : 'Ask Rosa to explain'}
                        className="text-xs"
                      >
                        {isExplaining ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : hasExplanation ? (
                          isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <Sparkles className="mr-1 h-3.5 w-3.5 text-[#ccff00]" />
                        )}
                        {!hasExplanation && !isExplaining && <span>Why?</span>}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act(a.id, 'acknowledge')}
                        title="Acknowledge"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act(a.id, 'dismiss')}
                        title="Dismiss as expected"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {explainErrors[a.id] && (
                    <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                      {explainErrors[a.id]}
                    </p>
                  )}

                  {isExpanded && a.explanation && (
                    <div className="mt-3 rounded-md border border-[#ccff00]/30 bg-[#ccff00]/5 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-[#ccff00]" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Rosa's hypothesis
                        </span>
                        <button
                          type="button"
                          onClick={() => explain(a.id, true)}
                          disabled={isExplaining}
                          className="ml-auto text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                        >
                          Re-investigate
                        </button>
                      </div>
                      <p className="text-sm font-medium text-foreground">{a.explanation.headline}</p>
                      {a.explanation.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {a.explanation.bullets.map((b, i) => (
                            <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                              <span className="text-[#ccff00]">•</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {a.explanation.tools_called && a.explanation.tools_called.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {a.explanation.tools_called.map((t, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={cn(
                                'text-[9px] uppercase tracking-wider',
                                t.is_error && 'border-amber-500/40 text-amber-600',
                              )}
                            >
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function severityDot(severity: Anomaly['severity']): string {
  return severity === 'high' ? 'bg-red-500' : severity === 'medium' ? 'bg-amber-500' : 'bg-yellow-500';
}

function severityChip(severity: Anomaly['severity']): string {
  return severity === 'high'
    ? 'bg-red-500/15 text-red-500'
    : severity === 'medium'
      ? 'bg-amber-500/15 text-amber-500'
      : 'bg-yellow-500/15 text-yellow-600';
}
