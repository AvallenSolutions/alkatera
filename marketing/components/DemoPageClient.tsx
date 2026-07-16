'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Video,
  BarChart3,
  ShieldCheck,
  Leaf,
} from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { Brand } from '@/components/shared/Brand';

type DaySlot = { startISO: string; endISO: string; time: string };
type DayGroup = { date: string; weekday: string; label: string; slots: DaySlot[] };
type Availability = { timeZone: string; slotMinutes: number; days: DayGroup[] };

const COVER = [
  {
    icon: BarChart3,
    title: 'Your footprint, mapped',
    body: 'A live look at how alkatera measures product and organisation impact beyond carbon, using your real data.',
  },
  {
    icon: ShieldCheck,
    title: 'Claims you can defend',
    body: 'How the platform stress-tests green claims so you can market with confidence and stay ahead of regulators.',
  },
  {
    icon: Leaf,
    title: 'Built for drinks',
    body: 'Purpose-built for distilleries, breweries, wineries and the brands they supply. No generic ESG bloat.',
  },
];

function BookingWidget() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<DaySlot | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmation, setConfirmation] = useState<{ when: string; joinUrl: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/demo/availability');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load availability.');
        if (cancelled) return;
        setAvailability(data);
        setActiveDate(data.days?.[0]?.date ?? null);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load availability.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/demo/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, notes, startISO: selected.startISO }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not complete the booking.');
      setConfirmation({ when: data.when, joinUrl: data.joinUrl });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not complete the booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeDay = availability?.days.find((d) => d.date === activeDate) ?? null;

  if (confirmation) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 px-6"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#ccff00]/10 text-[#ccff00] mb-8">
          <CheckCircle2 size={40} />
        </div>
        <h3 className="text-3xl font-serif text-white mb-3">You&apos;re booked in</h3>
        <p className="text-gray-300 text-lg mb-2">{confirmation.when} (UK time)</p>
        <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mb-8">
          A calendar invite is on its way to {email}
        </p>
        <a
          href={confirmation.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#ccff00] text-black font-mono uppercase tracking-widest text-sm px-8 py-4 hover:bg-white transition-colors"
        >
          <Video size={18} /> Join link
        </a>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="animate-spin mb-4 text-[#ccff00]" size={32} />
        <p className="font-mono text-xs uppercase tracking-widest">Loading available times</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-24 px-6">
        <p className="text-gray-400 mb-6">{loadError}</p>
        <a
          href="mailto:hello@alkatera.com?subject=Demo%20request"
          className="inline-flex items-center gap-2 border border-[#ccff00] text-[#ccff00] font-mono uppercase tracking-widest text-xs px-6 py-3 hover:bg-[#ccff00] hover:text-black transition-colors"
        >
          Email us instead <ArrowRight size={16} />
        </a>
      </div>
    );
  }

  if (!availability || availability.days.length === 0) {
    return (
      <div className="text-center py-24 px-6">
        <p className="text-gray-300 mb-2 text-lg font-serif">No slots open right now</p>
        <p className="text-gray-500 mb-6 text-sm">New times open every day. Or reach out directly:</p>
        <a
          href="mailto:hello@alkatera.com?subject=Demo%20request"
          className="inline-flex items-center gap-2 border border-[#ccff00] text-[#ccff00] font-mono uppercase tracking-widest text-xs px-6 py-3 hover:bg-[#ccff00] hover:text-black transition-colors"
        >
          Email us <ArrowRight size={16} />
        </a>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2">
      {/* Left: date + time picker */}
      <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/10">
        <div className="flex items-center gap-2 text-gray-500 font-mono text-[10px] uppercase tracking-widest mb-6">
          <Clock size={14} /> 30 minutes &bull; {availability.timeZone.replace('_', ' ')} &bull; video call
        </div>

        {/* Day selector */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-1 px-1">
          {availability.days.map((d) => {
            const active = d.date === activeDate;
            return (
              <button
                key={d.date}
                onClick={() => {
                  setActiveDate(d.date);
                  setSelected(null);
                }}
                className={`flex-shrink-0 text-center px-4 py-3 border transition-colors ${
                  active
                    ? 'border-[#ccff00] bg-[#ccff00]/10 text-white'
                    : 'border-white/10 text-gray-400 hover:border-white/30'
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest">{d.weekday.slice(0, 3)}</div>
                <div className="text-sm mt-1">{d.label}</div>
              </button>
            );
          })}
        </div>

        {/* Slots */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {activeDay?.slots.map((s) => {
            const active = selected?.startISO === s.startISO;
            return (
              <button
                key={s.startISO}
                onClick={() => setSelected(s)}
                className={`py-3 text-sm font-mono border transition-colors ${
                  active
                    ? 'border-[#ccff00] bg-[#ccff00] text-black'
                    : 'border-white/15 text-gray-200 hover:border-[#ccff00] hover:text-[#ccff00]'
                }`}
              >
                {s.time}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: details form */}
      <div className="p-8 md:p-10">
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-center py-12"
            >
              <CalendarClock size={40} className="text-gray-700 mb-4" />
              <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">
                Pick a time to continue
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              onSubmit={handleSubmit}
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#ccff00] mb-1">
                Selected time
              </p>
              <p className="text-white text-lg mb-8">
                {activeDay?.weekday}, {activeDay?.label} &bull; {selected.time}
              </p>

              <div className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border border-white/15 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#ccff00] transition-colors"
                />
                <input
                  type="email"
                  required
                  placeholder="Work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border border-white/15 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#ccff00] transition-colors"
                />
                <input
                  type="text"
                  placeholder="Company (optional)"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-transparent border border-white/15 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#ccff00] transition-colors"
                />
                <textarea
                  placeholder="Anything you'd like to focus on? (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-transparent border border-white/15 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#ccff00] transition-colors resize-none"
                />
              </div>

              {submitError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/40 text-red-400 text-sm">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full bg-[#ccff00] text-black font-bold py-4 flex items-center justify-between px-6 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="font-mono uppercase tracking-widest text-sm">
                  {submitting ? 'Booking...' : 'Confirm booking'}
                </span>
                {submitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DemoPageClient() {
  return (
    <div className="bg-[#050505] text-white min-h-screen">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-40 pb-16 px-6 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#ccff00] mb-6">
            30-minute demo
          </p>
          <h1 className="text-4xl md:text-6xl font-serif leading-tight mb-6">
            See <Brand /> in <span className="italic text-[#ccff00]">action</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            A focused half-hour with our team. No slides for the sake of slides. We&apos;ll show you the
            platform against your world and answer whatever you throw at us.
          </p>
        </div>
      </section>

      {/* What we'll cover */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {COVER.map((c) => (
            <div key={c.title} className="border border-white/10 p-8 bg-white/[0.02]">
              <c.icon size={24} className="text-[#ccff00] mb-5" />
              <h3 className="font-serif text-xl mb-3">{c.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Booking widget */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="border border-white/10 bg-[#0a0a0a]">
            <BookingWidget />
          </div>
          <p className="text-center text-gray-600 text-xs font-mono uppercase tracking-widest mt-6">
            Prefer email? Reach us at{' '}
            <a href="mailto:hello@alkatera.com" className="text-[#ccff00] hover:text-white">
              hello@alkatera.com
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
