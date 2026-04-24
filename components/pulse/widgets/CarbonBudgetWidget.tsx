'use client';

/**
 * Pulse -- Carbon budgets (F5).
 *
 * Lets admins set monthly / quarterly / annual carbon budgets and see the
 * current-period variance vs actual. Each row shows a traffic-light status:
 *   green  = under budget
 *   amber  = 0-10% over
 *   red    = more than 10% over
 *
 * Inline "Add budget" form with cadence + scope + number-of-tonnes. Delete
 * via trash icon per row. Owner/admin only (the API enforces it).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BudgetRow {
  id: string;
  scope: 'all' | 'scope_1' | 'scope_2' | 'scope_3';
  period: 'monthly' | 'quarterly' | 'annual';
  budget_tco2e: number;
  facility_id: string | null;
  notes: string | null;
  effective_from: string;
  current_period_start: string;
  actual_tco2e: number;
  variance_tco2e: number;
  variance_pct: number;
  status: 'on_track' | 'at_risk' | 'over';
}

interface ApiPayload {
  ok: boolean;
  budgets: BudgetRow[];
}

const PERIOD_LABELS: Record<BudgetRow['period'], string> = {
  monthly: 'This month',
  quarterly: 'This quarter',
  annual: 'This year',
};
const SCOPE_LABELS: Record<BudgetRow['scope'], string> = {
  all: 'All scopes',
  scope_1: 'Scope 1',
  scope_2: 'Scope 2',
  scope_3: 'Scope 3',
};

export function CarbonBudgetWidget() {
  const { currentOrganization, userRole } = useOrganization();
  const { toast } = useToast();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const canEdit = userRole === 'owner' || userRole === 'admin';

  const load = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pulse/carbon-budgets?organization_id=${currentOrganization.id}`,
      );
      const json = await res.json();
      if (res.ok) setData(json as ApiPayload);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    const res = await fetch(`/api/pulse/carbon-budgets?id=${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast({ title: 'Budget deleted' });
      void load();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: 'Delete failed', description: body.error, variant: 'destructive' });
    }
  };

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3 w-3 text-[#ccff00]" />
              Carbon budgets
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              Actual vs budget this period
            </h3>
          </div>
          {canEdit && !adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-3 w-3" />
              Add budget
            </Button>
          )}
        </header>

        {adding && canEdit && (
          <AddBudgetForm
            organizationId={currentOrganization!.id}
            onDone={() => {
              setAdding(false);
              void load();
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && data.budgets.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            No budgets set yet.{' '}
            {canEdit
              ? "Click 'Add budget' to set a monthly, quarterly or annual cap."
              : 'Ask your owner or admin to set one.'}
          </p>
        )}

        {!loading && data && data.budgets.length > 0 && (
          <ul className="space-y-2">
            {data.budgets.map(b => (
              <BudgetRowEl
                key={b.id}
                budget={b}
                canEdit={canEdit}
                onDelete={() => handleDelete(b.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetRowEl({
  budget,
  canEdit,
  onDelete,
}: {
  budget: BudgetRow;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const tone =
    budget.status === 'on_track'
      ? 'text-emerald-500'
      : budget.status === 'at_risk'
        ? 'text-amber-500'
        : 'text-red-500';
  const bar =
    budget.status === 'on_track'
      ? 'bg-emerald-500'
      : budget.status === 'at_risk'
        ? 'bg-amber-500'
        : 'bg-red-500';
  const actualPct =
    budget.budget_tco2e > 0
      ? Math.min(150, (budget.actual_tco2e / budget.budget_tco2e) * 100)
      : 0;

  const Icon =
    budget.status === 'on_track' ? CheckCircle2 : AlertTriangle;

  return (
    <li className="rounded-md border border-border/40 bg-card/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon className={cn('h-3.5 w-3.5', tone)} />
            {SCOPE_LABELS[budget.scope]} · {PERIOD_LABELS[budget.period]}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {budget.actual_tco2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t actual
            {' '}/ {budget.budget_tco2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t budgeted
            {budget.notes && ` · ${budget.notes}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold tabular-nums', tone)}>
            {budget.variance_pct >= 0 ? '+' : ''}
            {budget.variance_pct.toFixed(0)}%
          </span>
          {canEdit && (
            <button
              onClick={onDelete}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              title="Delete budget"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full', bar)}
          style={{ width: `${Math.min(100, actualPct)}%` }}
        />
        {actualPct > 100 && (
          <div
            className="absolute top-0 h-full bg-red-500/80"
            style={{
              left: '100%',
              width: `${actualPct - 100}%`,
            }}
          />
        )}
        {/* 100% marker line */}
        <div
          className="absolute top-0 h-full w-px bg-foreground/40"
          style={{ left: '100%' }}
        />
      </div>
    </li>
  );
}

function AddBudgetForm({
  organizationId,
  onDone,
  onCancel,
}: {
  organizationId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [scope, setScope] = useState<'all' | 'scope_1' | 'scope_2' | 'scope_3'>('all');
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('annual');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(budget);
    if (!Number.isFinite(val) || val <= 0) {
      toast({ title: 'Budget must be a positive number of tonnes', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pulse/carbon-budgets?organization_id=${organizationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          period,
          budget_tco2e: val,
          notes: notes.trim() || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Budget saved' });
        onDone();
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: 'Save failed', description: body.error, variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border border-[#ccff00]/40 bg-[#ccff00]/5 p-3"
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px]">
          <span className="mb-1 block font-medium uppercase tracking-wider text-muted-foreground">Scope</span>
          <select
            value={scope}
            onChange={e => setScope(e.target.value as typeof scope)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="all">All scopes</option>
            <option value="scope_1">Scope 1</option>
            <option value="scope_2">Scope 2</option>
            <option value="scope_3">Scope 3</option>
          </select>
        </label>
        <label className="text-[11px]">
          <span className="mb-1 block font-medium uppercase tracking-wider text-muted-foreground">Period</span>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as typeof period)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
        <label className="text-[11px]">
          <span className="mb-1 block font-medium uppercase tracking-wider text-muted-foreground">Budget (tCO₂e)</span>
          <input
            type="number"
            min={0}
            step="any"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="e.g. 500"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            required
          />
        </label>
      </div>
      <label className="text-[11px]">
        <span className="mb-1 block font-medium uppercase tracking-wider text-muted-foreground">Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Board-approved FY26 target"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={submitting}
          className="bg-[#ccff00] text-black hover:bg-[#b8e600]"
        >
          {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Save budget
        </Button>
      </div>
    </form>
  );
}
