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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, Loader2, Users, Trash2, AlertCircle } from 'lucide-react'
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

interface TeamMember {
  id: string
  user_id: string
  role_id: string
  profiles: {
    email: string
    full_name: string | null
  }
  roles: {
    name: string
  }
}

export default function TeamManagementPage() {
  const { currentOrganization, userRole } = useOrganization()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviting, setIsInviting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [inviteeEmail, setInviteeEmail] = useState('')
  const [inviteeRole, setInviteeRole] = useState<'company_admin' | 'company_user'>('company_user')
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const isAdmin = userRole === 'owner' || userRole === 'admin'

  const fetchMembers = async () => {
    if (!currentOrganization) return

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role_id,
          profiles!inner (email, full_name),
          roles!inner (name)
        `)
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
          organization_id: currentOrganization.id,
          invitee_email: inviteeEmail,
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
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberToDelete.id)

      if (error) throw error

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
        description: 'Failed to remove team member. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case 'owner':
        return 'default'
      case 'admin':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getRoleDisplayName = (roleName: string) => {
    const roleMap: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      member: 'Member',
      viewer: 'Viewer',
    }
    return roleMap[roleName] || roleName
  }

  useEffect(() => {
    fetchMembers()
  }, [currentOrganization])

  if (!currentOrganization) {
    return (
      <div className="flex items-centre justify-centre h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Card>
        <CardHeader className="flex flex-row items-centre justify-between space-y-0 pb-6">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold flex items-centre gap-2">
              <Users className="h-6 w-6" />
              Team Members
            </CardTitle>
            <CardDescription>
              Manage your organisation&apos;s team members and their roles
            </CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
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
                        onValueChange={(value) => setInviteeRole(value as 'company_admin' | 'company_user')}
                        disabled={isInviting}
                      >
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                      {isInviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Inviting...
                        </>
                      ) : (
                        'Invite Member'
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
            <div className="flex items-centre justify-centre h-64">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-centre py-12">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">No team members found</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.profiles.full_name || 'No name'}
                      </TableCell>
                      <TableCell>{member.profiles.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.roles.name)}>
                          {getRoleDisplayName(member.roles.name)}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {member.roles.name !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberToDelete(member)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
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
        </CardContent>
      </Card>

      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToDelete?.profiles.full_name || memberToDelete?.profiles.email} from your organisation?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Member'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
