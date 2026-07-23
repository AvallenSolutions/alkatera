'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import {
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Leaf,
  ArrowRight,
  Shield,
  BarChart3,
  Package,
} from 'lucide-react';

export default function SupplierRegisterPage() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  // Form fields — create account
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form fields — sign in
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const logoUrl = '/logo-cream.svg';

  const validatePassword = (pw: string) => {
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
    return null;
  };

  const acceptRegistration = async (userId: string, supplierName: string, contactName: string) => {
    const response = await fetch('/api/supplier-register/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        supplier_name: supplierName,
        contact_name: contactName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to register as supplier');
    }

    return result;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      setError('Please enter your company name.');
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
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
      // Step 1: Create account via Supabase Auth (password never sent to our API)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Please sign in instead.');
          setSignInEmail(email.trim().toLowerCase());
          setShowSignIn(true);
          return;
        }
        throw new Error(signUpError.message);
      }

      if (!signUpData.user) {
        throw new Error('Failed to create account');
      }

      // Step 2: Register as supplier via API (no password sent, no org link)
      await acceptRegistration(signUpData.user.id, companyName.trim(), fullName.trim());

      // Step 3: Sign in explicitly (signUp may auto-sign-in, but be explicit)
      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password,
        });

        if (signInError) {
          console.error('Error signing in after account creation:', signInError);
        }
      }

      // Step 4: Refresh session to pick up is_supplier metadata set by the
      // accept route. Without this, the session token from signIn/signUp
      // won't include the metadata, and OrganizationContext's fallback fails.
      await supabase.auth.refreshSession();

      setSuccess(true);
      setTimeout(() => {
        router.push('/supplier-portal');
      }, 2000);
    } catch (err) {
      console.error('Error creating account:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signInEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signInEmail.trim().toLowerCase(),
        password: signInPassword,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in failed');

      // Only call registration if the user is not already marked as a supplier.
      // Calling it unconditionally risks creating duplicate supplier records for
      // existing suppliers whose invitation-created record pre-dates the user_id
      // idempotency check.
      if (!user.user_metadata?.is_supplier) {
        await acceptRegistration(user.id, '', user.user_metadata?.full_name || '');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/supplier-portal');
      }, 2000);
    } catch (err) {
      console.error('Error signing in:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <p className="text-white/60 text-sm">You&apos;ve registered as a supplier. Taking you to your portal...</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Main registration page ─────────────────────────────────
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
              <h1 className="font-display font-bold tracking-tight text-3xl text-[#F2F1EA]">Register as a supplier.</h1>
              <p className="text-white/60 text-sm">
                Join alkatera&apos;s supplier network and share your sustainability data with your customers
              </p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-[6px] bg-white/5 border border-white/10 text-center">
                <Package className="h-5 w-5 text-[#F2F1EA] mx-auto mb-1.5" />
                <p className="text-[10px] text-white/50 leading-tight">Manage your product data</p>
              </div>
              <div className="p-3 rounded-[6px] bg-white/5 border border-white/10 text-center">
                <BarChart3 className="h-5 w-5 text-[#F2F1EA] mx-auto mb-1.5" />
                <p className="text-[10px] text-white/50 leading-tight">Share verified impact data</p>
              </div>
              <div className="p-3 rounded-[6px] bg-white/5 border border-white/10 text-center">
                <Shield className="h-5 w-5 text-[#F2F1EA] mx-auto mb-1.5" />
                <p className="text-[10px] text-white/50 leading-tight">Secure & confidential</p>
              </div>
            </div>

            {/* Free for suppliers */}
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

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[6px]">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Auth section */}
            {showSignIn ? (
              /* Sign in form */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-white/60">Sign in to your existing account</p>
                </div>

                <div>
                  <input
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm"
                    required
                  />
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
                  {isSubmitting ? 'Signing in...' : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </button>

                <button type="button" onClick={() => { setShowSignIn(false); setError(null); }} className="w-full text-center text-xs text-white/40 hover:text-white/60">
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
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm"
                    required
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm"
                    required
                  />
                </div>

                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#F2F1EA]/40 focus:ring-1 focus:ring-[#F2F1EA]/20 text-sm"
                    required
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
                  {isSubmitting ? 'Creating account...' : <>Create account <ArrowRight className="h-4 w-4" /></>}
                </button>

                <button type="button" onClick={() => { setShowSignIn(true); setError(null); }} className="w-full text-center text-xs text-white/40 hover:text-white/60">
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
