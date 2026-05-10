'use client'

/**
 * Matrix view for supplier-responsibility attestations. Six rows, each a
 * yes/no toggle with optional notes + evidence URL. Mirrors the /dependencies/
 * pattern.
 */

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Check, ExternalLink } from 'lucide-react'
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

  if (declared === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const declaredCount = declared.size
  const coveragePct = Math.round((declaredCount / SUPPLIER_ATTESTATIONS.length) * 100)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Due-diligence coverage
          </p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{coveragePct}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {declaredCount} of {SUPPLIER_ATTESTATIONS.length} attestations
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {SUPPLIER_ATTESTATIONS.map(att => {
          const current = declared.get(att.value)
          const isAttested = !!current
          const noteValue = pendingNotes[att.value] ?? current?.notes ?? ''
          const urlValue = pendingUrls[att.value] ?? current?.evidence_url ?? ''
          return (
            <div
              key={att.value}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{att.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{att.label}</p>
                    <Badge variant="outline" className="text-[9px] h-5 capitalize">
                      {att.framework}
                    </Badge>
                    {isAttested && (
                      <Badge variant="outline" className="text-[9px] h-5 bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                        <Check className="h-2.5 w-2.5 mr-1" />
                        Attested
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {att.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAttested ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove(att.value)}
                    disabled={savingType === att.value}
                  >
                    Remove attestation
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => upsert(att.value, true)}
                    disabled={savingType === att.value}
                  >
                    Attest yes
                  </Button>
                )}
              </div>
              {isAttested && (
                <div className="space-y-2">
                  <Input
                    placeholder="Evidence URL (optional)"
                    className="text-xs"
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
                    className="text-xs"
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
                      className="text-[10px] text-blue-300 hover:underline inline-flex items-center gap-1"
                    >
                      Open evidence <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
