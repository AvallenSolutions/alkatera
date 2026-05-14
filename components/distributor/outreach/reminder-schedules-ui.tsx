'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export interface ReminderScheduleRow {
  id: string;
  brand_profile_id: string | null;
  brand_name?: string | null;
  interval_days: number;
  max_reminders: number;
  active: boolean;
  created_at: string;
}

interface Props {
  initialSchedules: ReminderScheduleRow[];
  canEdit: boolean;
}

export function ReminderSchedulesUI({ initialSchedules, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialSchedules);
  const [intervalDays, setIntervalDays] = useState(14);
  const [maxReminders, setMaxReminders] = useState(3);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function createSchedule() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/distributor/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval_days: intervalDays,
          max_reminders: maxReminders,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        schedule?: ReminderScheduleRow;
        error?: string;
      };
      if (!res.ok || !body.schedule) {
        setFeedback({ type: 'err', text: `Could not create (${body.error ?? res.status}).` });
        return;
      }
      setRows((prev) => [body.schedule!, ...prev]);
      setFeedback({ type: 'ok', text: 'Reminder schedule created.' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: ReminderScheduleRow) {
    setBusy(true);
    try {
      const res = await fetch(`/api/distributor/reminders/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !row.active }),
      });
      if (!res.ok) {
        setFeedback({ type: 'err', text: 'Could not update schedule.' });
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: !r.active } : r)));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/distributor/reminders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setFeedback({ type: 'err', text: 'Could not delete schedule.' });
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-sky-400" />
              New reminder cadence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Every N days
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value || '14', 10)))}
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Max reminders
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxReminders}
                  onChange={(e) => setMaxReminders(Math.max(1, parseInt(e.target.value || '3', 10)))}
                  className="w-24"
                />
              </div>
              <Button
                onClick={createSchedule}
                disabled={busy}
                className="bg-sky-400 hover:bg-sky-300 text-black"
              >
                Add schedule
              </Button>
            </div>
            {feedback && (
              <div
                className={`text-xs mt-3 ${
                  feedback.type === 'ok' ? 'text-emerald-400' : 'text-destructive'
                }`}
              >
                {feedback.text}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Applies to every brand in your portfolio that's been sent an initial outreach but
              hasn't responded yet. Stops when a brand replies or reaches the max-reminder cap.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No reminder schedules yet. {canEdit && 'Add one above to automate follow-ups.'}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="py-3 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      Every {row.interval_days} day{row.interval_days === 1 ? '' : 's'} ·{' '}
                      up to {row.max_reminders} reminder{row.max_reminders === 1 ? '' : 's'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.brand_name ? `Brand: ${row.brand_name}` : 'Applies to all non-responding brands'} ·{' '}
                      created {new Date(row.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      row.active
                        ? 'text-emerald-300 border-emerald-500/30'
                        : 'text-muted-foreground border-muted'
                    }
                  >
                    {row.active ? 'Active' : 'Paused'}
                  </Badge>
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => toggleActive(row)}
                      >
                        {row.active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => remove(row.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
