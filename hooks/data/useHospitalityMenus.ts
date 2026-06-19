'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MenuListItem } from '@/lib/hospitality/menu-types'

export interface MenuCreateInput {
  name: string
  venue_id?: string | null
  description?: string | null
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export function useHospitalityMenus() {
  const [menus, setMenus] = useState<MenuListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hospitality/menus', { credentials: 'include' })
      if (!res.ok) throw new Error(await readError(res))
      const body = await res.json()
      setMenus(body.menus ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load menus')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createMenu = useCallback(async (input: MenuCreateInput) => {
    const res = await fetch('/api/hospitality/menus', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await readError(res))
    const body = await res.json()
    await refresh()
    return body.menu as { id: string }
  }, [refresh])

  const deleteMenu = useCallback(async (id: string) => {
    const res = await fetch(`/api/hospitality/menus/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error(await readError(res))
    setMenus((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return { menus, isLoading, error, refresh, createMenu, deleteMenu }
}
