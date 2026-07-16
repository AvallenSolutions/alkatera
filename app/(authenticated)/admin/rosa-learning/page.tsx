'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronDown, ChevronRight, FlaskConical, Loader2 } from 'lucide-react'
import { Statement } from '@/components/studio/statement'
import { Panel } from '@/components/studio/panel'
import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { format } from 'date-fns'

interface LearningCase {
  id: string
  kind: string
  status: string
  summary: string
  evidence: Record<string, unknown>
  organization_id: string | null
  organization_name: string | null
  created_at: string
  resolved_at: string | null
  resolution: Record<string, unknown> | null
}

interface Exemplar {
  id: string
  question: string
  ideal_answer: string
  tool_trace: unknown
  tags: string[]
  active: boolean
  created_from: string | null
  created_at: string
}

interface Stats {
  window_days: number
  helpfulness_rate: number | null
  feedback_count: number
  proposal_confirm_rate: number | null
  proposal_count: number
  knowledge_miss_count: number
  rephrase_count: number
  tickets_after_answer_count: number
  last_eval: { run_at: string; total: number; passed: number } | null
}

const KIND_LABELS: Record<string, string> = {
  missing_knowledge: 'Missing knowledge',
  wrong_tool: 'Wrong tool',
  wrong_data: 'Wrong data',
  wrong_tone: 'Wrong tone',
  unclassified: 'Unclassified',
}

const KIND_ORDER = ['missing_knowledge', 'wrong_tool', 'wrong_data', 'wrong_tone', 'unclassified']

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-studio-hairline p-3 text-center">
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <p className="text-xs text-studio-dim">{label}</p>
    </div>
  )
}

