'use client';

/**
 * Producer marketplace: browse opt-in producers whose verified drinks LCAs a
 * venue can pull, and opt your own org in to be discoverable.
 */

import { useCallback, useEffect, useState } from 'react';
import { Store, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface Producer {
  organization_id: string;
  name: string;
  country: string | null;
  product_count: number;
  categories: string[];
  verified_count: number;
  avg_carbon: number | null;
}

export function MarketplaceDirectory() {
  const { toast } = useToast();
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [listed, setListed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dir, listing] = await Promise.all([
        fetch('/api/hospitality/marketplace', { credentials: 'include' }),
        fetch('/api/hospitality/marketplace/listing', { credentials: 'include' }),
      ]);
      if (dir.ok) setProducers((await dir.json()).producers ?? []);
      if (listing.ok) setListed((await listing.json()).listed === true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleListing = async (next: boolean) => {
    setListed(next);
    setSaving(true);
    try {
      const res = await fetch('/api/hospitality/marketplace/listing', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listed: next }),
      });
      if (!res.ok) throw new Error();
      toast({ title: next ? 'Your org is now listed' : 'Listing removed' });
    } catch {
      setListed(!next);
      toast({ title: 'Could not update listing', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Producer marketplace</h2>
        <p className="text-sm text-muted-foreground">
          Find producers whose verified drinks LCAs you can pull into your menus, and list your own
          org so venues can find you.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <Label htmlFor="mkt-listed" className="text-sm font-medium">List my organisation as a producer</Label>
              <p className="text-xs text-muted-foreground">
                Shows your name, product categories and how many products have verified LCAs. No raw data is shared.
              </p>
            </div>
          </div>
          <Switch id="mkt-listed" checked={listed} onCheckedChange={toggleListing} disabled={saving} />
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      ) : producers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No producers are listed yet. Be the first — toggle the listing above.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {producers.map((p) => (
            <Card key={p.organization_id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{p.name}</span>
                  {p.verified_count > 0 && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      <BadgeCheck className="mr-1 h-3.5 w-3.5" /> {p.verified_count} verified
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {p.country && <Badge variant="secondary">{p.country}</Badge>}
                  {p.categories.slice(0, 4).map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.product_count} product{p.product_count === 1 ? '' : 's'}
                  {p.avg_carbon != null && ` · avg ${p.avg_carbon.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg CO₂e`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
