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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ClarificationRequest {
  id: string;
  description: string;
  raised_by: string | null;
  response: string | null;
  status: 'open' | 'responded' | 'resolved';
  created_at: string;
}

export function ClarificationRequests({
  onCountChange,
}: {
  onCountChange?: (open: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ClarificationRequest[]>([]);
  const [creating, setCreating] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newRaisedBy, setNewRaisedBy] = useState('');
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>(
    {},
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certifications/clarifications');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRequests(data.requests ?? []);
      onCountChange?.(data.openCount ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!newDesc.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/certifications/clarifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newDesc,
          raised_by: newRaisedBy || undefined,
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      setNewDesc('');
      setNewRaisedBy('');
      await load();
    } catch (err) {
      console.error(err);
      toast.error('Could not create request');
    } finally {
      setCreating(false);
    }
  };

  const respond = async (id: string, resolve = false) => {
    setBusyId(id);
    try {
      await fetch('/api/certifications/clarifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          response: responseDraft[id] ?? '',
          status: resolve ? 'resolved' : 'responded',
        }),
      });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const open = requests.filter((r) => r.status === 'open');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Clarification Requests
          {open.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {open.length} open
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Track and respond to auditor clarification requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="cl-desc">Log a clarification request</Label>
          <Textarea
            id="cl-desc"
            rows={2}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="What did the auditor ask for?"
          />
          <Input
            value={newRaisedBy}
            onChange={(e) => setNewRaisedBy(e.target.value)}
            placeholder="Raised by (auditor name or reference)"
          />
          <Button size="sm" disabled={creating || !newDesc.trim()} onClick={create}>
            <Plus className="mr-1 h-4 w-4" />
            Add request
          </Button>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clarification requests yet.
          </p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {r.raised_by ? `${r.raised_by}: ` : ''}
                  {r.description}
                </span>
                <Badge
                  className={
                    r.status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : r.status === 'responded'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }
                >
                  {r.status}
                </Badge>
              </div>
              {r.response && (
                <p className="text-xs text-muted-foreground">
                  Response: {r.response}
                </p>
              )}
              {r.status !== 'resolved' && (
                <div className="space-y-2">
                  <Textarea
                    rows={2}
                    value={responseDraft[r.id] ?? r.response ?? ''}
                    onChange={(e) =>
                      setResponseDraft((d) => ({
                        ...d,
                        [r.id]: e.target.value,
                      }))
                    }
                    placeholder="Write a response..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => respond(r.id, false)}
                    >
                      Save response
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => respond(r.id, true)}
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
