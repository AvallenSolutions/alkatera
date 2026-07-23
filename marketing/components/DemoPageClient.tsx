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
import {
  SiteNav,
  SiteFooter,
  F_STATEMENT,
  F_BODY,
  F_MONO,
  MONO_LABEL,
} from '@/marketing/shared/chrome';

// Studio ground tokens (the marketing palette, inlined like the rest of the site).
const PAPER = '#ECEAE3';
const CREAM = '#F2F1EA';
const INK = '#1A1B1D';
const FOREST = '#205E40';
const DIM = '#6F6F68';
const HAIR = '#D9D6CB';
const STALE = '#BE123C';

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: PAPER,
  border: `1px solid ${HAIR}`,
  borderRadius: 4,
  padding: '11px 14px',
  color: INK,
  fontFamily: F_BODY,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

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
        style={{ textAlign: 'center', padding: '48px 24px' }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 999,
            background: 'rgba(32,94,64,0.1)',
            color: FOREST,
            marginBottom: 28,
          }}
        >
          <CheckCircle2 size={38} />
        </div>
        <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 28, color: INK, margin: '0 0 10px' }}>
          You&apos;re booked in
        </h3>
        <p style={{ fontFamily: F_BODY, fontSize: 17, color: INK, margin: '0 0 6px' }}>
          {confirmation.when} (UK time)
        </p>
        <p style={{ ...MONO_LABEL, color: DIM, margin: '0 0 28px' }}>
          A calendar invite is on its way to {email}
        </p>
        <a
          href={confirmation.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: INK,
            color: CREAM,
            fontFamily: F_MONO,
            fontWeight: 700,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            padding: '14px 28px',
            borderRadius: 999,
            textDecoration: 'none',
          }}
        >
          <Video size={18} /> Join link
        </a>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 0', color: DIM }}>
        <Loader2 className="animate-spin" style={{ marginBottom: 16, color: FOREST }} size={30} />
        <p style={{ ...MONO_LABEL, color: DIM }}>Loading available times</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ textAlign: 'center', padding: '96px 24px' }}>
        <p style={{ fontFamily: F_BODY, color: DIM, margin: '0 0 24px' }}>{loadError}</p>
        <a
          href="mailto:hello@alkatera.com?subject=Demo%20request"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${INK}`,
            color: INK, fontFamily: F_MONO, fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
            letterSpacing: '0.14em', padding: '11px 22px', borderRadius: 999, textDecoration: 'none',
          }}
        >
          Email us instead <ArrowRight size={16} />
        </a>
      </div>
    );
  }

  if (!availability || availability.days.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '96px 24px' }}>
        <p style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 18, color: INK, margin: '0 0 6px' }}>
          No slots open right now
        </p>
        <p style={{ fontFamily: F_BODY, fontSize: 14, color: DIM, margin: '0 0 24px' }}>
          New times open every day. Or reach out directly:
        </p>
        <a
          href="mailto:hello@alkatera.com?subject=Demo%20request"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${INK}`,
            color: INK, fontFamily: F_MONO, fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
            letterSpacing: '0.14em', padding: '11px 22px', borderRadius: 999, textDecoration: 'none',
          }}
        >
          Email us <ArrowRight size={16} />
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {/* Left: date + time picker */}
      <div style={{ padding: 36, borderBottom: `1px solid ${HAIR}` }} className="demo-picker">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DIM, ...MONO_LABEL, marginBottom: 24 }}>
          <Clock size={14} /> 30 minutes &bull; {availability.timeZone.replace('_', ' ')} &bull; video call
        </div>

        {/* Day selector */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 24 }}>
          {availability.days.map((d) => {
            const active = d.date === activeDate;
            return (
              <button
                key={d.date}
                onClick={() => {
                  setActiveDate(d.date);
                  setSelected(null);
                }}
                style={{
                  flexShrink: 0, textAlign: 'center', padding: '10px 16px', borderRadius: 4, cursor: 'pointer',
                  background: active ? 'rgba(32,94,64,0.08)' : 'transparent',
                  border: `1px solid ${active ? FOREST : HAIR}`,
                  color: active ? INK : DIM,
                }}
              >
                <div style={{ ...MONO_LABEL }}>{d.weekday.slice(0, 3)}</div>
                <div style={{ fontFamily: F_BODY, fontSize: 14, marginTop: 4 }}>{d.label}</div>
              </button>
            );
          })}
        </div>

        {/* Slots */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
          {activeDay?.slots.map((s) => {
            const active = selected?.startISO === s.startISO;
            return (
              <button
                key={s.startISO}
                onClick={() => setSelected(s)}
                style={{
                  padding: '11px 0', fontFamily: F_MONO, fontSize: 13, borderRadius: 4, cursor: 'pointer',
                  background: active ? FOREST : 'transparent',
                  border: `1px solid ${active ? FOREST : HAIR}`,
                  color: active ? CREAM : INK,
                }}
              >
                {s.time}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: details form */}
      <div style={{ padding: 36 }}>
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 0' }}
            >
              <CalendarClock size={38} style={{ color: HAIR, marginBottom: 16 }} />
              <p style={{ ...MONO_LABEL, color: DIM }}>Pick a time to continue</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              onSubmit={handleSubmit}
            >
              <p style={{ ...MONO_LABEL, color: FOREST, margin: '0 0 4px' }}>Selected time</p>
              <p style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 18, color: INK, margin: '0 0 28px' }}>
                {activeDay?.weekday}, {activeDay?.label} &bull; {selected.time}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input type="text" required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                <input type="email" required placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} />
                <textarea placeholder="Anything you'd like to focus on? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
              </div>

              {submitError && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 4, background: 'rgba(190,18,60,0.08)', border: `1px solid ${STALE}`, color: STALE, fontFamily: F_BODY, fontSize: 14 }}>
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mkt-btn"
                style={{
                  marginTop: 24, width: '100%', background: INK, color: CREAM, border: 'none',
                  borderRadius: 999, padding: '15px 24px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                <span style={{ fontFamily: F_MONO, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 13 }}>
                  {submitting ? 'Booking…' : 'Confirm booking'}
                </span>
                {submitting ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
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
    <div style={{ background: PAPER, color: INK, minHeight: '100vh' }}>
      <SiteNav />

      {/* Hero */}
      <section style={{ position: 'relative', paddingTop: 148, paddingBottom: 56, paddingInline: 24, overflow: 'hidden' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3em', color: FOREST, margin: '0 0 24px' }}>
            30-minute demo
          </p>
          <h1 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px, 6vw, 62px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: INK, margin: '0 0 24px' }}>
            See{' '}
            <span>
              <span style={{ fontWeight: 500 }}>alka</span>
              <span style={{ fontWeight: 700 }}>tera</span>
            </span>{' '}
            in <span style={{ color: FOREST }}>action</span>
          </h1>
          <p style={{ fontFamily: F_BODY, fontSize: 18, lineHeight: 1.6, color: DIM, maxWidth: 620, margin: '0 auto' }}>
            A focused half-hour with our team. No slides for the sake of slides. We&apos;ll show you the
            platform against your world and answer whatever you throw at us.
          </p>
        </div>
      </section>

      {/* What we'll cover */}
      <section style={{ paddingInline: 24, paddingBottom: 80 }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {COVER.map((c) => (
            <div key={c.title} style={{ border: `1px solid ${HAIR}`, borderRadius: 6, padding: 32, background: CREAM }}>
              <c.icon size={24} style={{ color: FOREST, marginBottom: 20 }} />
              <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 20, color: INK, margin: '0 0 12px' }}>{c.title}</h3>
              <p style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: DIM, margin: 0 }}>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Booking widget */}
      <section style={{ paddingInline: 24, paddingBottom: 64 }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ border: `1px solid ${HAIR}`, borderRadius: 6, background: CREAM, overflow: 'hidden' }}>
            <BookingWidget />
          </div>
          <p style={{ textAlign: 'center', ...MONO_LABEL, color: DIM, marginTop: 24 }}>
            Prefer email? Reach us at{' '}
            <a href="mailto:hello@alkatera.com" style={{ color: FOREST, textDecoration: 'none' }}>
              hello@alkatera.com
            </a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
