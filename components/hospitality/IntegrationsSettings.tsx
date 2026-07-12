'use client';

/**
 * Live-integration connect surface. Lists the POS/PMS/procurement/waste vendors
 * the module targets and their configured status. Vendors show "Connect" once
 * their credentials are set in the environment; otherwise "Needs setup" — the UI
 * never implies a connection that doesn't exist.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plug, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface Vendor {
  id: string;
  label: string;
  category: 'pos' | 'pms' | 'procurement' | 'waste';
  auth: 'oauth2' | 'api_key';
  configured: boolean;
  provides: string[];
}

const CATEGORY_LABELS: Record<Vendor['category'], string> = {
  pos: 'Point of sale',
  pms: 'Property management (hotels)',
  procurement: 'Procurement',
  waste: 'Waste tracking',
};

export function IntegrationsSettings() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hospitality/integrations', { credentials: 'include' });
      if (res.ok) setVendors((await res.json()).vendors ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async (v: Vendor) => {
    setConnecting(v.id);
    try {
      const res = await fetch(`/api/hospitality/integrations/${v.id}/connect`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.authorize_url) {
        window.location.href = body.authorize_url;
        return;
      }
      toast({ title: 'Not available yet', description: body?.error || 'This integration needs setup.', variant: 'destructive' });
    } finally {
      setConnecting(null);
    }
  };

  const byCategory = (cat: Vendor['category']) => vendors.filter((v) => v.category === cat);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect your POS, property, procurement and waste systems to pull sales, occupancy and waste
          automatically. You can already import these via file upload today; live connections light up
          here once their credentials are configured.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : (
        (['pos', 'pms', 'procurement', 'waste'] as const).map((cat) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{CATEGORY_LABELS[cat]}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {byCategory(cat).map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{v.label}</p>
                      <p className="text-[11px] text-muted-foreground">Pulls {v.provides.join(', ')}</p>
                    </div>
                  </div>
                  {v.configured ? (
                    <Button size="sm" variant="outline" onClick={() => connect(v)} disabled={connecting === v.id}>
                      {connecting === v.id ? 'Connecting…' : 'Connect'}
                      <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Needs setup</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
