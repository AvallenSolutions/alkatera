'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, History, Award, AlertCircle } from 'lucide-react';
// import { Progress } from '@/components/ui/progress';

interface DqiStats {
  totalDataPoints: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  dqiScore: number;
  recentUpgrades: number;
}

interface DqiJourneyCardProps {
  organizationId?: string;
}

export function DqiJourneyCard({ organizationId }: DqiJourneyCardProps) {
  const [stats, setStats] = useState<DqiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDqiStats();
  }, [organizationId]);

  const fetchDqiStats = async () => {
    setIsLoading(true);

    try {
      // Fetch activity data points grouped by source type
      const { data: activityData, error } = await supabase
        .from('activity_data')
        .select('source_type, created_at');

      if (error) throw error;

      if (!activityData || activityData.length === 0) {
        setStats({
          totalDataPoints: 0,
          tier1Count: 0,
          tier2Count: 0,
          tier3Count: 0,
          dqiScore: 0,
          recentUpgrades: 0,
        });
        return;
      }

      // Count data points by tier
      const tier1Count = activityData.filter(d => d.source_type === 'linked_lca_report').length;
      const tier2Count = activityData.filter(d => d.source_type === 'supplier_provided').length;
      const tier3Count = activityData.filter(
        d => d.source_type === 'platform_estimate' || d.source_type === 'user_provided'
      ).length;

      const totalDataPoints = activityData.length;

      // Calculate DQI score (weighted: Tier 1 = 100, Tier 2 = 60, Tier 3 = 20)
      const weightedScore = (tier1Count * 100) + (tier2Count * 60) + (tier3Count * 20);
      const dqiScore = totalDataPoints > 0 ? Math.round(weightedScore / totalDataPoints) : 0;

      // Fetch recent upgrades (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: historyData } = await supabase
        .from('data_point_version_history')
        .select('change_type, updated_at')
        .in('change_type', ['quality_upgrade', 'lca_linkage'])
        .gte('updated_at', thirtyDaysAgo.toISOString());

      setStats({
        totalDataPoints,
        tier1Count,
        tier2Count,
        tier3Count,
        dqiScore,
        recentUpgrades: historyData?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching DQI stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-centre gap-2">
            <Award className="h-5 w-5" />
            Data Quality Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-centre justify-centre">
            <div className="animate-pulse text-muted-foreground">Loading DQI stats...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalDataPoints === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-centre gap-2">
            <Award className="h-5 w-5" />
            Data Quality Journey
          </CardTitle>
          <CardDescription>Track your data quality improvements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-centre justify-centre py-8 text-centre">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Add activity data points to start tracking your DQI journey
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDqiColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-500';
    return 'text-slate-500';
  };

  const getDqiLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-centre gap-2">
          <Award className="h-5 w-5" />
          Data Quality Journey
        </CardTitle>
        <CardDescription>
          Your data quality score and tier distribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* DQI Score */}
        <div className="space-y-2">
          <div className="flex items-centre justify-between">
            <span className="text-sm font-medium">Overall DQI Score</span>
            <span className={`text-2xl font-bold ${getDqiColor(stats.dqiScore)}`}>
              {stats.dqiScore}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${stats.dqiScore}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {getDqiLabel(stats.dqiScore)} - {stats.totalDataPoints} total data points
          </p>
        </div>

        {/* Tier Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Quality Tier Distribution</h4>

          <div className="space-y-2">
            <div className="flex items-centre justify-between">
              <div className="flex items-centre gap-2">
                <Badge className="bg-green-600">Tier 1</Badge>
                <span className="text-sm text-muted-foreground">Verified LCA</span>
              </div>
              <span className="text-sm font-medium">{stats.tier1Count}</span>
            </div>

            <div className="flex items-centre justify-between">
              <div className="flex items-centre gap-2">
                <Badge className="bg-amber-500">Tier 2</Badge>
                <span className="text-sm text-muted-foreground">Supplier Data</span>
              </div>
              <span className="text-sm font-medium">{stats.tier2Count}</span>
            </div>

            <div className="flex items-centre justify-between">
              <div className="flex items-centre gap-2">
                <Badge variant="secondary">Tier 3</Badge>
                <span className="text-sm text-muted-foreground">Estimates</span>
              </div>
              <span className="text-sm font-medium">{stats.tier3Count}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {stats.recentUpgrades > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-centre gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-600">
                {stats.recentUpgrades} quality upgrade{stats.recentUpgrades > 1 ? 's' : ''}
              </span>
              <span className="text-muted-foreground">in the last 30 days</span>
            </div>
          </div>
        )}

        {/* Improvement Opportunity */}
        {stats.tier3Count > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-centre gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4" />
              <span>
                {stats.tier3Count} data point{stats.tier3Count > 1 ? 's' : ''} can be upgraded
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
