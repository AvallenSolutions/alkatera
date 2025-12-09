'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users, Mail, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { format } from 'date-fns'

interface TeamMember {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
  joined_at: string
}

export function TeamDirectory() {
  const { currentOrganization } = useOrganization()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganization) return

    const fetchTeamMembers = async () => {
      setIsLoading(true)

      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          created_at,
          user_id,
          roles!inner (
            name
          ),
          profiles!inner (
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching team members:', error)
        setIsLoading(false)
        return
      }

      const teamMembers: TeamMember[] = (memberships || []).map((membership: any) => ({
        id: membership.user_id,
        email: membership.profiles.email,
        full_name: membership.profiles.full_name,
        avatar_url: membership.profiles.avatar_url,
        role: membership.roles.name,
        joined_at: membership.created_at,
      }))

      setMembers(teamMembers)
      setIsLoading(false)
    }

    fetchTeamMembers()
  }, [currentOrganization])

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
      case 'admin':
        return 'default'
      case 'member':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Directory
          </CardTitle>
          <CardDescription>People in your organisation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Directory
        </CardTitle>
        <CardDescription>
          {members.length} {members.length === 1 ? 'person' : 'people'} in your organisation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members found.</p>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.avatar_url || undefined} alt={member.full_name || member.email} />
                  <AvatarFallback>{getInitials(member.full_name, member.email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm truncate">
                      {member.full_name || 'Unnamed User'}
                    </h4>
                    <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                      {member.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Joined {format(new Date(member.joined_at), 'MMM yyyy')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
