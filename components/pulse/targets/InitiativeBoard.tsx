'use client';

import { useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  canTransition,
  INITIATIVE_STATUSES,
  type InitiativeAction,
  type InitiativeStatus,
} from '@/lib/pulse/initiative-status';
import { ABATEMENT_LEVERS } from '@/lib/pulse/abatement-costs';
import type { Initiative } from './types';

const STATUS_ORDER: InitiativeStatus[] = ['pending_approval', 'active', 'draft', 'completed', 'cancelled'];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400',
  pending_approval: 'bg-amber-500/15 text-amber-500',
  active: 'bg-[#ccff00]/15 text-[#9bbf00] dark:text-[#ccff00]',
  completed: 'bg-green-500/15 text-green-500',
  cancelled: 'bg-red-500/15 text-red-400',
};

interface InitiativeBoardProps {
  initiatives: Initiative[];
  viewerRole: string | null;
  viewerUserId: string | null;
  onEdit: (initiative: Initiative) => void;
  onChanged: () => Promise<void> | void;
}

/**
 * Action plan list grouped by status, with the approval workflow controls
 * and inline progress updates. Button visibility mirrors canTransition();
 * the API and a database trigger enforce the same rules server-side.
 */
export function InitiativeBoard({ initiatives, viewerRole, viewerUserId, onEdit, onChanged }: InitiativeBoardProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState('');
  const [progressNote, setProgressNote] = useState('');

  const isAdmin = ['owner', 'admin'].includes((viewerRole || '').toLowerCase());

  async function transition(id: string, action: InitiativeAction, reason?: string) {
    setBusyId(id);
    const res = await fetch('/api/pulse/initiatives/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, reason }),
    });
    if (res.ok) await onChanged();
    setBusyId(null);
    setRejectingId(null);
    setRejectReason('');
  }

  async function saveProgress(id: string) {
    setBusyId(id);
    const res = await fetch('/api/pulse/initiatives', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        percent_complete: Math.max(0, Math.min(100, Number(progressPct) || 0)),
        progress_notes: progressNote || null,
      }),
    });
    if (res.ok) await onChanged();
    setBusyId(null);
    setProgressFor(null);
    setProgressPct('');
    setProgressNote('');
  }

  async function deleteInitiative(id: string) {
    setBusyId(id);
    await fetch(`/api/pulse/initiatives?id=${id}`, { method: 'DELETE' });
    await onChanged();
    setBusyId(null);
  }

  if (initiatives.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No actions yet. Create one to turn your targets into a plan. Approved actions count
          towards your B Corp evidence.
        </CardContent>
      </Card>
    );
  }

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: initiatives.filter((i) => i.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {grouped.map(({ status, items }) => (
        <div key={status} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {INITIATIVE_STATUSES[status].label} ({items.length})
          </h3>
          <ul className="space-y-2">
            {items.map((i) => {
              const isOwner = Boolean(
                viewerUserId && (viewerUserId === i.owner_user_id || viewerUserId === i.created_by),
              );
              const lever = i.lever_id ? ABATEMENT_LEVERS.find((l) => l.id === i.lever_id) : null;
              const busy = busyId === i.id;

              return (
                <li key={i.id}>
                  <Card className="border-border/60">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{i.title}</p>
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_BADGE[i.status])}>
                              {INITIATIVE_STATUSES[i.status].label}
                            </span>
                            {lever && (
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {lever.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {[
                              i.owner_name || (i.owner_user_id ? 'Owner assigned' : 'No owner yet'),
                              i.start_date && i.end_date
                                ? `${i.start_date} to ${i.end_date}`
                                : 'No dates yet',
                              i.expected_annual_reduction_value
                                ? `expected ${i.expected_annual_reduction_value} ${i.expected_annual_reduction_unit ?? ''}`
                                : null,
                              i.budget_estimated_gbp
                                ? `~£${Number(i.budget_estimated_gbp).toLocaleString('en-GB')}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {i.status === 'draft' && i.rejection_reason && (
                            <p className="mt-1 text-xs text-red-400">
                              Sent back: {i.rejection_reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(i)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                              onClick={() => deleteInitiative(i.id)}
                              disabled={busy}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {(i.status === 'active' || i.status === 'completed') && (
                        <div className="flex items-center gap-3">
                          <Progress value={i.percent_complete} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground">{i.percent_complete}%</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {canTransition('submit', i.status, viewerRole, isOwner) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => transition(i.id, 'submit')}>
                            {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            Send for approval
                          </Button>
                        )}
                        {canTransition('approve', i.status, viewerRole, isOwner) && (
                          <Button size="sm" className="h-7 text-xs" disabled={busy} onClick={() => transition(i.id, 'approve')}>
                            {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            Approve
                          </Button>
                        )}
                        {canTransition('reject', i.status, viewerRole, isOwner) && (
                          <Popover open={rejectingId === i.id} onOpenChange={(o) => setRejectingId(o ? i.id : null)}>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-400 hover:text-red-500">
                                Send back
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 space-y-2">
                              <Label htmlFor={`reject-${i.id}`} className="text-xs">Why is it being sent back?</Label>
                              <Input
                                id={`reject-${i.id}`}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g. needs a budget first"
                              />
                              <Button size="sm" className="h-7 w-full text-xs" disabled={busy} onClick={() => transition(i.id, 'reject', rejectReason)}>
                                Send back to draft
                              </Button>
                            </PopoverContent>
                          </Popover>
                        )}
                        {i.status === 'active' && (
                          <Popover
                            open={progressFor === i.id}
                            onOpenChange={(o) => {
                              setProgressFor(o ? i.id : null);
                              if (o) {
                                setProgressPct(String(i.percent_complete));
                                setProgressNote('');
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs">
                                Update progress
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 space-y-2">
                              <Label htmlFor={`pct-${i.id}`} className="text-xs">How far along is it? (%)</Label>
                              <Input
                                id={`pct-${i.id}`}
                                type="number"
                                min={0}
                                max={100}
                                value={progressPct}
                                onChange={(e) => setProgressPct(e.target.value)}
                              />
                              <Label htmlFor={`note-${i.id}`} className="text-xs">Note (optional)</Label>
                              <Input
                                id={`note-${i.id}`}
                                value={progressNote}
                                onChange={(e) => setProgressNote(e.target.value)}
                                placeholder="e.g. contract signed with supplier"
                              />
                              <Button size="sm" className="h-7 w-full text-xs" disabled={busy} onClick={() => saveProgress(i.id)}>
                                Save progress
                              </Button>
                            </PopoverContent>
                          </Popover>
                        )}
                        {canTransition('complete', i.status, viewerRole, isOwner) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => transition(i.id, 'complete')}>
                            Mark completed
                          </Button>
                        )}
                        {canTransition('cancel', i.status, viewerRole, isOwner) && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={busy} onClick={() => transition(i.id, 'cancel')}>
                            Cancel action
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
