'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Store, UtensilsCrossed, Wine, BookOpen, BedDouble, BarChart3, Leaf, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SECTIONS = [
  { href: '/hospitality/venues/', icon: Store, title: 'Venues', blurb: 'Set up your restaurants, bars and accommodation. Each venue anchors its own impact reporting.' },
  { href: '/hospitality/meals/', icon: UtensilsCrossed, title: 'Meals', blurb: 'Build recipes from ingredients and see carbon, water and land impact per cover.' },
  { href: '/hospitality/drinks/', icon: Wine, title: 'Drinks', blurb: 'Cocktails and coffees as recipes; impact per serve from the same engine.' },
  { href: '/hospitality/menus/', icon: BookOpen, title: 'Menus', blurb: 'Collect meals and drinks — including your own wines, pulled live from their LCA — and see the menu average per cover.' },
  { href: '/hospitality/rooms/', icon: BedDouble, title: 'Rooms', blurb: 'Per-room-night impact: purchased consumables plus allocated energy and water.' },
  { href: '/hospitality/sales/', icon: BarChart3, title: 'Sales', blurb: 'Record covers, drinks and room-nights served — this drives your company total.' },
] as const;

function fmt(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

function ContributionCard() {
  const [data, setData] = useState<{ year: number; total: number; food: number; supplies: number } | null>(null);

  useEffect(() => {
    fetch('/api/hospitality/summary', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.total <= 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Leaf className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Contribution to your company total ({data.year})</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{fmt(data.total)} kg CO₂e</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmt(data.food)} kg from food &amp; drink · {fmt(data.supplies)} kg from room consumables.
          Added to Scope 3 — own wines and venue energy are excluded to avoid double-counting.
        </p>
      </CardContent>
    </Card>
  );
}

export default function HospitalityDashboard() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <UtensilsCrossed className="h-7 w-7" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Hospitality</h1>
            <Badge variant="secondary">Beta</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Measure the impact of meals, drinks, menus and room nights, and roll it into
            your total company footprint.
          </p>
        </div>
      </div>

      <ContributionCard />

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="block">
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-base">{s.title}</CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{s.blurb}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
