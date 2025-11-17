import { SupportedStorage } from '@supabase/supabase-js'

export function createBrowserCookieStorage(): SupportedStorage {
  return {
    getItem: (key: string): string | null => {
      if (typeof document === 'undefined') {
        return null
      }

      const cookies = document.cookie.split(';')
      for (const cookie of cookies) {
        const [cookieKey, cookieValue] = cookie.trim().split('=')
        if (cookieKey === key) {
          return decodeURIComponent(cookieValue)
        }
      }
      return null
    },

    setItem: (key: string, value: string): void => {
      if (typeof document === 'undefined') {
        return
      }

      const maxAge = 60 * 60 * 24 * 7
      const isSecure = window.location.protocol === 'https:'

      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? '; Secure' : ''}`
    },

    removeItem: (key: string): void => {
      if (typeof document === 'undefined') {
        return
      }

      document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`
    },
  }
}
