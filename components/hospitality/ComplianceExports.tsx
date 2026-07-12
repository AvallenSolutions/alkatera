'use client';

/**
 * One-click compliance exports (SECR / AGEC / Cool Food Pledge) assembled from
 * the hospitality data already in the platform.
 */

import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const YEAR = new Date().getFullYear();

const FRAMEWORKS = [
  { id: 'secr', label: 'SECR', blurb: 'UK energy & carbon reporting' },
  { id: 'agec', label: 'AGEC', blurb: 'France anti-waste (food waste)' },
  { id: 'cool_food', label: 'Cool Food Pledge', blurb: 'Food-emissions baseline' },
] as const;

export function ComplianceExports() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compliance exports</CardTitle>
        <CardDescription>
          Download {YEAR} data assembled for common frameworks. These are data exports for onward
          submission, not filings in themselves.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {FRAMEWORKS.map((f) => (
          <div key={f.id} className="flex flex-col gap-1 rounded-lg border p-3">
            <span className="text-sm font-medium">{f.label}</span>
            <span className="text-xs text-muted-foreground">{f.blurb}</span>
            <Button variant="outline" size="sm" asChild className="mt-1">
              <a href={`/api/hospitality/compliance?framework=${f.id}&year=${YEAR}&format=csv`}>
                <FileDown className="mr-2 h-4 w-4" /> Export CSV
              </a>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
