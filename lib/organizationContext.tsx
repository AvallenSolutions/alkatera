'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

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
  const supabase = createClientComponentClient()
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchOrganizations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoading(false)
        return
      }

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
        console.error('Error fetching organizations:', error)
        setIsLoading(false)
        return
      }

      const orgs = memberships
        ?.map((m: any) => m.organizations)
        .filter(Boolean) as Organization[]

      setOrganizations(orgs || [])

      if (orgs && orgs.length > 0) {
        const savedOrgId = localStorage.getItem('currentOrganizationId')
        const orgToSet = savedOrgId
          ? orgs.find(o => o.id === savedOrgId) || orgs[0]
          : orgs[0]

        setCurrentOrganization(orgToSet)

        const membership = memberships?.find(
          (m: any) => m.organization_id === orgToSet.id
        ) as any
        setUserRole(membership?.roles?.name || null)

        localStorage.setItem('currentOrganizationId', orgToSet.id)
      }
    } catch (error) {
      console.error('Error in fetchOrganizations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const switchOrganization = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    if (org) {
      setCurrentOrganization(org)
      localStorage.setItem('currentOrganizationId', orgId)

      const { data: membership } = await supabase
        .from('organization_members')
        .select('role_id, roles!inner (name)')
        .eq('organization_id', orgId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle()

      setUserRole((membership as any)?.roles?.name || null)
    }
  }

  const refreshOrganizations = async () => {
    setIsLoading(true)
    await fetchOrganizations()
  }

  const mutate = async (newOrganization?: { organization: Organization; role: string }) => {
    if (newOrganization) {
      setOrganizations(prev => [...prev, newOrganization.organization])
      setCurrentOrganization(newOrganization.organization)
      setUserRole(newOrganization.role)
      localStorage.setItem('currentOrganizationId', newOrganization.organization.id)
    } else {
      await refreshOrganizations()
    }
  }

  useEffect(() => {
    fetchOrganizations()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchOrganizations()
      } else if (event === 'SIGNED_OUT') {
        setCurrentOrganization(null)
        setOrganizations([])
        setUserRole(null)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
