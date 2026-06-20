'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_HOSPITALITY_SETTINGS, type HospitalitySettings } from '@/lib/hospitality/settings'

export function useHospitalitySettings() {
  const [settings, setSettings] = useState<HospitalitySettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/hospitality/settings', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const body = await res.json()
      setSettings(body.settings ?? { ...DEFAULT_HOSPITALITY_SETTINGS })
    } catch {
      setSettings({ ...DEFAULT_HOSPITALITY_SETTINGS })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (choice: { meals: boolean; drinks: boolean; rooms: boolean }) => {
      const res = await fetch('/api/hospitality/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(choice),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Could not save')
      }
      const body = await res.json()
      setSettings(body.settings)
      return body.settings as HospitalitySettings
    },
    [],
  )

  return { settings, isLoading, refresh, save }
}
