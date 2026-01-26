'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Briefcase,
  LogIn,
} from 'lucide-react';

interface InvitationDetails {
  id: string;
  organization_name: string;
  advisor_email: string;
  access_notes: string | null;
  invited_at: string;
  expires_at: string;
  status: string;
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
        setIsAuthenticated(!!user);
        setUserEmail(user?.email || null);

        // Load invitation details
        const { data, error: invError } = await supabase
          .from('advisor_invitations')
          .select(`
            id,
            advisor_email,
            access_notes,
            invited_at,
            expires_at,
            status,
            organizations:organization_id (name)
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

        setInvitation({
          id: data.id,
          organization_name: (data.organizations as any)?.name || 'Unknown Organization',
          advisor_email: data.advisor_email,
          access_notes: data.access_notes,
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

      setSuccess(true);

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError('Failed to accept invitation. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignIn = () => {
    // Store the return URL and redirect to sign in
    const returnUrl = `/advisor-invite/${token}`;
    router.push(`/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`);
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

  if (error) {
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
              <CardTitle>Invitation Accepted!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              You now have advisor access to <strong>{invitation?.organization_name}</strong>.
            </p>
            <p className="text-sm text-slate-500">
              Redirecting you to the dashboard...
            </p>
          </CardContent>
        </Card>
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <Briefcase className="h-6 w-6" />
            <CardTitle>Advisor Invitation</CardTitle>
          </div>
          <CardDescription>
            You&apos;ve been invited to be a sustainability advisor
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
              <span className="text-slate-500">Invited Email:</span>
              <span className="font-medium">{invitation.advisor_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sent:</span>
              <span>{new Date(invitation.invited_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Expires:</span>
              <span>{new Date(invitation.expires_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Access Notes */}
          {invitation.access_notes && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                Message from the organisation:
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {invitation.access_notes}
              </p>
            </div>
          )}

          {/* What advisors can do */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
              As an advisor, you will be able to:
            </p>
            <ul className="text-sm text-green-600 dark:text-green-400 space-y-1 list-disc list-inside">
              <li>View and edit sustainability data</li>
              <li>Create and manage LCA assessments</li>
              <li>Generate and publish reports</li>
              <li>View audit logs</li>
            </ul>
          </div>

          {/* Authentication & Accept */}
          {!isAuthenticated ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please sign in to accept this invitation. Make sure to use the email address:{' '}
                  <strong>{invitation.advisor_email}</strong>
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={handleSignIn}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Accept
              </Button>
            </div>
          ) : emailMismatch ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation was sent to <strong>{invitation.advisor_email}</strong>, but you are
                signed in as <strong>{userEmail}</strong>. Please sign in with the correct account.
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              className="w-full"
              onClick={handleAcceptInvitation}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept Invitation
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
