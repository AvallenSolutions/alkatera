'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Briefcase,
  LogIn,
} from 'lucide-react';

const ALKATERA_LOGO = '/logo-cream.svg';

interface InvitationDetails {
  id: string;
  organization_name: string;
  advisor_email: string;
  access_notes: string | null;
  invited_at: string;
  expires_at: string;
  status: string;
  access_level: 'read_only' | 'read_write';
}

export default function AdvisorInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuthAndLoadInvitation() {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();

        // Load invitation via secure RPC function (bypasses RLS so
        // unauthenticated users can view their invitation by token)
        const { data: rpcResult, error: invError } = await supabase
          .rpc('get_advisor_invitation_by_token', { p_token: token });

        if (invError) {
          console.error('Failed to load invitation:', invError);
          setError('Invalid invitation link. The invitation may have been cancelled.');
          return;
        }

        const data = rpcResult as {
          id: string;
          advisor_email: string;
          access_notes: string | null;
          invited_at: string;
          expires_at: string;
          status: string;
          access_level: 'read_only' | 'read_write';
          organization_name: string;
        } | null;

        if (!data) {
          setError('Invitation not found.');
          return;
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired. Please ask the organisation to send a new one.');
          return;
        }

        // Check if already accepted
        if (data.status === 'accepted') {
          setError('This invitation has already been accepted.');
          return;
        }

        // Check if revoked
        if (data.status === 'revoked') {
          setError('This invitation has been cancelled by the organisation.');
          return;
        }

        // Handle auth state: if a different user is logged in, sign them out
        if (user) {
          if (user.email?.toLowerCase() === data.advisor_email.toLowerCase()) {
            setIsAuthenticated(true);
            setUserEmail(user.email || null);
          } else {
            // A different user is logged in — sign them out automatically
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            setUserEmail(null);
          }
        } else {
          setIsAuthenticated(false);
          setUserEmail(null);
        }

        setInvitation({
          id: data.id,
          organization_name: data.organization_name || 'Unknown Organization',
          advisor_email: data.advisor_email,
          access_notes: data.access_notes,
          invited_at: data.invited_at,
          expires_at: data.expires_at,
          status: data.status,
          access_level: data.access_level === 'read_only' ? 'read_only' : 'read_write',
        });
      } catch (err) {
        console.error('Error loading invitation:', err);
        setError('Failed to load invitation details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthAndLoadInvitation();
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!invitation) return;

    setIsAccepting(true);
    setError(null);

    try {
      const { data, error: acceptError } = await supabase.rpc('accept_advisor_invitation', {
        token: token,
      });

      if (acceptError) throw acceptError;

      const result = data as { success: boolean; error?: string; organization_id?: string };

      if (!result.success) {
        setError(result.error || 'Failed to accept invitation.');
        return;
      }

      // The OrganizationProvider lives in the root layout and only re-fetches its
      // org list when the user ID changes, so a plain client-side redirect would
      // land the advisor back on their previous org with the new one invisible in
      // the switcher. Make the newly-granted org active via the server-trusted
      // switch route, refresh the session so the JWT carries it, then do a
      // full-page navigation so the provider bootstraps a fresh session that both
      // includes and resolves to the org they just accepted.
      if (result.organization_id) {
        try {
          await fetch('/api/organizations/switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organization_id: result.organization_id }),
          });
          await supabase.auth.refreshSession();
        } catch (switchErr) {
          // Non-fatal: the access grant succeeded, so the org will still appear in
          // the switcher after the reload even if making it active failed here.
          console.error('Failed to set newly-accepted org as active:', switchErr);
        }
      }

      setSuccess(true);

      // Full-page navigation (not router.push) to force a fresh organisation
      // bootstrap that picks up the new advisor access.
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError('Failed to accept invitation. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignIn = () => {
    // Store the return URL and redirect to the auth page. New advisors can
    // toggle to "Sign up" there; on success they return here to accept.
    const returnUrl = `/advisor-invite/${token}`;
    router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen text-white">
        <Image
          src="/images/agave.jpg"
          alt="Agave plants"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <p className="text-[#F2F1EA]/70 font-mono text-sm uppercase tracking-[0.22em]">
              Loading invitation...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen text-white">
        <Image
          src="/images/agave.jpg"
          alt="Agave plants"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex justify-center">
              <img src={ALKATERA_LOGO} alt="alkatera" className="h-12 md:h-14 w-auto object-contain" />
            </div>

            <div className="border border-white/10 bg-white/5 backdrop-blur-md rounded-[6px] p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-[6px] bg-red-500/20 border border-red-500/30">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
                <h2 className="font-display font-bold tracking-tight text-2xl text-[#F2F1EA]">This invitation can&apos;t be opened.</h2>
              </div>

              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[6px] mb-6">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>

              <Link
                href="/"
                className="block w-full py-4 border border-[#F2F1EA]/40 text-[#F2F1EA] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full text-center hover:border-[#F2F1EA] transition-colors"
              >
                Return to home
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative min-h-screen text-white">
        <Image
          src="/images/agave.jpg"
          alt="Agave plants"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex justify-center">
              <img src={ALKATERA_LOGO} alt="alkatera" className="h-12 md:h-14 w-auto object-contain" />
            </div>

            <div className="border border-white/20 bg-white/5 backdrop-blur-md rounded-[6px] p-8 text-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="inline-flex p-4 rounded-full bg-white/10 border border-white/20 mb-6"
              >
                <CheckCircle2 className="h-10 w-10 text-[#F2F1EA]" />
              </motion.div>

              <h2 className="font-display font-bold tracking-tight text-3xl text-[#F2F1EA] mb-3">Invitation accepted.</h2>
              <p className="text-white/60 mb-6">
                You now have advisor access to <strong className="text-white">{invitation?.organization_name}</strong>.
                Taking you there now...
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // Check if the authenticated user's email matches the invitation
  const emailMismatch = isAuthenticated && userEmail &&
    userEmail.toLowerCase() !== invitation.advisor_email.toLowerCase();

  return (
    <div className="relative min-h-screen text-white">
      <Image
        src="/images/vineyard-autumn.jpg"
        alt="Autumn vineyard"
        fill
        className="object-cover"
        priority
        quality={85}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-lg"
        >
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img src={ALKATERA_LOGO} alt="alkatera" className="h-12 md:h-14 w-auto object-contain" />
          </div>

          {/* Hero headline */}
          <h1 className="font-display font-bold tracking-tight text-4xl md:text-5xl text-[#F2F1EA] text-center mb-4">
            You&apos;re invited.
          </h1>
          <p className="text-white/50 text-center mb-8">
            Become a sustainability advisor for {invitation.organization_name}
          </p>

          {/* Glassmorphism Card */}
          <div className="border border-white/10 bg-white/5 backdrop-blur-md rounded-[6px] p-8 space-y-6">
            {/* Organisation Info */}
            <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-[6px]">
              <div className="p-3 rounded-[6px] bg-white/10 border border-white/20">
                <Building2 className="h-6 w-6 text-[#F2F1EA]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">
                  Organisation
                </p>
                <p className="text-lg font-semibold text-white truncate">
                  {invitation.organization_name}
                </p>
              </div>
            </div>

            {/* Invitation Details */}
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-[6px]">
                <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
                  Invited Email
                </span>
                <span className="font-medium text-white truncate ml-3">{invitation.advisor_email}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 border border-white/10 rounded-[6px]">
                  <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">Sent</p>
                  <p className="font-medium text-white">
                    {new Date(invitation.invited_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-[6px]">
                  <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">Expires</p>
                  <p className="font-medium text-white">
                    {new Date(invitation.expires_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Access Notes */}
            {invitation.access_notes && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-[6px]">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
                  Message from the organisation
                </p>
                <p className="text-sm text-white/80">{invitation.access_notes}</p>
              </div>
            )}

            {/* What advisors can do (depends on the access level granted) */}
            <div className="p-4 bg-white/5 border border-white/20 rounded-[6px]">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-[#F2F1EA]" />
                <p className="text-sm font-medium text-white">
                  {invitation.access_level === 'read_only'
                    ? 'You have been granted read-only access. You will be able to:'
                    : 'You have been granted read & write access. You will be able to:'}
                </p>
              </div>
              <ul className="text-sm text-white/70 space-y-1.5">
                {(invitation.access_level === 'read_only'
                  ? ['View sustainability data and LCA assessments', 'Generate reports', 'Message the team with advice']
                  : [
                      'View and edit sustainability data',
                      'Create and manage LCA assessments',
                      'Generate and publish reports',
                      'View audit logs',
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#F2F1EA] flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[6px]">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Authentication & Accept */}
            {!isAuthenticated ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-[6px]">
                  <AlertCircle className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/70">
                    Sign in to accept this invitation, or create an account if you don&apos;t
                    have one yet. Either way, use the email address{' '}
                    <strong className="text-white">{invitation.advisor_email}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in or create account
                </button>
              </div>
            ) : emailMismatch ? (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[6px]">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">
                  This invitation was sent to <strong className="text-white">{invitation.advisor_email}</strong>, but you
                  are signed in as <strong className="text-white">{userEmail}</strong>. Please sign in with the correct
                  account.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAcceptInvitation}
                disabled={isAccepting}
                className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAccepting ? (
                  'Accepting...'
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Accept invitation
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
