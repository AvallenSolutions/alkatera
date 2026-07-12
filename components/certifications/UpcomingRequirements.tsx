'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StateChip } from '@/components/studio';
import { CalendarClock } from 'lucide-react';
import type { CertificationReadiness } from '@/lib/certifications/scoring';

function dueDate(start: string | null, years: number): Date | null {
  if (!start) return null;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function monthsUntil(target: Date | null): number | null {
  if (!target) return null;
  const now = new Date();
  return Math.max(
    0,
    (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth()),
  );
}

export function UpcomingRequirements({
  readiness,
}: {
  readiness: CertificationReadiness;
}) {
  const start = readiness.certificationStartDate;
  const year3 = readiness.requirementStatuses.filter(
    (r) => r.applicableFromYear === 3,
  );
  const year5 = readiness.requirementStatuses.filter(
    (r) => r.applicableFromYear === 5,
  );
  if (year3.length === 0 && year5.length === 0) return null;

  const y3Due = dueDate(start, 3);
  const y5Due = dueDate(start, 5);
  const y3Months = monthsUntil(y3Due);
  const y5Months = monthsUntil(y5Due);

  const byTopic = (list: typeof year3) => {
    const map = new Map<string, typeof year3>();
    for (const r of list) {
      const arr = map.get(r.topicArea) ?? [];
      arr.push(r);
      map.set(r.topicArea, arr);
    }
    return Array.from(map.entries());
  };

  const onTrack = (code: string) =>
    (readiness.platformHealth ?? []).some(
      (e) => e.status !== 'missing' && e.requirementCodes.includes(code),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5 text-room-accent" />
          Upcoming Requirements
        </CardTitle>
        <CardDescription>
          Year 3 requirements become mandatory
          {y3Due ? ` on ${y3Due.toLocaleDateString('en-GB')}` : ''}
          {y3Months != null ? ` (in about ${y3Months} months)` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {byTopic(year3).map(([topic, reqs]) => (
          <div key={topic}>
            <p className="mb-1 text-sm font-medium">{topic}</p>
            <div className="space-y-1">
              {reqs.map((r) => (
                <div
                  key={r.requirementId}
                  className="flex items-center justify-between rounded-[6px] border p-2 text-sm"
                >
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.code}
                    </span>{' '}
                    {r.name}
                  </span>
                  <StateChip tone={onTrack(r.code) ? 'good' : 'attention'}>
                    {onTrack(r.code) ? 'On track' : 'Action needed'}
                  </StateChip>
                </div>
              ))}
            </div>
          </div>
        ))}

        {year5.length > 0 && (
          <details className="rounded-md border p-2">
            <summary className="cursor-pointer text-sm font-medium">
              Year 5 requirements
              {y5Due ? ` (mandatory ${y5Due.toLocaleDateString('en-GB')}` : ''}
              {y5Months != null ? `, in about ${y5Months} months)` : ')'}
            </summary>
            <div className="mt-2 space-y-1">
              {year5.map((r) => (
                <div
                  key={r.requirementId}
                  className="rounded-md border p-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.code}
                  </span>{' '}
                  {r.name}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
