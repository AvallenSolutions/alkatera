'use client';

/**
 * Events manager — create/edit episodic events (weddings, festivals, functions)
 * and see each one's footprint: attendee travel (modal split), temporary power
 * (generator + temporary grid) and catering carbon.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, PartyPopper, Trash2, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { EVENT_TYPES } from '@/lib/hospitality/event-service';
import { TRAVEL_MODE_LABELS, type TravelMode } from '@/lib/hospitality/travel-estimator';

interface EventRow {
  id: string;
  name: string;
  event_type: string;
  event_date_start: string | null;
  event_date_end: string | null;
  attendee_count: number;
  avg_distance_km: number;
  travel_split: Record<string, number>;
  generator_litres: number;
  temp_electricity_kwh: number;
  catering_co2e: number;
  country: string;
  status: string;
  footprint: {
    travel: { total_kg: number; per_attendee_kg: number; split_incomplete: boolean };
    temp_power_co2e: number;
    catering_co2e: number;
    total_co2e: number;
    per_attendee_co2e: number | null;
  };
}

const TRAVEL_MODES: TravelMode[] = ['car', 'train', 'bus', 'coach', 'motorcycle', 'cycle', 'walk', 'domestic_flight'];

function fmt(n: number, d = 1) {
  return n.toLocaleString('en-GB', { maximumFractionDigits: d });
}

const BLANK = {
  name: '', event_type: 'wedding', event_date_start: '', event_date_end: '',
  attendee_count: '', avg_distance_km: '', generator_litres: '', temp_electricity_kwh: '',
  catering_co2e: '', country: 'GB',
};

export function EventsManager() {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [split, setSplit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EventRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hospitality/events', { credentials: 'include' });
      if (res.ok) setEvents((await res.json()).events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...BLANK });
    setSplit({});
    setError(null);
    setOpen(true);
  };

  const openEdit = (e: EventRow) => {
    setEditId(e.id);
    setForm({
      name: e.name, event_type: e.event_type, event_date_start: e.event_date_start ?? '', event_date_end: e.event_date_end ?? '',
      attendee_count: String(e.attendee_count || ''), avg_distance_km: String(e.avg_distance_km || ''),
      generator_litres: String(e.generator_litres || ''), temp_electricity_kwh: String(e.temp_electricity_kwh || ''),
      catering_co2e: String(e.catering_co2e || ''), country: e.country || 'GB',
    });
    setSplit(Object.fromEntries(Object.entries(e.travel_split || {}).map(([k, v]) => [k, String(v)])));
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Give the event a name.'); return; }
    setBusy(true);
    setError(null);
    const travel_split: Record<string, number> = {};
    for (const [k, v] of Object.entries(split)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) travel_split[k] = n;
    }
    const body = {
      name: form.name.trim(), event_type: form.event_type,
      event_date_start: form.event_date_start || null, event_date_end: form.event_date_end || null,
      attendee_count: Number(form.attendee_count) || 0, avg_distance_km: Number(form.avg_distance_km) || 0,
      generator_litres: Number(form.generator_litres) || 0, temp_electricity_kwh: Number(form.temp_electricity_kwh) || 0,
      catering_co2e: Number(form.catering_co2e) || 0, country: form.country, travel_split,
    };
    try {
      const res = await fetch(editId ? `/api/hospitality/events/${editId}` : '/api/hospitality/events', {
        method: editId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save');
      setOpen(false);
      toast({ title: editId ? 'Event updated' : 'Event created' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await fetch(`/api/hospitality/events/${pendingDelete.id}`, { method: 'DELETE', credentials: 'include' });
    setEvents((prev) => prev.filter((e) => e.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Events</h2>
          <p className="text-sm text-muted-foreground">
            Weddings, festivals and functions — attendee travel, temporary power and catering in one per-event footprint.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New event</Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <PartyPopper className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No events yet</p>
          <p className="mb-4 text-sm text-muted-foreground">Add a wedding, festival or function to estimate its footprint.</p>
          <Button onClick={openCreate} variant="outline"><Plus className="mr-2 h-4 w-4" /> New event</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <div key={e.id} role="button" tabIndex={0} onClick={() => openEdit(e)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') openEdit(e); }}
              className="group flex cursor-pointer flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{e.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(ev) => { ev.stopPropagation(); setPendingDelete(e); }} aria-label="Delete event">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{e.event_type}</Badge>
                {e.event_date_start && <Badge variant="outline">{e.event_date_start}</Badge>}
                <Badge variant="outline">{fmt(e.attendee_count, 0)} attendees</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Leaf className="h-4 w-4 text-primary" />
                <span className="font-semibold">{fmt(e.footprint.total_co2e)} kg CO₂e</span>
                {e.footprint.per_attendee_co2e != null && (
                  <span className="text-muted-foreground">· {fmt(e.footprint.per_attendee_co2e, 2)} / attendee</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Travel {fmt(e.footprint.travel.total_kg)} · power {fmt(e.footprint.temp_power_co2e)} · catering {fmt(e.footprint.catering_co2e)} kg
                {e.footprint.travel.split_incomplete && ' · travel split ≠ 100%'}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit event' : 'New event'}</DialogTitle>
            <DialogDescription>Footprint = attendee travel + temporary power + catering.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ev-name">Name</Label>
              <Input id="ev-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer wedding" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ev-type">Type</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger id="ev-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-att">Attendees</Label>
                <Input id="ev-att" type="number" min="0" value={form.attendee_count} onChange={(e) => setForm({ ...form, attendee_count: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-start">Start</Label>
                <Input id="ev-start" type="date" value={form.event_date_start} onChange={(e) => setForm({ ...form, event_date_start: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-end">End</Label>
                <Input id="ev-end" type="date" value={form.event_date_end} onChange={(e) => setForm({ ...form, event_date_end: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Attendee travel</p>
              <div className="space-y-1">
                <Label htmlFor="ev-dist" className="text-xs">Average one-way distance (km)</Label>
                <Input id="ev-dist" type="number" min="0" value={form.avg_distance_km} onChange={(e) => setForm({ ...form, avg_distance_km: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">% of attendees by mode (should total 100)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TRAVEL_MODES.map((m) => (
                  <div key={m} className="space-y-1">
                    <Label htmlFor={`ev-mode-${m}`} className="text-[11px]">{TRAVEL_MODE_LABELS[m]}</Label>
                    <Input id={`ev-mode-${m}`} type="number" min="0" max="100" value={split[m] ?? ''} onChange={(e) => setSplit({ ...split, [m]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
              <p className="col-span-2 text-sm font-medium">Temporary power &amp; catering</p>
              <div className="space-y-1">
                <Label htmlFor="ev-gen" className="text-xs">Generator diesel (litres)</Label>
                <Input id="ev-gen" type="number" min="0" value={form.generator_litres} onChange={(e) => setForm({ ...form, generator_litres: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-elec" className="text-xs">Temp. grid electricity (kWh)</Label>
                <Input id="ev-elec" type="number" min="0" value={form.temp_electricity_kwh} onChange={(e) => setForm({ ...form, temp_electricity_kwh: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-cat" className="text-xs">Catering (kg CO₂e)</Label>
                <Input id="ev-cat" type="number" min="0" value={form.catering_co2e} onChange={(e) => setForm({ ...form, catering_co2e: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-country" className="text-xs">Grid country</Label>
                <Input id="ev-country" maxLength={3} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : editId ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this event?</DialogTitle>
            <DialogDescription>{pendingDelete ? `"${pendingDelete.name}" will be removed.` : ''}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
