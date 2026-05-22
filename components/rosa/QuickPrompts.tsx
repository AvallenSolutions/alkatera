'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useUserRole, type RosaPersona } from '@/lib/rosa/useUserRole'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

interface Prompt {
  /** Stable id used to dedupe across rotations and avoid showing the same set twice. */
  id: string
  label: string
  prompt: string
  /** Persona buckets this prompt applies to. */
  personas: RosaPersona[]
  /** Time-of-week buckets where this is relevant. */
  timing?: Array<'monday' | 'midweek' | 'friday' | 'any'>
  /** State guard: only show when this fact about the org is true. */
  when?:
    | 'has_open_queue'
    | 'has_anomalies'
    | 'has_products_no_lca'
    | 'has_recent_approvals'
    | 'is_new_org'
    | 'always'
}

// Curated catalogue. Each prompt has a persona target + optional timing
// + optional state guard. The hub picks 6 from this pool every render
// based on who the user is and what's true about their org.
const CATALOGUE: Prompt[] = [
  // Universal evergreens (fall-back fillers when filtering thins the pool).
  {
    id: 'biggest-emission-source',
    label: "What's my biggest emission source?",
    prompt:
      'What is my single biggest emission source this year, and what is driving it?',
    personas: ['leadership', 'sustainability', 'finance', 'operator', 'unknown'],
    when: 'always',
  },
  {
    id: 'next-three',
    label: 'What should I focus on this week?',
    prompt:
      'Give me a prioritised list of the three highest-impact things I should work on this week.',
    personas: ['leadership', 'sustainability', 'operator', 'unknown'],
    timing: ['monday', 'midweek', 'any'],
    when: 'always',
  },
  // Leadership / founder lens.
  {
    id: 'narrative-update',
    label: 'Draft a one-paragraph board update',
    prompt:
      'Draft a single short paragraph I can share with the board summarising this month\'s sustainability progress and what\'s coming up.',
    personas: ['leadership'],
    when: 'always',
  },
  {
    id: 'risk-overview',
    label: 'Where are my biggest sustainability risks?',
    prompt:
      'Where are my biggest sustainability risks right now, ranked? Include regulatory, reputational, and data-quality risks.',
    personas: ['leadership', 'sustainability'],
    when: 'always',
  },
  // Finance lens.
  {
    id: 'spend-vs-emissions',
    label: "Where's my carbon hiding in our spend?",
    prompt:
      'Walk me through my biggest spend categories and show how each maps to estimated emissions. Where\'s the unexpected carbon?',
    personas: ['finance', 'leadership'],
    when: 'always',
  },
  {
    id: 'shadow-cost',
    label: 'What does our carbon cost on a shadow price?',
    prompt:
      'Apply my shadow carbon price to this year\'s footprint and tell me the total internal cost. Compare to last year.',
    personas: ['finance'],
    when: 'always',
  },
  {
    id: 'cost-reduction-paths',
    label: 'Where should I invest to cut both carbon and cost?',
    prompt:
      'Show me the top three reduction opportunities ranked by combined carbon and cost benefit, with a rough payback estimate for each.',
    personas: ['finance', 'leadership'],
    when: 'always',
  },
  // Sustainability lead lens.
  {
    id: 'compare-benchmark',
    label: 'How do I compare to industry?',
    prompt:
      'Compare my carbon footprint per litre to the drinks-industry benchmark for my product category and explain where I sit.',
    personas: ['sustainability', 'leadership'],
    when: 'always',
  },
  {
    id: 'methodology-which',
    label: 'Which methodology applies to me?',
    prompt:
      'Given my reporting obligations, which methodologies (ISO 14067, GHG Protocol, VSME, CSRD) apply, and which should I prioritise?',
    personas: ['sustainability'],
    when: 'always',
  },
  {
    id: 'data-gaps',
    label: 'Where are my data gaps?',
    prompt:
      'Which parts of my emissions data have the lowest quality or biggest gaps right now, and how would I improve them?',
    personas: ['sustainability', 'operator'],
    when: 'always',
  },
  // Operator lens.
  {
    id: 'whats-in-queue',
    label: 'Walk me through my queue',
    prompt:
      'Walk me through what\'s in my approval queue and recommend an order to work through it.',
    personas: ['operator', 'sustainability'],
    when: 'has_open_queue',
  },
  {
    id: 'missing-utility',
    label: 'Which utility data am I missing?',
    prompt:
      'Which facilities are missing utility data this month, and what would help me catch up fastest?',
    personas: ['operator'],
    when: 'always',
  },
  {
    id: 'no-lca-products',
    label: 'Which products are missing LCAs?',
    prompt:
      "List the products that don't have a completed LCA yet, ordered by likely production volume.",
    personas: ['operator', 'sustainability', 'leadership'],
    when: 'has_products_no_lca',
  },
  // Anomaly-aware.
  {
    id: 'explain-anomalies',
    label: 'Explain the anomalies you flagged',
    prompt:
      'Walk me through the anomalies you\'ve flagged in the last 30 days. Which look real and which are likely metering glitches?',
    personas: ['operator', 'sustainability'],
    when: 'has_anomalies',
  },
  // Time-of-week aware.
  {
    id: 'monday-plan',
    label: 'Plan my week',
    prompt:
      "It's Monday. Help me plan my sustainability work for the week ahead, factoring in deadlines and the queue.",
    personas: ['leadership', 'sustainability', 'operator'],
    timing: ['monday'],
    when: 'always',
  },
  {
    id: 'friday-wrap',
    label: 'Wrap up the week',
    prompt:
      "It's Friday. Summarise what got done this week, what slipped, and what to tee up for Monday.",
    personas: ['leadership', 'sustainability', 'operator'],
    timing: ['friday'],
    when: 'always',
  },
  {
    id: 'last-month-changes',
    label: "Summarise last month's changes",
    prompt:
      'Summarise what changed in my sustainability data over the last month, including new entries, anomalies, and trend shifts.',
    personas: ['leadership', 'sustainability', 'finance'],
    timing: ['midweek', 'monday'],
    when: 'always',
  },
  // Onboarding (new org).
  {
    id: 'getting-started',
    label: "What's my first move?",
    prompt:
      "I'm just getting started. Walk me through what to set up first to start tracking emissions properly.",
    personas: ['leadership', 'sustainability', 'operator', 'unknown'],
    when: 'is_new_org',
  },
  {
    id: 'set-targets',
    label: 'Help me set a reduction target',
    prompt:
      "Help me set a credible carbon reduction target. What baseline should I use, and what's a reasonable ambition for my sector?",
    personas: ['leadership', 'sustainability'],
    when: 'always',
  },
  // Recent activity follow-ups.
  {
    id: 'review-approvals',
    label: 'Review what I just approved',
    prompt:
      'Walk me through the last few items I approved in the queue. Did anything look unusual?',
    personas: ['operator', 'sustainability'],
    when: 'has_recent_approvals',
  },
  // Deadlines.
  {
    id: 'whats-coming-up',
    label: "What deadlines are coming up?",
    prompt: 'List my upcoming regulatory deadlines and how prepared I am for each.',
    personas: ['leadership', 'sustainability', 'operator'],
    when: 'always',
  },
]

