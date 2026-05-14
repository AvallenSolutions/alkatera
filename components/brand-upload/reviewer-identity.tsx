'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, Pencil, UserCircle2 } from 'lucide-react';

export interface ReviewerIdentity {
  name: string;
  email: string;
}

const STORAGE_KEY = 'alkatera.brand-upload.reviewer';
const CHANGE_EVENT = 'alkatera.brand-upload.reviewer-changed';

export function isValidIdentity(value: ReviewerIdentity | null): value is ReviewerIdentity {
  if (!value) return false;
  if (value.name.trim().length < 2) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim());
}

export function readStoredReviewer(): ReviewerIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewerIdentity;
    return isValidIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The identity hook is used in two sibling components (the identity
 * card and the document upload form), so we publish a custom event on
 * every change to keep them in sync without lifting state up to a
 * provider that would force the page to become a client component.
 */
export function useStoredReviewer(): [
  ReviewerIdentity | null,
  (next: ReviewerIdentity | null) => void,
] {
  const [identity, setIdentity] = useState<ReviewerIdentity | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIdentity(readStoredReviewer());
    function onChange(e: Event) {
      const detail = (e as CustomEvent<ReviewerIdentity | null>).detail ?? null;
      setIdentity(detail && isValidIdentity(detail) ? detail : null);
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  function update(next: ReviewerIdentity | null) {
    setIdentity(next);
    if (typeof window === 'undefined') return;
    if (next && isValidIdentity(next)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent<ReviewerIdentity | null>(CHANGE_EVENT, { detail: next }));
  }

  return [identity, update];
}

interface Props {
  identity: ReviewerIdentity | null;
  onChange: (next: ReviewerIdentity | null) => void;
}

/**
 * Collects the reviewer's name and email up front. We stamp every
 * verification with this so the distributor (and the audit trail) know
 * who answered. Persisted to localStorage so a brand can come back to
 * the same link without retyping.
 */
export function ReviewerIdentityCard({ identity, onChange }: Props) {
  const [editing, setEditing] = useState(!identity);
  const [name, setName] = useState(identity?.name ?? '');
  const [email, setEmail] = useState(identity?.email ?? '');

  useEffect(() => {
    if (!identity) setEditing(true);
  }, [identity]);

  function save() {
    const next = { name: name.trim(), email: email.trim() };
    if (!isValidIdentity(next)) return;
    onChange(next);
    setEditing(false);
  }

  if (!editing && identity) {
    return (
      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-card/40 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-lg bg-sky-500/15 p-2 shrink-0">
            <UserCircle2 className="h-5 w-5 text-sky-300" />
          </div>
          <div className="text-sm min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Reviewer
            </div>
            <div className="font-medium truncate">
              {identity.name}{' '}
              <span className="text-muted-foreground font-normal">· {identity.email}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
          onClick={() => {
            setName(identity.name);
            setEmail(identity.email);
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Change
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-card/40 p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-sky-500/15 p-2 shrink-0">
          <UserCircle2 className="h-5 w-5 text-sky-300" />
        </div>
        <div>
          <h3 className="text-base font-semibold">First, tell us who you are</h3>
          <p className="text-sm text-muted-foreground mt-1">
            We attach your name and email to anything you confirm or correct, so the distributor
            knows the data came from someone at the brand.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="reviewer-name">Your name</Label>
          <Input
            id="reviewer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anna Smith"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reviewer-email">Your work email</Label>
          <Input
            id="reviewer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anna@brand.com"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={!isValidIdentity({ name: name.trim(), email: email.trim() })}
          className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
        >
          <Check className="h-4 w-4 mr-1.5" /> Continue
        </Button>
      </div>
    </div>
  );
}
