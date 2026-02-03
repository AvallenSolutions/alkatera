'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  UserPlus,
  Eye,
  EyeOff,
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

// Create a Supabase client for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

        // Load invitation details
        const { data, error: invError } = await supabase
          .from('team_invitations')
          .select(`
            id,
            organization_id,
            email,
            invited_at,
            expires_at,
            status,
            organizations:organization_id (name),
            roles:role_id (name)
          `)
          .eq('invitation_token', token)
          .single();

        if (invError) {
          if (invError.code === 'PGRST116') {
            setError('Invalid invitation link. The invitation may have been cancelled.');
          } else {
            throw invError;
          }
          return;
        }

        if (!data) {
          setError('Invitation not found.');
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
            setError(`This invitation was sent to ${data.email}. Please sign out and try again with the correct account.`);
            return;
          }
        }

        setInvitation({
          id: data.id,
          organization_id: data.organization_id,
          organization_name: (data.organizations as any)?.name || 'Unknown Organization',
          email: data.email,
          role_name: (data.roles as any)?.name || 'member',
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

      // Call the accept invitation API
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

      // Redirect to dashboard after a short delay
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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) return;

    // Validation
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the user account via API
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
        // Still show success, user can sign in manually
      }

      // Redirect to dashboard after a short delay
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
              <p className="text-slate-500">Loading invitation details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-6 w-6" />
              <CardTitle>Invitation Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-6">
              <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle>Welcome to {invitation?.organization_name}!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              You have successfully joined the team. Redirecting you to the dashboard...
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <UserPlus className="h-6 w-6" />
            <CardTitle>Team Invitation</CardTitle>
          </div>
          <CardDescription>
            You&apos;ve been invited to join a team on AlkaTera
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Info */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Building2 className="h-10 w-10 text-blue-500" />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Organization</p>
                <p className="text-lg font-semibold">{invitation.organization_name}</p>
              </div>
            </div>
          </div>

          {/* Invitation Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role:</span>
              <span className="font-medium">{getRoleDisplayName(invitation.role_name)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Expires:</span>
              <span>{new Date(invitation.expires_at).toLocaleDateString()}</span>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {existingUser ? (
            // Existing user - just accept
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You already have an AlkaTera account. Click below to join the team.
              </p>
              <Button
                className="w-full"
                onClick={handleAcceptAsExistingUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Join Team
                  </>
                )}
              </Button>
            </div>
          ) : (
            // New user - create account
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Create your account to join the team.
              </p>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invitation.email}
                  disabled
                  className="bg-slate-100 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account & Join Team
                  </>
                )}
              </Button>
            </form>
          )}

          <p className="text-xs text-center text-slate-500">
            Already have an account?{' '}
            <a href="/sign-in" className="text-blue-500 hover:underline">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
