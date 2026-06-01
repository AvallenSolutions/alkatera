'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlkaTeraIcon, AlkaTeraWordmark } from '@/components/lca-report/Logo';

export default function ProcurementLoginPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const supabase = getSupabaseBrowserClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? 'Could not sign in.');
      setLoading(false);
      return;
    }

    // The (portal) layout does the authoritative procurement_members
    // lookup against this slug and bounces back here with an error
    // param if the user isn't a member of THIS procurement org.
    router.push(`/procurement/${slug}/dashboard`);
    router.refresh();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm p-7 sm:p-8 space-y-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/80 to-transparent" />

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-brand-primary bg-brand-primary/10 border border-brand-primary/30 rounded-full px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
          Procurement Portal
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Access your procurement sustainability portfolio.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-primary hover:bg-brand-strong text-brand-on font-semibold"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <Link
            href={`/procurement/${slug}/password-reset`}
            className="hover:text-brand-primary transition-colors"
          >
            Forgot password?
          </Link>
        </div>
      </form>

      <div className="pt-4 border-t border-border/60 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <span>Powered by</span>
        <AlkaTeraIcon className="h-3.5 w-3.5 text-neon-emerald" />
        <span className="text-sm font-light text-foreground tracking-tight lowercase">
          alka<strong className="font-semibold">tera</strong>
        </span>
      </div>
    </div>
  );
}
