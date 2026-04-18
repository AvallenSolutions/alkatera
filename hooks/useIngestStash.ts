'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Pick up a file stashed by the Universal Dropzone.
 *
 * When the dropzone classifies a document as a spray diary or soil-carbon
 * evidence, it uploads the file to the `ingest-staging` bucket and deep-links
 * to the target page with `?stash_id=<path>&stash_kind=<kind>`. Target pages
 * (the three growing-profile questionnaires) call this hook with the kind
 * they handle; the hook downloads the blob, hands it to the consumer as a
 * File, then cleans up the stash and clears the URL params.
 *
 * @param kind     the stash_kind this page is responsible for
 * @param onFile   called once, with the resolved File, when the stash is ready
 */
export function useIngestStash(
  kind: 'spray' | 'evidence' | 'bom',
  onFile: (file: File) => void | Promise<void>,
) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    const stashId = searchParams?.get('stash_id') || null
    const stashKind = searchParams?.get('stash_kind') || null
    if (!stashId || stashKind !== kind) return

    let cancelled = false
    setPicking(true)

    const pickup = async () => {
      try {
        const res = await fetch(
          `/api/ingest/stash?path=${encodeURIComponent(stashId)}`,
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Stashed file not found')
        }
        const { signedUrl, fileName } = (await res.json()) as {
          signedUrl: string
          fileName: string
        }
        const fileRes = await fetch(signedUrl)
        if (!fileRes.ok) throw new Error('Failed to download stashed file')
        const blob = await fileRes.blob()
        const file = new File([blob], fileName, { type: blob.type })
        if (cancelled) return

        await onFile(file)

        // Fire-and-forget cleanup; the bucket has no TTL, so we delete on
        // successful pickup. If it fails (offline, RLS drift), orphans are
        // harmless — they just cost a few KB until manually cleared.
        fetch(`/api/ingest/stash?path=${encodeURIComponent(stashId)}`, {
          method: 'DELETE',
        }).catch(() => { /* swallow */ })

        // Strip the stash params from the URL so a refresh doesn't re-pick.
        const next = new URLSearchParams(searchParams?.toString() || '')
        next.delete('stash_id')
        next.delete('stash_kind')
        const q = next.toString()
        router.replace(q ? `${pathname}?${q}` : pathname)
      } catch (err: any) {
        if (cancelled) return
        toast.error(err.message || 'Could not pick up the uploaded file')
      } finally {
        if (!cancelled) setPicking(false)
      }
    }

    pickup()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, kind])

  return { picking }
}
