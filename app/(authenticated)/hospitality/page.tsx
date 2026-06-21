'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Store, UtensilsCrossed, Wine, BookOpen, BedDouble, BarChart3, Trash2, Settings2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HospitalitySetup } from '@/components/hospitality/HospitalitySetup';
import { HospitalityOverview } from '@/components/hospitality/dashboard/HospitalityOverview';
import { useHospitalitySettings } from '@/hooks/data/useHospitalitySettings';
import { hospitalitySectionFromHref, isHospitalitySectionEnabled } from '@/lib/hospitality/settings';

const SECTIONS = [
  { href: '/hospitality/venues/', icon: Store, title: 'Venues', blurb: 'Set up your restaurants, bars and accommodation. Each venue anchors its own impact reporting.' },
  { href: '/hospitality/meals/', icon: UtensilsCrossed, title: 'Meals', blurb: 'Build recipes from ingredients and see carbon, water and land impact per cover.' },
  { href: '/hospitality/drinks/', icon: Wine, title: 'Drinks', blurb: 'Cocktails and coffees as recipes; impact per serve from the same engine.' },
  { href: '/hospitality/menus/', icon: BookOpen, title: 'Menus', blurb: 'Collect meals and drinks — including your own wines, pulled live from their LCA — and see the menu average per cover.' },
  { href: '/hospitality/rooms/', icon: BedDouble, title: 'Rooms', blurb: 'Per-room-night impact: purchased consumables plus allocated energy and water.' },
  { href: '/hospitality/sales/', icon: BarChart3, title: 'Sales', blurb: 'Record covers, drinks and room-nights served — this drives your company total.' },
  { href: '/hospitality/waste/', icon: Trash2, title: 'Waste', blurb: 'Log food and dry waste with how it is treated; tracked separately and added to your footprint.' },
] as const;

export default function HospitalityDashboard() {
  // Dashboard: rich impact overview (HospitalityOverview) + section shortcuts.
  const { settings, isLoading } = useHospitalitySettings();
  const [editing, setEditing] = useState(false);

  const header = (
    <div className="flex items-start justify-between gap-3">
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
      {settings?.configured && !editing && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Settings2 className="mr-2 h-4 w-4" />
          Customise
        </Button>
      )}
    </div>
  );

  if (isLoading || !settings) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        {header}
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  // First open (or "Customise") → show the function chooser.
  if (!settings.configured || editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        {header}
        <HospitalitySetup
          initial={settings}
          onSaved={() => {
            // Reload so the sidebar nav picks up the new section selection.
            window.location.reload();
          }}
          onCancel={settings.configured ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const visibleSections = SECTIONS.filter((s) => {
    const section = hospitalitySectionFromHref(s.href);
    return section ? isHospitalitySectionEnabled(section, settings) : true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {header}

      <HospitalityOverview />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Manage</h2>
        <div className="grid gap-3 sm:grid-cols-2">
        {visibleSections.map((s) => {
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
    </div>
  );
}
