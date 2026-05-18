'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const STAGES: { key: string; label: string }[] = [
  { key: 'exported', label: 'Package exported' },
  { key: 'submitted', label: 'Submitted to auditor' },
  { key: 'scheduled', label: 'Audit scheduled' },
  { key: 'in_progress', label: 'Audit in progress' },
  { key: 'clarifications', label: 'Clarification requests' },
  { key: 'certified', label: 'Final determination' },
];

const ECGT_GUIDANCE =
  'https://bcorporation.eu/blog_post/certifying-on-the-new-b-lab-standards-how-companies-in-europe-can-lead-the-way-in-2026/';

interface AuditTimelineProps {
  packageId: string;
  auditStage: string | null;
  auditScheduledDate: string | null;
  auditorName: string | null;
  sizeBand: string | null;
  onUpdated: () => Promise<void> | void;
}

export function AuditTimeline({
  packageId,
  auditStage,
  auditScheduledDate,
  auditorName,
  sizeBand,
  onUpdated,
}: AuditTimelineProps) {
  const [busy, setBusy] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(
    auditScheduledDate ?? '',
  );
  const [auditor, setAuditor] = useState(auditorName ?? '');
  const [ecgtMessage, setEcgtMessage] = useState<{
    before: boolean;
  } | null>(null);

  const currentIndex = STAGES.findIndex((s) => s.key === auditStage);
  const durationEstimate =
    sizeBand === '250+' || sizeBand === '50-249'
      ? 'Based on your company size, the audit process typically takes 3 to 6 months.'
      : 'Based on your company size, the audit process typically takes 2 to 4 months.';

  const patch = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/certifications/audit-package', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId, ...payload }),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      if (data.ecgt?.applicable && data.ecgt.submittedBeforeDeadline != null) {
        setEcgtMessage({ before: !!data.ecgt.submittedBeforeDeadline });
      }
      toast.success('Audit status updated');
      await onUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Could not update audit status');
    } finally {
      setBusy(false);
    }
  };

  const advanceTo = (key: string) => patch({ audit_stage: key });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Audit Timeline</CardTitle>
        <CardDescription>{durationEstimate}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2">
          {STAGES.map((s, i) => {
            const done = currentIndex >= 0 && i <= currentIndex;
            return (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={done ? 'font-medium' : 'text-muted-foreground'}>
                  {s.label}
                </span>
                {s.key === 'scheduled' &&
                  auditScheduledDate &&
                  i <= currentIndex && (
                    <span className="text-xs text-muted-foreground">
                      ({auditScheduledDate})
                    </span>
                  )}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="auditor">Auditor</Label>
            <Input
              id="auditor"
              value={auditor}
              onChange={(e) => setAuditor(e.target.value)}
              placeholder="Auditor name or reference"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sched">Audit scheduled date</Label>
            <Input
              id="sched"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              patch({
                auditor_name: auditor || undefined,
                audit_scheduled_date: scheduledDate || undefined,
              })
            }
          >
            Save details
          </Button>
          {currentIndex < 0 && (
            <Button size="sm" disabled={busy} onClick={() => advanceTo('exported')}>
              Mark exported
            </Button>
          )}
          {auditStage === 'exported' && (
            <Button size="sm" disabled={busy} onClick={() => advanceTo('submitted')}>
              Mark submitted to auditor
            </Button>
          )}
          {auditStage === 'submitted' && (
            <Button size="sm" disabled={busy} onClick={() => advanceTo('scheduled')}>
              Mark audit scheduled
            </Button>
          )}
          {auditStage === 'scheduled' && (
            <Button size="sm" disabled={busy} onClick={() => advanceTo('in_progress')}>
              Mark audit in progress
            </Button>
          )}
          {auditStage === 'in_progress' && (
            <Button size="sm" disabled={busy} onClick={() => advanceTo('certified')}>
              Record final determination
            </Button>
          )}
        </div>

        {ecgtMessage && (
          <div
            className={`rounded-md border p-3 text-sm ${
              ecgtMessage.before
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
            }`}
          >
            {ecgtMessage.before ? (
              <p>
                You have submitted before the ECGT deadline. Once your
                certification is approved, you will be authorised to use the B
                Corp logo under the ECGT Directive.
              </p>
            ) : (
              <p>
                You have submitted after the ECGT deadline. You may need to
                pause use of the B Corp logo until recertification is approved.
                Consult B Lab&apos;s guidance.
              </p>
            )}
            <a
              href={ECGT_GUIDANCE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-medium underline"
            >
              B Lab guidance
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