interface Props {
  onAsk: (prompt: string) => void
}

interface OrgState {
  has_open_queue: boolean
  has_anomalies: boolean
  has_products_no_lca: boolean
  has_recent_approvals: boolean
  is_new_org: boolean
}

/**
 * "Ask Rosa" — a curated, rotating list of starter prompts personalised by:
 *
 *   - The user's persona (leadership / finance / sustainability / operator)
 *   - Time of week (Monday / midweek / Friday)
 *   - Live state of the org (does the queue have items? are there anomalies?
 *     are there products without LCAs? is the org just getting started?)
 *
 * Same component as before; very different output for different users
 * and contexts. The pool is curated (no LLM-generated prompts at runtime)
 * to keep latency at zero and prompts trustworthy.
 */
export function QuickPrompts({ onAsk }: Props) {
  const { persona } = useUserRole()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [orgState, setOrgState] = useState<OrgState | null>(null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    const load = async () => {
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const orgCreatedAt = (currentOrganization as any)?.created_at as string | undefined
      const orgAgeDays = orgCreatedAt
        ? (Date.now() - new Date(orgCreatedAt).getTime()) / (24 * 60 * 60 * 1000)
        : 999

      const [queueRes, anomalyRes, productsRes, recentApprovalRes] = await Promise.all([
        supabase
          .from('agent_exceptions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'open'),
        supabase
          .from('dashboard_anomalies')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .neq('status', 'resolved')
          .neq('status', 'dismissed'),
        supabase
          .from('products')
          .select('id, product_carbon_footprints!left(id)')
          .eq('organization_id', orgId),
        supabase
          .from('agent_exceptions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'approved')
          .gte('reviewed_at', since30),
      ])
      if (cancelled) return
      const productsList = (productsRes.data as any[]) || []
      const productsNoLca = productsList.filter(p => {
        const fps = p.product_carbon_footprints
        return !fps || (Array.isArray(fps) && fps.length === 0)
      }).length
      setOrgState({
        has_open_queue: (queueRes.count || 0) > 0,
        has_anomalies: (anomalyRes.count || 0) > 0,
        has_products_no_lca: productsNoLca > 0,
        has_recent_approvals: (recentApprovalRes.count || 0) > 0,
        // "New" = under 30 days old OR less than 2 products / facilities
        is_new_org: orgAgeDays < 30 || productsList.length < 2,
      })
    }
    load().catch(() => setOrgState(null))
    return () => {
      cancelled = true
    }
  }, [orgId, currentOrganization])

  const prompts = useMemo(() => {
    const day = new Date().getDay() // 0 = Sun, 1 = Mon, …, 5 = Fri
    const timing: Prompt['timing'] extends infer T ? T : never =
      day === 1 ? ['monday'] : day === 5 ? ['friday'] : day >= 2 && day <= 4 ? ['midweek'] : ['any']

    const filtered = CATALOGUE.filter(p => {
      // Persona filter — 'unknown' falls back to a wide net.
      if (persona === 'unknown') {
        if (!p.personas.includes('unknown') && !p.personas.includes('operator')) return false
      } else if (!p.personas.includes(persona)) {
        return false
      }
      // Timing filter — 'any' or matching today's bucket.
      if (p.timing && p.timing.length > 0) {
        const hasAny = p.timing.includes('any')
        const hasToday = p.timing.includes(timing[0] as any)
        if (!hasAny && !hasToday) return false
      }
      // State filter — only show when the org's state matches.
      if (p.when && p.when !== 'always') {
        if (!orgState) return false // no state yet, conservative: hide
        if (!orgState[p.when as keyof OrgState]) return false
      }
      return true
    })

    // Score by relevance: state-specific prompts > timing-specific > evergreen.
    const scored = filtered.map(p => ({
      p,
      score:
        (p.when && p.when !== 'always' ? 3 : 0) +
        (p.timing && !p.timing.includes('any') ? 2 : 0) +
        (p.personas.length === 1 ? 2 : 0) +
        (p.personas.length <= 2 ? 1 : 0),
    }))
    scored.sort((a, b) => b.score - a.score)

    // De-dupe by id (CATALOGUE shouldn't have dupes, but defensive).
    const seen = new Set<string>()
    const out: Prompt[] = []
    for (const { p } of scored) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push(p)
      if (out.length >= 6) break
    }
    return out
  }, [persona, orgState])

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 h-full">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#ccff00]" />
        Ask Rosa
      </h2>
      <ul className="space-y-1">
        {prompts.map(p => (
          <li key={p.id}>
            <button
              onClick={() => onAsk(p.prompt)}
              className="group w-full text-left text-sm py-2 px-2 -mx-2 rounded-md hover:bg-muted transition-colors flex items-center justify-between gap-3"
            >
              <span className="leading-snug">{p.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-[#ccff00] transition-colors flex-shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
