'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TopicCard } from '@/components/materiality/TopicCard'
import { MaterialityMatrix } from '@/components/materiality/MaterialityMatrix'
import { PriorityConfirmation } from '@/components/materiality/PriorityConfirmation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useOrganization } from '@/lib/organizationContext'
import { PageLoader } from '@/components/ui/page-loader'
import {
  TOPIC_LIBRARY,
  CATEGORY_LABELS,
  CATEGORY_COLOURS,
  getTopPriorityTopics,
} from '@/lib/materiality/topic-library'
import type { MaterialityTopic, TopicStatus, TopicCategory } from '@/lib/materiality/topic-library'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STEPS = [
  { label: 'Topic Library', description: 'Choose your material topics' },
  { label: 'Score Topics', description: 'Rate impact and financial importance' },
  { label: 'Confirm Priorities', description: 'Set your reporting priorities' },
]

function ScoreSlider({
  label,
  value,
  onChange,
  colour,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  colour: string
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-stone-600">{label}</span>
        <span className="text-sm font-bold" style={{ color: colour }}>{value}/5</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-current h-1.5"
        style={{ accentColor: colour }}
      />
      <div className="flex justify-between text-xs text-stone-300 mt-0.5">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  )
}

export default function MaterialitySetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization } = useOrganization()
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)

  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)

  // All topics initialised from the library with persisted state layered on top
  const [topics, setTopics] = useState<MaterialityTopic[]>([])
  const [priorityOrder, setPriorityOrder] = useState<string[]>([])

  // Active category filter for Step 1
  const [categoryFilter, setCategoryFilter] = useState<TopicCategory | 'all'>('all')

  // Load existing assessment on mount
  useEffect(() => {
    if (!currentOrganization?.id) return
    const supabase = getSupabaseBrowserClient()

    supabase
      .from('materiality_assessments')
      .select('topics, priority_topics')
      .eq('organization_id', currentOrganization.id)
      .eq('assessment_year', year)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.topics && Array.isArray(data.topics) && data.topics.length > 0) {
          // Merge saved state onto fresh library (preserves new topics added to library)
          const savedMap = Object.fromEntries(
            (data.topics as MaterialityTopic[]).map(t => [t.id, t])
          )
          const merged = TOPIC_LIBRARY.map(libTopic => ({
            ...libTopic,
            ...(savedMap[libTopic.id] || {}),
          }))
          setTopics(merged)
          setPriorityOrder(data.priority_topics || [])
        } else {
          setTopics(TOPIC_LIBRARY.map(t => ({ ...t })))
        }
        setIsLoading(false)
      })
  }, [currentOrganization?.id, year])

  // Auto-suggest priority order when entering Step 3
  useEffect(() => {
    if (step !== 3) return
    const materialTopics = topics.filter(t => t.status === 'material')
    if (materialTopics.length === 0) return
    // Only auto-suggest if priority order is empty or doesn't match material topics
    const suggested = getTopPriorityTopics(materialTopics, 8).map(t => t.id)
    if (priorityOrder.length === 0) {
      setPriorityOrder(suggested)
    } else {
      // Ensure all material topics are represented, add new ones at the end
      const existing = new Set(priorityOrder)
      const newIds = suggested.filter(id => !existing.has(id))
      const cleaned = priorityOrder.filter(id => materialTopics.some(t => t.id === id))
      setPriorityOrder([...cleaned, ...newIds])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const handleStatusChange = useCallback((id: string, status: TopicStatus) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }, [])

  const handleScoreChange = useCallback((id: string, field: 'impactScore' | 'financialScore', value: number) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }, [])

  const handleRationaleChange = useCallback((id: string, rationale: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, rationale } : t))
  }, [])

  async function saveProgress(complete = false) {
    if (!currentOrganization?.id) return
    setIsSaving(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase
      .from('materiality_assessments')
      .upsert({
        organization_id: currentOrganization.id,
        assessment_year: year,
        topics,
        priority_topics: priorityOrder,
        completed_at: complete ? new Date().toISOString() : null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,assessment_year' })

    setIsSaving(false)
    if (error) {
      toast.error('Failed to save assessment. Please try again.')
      return false
    }
    return true
  }

  async function handleNext() {
    await saveProgress(false)
    if (step < 3) setStep(s => s + 1)
  }

  async function handleFinish() {
    const ok = await saveProgress(true)
    if (ok) {
      toast.success('Materiality assessment complete.')
      router.push('/reports/materiality/')
    }
  }

  if (isLoading) return <PageLoader />

  const materialTopics = topics.filter(t => t.status === 'material')
  const filteredTopics = categoryFilter === 'all'
    ? topics
    : topics.filter(t => t.category === categoryFilter)

  const categoryCounts: Record<string, number> = {
    environmental: topics.filter(t => t.category === 'environmental' && t.status === 'material').length,
    social: topics.filter(t => t.category === 'social' && t.status === 'material').length,
    governance: topics.filter(t => t.category === 'governance' && t.status === 'material').length,
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/reports/materiality/" className="text-sm text-stone-400 hover:text-stone-600 flex items-center gap-1 mb-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Materiality
          </Link>
          <h1 className="text-xl font-semibold text-stone-900">
            {year} Materiality Assessment
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => saveProgress(false)} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Progress'}
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-0">
        {STEPS.map((s, i) => {
          const num = i + 1
          const isActive = step === num
          const isDone = step > num
          return (
            <div key={num} className="flex-1 flex items-center">
              <div className="flex items-center gap-2 flex-1">
                <div className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  isDone ? 'bg-[#ccff00] text-stone-900' : isActive ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500',
                ].join(' ')}>
                  {isDone ? <Check className="w-4 h-4" /> : num}
                </div>
                <div className="hidden sm:block">
                  <div className={['text-xs font-medium', isActive ? 'text-stone-900' : 'text-stone-400'].join(' ')}>
                    {s.label}
                  </div>
                  <div className="text-xs text-stone-400">{s.description}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={['h-px flex-1 mx-3', isDone ? 'bg-[#ccff00]' : 'bg-stone-200'].join(' ')} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: Topic Library ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Which topics are material to your business?</h2>
            <p className="text-sm text-stone-500 mt-1">
              Review each topic and mark it as <strong>Material</strong> (relevant and important),
              <strong> Monitoring</strong> (potentially relevant), or <strong>Not Material</strong>.
              You can change these at any time.
            </p>
          </div>

          {/* Category filter + counts */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={[
                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                categoryFilter === 'all' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-400',
              ].join(' ')}
            >
              All ({topics.length})
            </button>
            {(['environmental', 'social', 'governance'] as TopicCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={[
                  'text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5',
                  categoryFilter === cat ? 'text-white border-transparent' : 'border-stone-200 text-stone-600 hover:border-stone-400',
                ].join(' ')}
                style={categoryFilter === cat ? { background: CATEGORY_COLOURS[cat] } : {}}
              >
                {CATEGORY_LABELS[cat]}
                {categoryCounts[cat] > 0 && (
                  <span className={[
                    'text-xs rounded-full px-1.5',
                    categoryFilter === cat ? 'bg-white/30' : 'bg-stone-100',
                  ].join(' ')}>
                    {categoryCounts[cat]}
                  </span>
                )}
              </button>
            ))}
            <span className="text-xs text-stone-400 ml-auto">
              {materialTopics.length} material
            </span>
          </div>

          {/* Topic grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Double Materiality Scoring ───────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Score your material topics</h2>
            <p className="text-sm text-stone-500 mt-1">
              For each material topic, rate two dimensions on a scale of 1-5.
              <strong> Impact score:</strong> how significantly does your business affect this topic?
              <strong> Financial score:</strong> how significantly does this topic affect your business finances or reputation?
            </p>
          </div>

          {materialTopics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-10 text-center">
              <p className="text-sm text-stone-400">
                No topics marked as Material yet.{' '}
                <button onClick={() => setStep(1)} className="underline hover:text-stone-600">
                  Go back to Step 1
                </button>{' '}
                to select your material topics.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Scoring panel */}
              <div className="space-y-3">
                {materialTopics.map(topic => (
                  <Card
                    key={topic.id}
                    className={[
                      'border transition-all cursor-pointer',
                      activeTopicId === topic.id ? 'border-stone-400 shadow-sm' : 'border-stone-200',
                    ].join(' ')}
                    onClick={() => setActiveTopicId(activeTopicId === topic.id ? null : topic.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLOURS[topic.category] }} />
                        <span className="text-sm font-medium text-stone-900">{topic.name}</span>
                      </div>
                      <div className="space-y-2">
                        <ScoreSlider
                          label="Impact on people and planet"
                          value={topic.impactScore || 3}
                          onChange={v => handleScoreChange(topic.id, 'impactScore', v)}
                          colour={CATEGORY_COLOURS[topic.category]}
                        />
                        <ScoreSlider
                          label="Financial risk or opportunity"
                          value={topic.financialScore || 3}
                          onChange={v => handleScoreChange(topic.id, 'financialScore', v)}
                          colour="#8b5cf6"
                        />
                        <textarea
                          className="w-full text-xs text-stone-600 border border-stone-200 rounded-md p-2 resize-none h-16 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          placeholder="Optional: note your rationale for these scores..."
                          value={topic.rationale || ''}
                          onChange={e => handleRationaleChange(topic.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Live matrix */}
              <div className="sticky top-4 self-start">
                <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-2">Live Matrix</p>
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <MaterialityMatrix
                    topics={topics}
                    activeTopicId={activeTopicId || undefined}
                    onTopicClick={t => setActiveTopicId(t.id)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Priority Confirmation ────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Confirm your priority topics</h2>
            <p className="text-sm text-stone-500 mt-1">
              We have ranked your material topics by combined materiality score. Use the arrows to reorder them to reflect
              your organisation's strategic priorities. The top topics will lead your sustainability reports.
            </p>
          </div>

          <PriorityConfirmation
            materialTopics={materialTopics}
            priorityOrder={priorityOrder}
            onChange={setPriorityOrder}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-stone-100">
        <Button
          variant="outline"
          onClick={() => step > 1 ? setStep(s => s - 1) : router.push('/reports/materiality/')}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < 3 ? (
          <Button onClick={handleNext} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Next: {STEPS[step].label}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={isSaving || priorityOrder.length === 0}
            className="bg-[#ccff00] text-stone-900 hover:bg-lime-300"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
            Complete Assessment
          </Button>
        )}
      </div>
    </div>
  )
}
