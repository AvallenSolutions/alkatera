'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, CheckCircle2, AlertTriangle, Mail, Sparkles, FileText, Link2 } from 'lucide-react';

export interface NotificationRow {
  id: string;
  brand_profile_id: string | null;
  notification_type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Header-level bell with unread badge. Click opens a drawer showing
 * the most recent 20 notifications. Polls every 60 seconds while open
 * so newly-created notifications appear without a page refresh.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/distributor/notifications?limit=20');
      if (!res.ok) return;
      const body = (await res.json()) as { notifications: NotificationRow[]; unread_count: number };
      setItems(body.notifications ?? []);
      setUnread(body.unread_count ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [open]);

  async function markAllRead() {
    await fetch('/api/distributor/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
  }

  async function handleClick(n: NotificationRow) {
    if (!n.read_at) {
      await fetch('/api/distributor/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p)),
      );
    }
    if (n.link_url) {
      setOpen(false);
      router.push(n.link_url);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-sky-400 text-black text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="relative h-full w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-sm font-semibold">Notifications</div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs text-sky-300 hover:text-sky-300"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground text-center">Loading…</div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                  No notifications yet.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent/40 transition ${
                          !n.read_at ? 'bg-sky-400/5' : ''
                        }`}
                      >
                        <Icon type={n.notification_type} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`text-sm ${!n.read_at ? 'font-medium' : ''}`}>
                              {n.title}
                            </div>
                            {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
                          </div>
                          {n.body && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {n.body}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {formatRelative(n.created_at)}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Icon({ type }: { type: string }) {
  const cls = 'h-4 w-4 mt-0.5 shrink-0';
  switch (type) {
    case 'brand_joined_alkatera':
      return <Sparkles className={`${cls} text-sky-300`} />;
    case 'brand_tier_upgraded':
      return <CheckCircle2 className={`${cls} text-emerald-400`} />;
    case 'brand_data_updated':
      return <FileText className={`${cls} text-sky-300`} />;
    case 'new_document_submitted':
      return <FileText className={`${cls} text-sky-300`} />;
    case 'conflict_detected':
      return <AlertTriangle className={`${cls} text-amber-400`} />;
    case 'scraping_complete':
      return <Mail className={`${cls} text-muted-foreground`} />;
    case 'pending_match':
      return <Link2 className={`${cls} text-amber-400`} />;
    default:
      return <Bell className={`${cls} text-muted-foreground`} />;
  }
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
