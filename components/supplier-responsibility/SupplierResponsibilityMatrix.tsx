'use client'

/**
 * Matrix view for supplier-responsibility attestations. Six hairline fact
 * rows, each a yes/no toggle with optional notes + evidence URL. Owns its
 * own statement so the coverage number can stand right in the headline.
 */

import { useCallback, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ExternalLink } from 'lucide-react'
import { Statement } from '@/components/studio/statement'
import { BigNumber } from '@/components/studio/big-number'
import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
import {
  SUPPLIER_ATTESTATIONS,
  type SupplierAttestationType,
} from '@/lib/supplier-responsibility/attestation-types'

interface DeclaredAttestation {
  attestation_type: SupplierAttestationType
  is_attested: boolean
  evidence_url: string | null
  notes: string | null
}

const studioField =
  'rounded-[6px] border-studio-hairline bg-studio-cream text-xs text-foreground placeholder:text-studio-dim'

export function SupplierResponsibilityMatrix() {
  const [declared, setDeclared] = useState<Map<SupplierAttestationType, DeclaredAttestation> | null>(null)
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({})
  const [pendingUrls, setPendingUrls] = useState<Record<string, string>>({})
  const [savingType, setSavingType] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/supplier-responsibility', { credentials: 'include' })
      if (!res.ok) {
        setDeclared(new Map())
        return
      }
      const json = await res.json()
      const map = new Map<SupplierAttestationType, DeclaredAttestation>()
      for (const a of json?.attestations ?? []) {
        if (a.is_attested) map.set(a.attestation_type, a)
      }
      setDeclared(map)
    } catch {
      setDeclared(new Map())
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const upsert = useCallback(async (
    type: SupplierAttestationType,
    is_attested: boolean,
    notes?: string,
    evidence_url?: string,
  ) => {
    setSavingType(type)
    try {
      await fetch('/api/supplier-responsibility', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attestation_type: type,
          is_attested,
          notes,
          evidence_url,
        }),
      })
      await load()
    } finally {
      setSavingType(null)
    }
  }, [load])

  const remove = useCallback(async (type: SupplierAttestationType) => {
    setSavingType(type)
    try {
      await fetch(`/api/supplier-responsibility?type=${encodeURIComponent(type)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await load()
    } finally {
      setSavingType(null)
    }
  }, [load])

  const declaredCount = declared?.size ?? 0
  const total = SUPPLIER_ATTESTATIONS.length

  return (
    <div className="space-y-8">
      <Statement
        eyebrow="THE NETWORK · SOURCING"
        headline="Supplier responsibility."
      >
        <BigNumber
          value={`${declaredCount} OF ${total}`}
          label="ATTESTED"
          tone="room"
          size="display"
        />
      </Statement>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Declare your supply-chain due-diligence practices: code of conduct, audits, Living Wage
        requirements, modern-slavery policy, and more. None of this needs your suppliers to log into
        the platform, it&rsquo;s about what you do. Aligned with CSRD ESRS S2, the UK Modern Slavery
        Act, and B Corp Workers/Community.
      </p>

      {declared === null ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-[6px]" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-studio-hairline border-t border-studio-hairline">
          {SUPPLIER_ATTESTATIONS.map(att => {
            const current = declared.get(att.value)
            const isAttested = !!current
            const noteValue = pendingNotes[att.value] ?? current?.notes ?? ''
            const urlValue = pendingUrls[att.value] ?? current?.evidence_url ?? ''
            return (
              <li key={att.value} className="py-5">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-sm font-semibold text-foreground">
                        {att.label}
                      </span>
                      <StateChip tone={isAttested ? 'good' : 'quiet'}>
                        {isAttested ? 'Attested' : 'Not yet'}
                      </StateChip>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{att.description}</p>
                    <p className="mt-1.5 font-mono text-[10px] tracking-[0.12em] text-studio-dim">
                      {att.framework}
                    </p>
                  </div>
                  <PillButton
                    variant={isAttested ? 'ghost' : 'room'}
                    size="sm"
                    onClick={() => (isAttested ? remove(att.value) : upsert(att.value, true))}
                    disabled={savingType === att.value}
                  >
                    {isAttested ? 'Remove' : 'Attest'}
                  </PillButton>
                </div>

                {isAttested && (
                  <div className="mt-4 space-y-2">
                    <Input
                      placeholder="Evidence URL (optional)"
                      className={`h-9 ${studioField}`}
                      value={urlValue}
                      onChange={(e) =>
                        setPendingUrls(p => ({ ...p, [att.value]: e.target.value }))
                      }
                      onBlur={() => {
                        if (urlValue !== (current?.evidence_url ?? '')) {
                          void upsert(att.value, true, current?.notes ?? undefined, urlValue)
                        }
                      }}
                    />
                    <Textarea
                      placeholder="Notes (optional)"
                      rows={2}
                      className={`${studioField} py-2`}
                      value={noteValue}
                      onChange={(e) =>
                        setPendingNotes(p => ({ ...p, [att.value]: e.target.value }))
                      }
                      onBlur={() => {
                        if (noteValue !== (current?.notes ?? '')) {
                          void upsert(att.value, true, noteValue, current?.evidence_url ?? undefined)
                        }
                      }}
                    />
                    {current?.evidence_url && (
                      <a
                        href={current.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-room-accent hover:underline"
                      >
                        Open evidence <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
