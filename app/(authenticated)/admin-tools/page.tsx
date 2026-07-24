'use client'

import { AlertCircle } from 'lucide-react'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { Statement } from '@/components/studio/statement'
import { Eyebrow } from '@/components/studio/eyebrow'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'

const GROUPS: { label: string; items: FactRowItem[] }[] = [
  {
    label: 'OPERATIONS',
    items: [
      {
        id: 'demo-seed',
        title: 'Demo seed',
        hint: 'Seed the inventory demo and the Drinks Co showcase dataset.',
        href: '/admin/demo-seed',
      },
      {
        id: 'ingest-learning',
        title: 'Smart Upload learning',
        hint: 'Classifier accuracy, learned supplier profiles and recent corrections.',
        href: '/admin/ingest-learning',
      },
      {
        id: 'rosa-learning',
        title: "Rosa's learning loop",
        hint: 'Curation queue, exemplars and eval scoreboard for the self-learning flywheel.',
        href: '/admin/rosa-learning',
      },
      {
        id: 'reference-data',
        title: 'Reference data',
        hint: 'Load public emission-factor releases into the versioned factor library.',
        href: '/admin/reference-data',
      },
      {
        id: 'benchmarks',
        title: 'Internal benchmarks',
        hint: 'The shape of our own intensity cohort, and how it compares with the published figures.',
        href: '/admin/benchmarks',
      },
      {
        id: 'agribalyse-backfill',
        title: 'Agribalyse backfill',
        hint: 'Backfill ingredient factors from the Agribalyse dataset.',
        href: '/admin/agribalyse-backfill',
      },
      {
        id: 'reconciliation',
        title: 'Reconciliation',
        hint: 'Cross-check spend data against activity data for double counting.',
        href: '/admin/reconciliation',
      },
      {
        id: 'recalculate-lca',
        title: 'Recalculate LCAs',
        hint: 'Re-run every product LCA in the active organisation after a calculator fix.',
        href: '/admin-tools/recalculate-lca',
      },
      {
        id: 'factor-queue',
        title: 'Factor queue',
        hint: 'Materials computing with a conservative stand-in, across every organisation.',
        href: '/admin-tools/factor-queue',
      },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      {
        id: 'blog',
        title: 'Blog',
        hint: 'Write, edit and publish blog posts.',
        href: '/admin/blog',
      },
      {
        id: 'wiki',
        title: 'Sustainability wiki',
        hint: 'Sync the published wiki pages into Rosa’s knowledge base.',
        href: '/admin/wiki',
      },
      {
        id: 'feedback',
        title: 'Feedback',
        hint: 'User feedback inbox and follow-up.',
        href: '/admin/feedback',
      },
    ],
  },
  {
    label: 'DATA',
    items: [
      {
        id: 'factors',
        title: 'Factors',
        hint: 'Browse and edit the emission-factor library.',
        href: '/admin/factors',
      },
      {
        id: 'impact-proxy-values',
        title: 'Impact proxy values',
        hint: 'Spend-based proxy factors by category.',
        href: '/admin/impact-proxy-values',
      },
      {
        id: 'emissions-trace',
        title: 'Emissions trace',
        hint: 'Trace a footprint number back through the calculation.',
        href: '/admin/emissions-trace',
      },
      {
        id: 'allocation-review',
        title: 'Allocation review',
        hint: 'Review facility allocations across organisations.',
        href: '/admin/allocation-review',
      },
      {
        id: 'approvals',
        title: 'Approvals',
        hint: 'Pending data approvals across the platform.',
        href: '/admin/approvals',
      },
      {
        id: 'supplier-verification',
        title: 'Supplier verification',
        hint: 'Verify supplier submissions and evidence.',
        href: '/admin/supplier-verification',
      },
      {
        id: 'suppliers',
        title: 'Suppliers',
        hint: 'The platform-wide supplier directory.',
        href: '/admin/suppliers',
      },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      {
        id: 'platform',
        title: 'Platform',
        hint: 'Organisations, usage and platform health.',
        href: '/admin/platform',
      },
      {
        id: 'beta-access',
        title: 'Beta access',
        hint: 'Grant and revoke beta feature flags per organisation.',
        href: '/admin/beta-access',
      },
      {
        id: 'rosa',
        title: 'Rosa',
        hint: 'Rosa’s knowledge base and conversation tooling.',
        href: '/admin/rosa',
      },
      {
        id: 'tier-management',
        title: 'Tier management',
        hint: 'Subscription tiers and feature gating.',
        href: '/dev/tier-management',
      },
    ],
  },
]

export default function AdminIndexPage() {
  const { isAlkateraAdmin: isAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()

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
        <AlertCircle className="h-4 w-4" />
        Admin access required.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <Statement eyebrow="THE WIRING · ADMIN" headline="The back office." />

      {GROUPS.map((group) => (
        <section key={group.label}>
          <Eyebrow tone="dim" className="mb-1">{group.label}</Eyebrow>
          <FactList items={group.items} dense />
        </section>
      ))}
    </div>
  )
}
