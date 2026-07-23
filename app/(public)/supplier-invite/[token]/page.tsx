'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Package,
  Eye,
  EyeOff,
  Leaf,
  ArrowRight,
  Quote,
} from 'lucide-react';

interface InvitationDetails {
  invitation_id: string;
  organization_name: string;
  supplier_email: string;
  supplier_name: string | null;
  contact_person_name: string | null;
  material_name: string | null;
  material_type: string | null;
  personal_message: string | null;
  inviter_name: string | null;
  invited_at: string;
  expires_at: string;
  is_valid: boolean;
  request_kind?: string;
}

export default function SupplierInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [existingUser, setExistingUser] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  // Email of a *different* account already signed in this browser. We surface a
  // switch-account prompt rather than silently signing them out (which would log
  // a brand user out of the main app in the same browser).
  const [mismatchedUserEmail, setMismatchedUserEmail] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const logoUrl = '/logo-cream.svg';

  // Where to land the supplier after accepting. An ESG survey invitation deep-links
  // straight into the assessment; everything else lands on the portal home.
  const destinationFor = (result: { request_kind?: string } | null | undefined): string =>
    result?.request_kind === 'esg_assessment'
      ? '/supplier-portal/esg-assessment'
      : '/supplier-portal';

  useEffect(() => {
    async function loadInvitation() {
      try {
        // Check if user is already authenticated
        const { data: { user } } = await supabase.auth.getUser();

        // Load invitation details via API route (bypasses RLS)
        const response = await fetch(`/api/supplier-invite/details?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load invitation details.');
          return;
        }

        if (!data.is_valid) {
          if (new Date(data.expires_at) < new Date()) {
            setError('This invitation has expired. Please contact the company that invited you for a new invitation.');
          } else {
            setError('This invitation is no longer valid. It may have already been accepted.');
          }
          return;
        }

        // If user is logged in, check if their email matches the invitation.
        if (user) {
          if (user.email?.toLowerCase() === data.supplier_email.toLowerCase()) {
            setExistingUser(true);
          } else {
            // A different account is signed in (e.g. the inviting brand, who is
            // CC'd on the email). Do NOT auto sign them out — that would clear
            // their main-app session in this browser. Offer an explicit choice.
            setMismatchedUserEmail(user.email ?? 'another account');
          }
        }

        setInvitation(data);
      } catch (err) {
        console.error('Error loading invitation:', err);
        setError('Failed to load invitation details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  // Explicitly sign out the currently-signed-in (different) account so the
  // supplier can sign up / sign in with the invitation email. Only runs when
  // the user clicks the button, never automatically.
  const handleSwitchAccount = async () => {
    setIsSubmitting(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setMismatchedUserEmail(null);
      setExistingUser(false);
      setIsSubmitting(false);
    }
  };

  const handleAcceptAsExistingUser = async () => {
    if (!invitation) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to accept this invitation.');
        return;
      }

      const response = await fetch('/api/supplier-invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          user_id: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      // Refresh session to pick up is_supplier metadata set by the accept API
      await supabase.auth.refreshSession();

      setSuccess(true);
      setTimeout(() => {
        window.location.href = destinationFor(result);
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.supplier_email,
        password: signInPassword,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in failed');

      // Now accept the invitation
      const response = await fetch('/api/supplier-invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          user_id: user.id,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      // Refresh session to pick up is_supplier metadata set by the accept API
      await supabase.auth.refreshSession();

      setSuccess(true);
      setTimeout(() => {
        window.location.href = destinationFor(result);
      }, 2000);
    } catch (err) {
      console.error('Error signing in:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validatePassword = (pw: string) => {
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
    return null;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Create account directly via Supabase Auth (password never sent to our API)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.supplier_email,
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (!signUpData.user) {
        throw new Error('Failed to create account');
      }

      // Step 2: Accept the invitation via API (no password sent, just user_id + token)
      const response = await fetch('/api/supplier-invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          user_id: signUpData.user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      // Step 3: Sign in (signUp may auto-sign-in depending on config, but be explicit)
      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: invitation.supplier_email,
          password: password,
        });

        if (signInError) {
          console.error('Error signing in after account creation:', signInError);
        }
      }

      // Refresh session to pick up is_supplier metadata set by the accept API
      await supabase.auth.refreshSession();

      setSuccess(true);
      setTimeout(() => {
        window.location.href = destinationFor(result);
      }, 2000);
    } catch (err) {
      console.error('Error creating account:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysUntilExpiry = invitation
    ? Math.ceil((new Date(invitation.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // ESG survey invitations get tailored copy and CTA labels.
  const isEsgSurvey = invitation?.request_kind === 'esg_assessment';
  const acceptLabel = isEsgSurvey ? 'Accept & start survey' : 'Accept & Join';
  const signInLabel = isEsgSurvey ? 'Sign in & start survey' : 'Sign In & Accept';
  const createLabel = isEsgSurvey ? 'Create account & start survey' : 'Create Account & Accept';

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="relative min-h-screen text-white">
        <Image src="/images/supplier-invite.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-center">
            <p className="text-[#F2F1EA]/70 font-mono text-sm uppercase tracking-[0.22em]">Loading invitation...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Error (no invitation) ────────────────────────────────────
  if (error && !invitation) {
    return (
      <div className="relative min-h-screen text-white">
        <Image src="/images/supplier-invite.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md">
            <div className="mb-8 flex justify-center">
              <img src={logoUrl} alt="alkatera" className="h-12 md:h-14 w-auto object-contain" />
            </div>
            <div className="border border-white/10 bg-white/5 backdrop-blur-xl rounded-[6px] p-8">
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
              <a href="mailto:hello@alkatera.com" className="block w-full py-4 border border-[#F2F1EA]/40 text-[#F2F1EA] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full text-center hover:border-[#F2F1EA] transition-colors">
                Contact support
              </a>
            </div>
          </motion.div>
          <p className="absolute bottom-4 text-white/30 text-xs">
            Photo by <a href="https://unsplash.com/@supergios" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50">Jonny Gios</a> on Unsplash
          </p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────
  if (success) {
    return (
      <div className="relative min-h-screen text-white">
        <Image src="/images/supplier-invite.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
            <div className="mb-8 flex justify-center">
              <img src={logoUrl} alt="alkatera" className="h-12 md:h-14 w-auto object-contain" />
            </div>
            <div className="border border-white/20 bg-white/5 backdrop-blur-xl rounded-[6px] p-8 text-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
                <CheckCircle2 className="h-16 w-16 text-[#F2F1EA] mx-auto mb-4" />
              </motion.div>
              <h2 className="font-display font-bold tracking-tight text-2xl text-[#F2F1EA] mb-2">Welcome aboard.</h2>
              <p className="text-white/60 text-sm">You&apos;ve joined as a supplier. Taking you to your portal...</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Main invitation page ─────────────────────────────────────
  return (
    <div className="relative min-h-screen text-white">
      <Image src="/images/supplier-invite.jpg" alt="" fill className="object-cover" priority quality={85} />
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
            <img src={logoUrl} alt="alkatera" className="h-12 md:h-14 w-auto object-contain" />
          </div>

          {/* Main card */}
          <div className="border border-white/10 bg-white/5 backdrop-blur-xl rounded-[6px] p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="font-display font-bold tracking-tight text-3xl text-[#F2F1EA]">You&apos;re invited.</h1>
              <p className="text-white/60 text-sm">
                {isEsgSurvey ? (
                  <>
                    <strong className="text-white">{invitation?.organization_name}</strong> has invited you to complete a short sustainability survey (ESG self-assessment) on alka<strong className="text-white">tera</strong>
                  </>
                ) : (
                  <>
                    <strong className="text-white">{invitation?.organization_name}</strong> has invited you to join alkatera and share your sustainability data
                  </>
                )}
              </p>
            </div>

            {/* Organisation & material info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-[6px] bg-white/5 border border-white/10">
                <div className="p-2 rounded-[6px] bg-white/10">
                  <Building2 className="h-4 w-4 text-[#F2F1EA]" />
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">From</p>
                  <p className="text-sm text-white font-medium">
                    {invitation?.inviter_name || 'Your customer'} at {invitation?.organization_name}
                  </p>
                </div>
              </div>

              {invitation?.material_name && (
                <div className="flex items-center gap-3 p-3 rounded-[6px] bg-white/5 border border-white/10">
                  <div className="p-2 rounded-[6px] bg-white/10">
                    <Package className="h-4 w-4 text-[#F2F1EA]" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider">Data requested for</p>
                    <p className="text-sm text-white font-medium">
                      {invitation.material_name} {invitation.material_type && <span className="text-white/40">({invitation.material_type})</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ESG survey: what to expect */}
            {isEsgSurvey && (
              <div className="p-4 rounded-[6px] bg-white/5 border border-white/10">
                <p className="font-mono text-xs text-[#F2F1EA]/80 uppercase tracking-[0.22em] font-bold mb-1">What to expect</p>
                <p className="text-xs text-white/50 leading-relaxed">
                  Two quick steps, around 10 minutes, and it&apos;s free: first confirm a few details about your business, then a short survey covering labour &amp; human rights, environment, ethics, health &amp; safety and management systems. You can upload supporting evidence and save your progress as you go.
                </p>
              </div>
            )}

            {/* Personal message */}
            {invitation?.personal_message && (
              <div className="p-4 rounded-[6px] bg-white/5 border border-white/20">
                <div className="flex items-start gap-2">
                  <Quote className="h-4 w-4 text-[#F2F1EA]/60 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono text-xs text-[#F2F1EA]/60 uppercase tracking-[0.22em] mb-1">
                      Message from {invitation.inviter_name}
                    </p>
                    <p className="text-sm text-white/80 leading-relaxed">{invitation.personal_message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Why join */}
            <div className="p-4 rounded-[6px] bg-white/5 border border-white/10">
              <div className="flex items-start gap-2">
                <Leaf className="h-4 w-4 text-[#F2F1EA] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-xs text-[#F2F1EA]/80 uppercase tracking-[0.22em] font-bold mb-1">Free for suppliers</p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    alkatera gives you a streamlined portal to manage your sustainability data and share verified product information with your customers. No hidden costs, no commitment.
                  </p>
                </div>
              </div>
            </div>

            {/* Expiry warning */}
            {daysUntilExpiry <= 7 && (
              <div className="flex items-center gap-2 p-3 rounded-[6px] bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-200">
                  This invitation expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
                </p>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[6px]">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Auth section */}
            {mismatchedUserEmail ? (
              /* A different account is signed in this browser — let the user choose. */
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-[6px]">
                  <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/70">
                    You&apos;re signed in as <strong className="text-white">{mismatchedUserEmail}</strong>.
                    This invitation is for <strong className="text-white">{invitation?.supplier_email}</strong>.
                  </p>
                </div>
                <button
                  onClick={handleSwitchAccount}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    'Signing out...'
                  ) : (
                    <>Sign out &amp; continue as {invitation?.supplier_email} <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
                <p className="text-xs text-white/40 text-center leading-relaxed">
                  Prefer to stay signed in? Open this link in a private or incognito window instead.
                </p>
              </div>
            ) : existingUser ? (
              /* Already logged in with matching email */
              <div className="space-y-4">
                <p className="text-sm text-white/60 text-center">
                  Signed in as <strong className="text-white">{invitation?.supplier_email}</strong>
                </p>
                <button
                  onClick={handleAcceptAsExistingUser}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    'Accepting...'
                  ) : (
                    <>{acceptLabel} <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            ) : showSignIn ? (
              /* Sign in form */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-white/60 mb-1">Sign in to accept this invitation</p>
                  <p className="text-xs text-white/40">{invitation?.supplier_email}</p>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Signing in...' : <>{signInLabel} <ArrowRight className="h-4 w-4" /></>}
                </button>

                <button type="button" onClick={() => setShowSignIn(false)} className="w-full text-center text-xs text-white/40 hover:text-white/60">
                  Back to create account
                </button>
              </form>
            ) : (
              /* Create account form */
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-white/60">Create your free supplier account</p>
                </div>

                <div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm"
                    required
                  />
                </div>

                <div>
                  <input
                    type="email"
                    value={invitation?.supplier_email || ''}
                    disabled
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white/50 text-sm cursor-not-allowed"
                  />
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 8 characters)"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Creating account...' : <>{createLabel} <ArrowRight className="h-4 w-4" /></>}
                </button>

                <button type="button" onClick={() => setShowSignIn(true)} className="w-full text-center text-xs text-white/40 hover:text-white/60">
                  Already have an account? <span className="text-[#F2F1EA]/80 underline underline-offset-4">Sign in</span>
                </button>
              </form>
            )}
          </div>
        </motion.div>

        {/* Photo credit */}
        <p className="absolute bottom-4 text-white/30 text-xs">
          Photo by <a href="https://unsplash.com/@supergios" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50">Jonny Gios</a> on Unsplash
        </p>
      </div>
    </div>
  );
}
