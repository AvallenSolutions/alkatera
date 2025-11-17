'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from '@/hooks/useAuth'

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
  mutate: (newOrganization?: { organization: Organization; role: string }) => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()

  const fetchOrganizations = async () => {
    if (authLoading) {
      console.log('⏳ OrganizationContext: Waiting for auth to complete...')
      return
    }

    if (!user) {
      console.log('ℹ️ OrganizationContext: No user, skipping organization fetch')
      setIsLoading(false)
      return
    }

    try {
      console.log('📁 OrganizationContext: Fetching organizations for user:', user.id)

      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role_id,
          roles!inner (name),
          organizations!inner (
            id,
            name,
            slug,
            created_at
          )
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('❌ OrganizationContext: Error fetching organizations:', error)
        setIsLoading(false)
        return
      }

      const orgs = memberships
        ?.map((m: any) => m.organizations)
        .filter(Boolean) as Organization[]

      console.log(`✅ OrganizationContext: Found ${orgs?.length || 0} organization(s)`)
      setOrganizations(orgs || [])

      if (orgs && orgs.length > 0) {
        let savedOrgId: string | null = null

        try {
          if (typeof window !== 'undefined') {
            savedOrgId = localStorage.getItem('currentOrganizationId')
          }
        } catch (e) {
          console.warn('⚠️ OrganizationContext: Could not access localStorage')
        }

        const orgToSet = savedOrgId
          ? orgs.find(o => o.id === savedOrgId) || orgs[0]
          : orgs[0]

        console.log('📍 OrganizationContext: Setting current organization:', orgToSet.name)
        setCurrentOrganization(orgToSet)

        const membership = memberships?.find(
          (m: any) => m.organization_id === orgToSet.id
        ) as any
        setUserRole(membership?.roles?.name || null)

        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('currentOrganizationId', orgToSet.id)
          }
        } catch (e) {
          console.warn('⚠️ OrganizationContext: Could not save to localStorage')
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
    if (!org) {
      console.warn('⚠️ OrganizationContext: Organization not found:', orgId)
      return
    }

    if (!user) {
      console.warn('⚠️ OrganizationContext: Cannot switch organization, no user')
      return
    }

    console.log('🔄 OrganizationContext: Switching to organization:', org.name)
    setCurrentOrganization(org)

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentOrganizationId', orgId)
      }
    } catch (e) {
      console.warn('⚠️ OrganizationContext: Could not save to localStorage')
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role_id, roles!inner (name)')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()

    setUserRole((membership as any)?.roles?.name || null)
  }

  const refreshOrganizations = async () => {
    setIsLoading(true)
    await fetchOrganizations()
  }

  const mutate = async (newOrganization?: { organization: Organization; role: string }) => {
    if (newOrganization) {
      console.log('➕ OrganizationContext: Adding new organization:', newOrganization.organization.name)
      setOrganizations(prev => [...prev, newOrganization.organization])
      setCurrentOrganization(newOrganization.organization)
      setUserRole(newOrganization.role)

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentOrganizationId', newOrganization.organization.id)
        }
      } catch (e) {
        console.warn('⚠️ OrganizationContext: Could not save to localStorage')
      }
    } else {
      await refreshOrganizations()
    }
  }

  useEffect(() => {
    if (!authLoading) {
      fetchOrganizations()
    }
  }, [user, authLoading])

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        isLoading,
        userRole,
        switchOrganization,
        refreshOrganizations,
        mutate,
      }}
    >
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
