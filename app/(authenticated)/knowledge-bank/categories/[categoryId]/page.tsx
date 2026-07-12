'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useKnowledgeBankItems } from '@/hooks/data/useKnowledgeBank'
import { KnowledgeBankCard } from '@/components/knowledge-bank/KnowledgeBankCard'
import { Statement } from '@/components/studio/statement'
import { BigNumber } from '@/components/studio/big-number'
import { Panel } from '@/components/studio/panel'
import { PillButton } from '@/components/studio/pill-button'
import { PageLoader } from '@/components/ui/page-loader'
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
    return <PageLoader />
  }

  if (!category) {
    return (
      <div className="space-y-6">
        <PillButton variant="ghost" href="/knowledge-bank">
          <ChevronLeft className="h-4 w-4" />
          Back to the library
        </PillButton>
        <Panel>
          <p className="py-8 text-center text-sm text-studio-dim">Category not found.</p>
        </Panel>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PillButton variant="ghost" href="/knowledge-bank">
        <ChevronLeft className="h-4 w-4" />
        Back to the library
      </PillButton>

      <Statement eyebrow="THE LIBRARY · KNOWLEDGE" headline={category.name}>
        <BigNumber
          value={items.length}
          label={items.length === 1 ? 'RESOURCE' : 'RESOURCES'}
          size="display"
        />
      </Statement>

      {category.description && (
        <p className="max-w-2xl text-sm leading-relaxed text-studio-dim">{category.description}</p>
      )}

      {itemsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-[6px] bg-studio-hairline/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Panel>
          <p className="py-8 text-center text-sm text-studio-dim">
            No resources in this category yet.
          </p>
        </Panel>
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
