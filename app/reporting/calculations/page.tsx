'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calculator, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface CalculationResult {
  success: boolean;
  message: string;
  calculations_performed: number;
  unmatched_activities?: number;
  details?: {
    total_activities: number;
    matched: number;
    unmatched: number;
    unmatched_list: string[];
  };
}

export default function CalculationsPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<CalculationResult | null>(null);

  const handleRunCalculations = async () => {
    setIsRunning(true);
    setLastResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in to run calculations');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-corporate-calculations`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run calculations');
      }

      setLastResult(result);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message || 'Calculation completed with errors');
      }
    } catch (error) {
      console.error('Error running calculations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to run calculations';
      toast.error(errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Corporate GHG Emissions Calculation
          </h1>
          <p className="text-muted-foreground mt-2">
            Calculate emissions from activity data using emissions factors
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Calculations</CardTitle>
            <CardDescription>
              This will process all activity data for your organisation and calculate
              emissions using matching emissions factors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <Calculator className="h-5 w-5 text-slate-600 dark:text-slate-400 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">How it works:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Fetches all activity data for your organisation</li>
                  <li>Matches each activity with appropriate emissions factors by unit</li>
                  <li>Calculates CO2e emissions (quantity × emissions factor)</li>
                  <li>Stores results with full audit trail</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={handleRunCalculations}
              disabled={isRunning}
              size="lg"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Running Calculations...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Run Corporate Calculations
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {lastResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-centre gap-2">
                {lastResult.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Calculation Complete
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Calculation Failed
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTitle>Summary</AlertTitle>
                <AlertDescription>{lastResult.message}</AlertDescription>
              </Alert>

              {lastResult.details && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Activities</p>
                    <p className="text-2xl font-bold">{lastResult.details.total_activities}</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Matched</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {lastResult.details.matched}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Unmatched</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {lastResult.details.unmatched}
                    </p>
                  </div>
                </div>
              )}

              {lastResult.details && lastResult.details.unmatched_list.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Unmatched Activities</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">
                      The following activities could not be matched to emissions factors:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {lastResult.details.unmatched_list.map((activity, index) => (
                        <li key={index}>{activity}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
