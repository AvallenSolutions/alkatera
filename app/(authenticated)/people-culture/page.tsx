'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Briefcase,
  Heart,
  GraduationCap,
  RefreshCw,
  PlusCircle,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

import { PeopleCultureScoreHero } from '@/components/people-culture/PeopleCultureScoreHero';
import { FairWorkDashboard } from '@/components/people-culture/FairWorkDashboard';
import { DiversityDashboard } from '@/components/people-culture/DiversityDashboard';
import { TrainingDashboard } from '@/components/people-culture/TrainingDashboard';
import { WellbeingDashboard } from '@/components/people-culture/WellbeingDashboard';

import { FeatureGate } from '@/components/subscription/FeatureGate';
import { usePeopleCultureScore } from '@/hooks/data/usePeopleCultureScore';
import { useFairWorkMetrics } from '@/hooks/data/useFairWorkMetrics';
import { useDiversityMetrics } from '@/hooks/data/useDiversityMetrics';
import { useTrainingMetrics } from '@/hooks/data/useTrainingMetrics';
import { useWellbeingMetrics } from '@/hooks/data/useWellbeingMetrics';

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{title}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PeopleCulturePage() {
  return (
    <FeatureGate feature="people_fair_work">
      <PeopleCulturePageContent />
    </FeatureGate>
  );
}

function PeopleCulturePageContent() {
  const [activeTab, setActiveTab] = useState('overview');
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
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            People & Culture
          </h1>
          <p className="text-muted-foreground mt-1">
            Workforce wellbeing, diversity, fair work, and development metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={isRecalculating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Calculating...' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      {/* Score Hero */}
      <PeopleCultureScoreHero
        overallScore={score?.overall_score ?? null}
        fairWorkScore={score?.fair_work_score ?? null}
        diversityScore={score?.diversity_score ?? null}
        wellbeingScore={score?.wellbeing_score ?? null}
        trainingScore={score?.training_score ?? null}
        dataCompleteness={score?.data_completeness ?? null}
        isLoading={scoreLoading}
        onRecalculate={handleRecalculate}
        isRecalculating={isRecalculating}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Fair Work"
          description="Living wage, pay equity, compensation"
          href="/people-culture/fair-work"
          icon={<Briefcase className="h-5 w-5 text-blue-600" />}
        />
        <QuickActionCard
          title="Diversity & Inclusion"
          description="Demographics, representation, DEI"
          href="/people-culture/diversity-inclusion"
          icon={<Users className="h-5 w-5 text-purple-600" />}
        />
        <QuickActionCard
          title="Wellbeing"
          description="Benefits, surveys, engagement"
          href="/people-culture/wellbeing"
          icon={<Heart className="h-5 w-5 text-pink-600" />}
        />
        <QuickActionCard
          title="Training"
          description="Learning hours, development"
          href="/people-culture/training"
          icon={<GraduationCap className="h-5 w-5 text-amber-600" />}
        />
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fair-work">Fair Work</TabsTrigger>
          <TabsTrigger value="diversity">Diversity</TabsTrigger>
          <TabsTrigger value="wellbeing">Wellbeing</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Employees</p>
                    <p className="text-2xl font-bold">{summary?.total_employees || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Compensation Records</p>
                    <p className="text-2xl font-bold">{summary?.compensation_records || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Heart className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">DEI Actions</p>
                    <p className="text-2xl font-bold">{summary?.dei_total_actions || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Training Hours</p>
                    <p className="text-2xl font-bold">{summary?.total_training_hours?.toLocaleString() || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started Guide */}
          {(!summary?.total_employees || summary.total_employees === 0) && (
            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-base">Get Started with People & Culture</CardTitle>
                </div>
                <CardDescription>
                  Add data to calculate your People & Culture score and track B Corp readiness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link href="/people-culture/fair-work">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Compensation Data
                    </Button>
                  </Link>
                  <Link href="/people-culture/diversity-inclusion">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Demographics
                    </Button>
                  </Link>
                  <Link href="/people-culture/diversity-inclusion">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Create DEI Action
                    </Button>
                  </Link>
                  <Link href="/people-culture/training">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Log Training
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fair-work">
          <FairWorkDashboard metrics={fairWorkMetrics} isLoading={fairWorkLoading} />
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

      {/* Compliance Note */}
      <Card className="bg-slate-50 dark:bg-slate-900/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Compliance:</strong> People & Culture metrics support B Corp 2.1 People requirements
            (Fair Work, JEDI) and CSRD ESRS S1 (Own Workforce) reporting. Data is stored securely and
            can be exported for certification submissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
