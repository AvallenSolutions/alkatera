'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Star, TrendingUp, Clock } from 'lucide-react'
import { Eyebrow } from '@/components/studio/eyebrow'
import { BigNumber } from '@/components/studio/big-number'
import {
  useKnowledgeBankCategories,
  useKnowledgeBankItems,
  useRecentlyViewedItems,
  useFavoriteItems,
} from '@/hooks/data/useKnowledgeBank'
import { CategoryGrid } from '@/components/knowledge-bank/CategoryGrid'
import { KnowledgeBankCard } from '@/components/knowledge-bank/KnowledgeBankCard'
import { RecentActivity } from '@/components/knowledge-bank/RecentActivity'
import { SearchAndFilter } from '@/components/knowledge-bank/SearchAndFilter'

export default function KnowledgeBankPage() {
  const { categories, loading: categoriesLoading } = useKnowledgeBankCategories()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('newest')

  const { items, loading: itemsLoading } = useKnowledgeBankItems({
    searchQuery: searchQuery || undefined,
    categoryId: categoryFilter || undefined,
  })

  const { items: recentItems, loading: recentLoading } = useRecentlyViewedItems(5)
  const { items: favoriteItems, loading: favoritesLoading } = useFavoriteItems()

  const [filteredItems, setFilteredItems] = useState(items)

  useEffect(() => {
    let filtered = [...items]

    if (contentTypeFilter) {
      filtered = filtered.filter(item => item.content_type === contentTypeFilter)
    }

    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'most-viewed':
        filtered.sort((a, b) => b.view_count - a.view_count)
        break
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    setFilteredItems(filtered)
  }, [items, contentTypeFilter, sortBy])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleFilterCategory = (categoryId: string | null) => {
    setCategoryFilter(categoryId)
  }

  const handleFilterContentType = (contentType: string | null) => {
    setContentTypeFilter(contentType)
  }

  const handleSort = (sort: string) => {
    setSortBy(sort)
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="mb-3">THE EVIDENCE · KNOWLEDGE</Eyebrow>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
            The knowledge.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Access training materials, templates, and documentation
          </p>
        </div>
        <Button asChild>
          <Link href="/knowledge-bank/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Resource
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 rounded-[6px]">
          <CardHeader>
            <CardTitle className="text-lg">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-8">
              <BigNumber value={items.length} label="TOTAL RESOURCES" />
              <BigNumber value={categories.length} label="CATEGORIES" />
              <BigNumber value={favoriteItems.length} label="FAVOURITES" />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <RecentActivity
            title="Recently Viewed"
            items={recentItems}
            icon={Clock}
            emptyMessage="You haven't viewed any resources yet"
          />

          {favoriteItems.length > 0 && (
            <RecentActivity
              title="Your Favourites"
              items={favoriteItems.slice(0, 5)}
              icon={Star}
              emptyMessage="No favourite resources yet"
            />
          )}
        </div>
      </div>

      <div>
        <Eyebrow tone="dim" className="mb-4">BROWSE BY CATEGORY</Eyebrow>
        {categoriesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="rounded-[6px]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-14 w-14 rounded-[6px]" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <CategoryGrid categories={categories} />
        )}
      </div>

      <div>
        <Eyebrow tone="dim" className="mb-4">ALL RESOURCES</Eyebrow>
        <div className="space-y-4">
          <SearchAndFilter
            categories={categories}
            onSearch={handleSearch}
            onFilterCategory={handleFilterCategory}
            onFilterContentType={handleFilterContentType}
            onSort={handleSort}
          />

          {itemsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="rounded-[6px]">
                  <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-12 w-12 rounded-[6px]" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="rounded-[6px]">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery || categoryFilter || contentTypeFilter
                    ? 'No resources found matching your criteria'
                    : 'No resources available yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <KnowledgeBankCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
