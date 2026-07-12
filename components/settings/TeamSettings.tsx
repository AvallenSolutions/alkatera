'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Eyebrow, Panel, StateChip } from '@/components/studio'
import type { WorkingTone } from '@/components/studio'
import { UserPlus, Trash2, Lock, ShieldCheck } from 'lucide-react'
import { useTeamMemberLimit } from '@/hooks/useSubscription'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AdvisorManagement } from '@/components/settings/AdvisorManagement'

interface TeamMember {
  membership_id: string
  user_id: string
  role_id: string
  email: string
  full_name: string | null
  role: string
}

interface TeamInvitation {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  invited_at: string
  expires_at: string
}

interface TeamSettingsProps {
  showHeader?: boolean
}

const BUSY_TEXT = (
  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
    Loading
  </span>
)

export function TeamSettings({ showHeader = true }: TeamSettingsProps) {
  const { currentOrganization, userRole } = useOrganization()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviting, setIsInviting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [inviteeEmail, setInviteeEmail] = useState('')
  const [inviteeRole, setInviteeRole] = useState<'company_owner' | 'company_admin' | 'company_user'>('company_user')
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [roleMap, setRoleMap] = useState<Record<string, string>>({})
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const { toast } = useToast()
  const { currentCount, maxCount, isUnlimited, checkLimit } = useTeamMemberLimit()
  const atLimit = !isUnlimited && maxCount != null && currentCount >= maxCount

  const isAdmin = userRole === 'owner' || userRole === 'admin'
  const isOwner = userRole === 'owner'

  const fetchMembers = async () => {
    if (!currentOrganization) return

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('member_profiles')
        .select('*')
        .eq('organization_id', currentOrganization.id)

      if (error) throw error

      setMembers((data as any) || [])
    } catch (error) {
      console.error('Error fetching members:', error)
      toast({
        title: 'Error',
        description: 'Failed to load team members.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const { data } = await supabase.from('roles').select('id, name')
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((r) => { map[r.name] = r.id })
        setRoleMap(map)
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
    }
  }

  const handleRoleChange = async (member: TeamMember, newRole: string) => {
    const newRoleId = roleMap[newRole]
    if (!newRoleId || newRoleId === member.role_id) return

    setUpdatingRole(member.membership_id)
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role_id: newRoleId })
        .eq('id', member.membership_id)

      if (error) throw error

      toast({
        title: 'Success',
        description: `Role updated to ${getRoleDisplayName(newRole)}.`,
      })
      fetchMembers()
    } catch (error) {
      console.error('Error updating role:', error)
      toast({
        title: 'Error',
        description: 'Failed to update role. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUpdatingRole(null)
    }
  }

  const fetchInvitations = async () => {
    if (!currentOrganization) return

    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('id, email, status, invited_at, expires_at')
        .eq('organization_id', currentOrganization.id)
        .in('status', ['pending', 'expired'])
        .order('invited_at', { ascending: false })

      if (error) throw error

      setInvitations((data as TeamInvitation[]) || [])
    } catch (_) {
      // Non-fatal: invitations section is supplementary
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentOrganization) return

    if (!inviteeEmail.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an email address.',
        variant: 'destructive',
      })
      return
    }

    setIsInviting(true)

    try {
      // Server-side limit check before inviting
      const limitResult = await checkLimit()
      if (!limitResult.allowed) {
        toast({
          title: 'Team member limit reached',
          description: limitResult.reason || 'Please upgrade your plan to invite more members.',
          variant: 'destructive',
        })
        setIsInviting(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: inviteeEmail,
          role: inviteeRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to invite member')
      }

      toast({
        title: 'Success',
        description: 'Team member invited successfully.',
      })

      setIsDialogOpen(false)
      setInviteeEmail('')
      setInviteeRole('company_user')
      fetchMembers()
      fetchInvitations()
    } catch (error) {
      console.error('Error inviting member:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to invite member. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsInviting(false)
    }
  }

  const handleDeleteMember = async () => {
    if (!memberToDelete) return

    setIsDeleting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(`/api/team-members/${memberToDelete.membership_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove team member')
      }

      toast({
        title: 'Success',
        description: 'Team member removed successfully.',
      })

      setMemberToDelete(null)
      fetchMembers()
    } catch (error) {
      console.error('Error removing member:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove team member. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getRoleTone = (roleName: string): WorkingTone => {
    switch (roleName) {
      case 'owner':
        return 'good'
      case 'admin':
        return 'quiet'
      case 'advisor':
        return 'hold'
      default:
        return 'quiet'
    }
  }

  const getRoleDisplayName = (roleName: string) => {
    const roleMap: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      member: 'Member',
      viewer: 'Viewer',
      advisor: 'Advisor',
    }
    return roleMap[roleName] || roleName
  }

  useEffect(() => {
    fetchMembers()
    fetchInvitations()
    fetchRoles()
  }, [currentOrganization])

  if (!currentOrganization) {
    return (
      <div className="flex h-96 items-center justify-center">
        {BUSY_TEXT}
      </div>
    )
  }

  return (
    <div className={showHeader ? "container mx-auto py-8 px-4 max-w-6xl" : ""}>
      <Panel className="space-y-6">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <Eyebrow tone="dim">Team members</Eyebrow>
            <p className="text-sm text-studio-dim">
              Manage your organisation&apos;s team members and their roles
            </p>
          </div>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={atLimit}>
                  {atLimit ? <Lock className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  {atLimit ? 'Limit Reached' : 'Invite Member'}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleInviteMember}>
                  <DialogHeader>
                    <DialogTitle>Invite New Member</DialogTitle>
                    <DialogDescription>
                      Add a new team member to your organisation. They must have an existing account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteeEmail}
                        onChange={(e) => setInviteeEmail(e.target.value)}
                        disabled={isInviting}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={inviteeRole}
                        onValueChange={(value) => setInviteeRole(value as 'company_owner' | 'company_admin' | 'company_user')}
                        disabled={isInviting}
                      >
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Only an owner may grant ownership */}
                          {isOwner && <SelectItem value="company_owner">Owner</SelectItem>}
                          <SelectItem value="company_admin">Company Admin</SelectItem>
                          <SelectItem value="company_user">Company User</SelectItem>
                        </SelectContent>
                      </Select>
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
                      {isInviting ? 'Inviting...' : 'Invite Member'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div>
          {atLimit && (
            <div className="mb-4 flex items-center gap-3 rounded-[6px] border border-studio-stale/30 bg-studio-stale/5 p-4">
              <Lock className="h-5 w-5 shrink-0 text-studio-stale" />
              <div className="flex-1">
                <p className="text-sm font-medium text-studio-stale">Team member limit reached</p>
                <p className="text-xs text-studio-dim">
                  You&apos;ve used {currentCount} of {maxCount} team members on your current plan.{' '}
                  <a href="/dashboard/settings" className="underline text-foreground">Upgrade</a> to add more.
                </p>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              {BUSY_TEXT}
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg text-studio-dim">No team members found</p>
            </div>
          ) : (
            <div className="rounded-[6px] border border-studio-hairline">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {isOwner && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.membership_id}>
                      <TableCell className="font-medium">
                        {member.full_name || 'No name'}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        {isOwner && member.role !== 'owner' ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleRoleChange(member, value)}
                            disabled={updatingRole === member.membership_id}
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Promoting to owner is owner-only (matches the invite flow) */}
                              {isOwner && (
                                <SelectItem value="owner">
                                  <span className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Owner
                                  </span>
                                </SelectItem>
                              )}
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Admin
                                </span>
                              </SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <StateChip tone={getRoleTone(member.role)}>
                            {getRoleDisplayName(member.role)}
                          </StateChip>
                        )}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          {member.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberToDelete(member)}
                            >
                              <Trash2 className="h-4 w-4 text-studio-stale" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Panel>

      {/* Pending Invitations */}
      {isAdmin && invitations.length > 0 && (
        <Panel className="mt-6 space-y-4">
          <div className="space-y-1">
            <Eyebrow tone="dim">Pending invitations</Eyebrow>
            <p className="text-sm text-studio-dim">
              Invitations that have been sent but not yet accepted
            </p>
          </div>
          <div className="rounded-[6px] border border-studio-hairline">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invite) => {
                  const isExpired = invite.status === 'expired' || new Date(invite.expires_at) < new Date()
                  return (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>
                        {isExpired ? (
                          <StateChip tone="stale">Expired</StateChip>
                        ) : (
                          <StateChip tone="attention">Pending</StateChip>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-studio-dim">
                        {new Date(invite.invited_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-studio-dim">
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToDelete?.full_name || memberToDelete?.email} from your organisation?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={isDeleting}
              className="bg-studio-stale text-studio-cream hover:bg-studio-stale/90"
            >
              {isDeleting ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Advisor Management Section */}
      {isAdmin && <AdvisorManagement />}
    </div>
  )
}
