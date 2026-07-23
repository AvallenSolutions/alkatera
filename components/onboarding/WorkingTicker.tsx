'use client'

import { useEffect, useRef, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'

/**
 * The working ticker: a single mono line that shows what alkatera is actually
 * doing in the background while the user answers the next question. It reads
 * real job events, never a fake progress animation:
 *
 *   Reading avallenspirits.com. → Companies House: Avallen Spirits Ltd,
 *   incorporated 2018. → Found 3 products.
 *
 * Sourced from the same scrape job the ritual already runs
 * (personalization.scrapeJobId, polled at GET /api/products/import-from-url/
 * [jobId]) plus the Companies House facts the website step stashes. It shows
 * the latest event and quietly renders nothing until there is something honest
 * to say; a failed scrape simply stops it — never an alarm.
 */

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  const host = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]
  return host || null
}

export function WorkingTicker() {
  const { state } = useOnboarding()
  const p = state.personalization ?? {}
  const jobId = p.scrapeJobId
  const host = hostOf(p.websiteUrl)
  const companiesHouse = p.companiesHouse

  const [lines, setLines] = useState<string[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const doneRef = useRef(false)

  const push = (line: string) => {
    if (seenRef.current.has(line)) return
    seenRef.current.add(line)
    setLines(prev => [...prev, line])
  }

  // Opening line: what we're reading.
  useEffect(() => {
    if (host) push(`Reading ${host}.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])

  // Poll the scrape job for real progress and its finds.
  useEffect(() => {
    if (!jobId || doneRef.current) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/products/import-from-url/${jobId}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        if (data?.status === 'completed') {
          doneRef.current = true
          const products = Array.isArray(data.products) ? data.products : []
          if (products.length > 0) {
            push(`Found ${products.length} product${products.length === 1 ? '' : 's'}.`)
          }
          if (data.brandMetadata?.logo_url) push('Found your logo.')
        } else if (data?.status === 'failed') {
          doneRef.current = true
        }
      } catch {
        // Best-effort; a transient poll failure just means one fewer line.
      }
    }
    tick()
    const iv = setInterval(() => {
      if (doneRef.current) { clearInterval(iv); return }
      tick()
    }, 1800)
    return () => { cancelled = true; clearInterval(iv) }
  }, [jobId])

  // Companies House facts, once the parallel lookup lands.
  useEffect(() => {
    if (!companiesHouse?.name) return
    const yr = companiesHouse.incorporationYear
    push(yr ? `Companies House: ${companiesHouse.name}, incorporated ${yr}.` : `Companies House: ${companiesHouse.name}.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesHouse])

  if (!lines.length) return null
  const visible = lines[lines.length - 1]

  return (
    <div className="flex items-center justify-center gap-2.5" aria-live="polite">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-studio-forest motion-safe:animate-pulse" />
      <span key={visible} className="font-mono text-[10.5px] tracking-[0.08em] text-studio-dim animate-in fade-in duration-300">
        {visible}
      </span>
    </div>
  )
}
