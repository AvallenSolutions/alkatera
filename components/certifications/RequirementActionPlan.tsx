'use client';

/**
 * Turn a B Corp requirement gap into an owned, dated action. Writes to
 * certification_gap_analyses via the gap-analysis API, so "who is doing what by
 * when" lives in one place across the cross-functional team.
 */

import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export interface RequirementAction {
  assigned_to?: string | null;
  target_completion_date?: string | null;
  action_required?: string | null;
  compliance_status?: string | null;
}

export function RequirementActionPlan({
  frameworkId,
  requirementId,
  initial,
  onSaved,
}: {
  frameworkId: string;
  requirementId: string;
  initial?: RequirementAction;
  onSaved?: () => void;
}) {
  const [owner, setOwner] = useState(initial?.assigned_to ?? '');
  const [due, setDue] = useState(initial?.target_completion_date ?? '');
  const [action, setAction] = useState(initial?.action_required ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/certifications/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework_id: frameworkId,
          requirement_id: requirementId,
          assigned_to: owner.trim() || null,
          target_completion_date: due || null,
          action_required: action.trim() || null,
          // Assigning an action means it's being worked on; preserve a real
          // status if one already exists.
          compliance_status: initial?.compliance_status ?? 'in_progress',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save action');
      }
      toast.success('Action saved');
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save action');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <UserPlus className="h-3.5 w-3.5 text-[#ccff00]" />
        Action plan
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Owner</Label>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. Sarah (People team)" disabled={saving} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Due date</Label>
          <Input type="date" value={due ?? ''} onChange={(e) => setDue(e.target.value)} disabled={saving} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Next action</Label>
        <Textarea value={action} onChange={(e) => setAction(e.target.value)} rows={2} placeholder="What needs doing to close this gap?" disabled={saving} />
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} loading={saving}>
          {!saving && <UserPlus className="mr-2 h-3.5 w-3.5" />}
          Save action
        </Button>
      </div>
    </div>
  );
}