export default function RosaLearningPage() {
  const router = useRouter()
  const { isAlkateraAdmin: isAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openCases, setOpenCases] = useState<LearningCase[]>([])
  const [recentHistory, setRecentHistory] = useState<LearningCase[]>([])
  const [exemplars, setExemplars] = useState<Exemplar[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyCase, setBusyCase] = useState<string | null>(null)
  const [exemplarDraft, setExemplarDraft] = useState<{ caseId: string; question: string; ideal_answer: string } | null>(null)
  const [newExemplar, setNewExemplar] = useState({ question: '', ideal_answer: '', tags: '' })
  const [creatingExemplar, setCreatingExemplar] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/rosa-learning').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))),
      fetch('/api/admin/rosa-learning-stats').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))),
    ])
      .then(([queue, statsBody]) => {
        setOpenCases(queue.openCases || [])
        setRecentHistory(queue.recentHistory || [])
        setExemplars(queue.exemplars || [])
        setStats(statsBody)
      })
      .catch(() => setError('Could not load the Rosa learning queue.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (adminLoading || !isAdmin) return
    load()
  }, [adminLoading, isAdmin, load])

  const resolveCase = async (caseId: string, action: string, extra?: Record<string, unknown>) => {
    setBusyCase(caseId)
    try {
      const res = await fetch('/api/admin/rosa-learning/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, action, ...extra }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not resolve the case')
      toast.success(action === 'dismiss' ? 'Dismissed.' : 'Case resolved.')
      setExemplarDraft(null)
      setOpenCases((prev) => prev.filter((c) => c.id !== caseId))
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setBusyCase(null)
    }
  }

  const writeToWiki = async (caseId: string) => {
    await resolveCase(caseId, 'knowledge')
    router.push('/admin/wiki')
  }

  const promoteCase = async (caseId: string) => {
    setBusyCase(caseId)
    try {
      const res = await fetch('/api/admin/rosa-learning/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not promote to eval')
      toast.success('Added to the eval corpus.')
      setOpenCases((prev) => prev.filter((c) => c.id !== caseId))
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setBusyCase(null)
    }
  }

  const saveExemplarFromDraft = async () => {
    if (!exemplarDraft) return
    await resolveCase(exemplarDraft.caseId, 'exemplar', {
      exemplar: { question: exemplarDraft.question, ideal_answer: exemplarDraft.ideal_answer },
    })
  }

  const createExemplar = async () => {
    if (!newExemplar.question.trim() || !newExemplar.ideal_answer.trim()) return
    setCreatingExemplar(true)
    try {
      const res = await fetch('/api/admin/rosa-learning/exemplars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newExemplar.question,
          ideal_answer: newExemplar.ideal_answer,
          tags: newExemplar.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not create the exemplar')
      toast.success('Exemplar saved.')
      setNewExemplar({ question: '', ideal_answer: '', tags: '' })
      setExemplars((prev) => [body.exemplar, ...prev])
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setCreatingExemplar(false)
    }
  }

  const toggleExemplarActive = async (exemplar: Exemplar) => {
    try {
      const res = await fetch(`/api/admin/rosa-learning/exemplars/${exemplar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !exemplar.active }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not update the exemplar')
      setExemplars((prev) => prev.map((e) => (e.id === exemplar.id ? body.exemplar : e)))
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-studio-dim">
        <AlertCircle className="h-4 w-4" /> Admin access required.
      </div>
    )
  }

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    cases: openCases.filter((c) => c.kind === kind),
  })).filter((g) => g.cases.length > 0)

  return (
    <div className="space-y-6 p-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN" headline="Rosa's learning loop." />
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          The weekly sweep clusters feedback, knowledge misses, cancelled proposals and rephrases into
          cases below. Resolve each one to a wiki edit, an exemplar, an org-memory correction, or a
          code-fix ticket, or dismiss it as noise.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-studio-dim">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : (
        <>
          {stats && (
            <Panel>
              <div className="mb-4 space-y-1">
                <h2 className="font-display text-base font-semibold text-foreground">
                  Measure -- last {stats.window_days} days
                </h2>
                <p className="text-sm text-studio-dim">How much of Rosa&apos;s answering is landing, and whether the gate is holding.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatTile
                  label={`Helpful (${stats.feedback_count})`}
                  value={stats.helpfulness_rate !== null ? `${stats.helpfulness_rate}%` : '·'}
                />
                <StatTile
                  label={`Proposals confirmed (${stats.proposal_count})`}
                  value={stats.proposal_confirm_rate !== null ? `${stats.proposal_confirm_rate}%` : '·'}
                />
                <StatTile label="Knowledge misses" value={String(stats.knowledge_miss_count)} />
                <StatTile label="Rephrases" value={String(stats.rephrase_count)} />
                <StatTile label="Tickets after an answer" value={String(stats.tickets_after_answer_count)} />
                <StatTile
                  label="Last eval score"
                  value={stats.last_eval ? `${stats.last_eval.passed}/${stats.last_eval.total}` : 'No runs yet'}
                />
              </div>
            </Panel>
          )}

          <Panel>
            <div className="mb-4 space-y-1">
              <h2 className="font-display text-base font-semibold text-foreground">
                Open cases ({openCases.length})
              </h2>
              <p className="text-sm text-studio-dim">Grouped by kind, newest first.</p>
            </div>
            {grouped.length === 0 ? (
              <p className="text-sm text-studio-dim">Nothing open. Either it&apos;s early days, or the sweep hasn&apos;t found a pattern yet.</p>
            ) : (
              <div className="space-y-6">
                {grouped.map((group) => (
                  <div key={group.kind}>
                    <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                      {KIND_LABELS[group.kind] ?? group.kind} ({group.cases.length})
                    </h3>
                    <div className="space-y-3">
                      {group.cases.map((c) => {
                        const evidence = c.evidence ?? {}
                        const isExpanded = expanded === c.id
                        const isDraftingExemplar = exemplarDraft?.caseId === c.id
                        return (
                          <div key={c.id} className="rounded-md border border-studio-hairline p-3">
                            <button
                              type="button"
                              className="flex w-full items-start justify-between gap-3 text-left"
                              onClick={() => setExpanded(isExpanded ? null : c.id)}
                            >
                              <div className="min-w-0">
                                <p className="text-sm text-foreground">{c.summary}</p>
                                <p className="mt-1 text-xs text-studio-dim">
                                  {c.organization_name || 'Cross-organisation'} · {format(new Date(c.created_at), 'd MMM HH:mm')}
                                </p>
                              </div>
                              {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                            </button>

                            {isExpanded && (
                              <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-studio-paper/60 p-2 text-[11px]">
                                {JSON.stringify(evidence, null, 2)}
                              </pre>
                            )}

                            {isDraftingExemplar ? (
                              <div className="mt-3 space-y-2 rounded border border-studio-hairline p-3">
                                <label className="block text-xs text-studio-dim">Question</label>
                                <Input
                                  value={exemplarDraft.question}
                                  onChange={(e) => setExemplarDraft({ ...exemplarDraft, question: e.target.value })}
                                />
                                <label className="block text-xs text-studio-dim">Ideal answer</label>
                                <Textarea
                                  rows={4}
                                  value={exemplarDraft.ideal_answer}
                                  onChange={(e) => setExemplarDraft({ ...exemplarDraft, ideal_answer: e.target.value })}
                                />
                                <div className="flex gap-2">
                                  <PillButton
                                    size="sm"
                                    disabled={busyCase === c.id || !exemplarDraft.question.trim() || !exemplarDraft.ideal_answer.trim()}
                                    onClick={saveExemplarFromDraft}
                                  >
                                    {busyCase === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save exemplar'}
                                  </PillButton>
                                  <PillButton variant="ghost" size="sm" onClick={() => setExemplarDraft(null)}>
                                    Cancel
                                  </PillButton>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <PillButton variant="outline" size="sm" disabled={busyCase === c.id} onClick={() => writeToWiki(c.id)}>
                                  Write it into the wiki.
                                </PillButton>
                                <PillButton
                                  variant="outline"
                                  size="sm"
                                  disabled={busyCase === c.id}
                                  onClick={() =>
                                    setExemplarDraft({
                                      caseId: c.id,
                                      question: (evidence.question as string) || (evidence.query as string) || '',
                                      ideal_answer: (evidence.answer_excerpt as string) || '',
                                    })
                                  }
                                >
                                  Save as an exemplar.
                                </PillButton>
                                <PillButton variant="outline" size="sm" disabled={busyCase === c.id} onClick={() => resolveCase(c.id, 'memory')}>
                                  Correct the org memory.
                                </PillButton>
                                <PillButton variant="outline" size="sm" disabled={busyCase === c.id} onClick={() => resolveCase(c.id, 'code')}>
                                  Needs a code fix.
                                </PillButton>
                                <PillButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={busyCase === c.id}
                                  onClick={() => promoteCase(c.id)}
                                  title="Promote to the eval corpus"
                                >
                                  <FlaskConical className="mr-1 h-3 w-3" /> Promote to eval
                                </PillButton>
                                <PillButton variant="ghost" size="sm" disabled={busyCase === c.id} onClick={() => resolveCase(c.id, 'dismiss')}>
                                  Dismiss
                                </PillButton>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <div className="mb-4 space-y-1">
              <h2 className="font-display text-base font-semibold text-foreground">Exemplars</h2>
              <p className="text-sm text-studio-dim">
                Worked examples injected into Rosa&apos;s system prompt by relevance to the user&apos;s question.
              </p>
            </div>
            <div className="mb-4 space-y-2 rounded-md border border-studio-hairline p-3">
              <label className="block text-xs text-studio-dim">Question</label>
              <Input value={newExemplar.question} onChange={(e) => setNewExemplar({ ...newExemplar, question: e.target.value })} />
              <label className="block text-xs text-studio-dim">Ideal answer</label>
              <Textarea rows={3} value={newExemplar.ideal_answer} onChange={(e) => setNewExemplar({ ...newExemplar, ideal_answer: e.target.value })} />
              <label className="block text-xs text-studio-dim">Tags (comma-separated)</label>
              <Input value={newExemplar.tags} onChange={(e) => setNewExemplar({ ...newExemplar, tags: e.target.value })} />
              <PillButton
                size="sm"
                disabled={creatingExemplar || !newExemplar.question.trim() || !newExemplar.ideal_answer.trim()}
                onClick={createExemplar}
              >
                {creatingExemplar ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add exemplar'}
              </PillButton>
            </div>
            {exemplars.length === 0 ? (
              <p className="text-sm text-studio-dim">No exemplars yet.</p>
            ) : (
              <div className="space-y-2">
                {exemplars.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border border-studio-hairline p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{e.question}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-studio-dim">{e.ideal_answer}</p>
                      {e.tags?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {e.tags.map((t) => (
                            <StateChip key={t} tone="quiet">
                              {t}
                            </StateChip>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StateChip tone={e.active ? 'good' : 'quiet'}>{e.active ? 'Active' : 'Inactive'}</StateChip>
                      <PillButton variant="ghost" size="sm" onClick={() => toggleExemplarActive(e)}>
                        {e.active ? 'Deactivate' : 'Reactivate'}
                      </PillButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {recentHistory.length > 0 && (
            <Panel>
              <div className="mb-4 space-y-1">
                <h2 className="font-display text-base font-semibold text-foreground">Recently resolved</h2>
                <p className="text-sm text-studio-dim">Last 50 cases that left the queue.</p>
              </div>
              <div className="space-y-2">
                {recentHistory.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-studio-hairline p-2 text-sm">
                    <span className="min-w-0 truncate text-foreground">{c.summary}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <StateChip tone={c.status === 'dismissed' ? 'quiet' : 'good'}>
                        {(c.resolution?.type as string) || c.status}
                      </StateChip>
                      <span className="text-xs text-studio-dim">{c.resolved_at ? format(new Date(c.resolved_at), 'd MMM') : '·'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
