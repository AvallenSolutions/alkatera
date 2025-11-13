'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LcaWorkbench } from '@/components/lca/LcaWorkbench';
import { DqiJourneyCard } from '@/components/lca/DqiJourneyCard';
import { PageLoader } from '@/components/ui/page-loader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function LcaWorkbenchPage() {
  const [activityData, setActivityData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivityData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('activity_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setActivityData(data || []);
    } catch (err: any) {
      console.error('Error fetching activity data:', err);
      setError(err.message || 'Failed to load activity data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityData();
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LCA Workbench</h1>
        <p className="text-muted-foreground mt-1">
          Build and manage your Life Cycle Assessment with platform estimates
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LcaWorkbench activityData={activityData} onDataPointAdded={fetchActivityData} />
        </div>
        <div>
          <DqiJourneyCard />
        </div>
      </div>
    </div>
  );
}
