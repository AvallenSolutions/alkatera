'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

export interface KnowledgeBankCategory {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  icon: string
  color: string
  sort_order: number
  created_at: string
  updated_at: string
  item_count?: number
}

export interface KnowledgeBankItem {
  id: string
  organization_id: string | null
  category_id: string
  title: string
  description: string | null
  content_type: 'document' | 'video' | 'link' | 'embedded'
  file_url: string | null
  file_name: string | null
  file_size: number
  mime_type: string | null
  thumbnail_url: string | null
  status: 'draft' | 'published' | 'archived'
  version: number
  author_id: string | null
  view_count: number
  download_count: number
  created_at: string
  updated_at: string
  published_at: string | null
  category?: KnowledgeBankCategory
  author?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  tags?: string[]
  is_favorited?: boolean
}

export interface KnowledgeBankTag {
  id: string
  organization_id: string | null
  name: string
  created_at: string
}

export function useKnowledgeBankCategories() {
  const { currentOrganization } = useOrganization()
  const [categories, setCategories] = useState<KnowledgeBankCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCategories() {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch both org-specific and global (platform) categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('knowledge_bank_categories')
          .select('*')
          .or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`)
          .order('sort_order', { ascending: true })

        if (categoriesError) throw categoriesError

        const categoriesWithCounts = await Promise.all(
          (categoriesData || []).map(async (category) => {
            const { count } = await supabase
              .from('knowledge_bank_items')
              .select('*', { count: 'exact', head: true })
              .eq('category_id', category.id)
              .eq('status', 'published')

            return {
              ...category,
              item_count: count || 0,
            }
          })
        )

        setCategories(categoriesWithCounts)
      } catch (err) {
        console.error('Error fetching categories:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch categories')
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [currentOrganization?.id])

  return { categories, loading, error, refetch: () => {} }
}

export function useKnowledgeBankItems(filters?: {
  categoryId?: string
  status?: string
  searchQuery?: string
  limit?: number
}) {
  const { currentOrganization } = useOrganization()
  const [items, setItems] = useState<KnowledgeBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchItems() {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch both org-specific and global (platform) items
        let query = supabase
          .from('knowledge_bank_items')
          .select(`
            *,
            category:knowledge_bank_categories(*),
            author:profiles(id, full_name, avatar_url)
          `)
          .or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`)

        if (filters?.categoryId) {
          query = query.eq('category_id', filters.categoryId)
        }

        if (filters?.status) {
          query = query.eq('status', filters.status)
        } else {
          query = query.eq('status', 'published')
        }

        if (filters?.searchQuery) {
          query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`)
        }

        if (filters?.limit) {
          query = query.limit(filters.limit)
        }

        query = query.order('created_at', { ascending: false })

        const { data, error: itemsError } = await query

        if (itemsError) throw itemsError

        const { data: { user } } = await supabase.auth.getUser()

        const itemsWithDetails = await Promise.all(
          (data || []).map(async (item) => {
            const { data: tagsData } = await supabase
              .from('knowledge_bank_item_tags')
              .select('tag:knowledge_bank_tags(name)')
              .eq('item_id', item.id)

            const tags = tagsData?.map((t: any) => t.tag?.name).filter(Boolean) || []

            let is_favorited = false
            if (user) {
              const { data: favData } = await supabase
                .from('knowledge_bank_favorites')
                .select('id')
                .eq('item_id', item.id)
                .eq('user_id', user.id)
                .maybeSingle()

              is_favorited = !!favData
            }

            return {
              ...item,
              tags,
              is_favorited,
            }
          })
        )

        setItems(itemsWithDetails)
      } catch (err) {
        console.error('Error fetching items:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch items')
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [currentOrganization?.id, filters?.categoryId, filters?.status, filters?.searchQuery, filters?.limit])

  return { items, loading, error }
}

export function useKnowledgeBankItem(itemId: string | null) {
  const [item, setItem] = useState<KnowledgeBankItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchItem() {
      if (!itemId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data, error: itemError } = await supabase
          .from('knowledge_bank_items')
          .select(`
            *,
            category:knowledge_bank_categories(*),
            author:profiles(id, full_name, avatar_url)
          `)
          .eq('id', itemId)
          .maybeSingle()

        if (itemError) throw itemError

        if (data) {
          const { data: tagsData } = await supabase
            .from('knowledge_bank_item_tags')
            .select('tag:knowledge_bank_tags(name)')
            .eq('item_id', data.id)

          const tags = tagsData?.map((t: any) => t.tag?.name).filter(Boolean) || []

          const { data: { user } } = await supabase.auth.getUser()
          let is_favorited = false
          if (user) {
            const { data: favData } = await supabase
              .from('knowledge_bank_favorites')
              .select('id')
              .eq('item_id', data.id)
              .eq('user_id', user.id)
              .maybeSingle()

            is_favorited = !!favData
          }

          setItem({
            ...data,
            tags,
            is_favorited,
          })
        }
      } catch (err) {
        console.error('Error fetching item:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch item')
      } finally {
        setLoading(false)
      }
    }

    fetchItem()
  }, [itemId])

  return { item, loading, error }
}

export function useRecentlyViewedItems(limit = 5) {
  const { currentOrganization } = useOrganization()
  const [items, setItems] = useState<KnowledgeBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRecentItems() {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data: viewsData, error: viewsError } = await supabase
          .from('knowledge_bank_views')
          .select('item_id, viewed_at')
          .eq('user_id', user.id)
          .order('viewed_at', { ascending: false })
          .limit(limit)

        if (viewsError) throw viewsError

        if (viewsData && viewsData.length > 0) {
          const itemIds = viewsData.map(v => v.item_id)

          const { data: itemsData, error: itemsError } = await supabase
            .from('knowledge_bank_items')
            .select(`
              *,
              category:knowledge_bank_categories(*)
            `)
            .in('id', itemIds)
            .eq('status', 'published')

          if (itemsError) throw itemsError

          const sortedItems = itemIds
            .map(id => itemsData?.find(item => item.id === id))
            .filter(Boolean) as KnowledgeBankItem[]

          setItems(sortedItems)
        }
      } catch (err) {
        console.error('Error fetching recent items:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch recent items')
      } finally {
        setLoading(false)
      }
    }

    fetchRecentItems()
  }, [currentOrganization?.id, limit])

  return { items, loading, error }
}

export function useFavoriteItems() {
  const { currentOrganization } = useOrganization()
  const [items, setItems] = useState<KnowledgeBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFavorites() {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data: favoritesData, error: favoritesError } = await supabase
          .from('knowledge_bank_favorites')
          .select(`
            item:knowledge_bank_items(
              *,
              category:knowledge_bank_categories(*)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (favoritesError) throw favoritesError

        const items = favoritesData?.map((f: any) => ({
          ...f.item,
          is_favorited: true,
        })).filter(item => item.status === 'published') || []

        setItems(items)
      } catch (err) {
        console.error('Error fetching favorites:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch favorites')
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [currentOrganization?.id])

  return { items, loading, error }
}
