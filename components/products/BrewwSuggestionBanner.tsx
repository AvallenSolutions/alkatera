'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { Sparkles, X } from 'lucide-react'

interface BrewwSuggestionBannerProps {
  productId: string | number
  productName: string
}

// Suggests a Breww SKU to link when the product name fuzzy-matches an
// unlinked SKU. Dismissable per-product via localStorage.
export function BrewwSuggestionBanner({ productId, productName }: BrewwSuggestionBannerProps) {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [suggestion, setSuggestion] = useState<{ external_id: string; name: string } | null>(null)
  const [linking, setLinking] = useState(false)

  const dismissKey = `breww-suggestion-dismissed-${productId}`

  useEffect(() => {
    if (!orgId) return
    if (typeof window !== 'undefined' && window.localStorage.getItem(dismissKey)) return

    let cancelled = false
    ;(async () => {
      // Skip if already linked
      const { data: existingLink } = await supabase
        .from('breww_product_links')
        .select('id')
        .eq('organization_id', orgId)
        .eq('alkatera_product_id', Number(productId))
        .maybeSingle()
      if (existingLink || cancelled) return

      // Fetch unlinked SKUs and find best fuzzy match
      const { data: skus } = await supabase
        .from('breww_skus')
        .select('external_id, name, obsolete')
        .eq('organization_id', orgId)
      if (!skus || cancelled) return

      const { data: links } = await supabase
        .from('breww_product_links')
        .select('breww_sku_external_id')
        .eq('organization_id', orgId)
      const linkedIds = new Set((links ?? []).map((l) => l.breww_sku_external_id))

      const candidates = skus.filter((s) => !s.obsolete && !linkedIds.has(s.external_id))
      const best = bestMatch(productName, candidates.map((c) => c.name))
      if (best && best.score >= 0.6) {
        const match = candidates.find((c) => c.name === best.value)
        if (match) setSuggestion({ external_id: match.external_id, name: match.name })
      }
    })()
    return () => { cancelled = true }
  }, [orgId, productId, productName, dismissKey])

  const handleLink = async () => {
    if (!orgId || !suggestion) return
    setLinking(true)
    try {
      const res = await fetch('/api/integrations/breww/link-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          brewwSkuExternalId: suggestion.external_id,
          alkateraProductId: Number(productId),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Link failed')
      }
      toast.success(`Linked to Breww SKU "${suggestion.name}"`)
      window.localStorage.removeItem(dismissKey)
      setSuggestion(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Link failed')
    } finally {
      setLinking(false)
    }
  }

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(dismissKey, '1')
    }
    setSuggestion(null)
  }

  if (!suggestion) return null

  return (
    <div className="rounded-lg border border-[#ccff00]/40 bg-[#ccff00]/10 p-3 flex items-start gap-3">
      <Sparkles className="h-4 w-4 text-[#8da300] dark:text-[#ccff00] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          This product looks like your Breww SKU{' '}
          <strong>&ldquo;{suggestion.name}&rdquo;</strong>.
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Link them so production volumes, recipes and packaging flow automatically.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" onClick={handleLink} disabled={linking} className="h-7 text-xs">
            Link now
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-7 text-xs">
            Dismiss
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// Simple normalised-Levenshtein similarity score 0..1
function bestMatch(target: string, candidates: string[]): { value: string; score: number } | null {
  if (candidates.length === 0) return null
  const t = normalise(target)
  let best: { value: string; score: number } | null = null
  for (const c of candidates) {
    const n = normalise(c)
    const score = similarity(t, n)
    if (!best || score > best.score) best = { value: c, score }
  }
  return best
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1
  const distance = levenshtein(longer, shorter)
  return (longer.length - distance) / longer.length
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[b.length][a.length]
}
