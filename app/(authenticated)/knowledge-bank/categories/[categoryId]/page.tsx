'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft } from 'lucide-react'
import { useKnowledgeBankItems } from '@/hooks/data/useKnowledgeBank'
import { KnowledgeBankCard } from '@/components/knowledge-bank/KnowledgeBankCard'
import { supabase } from '@/lib/supabaseClient'

export default function CategoryPage() {
  const params = useParams()
  const categoryId = params?.categoryId as string

  const [category, setCategory] = useState<any>(null)
  const [categoryLoading, setCategoryLoading] = useState(true)

  const { items, loading: itemsLoading } = useKnowledgeBankItems({
    categoryId,
  })

  useEffect(() => {
    async function fetchCategory() {
      if (!categoryId) return

      try {
        setCategoryLoading(true)
        const { data, error } = await supabase
          .from('knowledge_bank_categories')
          .select('*')
          .eq('id', categoryId)
          .maybeSingle()

        if (error) throw error
        setCategory(data)
      } catch (error) {
        console.error('Error fetching category:', error)
      } finally {
        setCategoryLoading(false)
      }
    }

    fetchCategory()
  }, [categoryId])

  if (categoryLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/knowledge-bank">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Bank
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Category not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/knowledge-bank">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Knowledge Bank
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground mt-2">{category.description}</p>
        )}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'resource' : 'resources'}
          </span>
        </div>
      </div>

      {itemsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No resources in this category yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <KnowledgeBankCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
