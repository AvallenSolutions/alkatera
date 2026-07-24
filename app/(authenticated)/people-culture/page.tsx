'use client';

/**
 * People & culture hub (/people-culture/), OUR PEOPLE, in the studio
 * grammar: one statement, the family score said once through the shared
 * ScoreHero, quiet doors to the four detail pages, URL-synced mono tabs,
 * and a dim compliance footnote. The score recalc POST is unchanged.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';

import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
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

// Round 9 (auto-research): each dashboard lives in its own (non-default) tab, so
// only one is ever shown; defer all four out of /people-culture's first load.
const FairWorkDashboard = dynamic(() => import('@/components/people-culture/FairWorkDashboard').then((m) => m.FairWorkDashboard), { ssr: false });
const DiversityDashboard = dynamic(() => import('@/components/people-culture/DiversityDashboard').then((m) => m.DiversityDashboard), { ssr: false });
const TrainingDashboard = dynamic(() => import('@/components/people-culture/TrainingDashboard').then((m) => m.TrainingDashboard), { ssr: false });
const WellbeingDashboard = dynamic(() => import('@/components/people-culture/WellbeingDashboard').then((m) => m.WellbeingDashboard), { ssr: false });

import { FeatureGate } from '@/components/subscription/FeatureGate';
import { usePeopleCultureScore } from '@/hooks/data/usePeopleCultureScore';
import { useFairWorkMetrics } from '@/hooks/data/useFairWorkMetrics';
import { useDiversityMetrics } from '@/hooks/data/useDiversityMetrics';
import { useTrainingMetrics } from '@/hooks/data/useTrainingMetrics';
import { useWellbeingMetrics } from '@/hooks/data/useWellbeingMetrics';

export default function PeopleCulturePage() {
  return (
    <FeatureGate feature="people_fair_work">
      <PeopleCulturePageContent />
    </FeatureGate>
  );
}

function PeopleCulturePageContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useUrlTab('overview');
  const [isRecalculating, setIsRecalculating] = useState(false);

  const {
    score,
    summary,
    loading: scoreLoading,
    recalculate,
  } = usePeopleCultureScore();

  const { metrics: fairWorkMetrics, loading: fairWorkLoading } = useFairWorkMetrics();
  const { metrics: diversityMetrics, loading: diversityLoading } = useDiversityMetrics();
  const { metrics: trainingMetrics, loading: trainingLoading } = useTrainingMetrics();
  const { metrics: wellbeingMetrics, loading: wellbeingLoading } = useWellbeingMetrics();

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

  const isLoading = scoreLoading || fairWorkLoading || diversityLoading || trainingLoading || wellbeingLoading;

  if (isLoading) {
    return <HubSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <HubHeader
        eyebrow={<>OUR PEOPLE &middot; PEOPLE &amp; CULTURE</>}
        headline={<>People &amp; culture.</>}
        description="Workforce wellbeing, diversity, fair work, and development metrics."
      >
        {typeof summary?.total_employees === 'number' && (
          <BigNumber size="display" value={summary.total_employees} label="Employees" />
        )}
        <PillButton variant="outline" size="sm" onClick={handleRecalculate} disabled={isRecalculating}>
          {isRecalculating ? 'Recalculating…' : 'Refresh data'}
        </PillButton>
      </HubHeader>

      <ScoreHero
        heading={'PEOPLE & CULTURE SCORE'}
        overallScore={score?.overall_score ?? null}
        dataCompleteness={score?.data_completeness ?? null}
        pillars={[
          { label: 'Fair work', score: score?.fair_work_score ?? null },
          { label: 'Diversity', score: score?.diversity_score ?? null },
          { label: 'Wellbeing', score: score?.wellbeing_score ?? null },
          { label: 'Training', score: score?.training_score ?? null },
        ]}
      />

      <QuickActionRow
        items={[
          {
            title: 'Fair work',
            description: 'Living wage, pay equity, compensation',
            href: '/people-culture/fair-work',
          },
          {
            title: 'Diversity & inclusion',
            description: 'Demographics, representation, DEI',
            href: '/people-culture/diversity-inclusion',
          },
          {
            title: 'Wellbeing',
            description: 'Benefits, surveys, engagement',
            href: '/people-culture/wellbeing',
          },
          {
            title: 'Training',
            description: 'Learning hours, development',
            href: '/people-culture/training',
          },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <HubTabList
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'fair-work', label: 'Fair work' },
            { value: 'diversity', label: 'Diversity' },
            { value: 'wellbeing', label: 'Wellbeing' },
            { value: 'training', label: 'Training' },
          ]}
        />

        <TabsContent value="overview" className="space-y-6">
          <SummaryRow
            figures={[
              { value: summary?.total_employees || '·', label: 'Total employees' },
              { value: summary?.compensation_records || '·', label: 'Compensation records' },
              { value: summary?.dei_total_actions || '·', label: 'DEI actions' },
              { value: summary?.total_training_hours?.toLocaleString() || '·', label: 'Training hours' },
            ]}
          />

          {(!summary?.total_employees || summary.total_employees === 0) && (
            <GetStartedGuide
              description="Add data to calculate your People & Culture score and track B Corp readiness."
              actions={[
                { label: 'Add compensation data', href: '/people-culture/fair-work' },
                { label: 'Add demographics', href: '/people-culture/diversity-inclusion' },
                { label: 'Create DEI action', href: '/people-culture/diversity-inclusion' },
                { label: 'Log training', href: '/people-culture/training' },
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="fair-work">
          <FairWorkDashboard
            metrics={fairWorkMetrics}
            isLoading={fairWorkLoading}
            onEditRecord={() => router.push('/people-culture/fair-work')}
            onDeleteRecord={() => router.push('/people-culture/fair-work')}
          />
        </TabsContent>

        <TabsContent value="diversity">
          <DiversityDashboard metrics={diversityMetrics} isLoading={diversityLoading} />
        </TabsContent>

        <TabsContent value="wellbeing">
          <WellbeingDashboard metrics={wellbeingMetrics} isLoading={wellbeingLoading} />
        </TabsContent>

        <TabsContent value="training">
          <TrainingDashboard metrics={trainingMetrics} isLoading={trainingLoading} />
        </TabsContent>
      </Tabs>

      <ComplianceNote>
        People &amp; Culture metrics support B Corp 2.1 People requirements (Fair Work, JEDI) and
        CSRD ESRS S1 (Own Workforce) reporting. Data is stored securely and can be exported for
        certification submissions.
      </ComplianceNote>
    </div>
  );
}
