'use client';

import { useEffect, useState } from 'react';
import { Building2, ShieldCheck, ShieldOff, Loader2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FieldSharingControls } from './field-sharing-controls';

interface LinkRow {
  id: string;
  distributor_org_id: string;
  distributor_name: string;
  brand_profile_id: string;
  match_method: string;
  match_confidence: number | null;
  confirmed_by_brand: boolean;
  confirmed_at: string | null;
  sharing_active: boolean;
  deactivated_at: string | null;
  created_at: string;
}

/**
 * Brand-side panel: list every distributor that has linked to this
 * brand's alkatera org, with controls to confirm pending requests,
 * pause sharing per distributor, and disconnect entirely.
 *
 * The expandable per-distributor section drills into FieldSharingControls
 * for granular per-field privacy.
 */
export function DistributorListPanel() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/brand/distributors');
      if (!res.ok) {
        setFeedback({ type: 'err', text: 'Could not load distributors.' });
        return;
      }
      const body = (await res.json()) as { links: LinkRow[] };
      setLinks(body.links ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusy(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/brand/distributors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Save failed (${body.error ?? res.status}).` });
        return;
      }
      await load();
      setFeedback({ type: 'ok', text: 'Saved.' });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm('Disconnect this distributor entirely? They will lose access to your data immediately.')) return;
    setBusy(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/brand/distributors/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setFeedback({ type: 'err', text: 'Disconnect failed.' });
        return;
      }
      await load();
      setFeedback({ type: 'ok', text: 'Distributor disconnected.' });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`text-xs px-3 py-2 rounded border ${
            feedback.type === 'ok'
              ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'
              : 'border-destructive/30 text-destructive bg-destructive/5'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No distributors are connected to your alkatera profile yet. If a distributor adds your
            brand to their portfolio, they will appear here.
          </CardContent>
        </Card>
      ) : (
        links.map((link) => (
          <Card key={link.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-teal-500" />
                  {link.distributor_name}
                </CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  Connected {new Date(link.created_at).toLocaleDateString()} · {humanMethod(link.match_method)}
                  {link.match_confidence != null &&
                    ` · ${Math.round(link.match_confidence * 100)}% confidence`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!link.confirmed_by_brand ? (
                  <Badge variant="outline" className="text-xs text-amber-300 border-amber-500/30">
                    Awaiting your confirmation
                  </Badge>
                ) : link.sharing_active ? (
                  <Badge variant="outline" className="text-xs text-emerald-300 border-emerald-500/30">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Sharing active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                    <ShieldOff className="h-3 w-3 mr-1" /> Paused
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {!link.confirmed_by_brand && (
                  <Button
                    size="sm"
                    disabled={busy === link.id}
                    onClick={() => patch(link.id, { confirmed: true })}
                    className="bg-teal-500 hover:bg-teal-400 text-black"
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Confirm connection
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === link.id || !link.confirmed_by_brand}
                  onClick={() => patch(link.id, { sharing_active: !link.sharing_active })}
                >
                  {link.sharing_active ? 'Pause sharing' : 'Resume sharing'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === link.id}
                  onClick={() => disconnect(link.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExpanded((cur) => (cur === link.id ? null : link.id))}
                >
                  {expanded === link.id ? 'Hide field controls' : 'Field-level controls'}
                </Button>
              </div>

              {expanded === link.id && (
                <div className="pt-3 border-t border-border">
                  <FieldSharingControls
                    distributorOrgId={link.distributor_org_id}
                    distributorName={link.distributor_name}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function humanMethod(method: string): string {
  switch (method) {
    case 'auto_name':
      return 'matched by name';
    case 'auto_domain':
      return 'matched by domain';
    case 'auto_fuzzy':
      return 'fuzzy match';
    case 'manual':
      return 'added manually';
    default:
      return method;
  }
}
