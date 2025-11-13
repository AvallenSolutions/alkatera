import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface UpdateProfileData {
  full_name?: string | null
  phone?: string | null
  avatar_url?: string | null
}

interface UseProfileResult {
  profile: Profile | null
  isLoading: boolean
  error: Error | null
  updateProfile: (data: UpdateProfileData) => Promise<void>
  isUpdating: boolean
  updateError: Error | null
  refetch: () => Promise<void>
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<Error | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()
  }, [])

  const fetchProfile = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const supabase = createClient();
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        throw new Error(profileError.message)
      }

      setProfile(profileData as Profile)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile'
      setError(new Error(errorMessage))
      console.error('Error fetching profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const updateProfile = async (data: UpdateProfileData) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      setIsUpdating(true)
      setUpdateError(null)

      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      }

      const supabase = createClient();
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        throw new Error(updateError.message)
      }

      setProfile(updatedProfile as Profile)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      setUpdateError(new Error(errorMessage))
      console.error('Error updating profile:', err)
      throw err
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    isUpdating,
    updateError,
    refetch: fetchProfile,
  }
}
