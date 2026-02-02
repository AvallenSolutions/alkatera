'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@supabase/supabase-js'

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  logo_url?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  industry_sector?: string | null
  founding_year?: number | null
  company_size?: string | null
  description?: string | null
  address_lat?: number | null
  address_lng?: number | null
  product_type?: string | null
  report_defaults?: Record<string, any> | null
  subscription_status?: string | null
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
  const isFetchingRef = useRef(false)
  const lastFetchedUserIdRef = useRef<string | null>(null)
  const { user, session, loading: authLoading, onAuthStateChanged } = useAuth()

  const fetchOrganizations = useCallback(async () => {
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

    if (isFetchingRef.current) {
      console.log('⏳ OrganizationContext: Already fetching, skipping...')
      return
    }

    isFetchingRef.current = true
    setIsLoading(true)
    try {
      // Use the supabase client directly - it already has the session from AuthProvider
      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_members')
        .select('organization_id, role_id')
        .eq('user_id', user.id)

      console.log('📊 OrganizationContext: Memberships result:', { memberships, error: membershipsError })

      if (membershipsError) {
        console.error('❌ OrganizationContext: Error fetching memberships:', membershipsError)
        setIsLoading(false)
        return
      }

      // Check for advisor access if no regular memberships
      let advisorOrgIds: string[] = []
      let isAdvisor = false

      if (!memberships || memberships.length === 0) {
        console.log('ℹ️ OrganizationContext: No organization memberships found, checking advisor access...')

        // Check advisor_organization_access table
        const { data: advisorAccess, error: advisorError } = await supabase
          .from('advisor_organization_access')
          .select('organization_id')
          .eq('advisor_user_id', user.id)
          .eq('is_active', true)

        console.log('📊 OrganizationContext: Advisor access result:', { advisorAccess, error: advisorError })

        if (!advisorError && advisorAccess && advisorAccess.length > 0) {
          advisorOrgIds = advisorAccess.map(a => a.organization_id)
          isAdvisor = true
          console.log('✅ OrganizationContext: Found advisor access to', advisorOrgIds.length, 'organization(s)')
        } else {
          console.log('ℹ️ OrganizationContext: No advisor access found either')
          setOrganizations([])
          setIsLoading(false)
          return
        }
      }

      // Get org IDs from either memberships or advisor access
      const orgIds = memberships && memberships.length > 0
        ? memberships.map(m => m.organization_id)
        : advisorOrgIds

      // Then fetch the organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      console.log('🏢 OrganizationContext: Organizations result:', { orgs, error: orgsError })

      if (orgsError) {
        console.error('❌ OrganizationContext: Error fetching organizations:', orgsError)
        setIsLoading(false)
        return
      }

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

        // Set role based on whether user is advisor or regular member
        if (isAdvisor) {
          setUserRole('advisor')
          console.log('👤 OrganizationContext: User role: advisor')
        } else {
          // Fetch the role for this organization
          const membership = memberships?.find((m: any) => m.organization_id === orgToSet.id)
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
      }
    } catch (error) {
      console.error('❌ OrganizationContext: Fatal error in fetchOrganizations:', error)
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [user, session, authLoading])

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

    // Check for regular membership first
    const { data: membership } = await supabase
      .from('organization_members')
      .select('roles!inner (name)')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      setUserRole((membership as any)?.roles?.name || null)
    } else {
      // Check for advisor access
      const { data: advisorAccess } = await supabase
        .from('advisor_organization_access')
        .select('id')
        .eq('organization_id', orgId)
        .eq('advisor_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      setUserRole(advisorAccess ? 'advisor' : null)
    }
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
        await fetchOrganizations();
    }
  };

  // Only fetch organizations when user ID changes (not on every user object reference change)
  useEffect(() => {
    if (authLoading) return

    const currentUserId = user?.id || null
    const userChanged = currentUserId !== lastFetchedUserIdRef.current

    if (userChanged) {
      lastFetchedUserIdRef.current = currentUserId
      if (user) {
        console.log('🔄 OrganizationContext: User changed, fetching organizations...')
        fetchOrganizations()
      } else {
        // User signed out
        setOrganizations([])
        setCurrentOrganization(null)
        setUserRole(null)
        setIsLoading(false)
      }
    }
  }, [user?.id, authLoading, fetchOrganizations])

  // Note: onAuthStateChanged callback is now only triggered on actual sign-in
  // (not on token refresh), so this won't cause unnecessary refetches
  useEffect(() => {
    if (onAuthStateChanged) {
      onAuthStateChanged(() => {
        console.log('🔄 OrganizationContext: User signed in, refetching organizations...')
        fetchOrganizations()
      })
    }
  }, [onAuthStateChanged, fetchOrganizations])

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
