'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Users,
  Shield,
} from 'lucide-react';

interface InvitationDetails {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role_name: string;
  invited_at: string;
  expires_at: string;
  status: string;
}

export default function TeamInvitePage() {
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

  // Form fields
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    async function loadInvitation() {
      try {
        // Check if user is already authenticated
        const { data: { user } } = await supabase.auth.getUser();

        // Load invitation details via server-side API route
        // This uses the service role client to bypass RLS on the organisations table,
        // which anonymous users cannot read directly via the anon key
        const response = await fetch(`/api/team-invite/details?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load invitation details.');
          return;
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired. Please ask for a new invitation.');
          return;
        }

        // Check if already accepted
        if (data.status === 'accepted') {
          setError('This invitation has already been accepted.');
          return;
        }

        // Check if cancelled
        if (data.status === 'cancelled') {
          setError('This invitation has been cancelled.');
          return;
        }

        // If user is logged in, check if their email matches
        if (user) {
          if (user.email?.toLowerCase() === data.email.toLowerCase()) {
            setExistingUser(true);
          } else {
            // A different user is logged in — sign them out automatically
            // so the invited user can sign up or sign in with the correct account.
            // This handles stale sessions and the case where someone opens the
            // invite link in a browser where another account is active.
            await supabase.auth.signOut();
            // Don't set existingUser — fall through to show the signup form
          }
        }

        setInvitation({
          id: data.id,
          organization_id: data.organization_id,
          organization_name: data.organization_name || 'Unknown Organisation',
          email: data.email,
          role_name: data.role_name || 'member',
          invited_at: data.invited_at,
          expires_at: data.expires_at,
          status: data.status,
        });
      } catch (err) {
        console.error('Error loading invitation:', err);
        setError('Failed to load invitation details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

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

      const response = await fetch('/api/team-invite/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          user_id: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      setSuccess(true);

      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invitation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) return;

    // Validation
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
      const response = await fetch('/api/team-invite/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          full_name: fullName.trim(),
          password: password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account');
      }

      setSuccess(true);

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: password,
      });

      if (signInError) {
        console.error('Error signing in after account creation:', signInError);
      }

      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error creating account:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleDisplayName = (roleName: string) => {
    const roleMap: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      member: 'Team Member',
      viewer: 'Viewer',
    };
    return roleMap[roleName] || roleName;
  };

  const getRoleIcon = (roleName: string) => {
    if (roleName === 'admin' || roleName === 'owner') {
      return <Shield className="h-4 w-4" />;
    }
    return <Users className="h-4 w-4" />;
  };

  // Loading state
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
            <Loader2 className="h-10 w-10 animate-spin text-[#ccff00] mb-4" />
            <p className="text-white/60 font-mono text-sm uppercase tracking-widest">
              Loading invitation...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Error state (no invitation)
  if (error && !invitation) {
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
              <img
                src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
                alt="AlkaTera"
                className="h-12 md:h-14 w-auto object-contain"
              />
            </div>

            <div className="border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
                <h2 className="font-serif text-2xl text-white">Invitation Error</h2>
              </div>

              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>

              <Link
                href="/"
                className="block w-full py-4 bg-white/10 text-white font-mono uppercase text-xs tracking-widest font-bold rounded-xl text-center hover:bg-white/20 transition-all"
              >
                Return to Home
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Success state
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
              <img
                src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
                alt="AlkaTera"
                className="h-12 md:h-14 w-auto object-contain"
              />
            </div>

            <div className="border border-[#ccff00]/30 bg-[#ccff00]/5 backdrop-blur-md rounded-2xl p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex p-4 rounded-full bg-[#ccff00]/20 border border-[#ccff00]/30 mb-6"
              >
                <CheckCircle2 className="h-10 w-10 text-[#ccff00]" />
              </motion.div>

              <h2 className="font-serif text-3xl text-white mb-3">
                Welcome to {invitation?.organization_name}!
              </h2>
              <p className="text-white/60 mb-6">
                You have successfully joined the team. Redirecting you to the dashboard...
              </p>
              <Loader2 className="h-6 w-6 animate-spin text-[#ccff00] mx-auto" />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // Main invitation form
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
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img
              src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
              alt="AlkaTera"
              className="h-12 md:h-14 w-auto object-contain"
            />
          </div>

          {/* Hero headline */}
          <h1 className="font-serif text-4xl md:text-5xl text-white text-center mb-4">
            You&apos;re invited.
          </h1>
          <p className="text-white/50 text-center mb-8">
            Join {invitation.organization_name} on AlkaTera
          </p>

          {/* Glassmorphism Card */}
          <div className="border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-8">
            {/* Organisation Info */}
            <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl mb-6">
              <div className="p-3 rounded-xl bg-[#ccff00]/10 border border-[#ccff00]/20">
                <Building2 className="h-6 w-6 text-[#ccff00]" />
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
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">
                  Your Role
                </p>
                <div className="flex items-center gap-2">
                  {getRoleIcon(invitation.role_name)}
                  <span className="text-sm font-medium text-white">
                    {getRoleDisplayName(invitation.role_name)}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">
                  Expires
                </p>
                <p className="text-sm font-medium text-white">
                  {new Date(invitation.expires_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {existingUser ? (
              // Existing user - just accept
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-[#ccff00]/10 border border-[#ccff00]/20 rounded-xl">
                  <CheckCircle2 className="h-5 w-5 text-[#ccff00] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/80">
                    You already have an AlkaTera account. Click below to join the team.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAcceptAsExistingUser}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#ccff00] text-black font-mono uppercase text-xs tracking-widest font-bold rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Joining team...
                    </span>
                  ) : (
                    "Join Team"
                  )}
                </button>
              </div>
            ) : (
              // New user - create account
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <p className="text-sm text-white/60 mb-4">
                  Create your account to join the team.
                </p>

                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-white/60">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isSubmitting}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-white/60">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={invitation.email}
                    disabled
                    className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white/60 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-white/60">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-white/30">
                    Min 8 chars with uppercase, lowercase, and number
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/60">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#ccff00] text-black font-mono uppercase text-xs tracking-widest font-bold rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    "Create Account & Join"
                  )}
                </button>
              </form>
            )}

            {/* Sign in link */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-white/40 font-mono text-xs uppercase tracking-widest">
                  Already have an account?
                </span>
                <Link
                  href="/login"
                  className="text-[#ccff00] font-mono text-xs uppercase tracking-widest hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Photo credit */}
        <div className="absolute bottom-4 text-center text-[10px] text-white/20">
          Photo by{' '}
          <a
            href="https://unsplash.com/@maranthi"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Stephan Hinni
          </a>
          {' '}on{' '}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Unsplash
          </a>
        </div>
      </div>
    </div>
  );
}
