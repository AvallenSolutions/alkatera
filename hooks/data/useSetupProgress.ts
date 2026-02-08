'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useOrganization } from '@/lib/organizationContext'

export interface SetupMilestone {
  key: string
  label: string
  done: boolean
  href: string
}

export interface SetupProgress {
  hasFacilities: boolean
  hasProducts: boolean
  hasSuppliers: boolean
  hasTeamMembers: boolean
  facilitiesCount: number
  productsCount: number
  suppliersCount: number
  membersCount: number
  milestones: SetupMilestone[]
  completedCount: number
  totalCount: number
  percentage: number
  isComplete: boolean
  isLoading: boolean
  isDismissed: boolean
  dismiss: () => void
  refetch: () => void
}

function getDismissKey(orgId: string) {
  return `alkatera_setup_dismissed_${orgId}`
}

export function useSetupProgress(): SetupProgress {
  const { currentOrganization } = useOrganization()
  const supabase = getSupabaseBrowserClient()

  const [facilitiesCount, setFacilitiesCount] = useState(0)
  const [productsCount, setProductsCount] = useState(0)
  const [suppliersCount, setSuppliersCount] = useState(0)
  const [membersCount, setMembersCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)

  const orgId = currentOrganization?.id

  // Generation counter to guard against stale responses when org changes
  const fetchGenRef = useRef(0)

  // Check dismissed state on mount
  useEffect(() => {
    if (!orgId) return
    const dismissed = localStorage.getItem(getDismissKey(orgId))
    setIsDismissed(dismissed === 'true')
  }, [orgId])

  const fetchCounts = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false)
      return
    }

    const generation = ++fetchGenRef.current
    setIsLoading(true)

    try {
      const [facilities, products, suppliers, members] = await Promise.all([
        supabase
          .from('facilities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),
        supabase
          .from('organization_suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),
      ])

      // Discard stale response if org changed during fetch
      if (generation !== fetchGenRef.current) return

      setFacilitiesCount(facilities.count ?? 0)
      setProductsCount(products.count ?? 0)
      setSuppliersCount(suppliers.count ?? 0)
      setMembersCount(members.count ?? 0)
    } catch (err) {
      if (generation !== fetchGenRef.current) return
      console.error('Error fetching setup progress:', err)
    } finally {
      if (generation === fetchGenRef.current) {
        setIsLoading(false)
      }
    }
  }, [orgId, supabase])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  const hasFacilities = facilitiesCount > 0
  const hasProducts = productsCount > 0
  const hasSuppliers = suppliersCount > 0
  const hasTeamMembers = membersCount > 1

  const milestones: SetupMilestone[] = [
    { key: 'facilities', label: 'Add a facility', done: hasFacilities, href: '/company/facilities' },
    { key: 'products', label: 'Create a product', done: hasProducts, href: '/products/new' },
    { key: 'suppliers', label: 'Add a supplier', done: hasSuppliers, href: '/suppliers' },
    { key: 'team', label: 'Invite a team member', done: hasTeamMembers, href: '/settings' },
  ]

  const completedCount = milestones.filter(m => m.done).length
  const totalCount = milestones.length
  const percentage = Math.round((completedCount / totalCount) * 100)
  const isComplete = completedCount === totalCount

  const dismiss = useCallback(() => {
    if (!orgId) return
    localStorage.setItem(getDismissKey(orgId), 'true')
    setIsDismissed(true)
  }, [orgId])

  return {
    hasFacilities,
    hasProducts,
    hasSuppliers,
    hasTeamMembers,
    facilitiesCount,
    productsCount,
    suppliersCount,
    membersCount,
    milestones,
    completedCount,
    totalCount,
    percentage,
    isComplete,
    isLoading,
    isDismissed,
    dismiss,
    refetch: fetchCounts,
  }
}
