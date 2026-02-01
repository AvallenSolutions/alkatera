'use client';

import { useState } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  FileText,
  Users,
  Scale,
  Eye,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import Link from 'next/link';

import { GovernanceScoreHero } from '@/components/governance/GovernanceScoreHero';
import { PolicyDashboard } from '@/components/governance/PolicyDashboard';
import { BoardCompositionChart } from '@/components/governance/BoardCompositionChart';

import { useGovernanceScore } from '@/hooks/data/useGovernanceScore';
import { usePolicies } from '@/hooks/data/usePolicies';
import { useStakeholders } from '@/hooks/data/useStakeholders';
import { useBoardComposition } from '@/hooks/data/useBoardComposition';

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

export default function GovernancePage() {
  return (
    <FeatureGate feature="governance_ethics">
      <GovernancePageContent />
    </FeatureGate>
  );
}

function GovernancePageContent() {
  const [activeTab, setActiveTab] = useState('overview');
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
    return <PageSkeleton />;
  }

  const hasData = policies.length > 0 || stakeholders.length > 0 || members.length > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Governance & Ethics
          </h1>
          <p className="text-muted-foreground mt-1">
            Policies, stakeholder engagement, board composition, and transparency
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
      <GovernanceScoreHero
        overallScore={score?.overall_score ?? null}
        policyScore={score?.policy_score ?? null}
        stakeholderScore={score?.stakeholder_score ?? null}
        boardScore={score?.board_score ?? null}
        ethicsScore={score?.ethics_score ?? null}
        transparencyScore={score?.transparency_score ?? null}
        dataCompleteness={score?.data_completeness ?? null}
        isLoading={scoreLoading}
        onRecalculate={handleRecalculate}
        isRecalculating={isRecalculating}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Policies"
          description="Manage organizational policies"
          href="/governance/policies"
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        />
        <QuickActionCard
          title="Stakeholders"
          description="Track stakeholder engagement"
          href="/governance/stakeholders"
          icon={<Users className="h-5 w-5 text-purple-600" />}
        />
        <QuickActionCard
          title="Board"
          description="Board composition & diversity"
          href="/governance/board"
          icon={<Scale className="h-5 w-5 text-emerald-600" />}
        />
        <QuickActionCard
          title="Transparency"
          description="Mission, lobbying, ethics"
          href="/governance/transparency"
          icon={<Eye className="h-5 w-5 text-amber-600" />}
        />
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Policies</p>
                    <p className="text-2xl font-bold">{policyMetrics.active_policies}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stakeholders</p>
                    <p className="text-2xl font-bold">{stakeholderMetrics.total_stakeholders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Scale className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Board Members</p>
                    <p className="text-2xl font-bold">{boardMetrics.total_members}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Public Policies</p>
                    <p className="text-2xl font-bold">{policyMetrics.public_policies}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started Guide */}
          {!hasData && (
            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-base">Get Started with Governance</CardTitle>
                </div>
                <CardDescription>
                  Add data to calculate your Governance score and track compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link href="/governance/policies">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Policy
                    </Button>
                  </Link>
                  <Link href="/governance/stakeholders">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Stakeholder
                    </Button>
                  </Link>
                  <Link href="/governance/board">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Board Member
                    </Button>
                  </Link>
                  <Link href="/governance/transparency">
                    <Button variant="outline" className="w-full justify-start">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Set Mission
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="policies">
          <PolicyDashboard
            policies={policies}
            metrics={policyMetrics}
            isLoading={policiesLoading}
          />
        </TabsContent>

        <TabsContent value="stakeholders">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stakeholder Overview</CardTitle>
                <CardDescription>
                  {stakeholderMetrics.total_stakeholders} stakeholders tracked
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stakeholderMetrics.by_type).map(([type, count]) => (
                    <div key={type} className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground capitalize">{type}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {stakeholderMetrics.engagement_overdue > 0 && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <p className="font-medium">
                      {stakeholderMetrics.engagement_overdue} stakeholder engagement{stakeholderMetrics.engagement_overdue !== 1 ? 's' : ''} overdue
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="board">
          <BoardCompositionChart
            members={members}
            metrics={boardMetrics}
            isLoading={boardLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Compliance Note */}
      <Card className="bg-slate-50 dark:bg-slate-900/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Compliance:</strong> Governance metrics support B Corp 2.1 Governance requirements
            and CSRD ESRS G1 (Business Conduct) reporting. Data can be exported for certification
            submissions and annual reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
