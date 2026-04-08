'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Clock,
  ChevronRight,
  BarChart2,
  Layers,
  AlertTriangle,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useOrganization } from '@/lib/organizationContext'
import { PageLoader } from '@/components/ui/page-loader'
import { CATEGORY_COLOURS } from '@/lib/materiality/topic-library'
import type { MaterialityTopic } from '@/lib/materiality/topic-library'

interface MaterialityAssessment {
  id: string
  assessment_year: number
  topics: MaterialityTopic[]
  priority_topics: string[]
  completed_at: string | null
  updated_at: string
}

export default function MaterialityPage() {
  const { currentOrganization } = useOrganization()
  const [assessment, setAssessment] = useState<MaterialityAssessment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!currentOrganization?.id) return
    const supabase = getSupabaseBrowserClient()
    supabase
      .from('materiality_assessments')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .eq('assessment_year', currentYear)
      .maybeSingle()
      .then(({ data }) => {
        setAssessment(data as MaterialityAssessment | null)
        setIsLoading(false)
      })
  }, [currentOrganization?.id, currentYear])

  if (isLoading) return <PageLoader />

  const isComplete = !!assessment?.completed_at
  const materialTopics = assessment?.topics?.filter(t => t.status === 'material') || []
  const priorityCount = assessment?.priority_topics?.length || 0

  const envCount = materialTopics.filter(t => t.category === 'environmental').length
  const socialCount = materialTopics.filter(t => t.category === 'social').length
  const govCount = materialTopics.filter(t => t.category === 'governance').length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Materiality Assessment</h1>
        <p className="text-sm text-stone-500 mt-1">
          Identify and prioritise the sustainability topics that matter most to your business and stakeholders.
          Your materiality assessment shapes the structure and narrative of every sustainability report you generate.
        </p>
      </div>

      {/* Status banner */}
      {isComplete ? (
        <div className="rounded-xl border border-lime-300 bg-lime-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-lime-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-lime-800">
              {currentYear} assessment complete
            </p>
            <p className="text-xs text-lime-600 mt-0.5">
              {materialTopics.length} material topics identified, {priorityCount} set as priorities.
              Your reports will be structured around these topics.
            </p>
          </div>
          <Link href={`/reports/materiality/setup?year=${currentYear}`}>
            <Button variant="outline" size="sm" className="border-lime-300 text-lime-700 hover:bg-lime-100">
              Edit
            </Button>
          </Link>
        </div>
      ) : assessment ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Assessment in progress</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {materialTopics.length} topics marked as material so far. Complete the three-step setup to finalise.
            </p>
          </div>
          <Link href={`/reports/materiality/setup?year=${currentYear}`}>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
              Continue
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-stone-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-700">No assessment for {currentYear}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              Complete your double-materiality assessment to unlock structured, framework-compliant sustainability reports.
              Takes around 20 minutes.
            </p>
          </div>
          <Link href={`/reports/materiality/setup?year=${currentYear}`}>
            <Button size="sm">Start Assessment</Button>
          </Link>
        </div>
      )}

      {/* Summary cards (show only if there's data) */}
      {materialTopics.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Environmental</div>
              <div
                className="text-3xl font-bold"
                style={{ color: CATEGORY_COLOURS.environmental }}
              >
                {envCount}
              </div>
              <div className="text-xs text-stone-400 mt-1">material topics</div>
            </CardContent>
          </Card>
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Social</div>
              <div
                className="text-3xl font-bold"
                style={{ color: CATEGORY_COLOURS.social }}
              >
                {socialCount}
              </div>
              <div className="text-xs text-stone-400 mt-1">material topics</div>
            </CardContent>
          </Card>
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Governance</div>
              <div
                className="text-3xl font-bold"
                style={{ color: CATEGORY_COLOURS.governance }}
              >
                {govCount}
              </div>
              <div className="text-xs text-stone-400 mt-1">material topics</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Priority topics list */}
      {isComplete && priorityCount > 0 && (
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Priority Topics</CardTitle>
            <CardDescription>
              These topics will appear first in your sustainability reports and drive the narrative structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assessment!.priority_topics.map((topicId, index) => {
                const topic = assessment!.topics.find(t => t.id === topicId)
                if (!topic) return null
                return (
                  <div key={topicId} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0">
                    <span className="text-sm font-mono text-stone-400 w-5 text-right">{index + 1}</span>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: CATEGORY_COLOURS[topic.category] }}
                    />
                    <span className="text-sm text-stone-700 flex-1">{topic.name}</span>
                    {topic.impactScore && topic.financialScore && (
                      <span className="text-xs text-stone-400">
                        {topic.impactScore}×{topic.financialScore} = {topic.impactScore * topic.financialScore}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* What this unlocks */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Why materiality matters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              icon: Layers,
              title: 'Report structure',
              desc: 'Material topics appear first in your reports. Non-material topics move to the appendix.',
            },
            {
              icon: BarChart2,
              title: 'Narrative quality',
              desc: 'AI section narratives are written with materiality context — specific to what matters for your business.',
            },
            {
              icon: CheckCircle2,
              title: 'CSRD compliance',
              desc: 'A completed double-materiality assessment is required to use the CSRD standard on your reports.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <Icon className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-stone-700">{title}</p>
                <p className="text-xs text-stone-500">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
