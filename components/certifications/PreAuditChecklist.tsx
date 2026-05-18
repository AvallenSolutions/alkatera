'use client';

import { useEffect, useState, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Circle, AlertTriangle, Loader2 } from 'lucide-react';

interface Derived {
  foundationComplete: boolean;
  riskToolComplete: boolean;
  year0Complete: boolean;
  employeeCount: number | null;
}

interface ChecklistState {
  audit_provider?: string;
  size_band?: string;
  scope?: string;
}

interface PreAuditChecklistProps {
  onReadyChange: (ready: boolean) => void;
}

const SIZE_BANDS = ['1-9', '10-49', '50-249', '250+'];

export function PreAuditChecklist({ onReadyChange }: PreAuditChecklistProps) {
  const [loading, setLoading] = useState(true);
  const [derived, setDerived] = useState<Derived | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certifications/checklist');
      if (!res.ok) throw new Error('Failed to load checklist');
      const data = await res.json();
      setDerived(data.derived);
      const cl: ChecklistState = data.checklist ?? {};
      if (!cl.size_band && data.derived?.employeeCount != null) {
        const n = data.derived.employeeCount as number;
        cl.size_band =
          n >= 250 ? '250+' : n >= 50 ? '50-249' : n >= 10 ? '10-49' : '1-9';
      }
      setChecklist(cl);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(async (next: ChecklistState) => {
    setSaving(true);
    try {
      await fetch('/api/certifications/checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: next }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = (patch: Partial<ChecklistState>) => {
    const next = { ...checklist, ...patch };
    setChecklist(next);
    persist(next);
  };

  const sizeBandIsLarge =
    checklist.size_band === '50-249' || checklist.size_band === '250+';
  const providerMismatch =
    sizeBandIsLarge && checklist.audit_provider === 'To-Cert';

  const ready =
    !!derived &&
    derived.foundationComplete &&
    derived.riskToolComplete &&
    derived.year0Complete &&
    !!checklist.audit_provider &&
    !!checklist.size_band &&
    !!checklist.scope &&
    !providerMismatch;

  useEffect(() => {
    onReadyChange(ready);
  }, [ready, onReadyChange]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const autoItem = (label: string, done: boolean) => (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={done ? '' : 'text-muted-foreground'}>{label}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pre-Audit Checklist</CardTitle>
        <CardDescription>
          Complete each item before preparing your audit package.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {autoItem(
          'All Foundation Requirements passed',
          derived?.foundationComplete ?? false,
        )}
        {autoItem('Risk Tool completed', derived?.riskToolComplete ?? false)}
        {autoItem(
          'All Year 0 Impact Topic requirements passed',
          derived?.year0Complete ?? false,
        )}

        <div className="space-y-2 border-t pt-3">
          <Label>Audit provider</Label>
          <Select
            value={checklist.audit_provider ?? ''}
            onValueChange={(v) => update({ audit_provider: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select audit provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="To-Cert">To-Cert (all sizes)</SelectItem>
              <SelectItem value="SCS Global Services">
                SCS Global Services (required for 50+ workers)
              </SelectItem>
            </SelectContent>
          </Select>
          {providerMismatch && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Your organisation has 50 or more workers. You should use SCS
              Global Services rather than To-Cert.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Company size band</Label>
          <Select
            value={checklist.size_band ?? ''}
            onValueChange={(v) => update({ size_band: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select size band" />
            </SelectTrigger>
            <SelectContent>
              {SIZE_BANDS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b} workers
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {derived?.employeeCount != null && (
            <p className="text-xs text-muted-foreground">
              alkatera has {derived.employeeCount} workers on record.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scope">Certification scope (legal entities)</Label>
          <Input
            id="scope"
            value={checklist.scope ?? ''}
            onChange={(e) =>
              setChecklist((c) => ({ ...c, scope: e.target.value }))
            }
            onBlur={() => persist(checklist)}
            placeholder="e.g. Acme Drinks Ltd and subsidiaries"
          />
        </div>

        <div className="border-t pt-3 text-sm">
          {ready ? (
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              Checklist complete. You can prepare your audit package.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Complete all items to unlock the audit package export.
            </span>
          )}
          {saving && (
            <span className="ml-2 text-xs text-muted-foreground">Saving…</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
