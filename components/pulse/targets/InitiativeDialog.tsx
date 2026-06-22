'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ABATEMENT_LEVERS } from '@/lib/pulse/abatement-costs';
import { METRIC_DEFINITIONS } from '@/lib/pulse/metric-keys';
import type { Initiative, Target } from './types';
import { initiativeTargetIds } from './types';

interface MaccLever {
  id: string;
  label: string;
  annual_tonnes_abated: number;
  capex_gbp: number;
}

interface InitiativeDialogProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  targets: Target[];
  /** Existing initiative to edit, or null to create */
  initiative: Initiative | null;
  /** Pre-select these targets when creating */
  initialTargetIds?: string[];
  /** Pre-select this cost lever when creating (e.g. arriving from the MACC chart) */
  initialLeverId?: string | null;
  onSaved: () => Promise<void> | void;
}

/**
 * Create or edit a reduction initiative. Picking a cost lever prefills the
 * title, description, estimated budget and, when the organisation's own MACC
 * has data, the expected annual reduction. All prefills are editable and
 * labelled as estimates.
 */
export function InitiativeDialog({
  open,
  onClose,
  organizationId,
  targets,
  initiative,
  initialTargetIds = [],
  initialLeverId = null,
  onSaved,
}: InitiativeDialogProps) {
  const editing = Boolean(initiative);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maccLevers, setMaccLevers] = useState<MaccLever[] | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [leverId, setLeverId] = useState<string>('none');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [ownerName, setOwnerName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetEstimated, setBudgetEstimated] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [expectedUnit, setExpectedUnit] = useState('tCO2e per year');

  // Reset the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (initiative) {
      setTitle(initiative.title);
      setDescription(initiative.description ?? '');
      setLeverId(initiative.lever_id ?? 'none');
      setTargetIds(initiativeTargetIds(initiative));
      setOwnerName(initiative.owner_name ?? '');
      setStartDate(initiative.start_date ?? '');
      setEndDate(initiative.end_date ?? '');
      setBudgetEstimated(initiative.budget_estimated_gbp != null ? String(initiative.budget_estimated_gbp) : '');
      setExpectedValue(initiative.expected_annual_reduction_value != null ? String(initiative.expected_annual_reduction_value) : '');
      setExpectedUnit(initiative.expected_annual_reduction_unit ?? 'tCO2e per year');
    } else {
      setTitle('');
      setDescription('');
      setLeverId(initialLeverId ?? 'none');
      setTargetIds(initialTargetIds);
      setOwnerName('');
      setStartDate('');
      setEndDate('');
      setBudgetEstimated('');
      setExpectedValue('');
      setExpectedUnit('tCO2e per year');
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initiative?.id, initialLeverId]);

  // Org-specific MACC figures for prefills (best-effort).
  useEffect(() => {
    if (!open || maccLevers !== null) return;
    fetch(`/api/pulse/macc?organization_id=${organizationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setMaccLevers(body?.levers ?? []))
      .catch(() => setMaccLevers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizationId]);

  // Apply lever prefills when a lever is chosen on a fresh form (and when
  // arriving from the MACC chart with initialLeverId).
  function applyLever(id: string) {
    setLeverId(id);
    if (id === 'none') return;
    const lever = ABATEMENT_LEVERS.find((l) => l.id === id);
    if (!lever) return;
    if (!title) setTitle(lever.label);
    if (!description) setDescription(lever.description);
    const orgLever = (maccLevers ?? []).find((l) => l.id === id);
    if (orgLever) {
      if (!budgetEstimated && orgLever.capex_gbp > 0) setBudgetEstimated(String(Math.round(orgLever.capex_gbp)));
      if (!expectedValue && orgLever.annual_tonnes_abated > 0) {
        setExpectedValue(String(Math.round(orgLever.annual_tonnes_abated * 10) / 10));
        setExpectedUnit('tCO2e per year');
      }
    } else if (!budgetEstimated && lever.capexGbp > 0) {
      setBudgetEstimated(String(lever.capexGbp));
    }
  }

  // Apply the initial lever once MACC data lands (deep-link from the chart).
  useEffect(() => {
    if (open && !editing && initialLeverId && leverId === initialLeverId && maccLevers && !expectedValue) {
      applyLever(initialLeverId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maccLevers, open]);

  function toggleTarget(id: string) {
    setTargetIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function save() {
    if (!title.trim()) {
      setError('Give the action a title.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      title: title.trim(),
      description: description.trim() || null,
      lever_id: leverId === 'none' ? null : leverId,
      owner_name: ownerName.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      budget_estimated_gbp: budgetEstimated ? Number(budgetEstimated) : null,
      expected_annual_reduction_value: expectedValue ? Number(expectedValue) : null,
      expected_annual_reduction_unit: expectedValue ? expectedUnit : null,
      target_ids: targetIds,
    };

    const res = await fetch('/api/pulse/initiatives', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { ...payload, id: initiative!.id } : payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? `Failed (${res.status})`);
      setSaving(false);
      return;
    }
    await onSaved();
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit action' : 'New action'}</DialogTitle>
          <DialogDescription>
            A concrete project that works towards one or more of your targets.
            Approved actions count towards your B Corp evidence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Start from a cost lever (optional)</Label>
            <Select value={leverId} onValueChange={applyLever}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a lever" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No lever, start blank</SelectItem>
                {ABATEMENT_LEVERS.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Prefills figures from your cost curve. Estimates only, edit as needed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="init-title">Title</Label>
            <Input id="init-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Switch to renewable electricity" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="init-desc">Description (optional)</Label>
            <Textarea id="init-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Which targets does this work towards?</Label>
            <div className="flex flex-wrap gap-1.5">
              {targets.length === 0 ? (
                <p className="text-xs text-muted-foreground">No targets yet. Set a target first so this action counts towards it.</p>
              ) : (
                targets.map((t) => {
                  const def = METRIC_DEFINITIONS[t.metric_key];
                  const selected = targetIds.includes(t.id);
                  return (
                    <Badge
                      key={t.id}
                      variant={selected ? 'default' : 'outline'}
                      className="cursor-pointer select-none"
                      onClick={() => toggleTarget(t.id)}
                    >
                      {def?.label ?? t.metric_key} by {t.target_date?.slice(0, 4)}
                    </Badge>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="init-owner">Who is responsible?</Label>
              <Input id="init-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Sam (Operations)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="init-budget">Estimated budget (£)</Label>
              <Input id="init-budget" type="number" value={budgetEstimated} onChange={(e) => setBudgetEstimated(e.target.value)} placeholder="e.g. 25000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="init-start">Start date</Label>
              <Input id="init-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="init-end">Finish date</Label>
              <Input id="init-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="init-expected">Expected yearly reduction</Label>
              <Input id="init-expected" type="number" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder="e.g. 120" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="init-unit">Unit</Label>
              <Input id="init-unit" value={expectedUnit} onChange={(e) => setExpectedUnit(e.target.value)} placeholder="e.g. tCO₂e per year" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            B Corp tip: an approved action with an owner, a start date and a finish date counts as
            evidence of a time-bound reduction plan.
          </p>

          {error && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? 'Save changes' : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
