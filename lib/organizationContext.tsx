'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { setBootstrapCache, clearBootstrapCache } from '@/lib/auth/bootstrap-cache'
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

/**
 * Persist the active organisation to SERVER-ONLY app_metadata via the switch
 * route (CRIT-2), then refresh the session so the new app_metadata lands in the
 * JWT. Returns false on failure. user_metadata is no longer the source of truth
 * for tenant context; it remains only as a validated legacy fallback.
 */
async function persistCurrentOrg(orgId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/organizations/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId }),
    })
    if (!res.ok) {
      console.error('❌ OrganizationContext: Failed to persist current organisation:', res.status)
      return false
    }
    await supabase.auth.refreshSession()
    return true
  } catch (e) {
    console.error('❌ OrganizationContext: Error persisting current organisation:', e)
    return false
  }
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isFetchingRef = useRef(false)
  const lastFetchedUserIdRef = useRef<string | null>(null)
  const { user, session, loading: authLoading, onAuthStateChanged } = useAuth()

  // Listen for SIGNED_OUT directly on the Supabase auth listener so we clear
  // organisation state synchronously — before the next React render. Relying
  // on the user-id-change effect alone leaves a gap where the old
  // currentOrganization is still in state while the new session bootstraps.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        console.log('🧹 OrganizationContext: SIGNED_OUT — clearing state immediately')
        setOrganizations([])
        setCurrentOrganization(null)
        setUserRole(null)
        setIsLoading(false)
        lastFetchedUserIdRef.current = null
        clearBootstrapCache()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

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

    console.log('🔍 OrganizationContext: Fetching organizations')

    if (!session) {
      console.error('❌ OrganizationContext: No session available from AuthProvider')
      setIsLoading(false)
      return
    }

    console.log('✅ OrganizationContext: Session available')

    if (isFetchingRef.current) {
      console.log('⏳ OrganizationContext: Already fetching, skipping...')
      return
    }

    isFetchingRef.current = true
    setIsLoading(true)
    try {
      // ── Bootstrap fast-path (one round-trip) ─────────────────────────────
      // Try the single get_user_bootstrap() RPC. On success it gives us orgs +
      // role + subscription + admin in one call, replacing the membership →
      // organizations → (downstream) usage/admin waterfall. On ANY failure we
      // fall straight through to the legacy per-query path below, which is left
      // completely intact — so a bad/missing RPC can never break login.
      try {
        const claimOrgId =
          (user.app_metadata?.current_organization_id as string | undefined) ??
          (user.user_metadata?.current_organization_id as string | undefined) ??
          null
        const { data: boot, error: bootError } = await supabase.rpc('get_user_bootstrap', {
          p_current_org_id: claimOrgId,
        })

        // Strict validation — only commit if the shape is exactly what we expect.
        if (
          !bootError &&
          boot &&
          typeof boot === 'object' &&
          !(boot as any).error &&
          Array.isArray((boot as any).organizations)
        ) {
          const b = boot as any
          const kind = b.kind as string

          // Supplier: mirror the legacy supplier early-return.
          if (kind === 'supplier') {
            const orgs = b.organizations as Organization[]
            if (orgs.length > 0) {
              setOrganizations(orgs)
              setCurrentOrganization(orgs[0])
            }
            setUserRole('supplier')
            setIsLoading(false)
            isFetchingRef.current = false
            return
          }

          // 'none' (no memberships, not a supplier) — let the legacy path handle
          // the is_supplier-metadata edge case + create-organization redirect.
          if (kind === 'member' && b.organizations.length > 0) {
            const orgs = b.organizations as Organization[]
            const resolvedId = b.current_organization_id as string | null
            const orgToSet = orgs.find(o => o.id === resolvedId) || orgs[0]

            // Populate the hand-off cache BEFORE setting state, so the
            // downstream useSubscription / Sidebar effects (which gate on the
            // org id we're about to set) read it instead of firing their own RPCs.
            // Only cache a subscription that looks valid (has a tier); anything
            // else → null, so useSubscription falls through to its live fetch.
            const sub = b.subscription as any
            const validSub = sub && typeof sub === 'object' && sub.tier ? sub : null
            setBootstrapCache(orgToSet.id, {
              subscription: validSub,
              isAlkateraAdmin: !!b.is_alkatera_admin,
              pendingApprovalCount: Number(b.pending_approval_count) || 0,
            })

            setOrganizations(orgs)
            setCurrentOrganization(orgToSet)
            setUserRole((b.user_role as string | null) ?? null)

            // Background the session-sync write (don't block first paint). Same
            // effect as the legacy inline block, just not awaited.
            if (orgToSet.id !== claimOrgId) {
              void supabase.auth
                .updateUser({ data: { current_organization_id: orgToSet.id } })
                .then(() => persistCurrentOrg(orgToSet.id))
                .catch(() => {})
            }

            setIsLoading(false)
            isFetchingRef.current = false
            return
          }
          // kind 'none'/'member'-with-no-orgs → fall through to legacy path.
        }
      } catch (bootErr) {
        // Swallow and fall through to the legacy path — never let the bootstrap
        // attempt itself break the boot.
        console.warn('OrganizationContext: bootstrap RPC unavailable, using legacy path', bootErr)
      }

      // Fast-path: if session metadata already flags this user as a supplier,
      // resolve immediately without waiting for membership + RPC queries.
      // This prevents the race condition where AppLayout redirects to
      // /create-organization before the supplier context RPC completes.
      if (user.user_metadata?.is_supplier) {
        console.log('👤 OrganizationContext: Fast-path supplier detection from metadata')
        // Still try to get org context for display purposes
        const { data: supplierCtx } = await supabase.rpc('get_supplier_context')
        if (supplierCtx && supplierCtx.length > 0 && supplierCtx[0].organization_id) {
          const ctx = supplierCtx[0]
          const supplierOrg: Organization = {
            id: ctx.organization_id,
            name: ctx.organization_name,
            slug: ctx.organization_slug,
            created_at: '',
          }
          setOrganizations([supplierOrg])
          setCurrentOrganization(supplierOrg)
        }
        setUserRole('supplier')
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      // ── Parallel Group 1: memberships (with role join) + advisor access ──
      const [membershipsResult, advisorResult] = await Promise.all([
        supabase
          .from('organization_members')
          .select('organization_id, role_id, roles!inner(name)')
          .eq('user_id', user.id),
        supabase
          .from('advisor_organization_access')
          .select('organization_id')
          .eq('advisor_user_id', user.id)
          .eq('is_active', true),
      ])

      const memberships = membershipsResult.data
      const membershipsError = membershipsResult.error
      const advisorAccess = advisorResult.data
      const advisorError = advisorResult.error

      console.log('📊 OrganizationContext: Parallel fetch complete', {
        memberships: memberships?.length ?? 0,
        advisorOrgs: advisorAccess?.length ?? 0,
      })

      if (membershipsError) {
        console.error('❌ OrganizationContext: Error fetching memberships:', membershipsError)
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      // Check if user has org memberships — org members are NEVER treated as suppliers,
      // even if they also have a supplier record (e.g. from testing).
      // Membership takes priority over supplier role.
      const hasMemberships = memberships && memberships.length > 0

      // Only check supplier status if user has NO org memberships.
      // Suppliers are external users who should not be in organization_members.
      if (!hasMemberships) {
        // Uses SECURITY DEFINER RPC to bypass RLS during this bootstrap check.
        const { data: supplierCtx, error: supplierError } = await supabase
          .rpc('get_supplier_context')

        if (!supplierError && supplierCtx && supplierCtx.length > 0) {
          const ctx = supplierCtx[0]
          console.log('👤 OrganizationContext: User is a supplier')

          // Suppliers may not have an org link (self-registered).
          // Set role to 'supplier' regardless — the portal works without an org.
          if (ctx.organization_id) {
            const supplierOrg: Organization = {
              id: ctx.organization_id,
              name: ctx.organization_name,
              slug: ctx.organization_slug,
              created_at: '',
            }
            setOrganizations([supplierOrg])
            setCurrentOrganization(supplierOrg)
          }
          setUserRole('supplier')
          setIsLoading(false)
          isFetchingRef.current = false
          return
        }

        // Fallback: if get_supplier_context() returned nothing but user metadata
        // flags them as a supplier (set during registration/invitation acceptance).
        // This catches timing issues, migration lag, or NULL org_id with old INNER JOIN.
        if (user.user_metadata?.is_supplier) {
          console.log('👤 OrganizationContext: User is supplier (from metadata fallback)')
          setUserRole('supplier')
          setIsLoading(false)
          isFetchingRef.current = false
          return
        }
      }

      const advisorOrgIds = (!advisorError && advisorAccess) ? advisorAccess.map(a => a.organization_id) : []
      const memberOrgIds = memberships ? memberships.map(m => m.organization_id) : []

      // Merge and deduplicate membership + advisor org IDs
      const allOrgIds = Array.from(new Set([...memberOrgIds, ...advisorOrgIds]))

      if (allOrgIds.length === 0) {
        console.log('ℹ️ OrganizationContext: No memberships or advisor access found')
        setOrganizations([])
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      // ── Group 2: Fetch org details (depends on merged IDs) ──
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', allOrgIds)

      if (orgsError) {
        console.error('❌ OrganizationContext: Error fetching organizations:', orgsError)
        setIsLoading(false)
        return
      }

      console.log('🏢 OrganizationContext: Found organizations:', orgs?.length || 0)
      setOrganizations(orgs || [])

      if (orgs && orgs.length > 0) {
        const currentOrgIdFromSession =
          user.app_metadata?.current_organization_id ?? user.user_metadata?.current_organization_id

        const orgToSet = orgs.find((o: any) => o.id === currentOrgIdFromSession) || orgs[0]
        setCurrentOrganization(orgToSet)

        if (orgToSet.id !== currentOrgIdFromSession) {
            console.log('🔧 OrganizationContext: Syncing session with default organization.')
            await supabase.auth.updateUser({ data: { current_organization_id: orgToSet.id } })
            await persistCurrentOrg(orgToSet.id)
        }

        // Set role from the already-fetched membership data (includes role name via join).
        // No separate roles query needed.
        const membership = memberships?.find((m: any) => m.organization_id === orgToSet.id)
        const isAdvisorForThisOrg = advisorOrgIds.includes(orgToSet.id)

        if (membership) {
          setUserRole((membership as any)?.roles?.name || null)
          console.log('👤 OrganizationContext: User role:', (membership as any)?.roles?.name)
        } else if (isAdvisorForThisOrg) {
          setUserRole('advisor')
          console.log('👤 OrganizationContext: User role: advisor')
        } else {
          setUserRole(null)
        }
      }
    } catch (error) {
      console.error('❌ OrganizationContext: Fatal error in fetchOrganizations:', error)
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [user, session, authLoading])

  const switchOrganization = useCallback(async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    if (!org || !user) return

    // The bootstrap hand-off cache is scoped to the previously-resolved org;
    // clear it so post-switch subscription/admin reads go live for the new org.
    clearBootstrapCache()
    setCurrentOrganization(org)

    // Write user_metadata (instant, and keeps working with the pre-migration RLS
    // function) AND the server-only app_metadata source (preferred post-migration).
    const { error } = await supabase.auth.updateUser({ data: { current_organization_id: orgId } })
    if (error) {
        console.error('❌ OrganizationContext: Error updating user metadata:', error)
        return;
    }
    await persistCurrentOrg(orgId)

    // CRITICAL: Check if user is a supplier first (authoritative check)
    const { data: supplierCtx } = await supabase.rpc('get_supplier_context')

    if (supplierCtx && supplierCtx.length > 0) {
      setUserRole('supplier')
    } else {
      // Check for regular membership
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
  }, [organizations, user])

  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations()
  }, [fetchOrganizations])

  const mutate = useCallback(async (newOrgPayload?: { organization: Organization; role: string; user: User }) => {
    if (newOrgPayload) {
        const { organization, role } = newOrgPayload;
        setOrganizations(prev => [...prev, organization]);
        setCurrentOrganization(organization);
        setUserRole(role);

        // Keep user_metadata for instant UI on the new-user path, and also set
        // the server-only app_metadata source (CRIT-2) via the switch route.
        const { error } = await supabase.auth.updateUser({
            data: {
                current_organization_id: organization.id
            }
        });

        if (error) {
            console.error('❌ OrganizationContext: Error setting initial organization for new user:', error);
        }

        await persistCurrentOrg(organization.id);

    } else {
        await fetchOrganizations();
    }
  }, [fetchOrganizations]);

  // Fetch organizations when user ID changes, or when is_supplier metadata appears
  // (after invite acceptance + session refresh, the user ID stays the same but
  // the metadata updates — we need to re-fetch to pick up the supplier role).
  const isSupplierMeta = user?.user_metadata?.is_supplier === true
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
    } else if (isSupplierMeta && userRole !== 'supplier') {
      // Metadata updated (e.g. after invite acceptance) but user ID unchanged
      console.log('🔄 OrganizationContext: Supplier metadata detected, re-fetching...')
      fetchOrganizations()
    }
  }, [user?.id, isSupplierMeta, authLoading, fetchOrganizations, userRole])

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

  const value = useMemo(() => ({
    currentOrganization,
    organizations,
    isLoading,
    userRole,
    switchOrganization,
    refreshOrganizations,
    mutate,
  }), [currentOrganization, organizations, isLoading, userRole, switchOrganization, refreshOrganizations, mutate])

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
