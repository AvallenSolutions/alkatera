'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@supabase/supabase-js'

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role_id: string
  roles: {
    name: string
  }
}

interface OrganizationContextType {
  currentOrganization: Organization | null
  organizations: Organization[]
  isLoading: boolean
  userRole: string | null
  switchOrganization: (orgId: string) => Promise<void>
  refreshOrganizations: () => Promise<void>
  mutate: (newOrganization?: { organization: Organization; role: string; user: User }) => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user, session, loading: authLoading } = useAuth()

  const fetchOrganizations = async () => {
    if (authLoading) {
      console.log('⏳ OrganizationContext: Waiting for auth to complete...')
      return
    }

    if (!user) {
      console.log('ℹ️ OrganizationContext: No user found, skipping organization fetch')
      setIsLoading(false)
      return
    }

    console.log('🔍 OrganizationContext: Fetching organizations for user:', user.id)

    if (!session) {
      console.error('❌ OrganizationContext: No session available from AuthProvider')
      setIsLoading(false)
      return
    }

    console.log('✅ OrganizationContext: Using session from AuthProvider:', {
      userId: session.user.id,
      hasAccessToken: !!session.access_token
    })

    setIsLoading(true)
    try {
      // Use the session access token directly for authenticated requests
      const authHeaders = {
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      }

      // First, get the user's organization memberships using fetch with explicit auth
      const membershipsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${user.id}&select=organization_id,role_id`

      const membershipsResponse = await fetch(membershipsUrl, {
        headers: authHeaders
      })

      if (!membershipsResponse.ok) {
        console.error('❌ OrganizationContext: Memberships fetch failed:', membershipsResponse.status, membershipsResponse.statusText)
        setIsLoading(false)
        return
      }

      const memberships = await membershipsResponse.json()

      console.log('📊 OrganizationContext: Memberships result:', memberships)

      if (!memberships || memberships.length === 0) {
        console.log('ℹ️ OrganizationContext: No organization memberships found')
        setOrganizations([])
        setIsLoading(false)
        return
      }

      // Then fetch the organizations using fetch with explicit auth
      const orgIds = memberships.map((m: any) => m.organization_id)
      const orgsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/organizations?id=in.(${orgIds.join(',')})`

      const orgsResponse = await fetch(orgsUrl, {
        headers: authHeaders
      })

      if (!orgsResponse.ok) {
        console.error('❌ OrganizationContext: Organizations fetch failed:', orgsResponse.status, orgsResponse.statusText)
        setIsLoading(false)
        return
      }

      const orgs = await orgsResponse.json()
      console.log('🏢 OrganizationContext: Organizations result:', orgs)

      console.log('🏢 OrganizationContext: Found organizations:', orgs?.length || 0)
      setOrganizations(orgs || [])

      if (orgs && orgs.length > 0) {
        const currentOrgIdFromSession = user.user_metadata?.current_organization_id

        const orgToSet = orgs.find((o: any) => o.id === currentOrgIdFromSession) || orgs[0]
        setCurrentOrganization(orgToSet)
        console.log('✅ OrganizationContext: Set current organization:', orgToSet.name)

        if (orgToSet.id !== currentOrgIdFromSession) {
            console.log('🔧 OrganizationContext: Syncing session with default organization.')
            await supabase.auth.updateUser({ data: { current_organization_id: orgToSet.id } })
        }

        // Fetch the role for this organization
        const membership = memberships.find((m: any) => m.organization_id === orgToSet.id)
        if (membership) {
          const { data: roleData } = await supabase
            .from('roles')
            .select('name')
            .eq('id', membership.role_id)
            .single()

          setUserRole(roleData?.name || null)
          console.log('👤 OrganizationContext: User role:', roleData?.name)
        }
      }
    } catch (error) {
      console.error('❌ OrganizationContext: Fatal error in fetchOrganizations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const switchOrganization = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    if (!org || !user) return

    setCurrentOrganization(org)
    
    const { error } = await supabase.auth.updateUser({
        data: {
            current_organization_id: orgId
        }
    });

    if (error) {
        console.error('❌ OrganizationContext: Error updating user metadata:', error)
        return;
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('roles!inner (name)')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()
    
    setUserRole((membership as any)?.roles?.name || null)
  }

  const refreshOrganizations = async () => {
    await fetchOrganizations()
  }

  const mutate = async (newOrgPayload?: { organization: Organization; role: string; user: User }) => {
    if (newOrgPayload) {
        const { organization, role } = newOrgPayload;
        setOrganizations(prev => [...prev, organization]);
        setCurrentOrganization(organization);
        setUserRole(role);

        const { error } = await supabase.auth.updateUser({
            data: {
                current_organization_id: organization.id
            }
        });

        if (error) {
            console.error('❌ OrganizationContext: Error setting initial organization for new user:', error);
        }

    } else {
        await refreshOrganizations();
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchOrganizations()
    }
  }, [user, authLoading])

  const value = {
    currentOrganization,
    organizations,
    isLoading,
    userRole,
    switchOrganization,
    refreshOrganizations,
    mutate,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}
