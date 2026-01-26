'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Briefcase,
  Loader2,
  UserPlus,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Advisor {
  advisor_user_id: string;
  advisor_email: string;
  advisor_name: string | null;
  company_name: string | null;
  expertise_areas: string[] | null;
  granted_at: string;
  is_active: boolean;
}

interface AdvisorInvitation {
  id: string;
  advisor_email: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  invited_at: string;
  expires_at: string;
  access_notes: string | null;
}

export function AdvisorManagement() {
  const { currentOrganization, userRole } = useOrganization();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [invitations, setInvitations] = useState<AdvisorInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [advisorToRevoke, setAdvisorToRevoke] = useState<Advisor | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const { toast } = useToast();

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const fetchAdvisors = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setIsLoading(true);

      // Fetch active advisors
      const { data: advisorData, error: advisorError } = await supabase.rpc(
        'get_organization_advisors',
        { p_org_id: currentOrganization.id }
      );

      if (advisorError) {
        console.error('Error fetching advisors:', advisorError);
      } else {
        setAdvisors(advisorData || []);
      }

      // Fetch pending invitations
      const { data: invitationData, error: invitationError } = await supabase
        .from('advisor_invitations')
        .select('id, advisor_email, status, invited_at, expires_at, access_notes')
        .eq('organization_id', currentOrganization.id)
        .in('status', ['pending', 'expired'])
        .order('invited_at', { ascending: false });

      if (invitationError) {
        console.error('Error fetching invitations:', invitationError);
      } else {
        setInvitations(invitationData || []);
      }
    } catch (error) {
      console.error('Error fetching advisor data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load advisor data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization, toast]);

  const handleInviteAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentOrganization) return;

    if (!inviteeEmail.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsInviting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('Not authenticated');
      }

      // Create the invitation
      const { data, error } = await supabase
        .from('advisor_invitations')
        .insert({
          organization_id: currentOrganization.id,
          advisor_email: inviteeEmail.trim().toLowerCase(),
          invited_by: userData.user.id,
          access_notes: accessNotes.trim() || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('An invitation has already been sent to this email address');
        }
        throw error;
      }

      toast({
        title: 'Invitation Sent',
        description: `Advisor invitation sent to ${inviteeEmail}. They will need to accept it to gain access.`,
      });

      setIsDialogOpen(false);
      setInviteeEmail('');
      setAccessNotes('');
      fetchAdvisors();
    } catch (error) {
      console.error('Error inviting advisor:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to send invitation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!advisorToRevoke || !currentOrganization) return;

    setIsRevoking(true);

    try {
      const { error } = await supabase.rpc('revoke_advisor_access', {
        p_advisor_user_id: advisorToRevoke.advisor_user_id,
        p_organization_id: currentOrganization.id,
        p_reason: 'Revoked by organization admin',
      });

      if (error) throw error;

      toast({
        title: 'Access Revoked',
        description: `${advisorToRevoke.advisor_name || advisorToRevoke.advisor_email}'s access has been revoked.`,
      });

      setAdvisorToRevoke(null);
      fetchAdvisors();
    } catch (error) {
      console.error('Error revoking access:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke advisor access. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('advisor_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Invitation Cancelled',
        description: 'The invitation has been cancelled.',
      });

      fetchAdvisors();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel invitation.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Accepted
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="text-slate-500 border-slate-500">
            <XCircle className="mr-1 h-3 w-3" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  useEffect(() => {
    fetchAdvisors();
  }, [fetchAdvisors]);

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const activeAdvisors = advisors.filter((a) => a.is_active);
  const revokedAdvisors = advisors.filter((a) => !a.is_active);
  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div className="space-y-1">
          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Sustainability Advisors
          </CardTitle>
          <CardDescription>
            Manage external advisors who have access to your organisation
          </CardDescription>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Advisor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleInviteAdvisor}>
                <DialogHeader>
                  <DialogTitle>Invite Sustainability Advisor</DialogTitle>
                  <DialogDescription>
                    Invite an AlkaTera-accredited advisor to help with your sustainability journey.
                    They will receive full access to data, reports, and LCA features.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="advisor-email">Advisor Email Address</Label>
                    <Input
                      id="advisor-email"
                      type="email"
                      placeholder="advisor@consultancy.com"
                      value={inviteeEmail}
                      onChange={(e) => setInviteeEmail(e.target.value)}
                      disabled={isInviting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="access-notes">Access Notes (Optional)</Label>
                    <Textarea
                      id="access-notes"
                      placeholder="Describe what you'd like the advisor to help with..."
                      value={accessNotes}
                      onChange={(e) => setAccessNotes(e.target.value)}
                      disabled={isInviting}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      These notes will be visible to the advisor when they accept the invitation.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isInviting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isInviting}>
                    {isInviting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : activeAdvisors.length === 0 && pendingInvitations.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg mb-2">No advisors yet</p>
            <p className="text-slate-400 text-sm">
              Invite a sustainability advisor to help with your carbon accounting and reporting.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList>
              <TabsTrigger value="active">
                Active Advisors ({activeAdvisors.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending Invitations ({pendingInvitations.length})
              </TabsTrigger>
              {revokedAdvisors.length > 0 && (
                <TabsTrigger value="revoked">
                  Revoked ({revokedAdvisors.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {activeAdvisors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No active advisors
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Advisor</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Expertise</TableHead>
                        <TableHead>Since</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeAdvisors.map((advisor) => (
                        <TableRow key={advisor.advisor_user_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {advisor.advisor_name || 'Unknown'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {advisor.advisor_email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{advisor.company_name || '-'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {advisor.expertise_areas?.slice(0, 2).map((area) => (
                                <Badge key={area} variant="secondary" className="text-xs">
                                  {area}
                                </Badge>
                              ))}
                              {(advisor.expertise_areas?.length || 0) > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(advisor.expertise_areas?.length || 0) - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(advisor.granted_at).toLocaleDateString()}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAdvisorToRevoke(advisor)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-4">
              {pendingInvitations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No pending invitations
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Expires</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">
                            {invitation.advisor_email}
                          </TableCell>
                          <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                          <TableCell>
                            {new Date(invitation.invited_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(invitation.expires_at).toLocaleDateString()}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelInvitation(invitation.id)}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {revokedAdvisors.length > 0 && (
              <TabsContent value="revoked" className="mt-4">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Advisor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Was Active Since</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revokedAdvisors.map((advisor) => (
                        <TableRow key={advisor.advisor_user_id} className="opacity-60">
                          <TableCell className="font-medium">
                            {advisor.advisor_name || 'Unknown'}
                          </TableCell>
                          <TableCell>{advisor.advisor_email}</TableCell>
                          <TableCell>
                            {new Date(advisor.granted_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}
      </CardContent>

      <AlertDialog open={!!advisorToRevoke} onOpenChange={() => setAdvisorToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Advisor Access?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke{' '}
              {advisorToRevoke?.advisor_name || advisorToRevoke?.advisor_email}&apos;s access to your
              organisation? They will no longer be able to view or edit your data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAccess}
              disabled={isRevoking}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRevoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Access'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
