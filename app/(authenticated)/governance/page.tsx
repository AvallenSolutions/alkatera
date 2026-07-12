'use client';

/**
 * Governance & ethics hub (/governance/), THE WIRING, in the studio
 * grammar: the family finally gets its eyebrow, the score is said once
 * through the shared ScoreHero, the doors are quiet hairline blocks, the
 * tabs are URL-synced mono tabs. The score recalc POST is unchanged.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';

import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import {
  HubHeader,
  QuickActionRow,
  SummaryRow,
  HubSkeleton,
  ComplianceNote,
  GetStartedGuide,
  ScoreHero,
  HubTabList,
  useUrlTab,
} from '@/components/social';

import { FeatureGate } from '@/components/subscription/FeatureGate';
// Round 10 (auto-research): both live in non-default tabs (policies / board), so
// defer them out of /governance's first load.
const PolicyDashboard = dynamic(() => import('@/components/governance/PolicyDashboard').then((m) => m.PolicyDashboard), { ssr: false });
const BoardCompositionChart = dynamic(() => import('@/components/governance/BoardCompositionChart').then((m) => m.BoardCompositionChart), { ssr: false });

import { useGovernanceScore } from '@/hooks/data/useGovernanceScore';
import { usePolicies } from '@/hooks/data/usePolicies';
import { useStakeholders } from '@/hooks/data/useStakeholders';
import { useBoardComposition } from '@/hooks/data/useBoardComposition';

export default function GovernancePage() {
  return (
    <FeatureGate feature="governance_ethics">
      <GovernancePageContent />
    </FeatureGate>
  );
}

function GovernancePageContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useUrlTab('overview');
  const [isRecalculating, setIsRecalculating] = useState(false);

  const { score, loading: scoreLoading, recalculate } = useGovernanceScore();
  const { policies, metrics: policyMetrics, loading: policiesLoading } = usePolicies();
  const { stakeholders, metrics: stakeholderMetrics, loading: stakeholdersLoading } = useStakeholders();
  const { members, metrics: boardMetrics, loading: boardLoading } = useBoardComposition();

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculate();
    } catch (error) {
      console.error('Failed to recalculate score:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  const isLoading = scoreLoading || policiesLoading || stakeholdersLoading || boardLoading;

  if (isLoading) {
    return <HubSkeleton />;
  }

  const hasData = policies.length > 0 || stakeholders.length > 0 || members.length > 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <HubHeader
        eyebrow={<>THE WIRING &middot; GOVERNANCE</>}
        headline={<>Governance &amp; ethics.</>}
        description="Policies, stakeholder engagement, board composition, and transparency."
      >
        <PillButton variant="outline" size="sm" onClick={handleRecalculate} disabled={isRecalculating}>
          {isRecalculating ? 'Recalculating…' : 'Refresh data'}
        </PillButton>
      </HubHeader>

      <ScoreHero
        heading="GOVERNANCE SCORE"
        overallScore={score?.overall_score ?? null}
        dataCompleteness={score?.data_completeness ?? null}
        pillars={[
          { label: 'Policies', score: score?.policy_score ?? null },
          { label: 'Stakeholders', score: score?.stakeholder_score ?? null },
          { label: 'Board', score: score?.board_score ?? null },
          { label: 'Ethics', score: score?.ethics_score ?? null },
          { label: 'Transparency', score: score?.transparency_score ?? null },
        ]}
      />

      <QuickActionRow
        items={[
          {
            title: 'Policies',
            description: 'Manage organisational policies',
            href: '/governance/policies',
          },
          {
            title: 'Stakeholders',
            description: 'Track stakeholder engagement',
            href: '/governance/stakeholders',
          },
          {
            title: 'Board',
            description: 'Board composition and diversity',
            href: '/governance/board',
          },
          {
            title: 'Transparency',
            description: 'Mission, lobbying, ethics',
            href: '/governance/transparency',
          },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <HubTabList
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'policies', label: 'Policies' },
            { value: 'stakeholders', label: 'Stakeholders' },
            { value: 'board', label: 'Board' },
          ]}
        />

        <TabsContent value="overview" className="space-y-6">
          <SummaryRow
            figures={[
              { value: policyMetrics.active_policies, label: 'Active policies' },
              { value: stakeholderMetrics.total_stakeholders, label: 'Stakeholders' },
              { value: boardMetrics.total_members, label: 'Board members' },
              { value: policyMetrics.public_policies, label: 'Public policies' },
            ]}
          />

          {!hasData && (
            <GetStartedGuide
              description="Add data to calculate your Governance score and track compliance."
              actions={[
                { label: 'Add policy', href: '/governance/policies' },
                { label: 'Add stakeholder', href: '/governance/stakeholders' },
                { label: 'Add board member', href: '/governance/board' },
                { label: 'Set mission', href: '/governance/transparency' },
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="policies">
          <PolicyDashboard
            policies={policies}
            metrics={policyMetrics}
            isLoading={policiesLoading}
            onEditPolicy={() => router.push('/governance/policies')}
          />
        </TabsContent>

        <TabsContent value="stakeholders">
          <div className="space-y-6">
            <SummaryRow
              figures={Object.entries(stakeholderMetrics.by_type).map(([type, count]) => ({
                value: count as number,
                label: type,
              }))}
            />
            {stakeholderMetrics.engagement_overdue > 0 && (
              <p className="text-sm text-muted-foreground">
                <StateChip tone="attention" className="mr-2">
                  OVERDUE
                </StateChip>
                {stakeholderMetrics.engagement_overdue} stakeholder engagement
                {stakeholderMetrics.engagement_overdue !== 1 ? 's' : ''} overdue.
              </p>
            )}
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
              {stakeholderMetrics.total_stakeholders} stakeholders tracked
            </p>
          </div>
        </TabsContent>

        <TabsContent value="board">
          <BoardCompositionChart
            members={members}
            metrics={boardMetrics}
            isLoading={boardLoading}
            onEditMember={() => router.push('/governance/board')}
            onDeleteMember={() => router.push('/governance/board')}
          />
        </TabsContent>
      </Tabs>

      <ComplianceNote>
        Governance metrics support B Corp 2.1 Governance requirements and CSRD ESRS G1 (Business
        Conduct) reporting. Data can be exported for certification submissions and annual reports.
      </ComplianceNote>
    </div>
  );
}
