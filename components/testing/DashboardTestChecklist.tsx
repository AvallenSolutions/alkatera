'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface TestItem {
  id: string;
  category: string;
  test: string;
  status: 'pending' | 'pass' | 'fail';
}

export function DashboardTestChecklist() {
  const [tests, setTests] = useState<TestItem[]>([
    { id: '1.1', category: 'Data Accuracy', test: 'Dashboard total emissions matches /reports/company-footprint/[year]', status: 'pending' },
    { id: '1.2', category: 'Data Accuracy', test: 'Dashboard Scope 1 matches company footprint Scope 1', status: 'pending' },
    { id: '1.3', category: 'Data Accuracy', test: 'Dashboard Scope 2 matches company footprint Scope 2', status: 'pending' },
    { id: '1.4', category: 'Data Accuracy', test: 'Dashboard Scope 3 matches company footprint Scope 3', status: 'pending' },
    { id: '1.5', category: 'Data Accuracy', test: 'Product count matches /products page', status: 'pending' },
    { id: '1.6', category: 'Data Accuracy', test: 'No hardcoded values visible in any widget', status: 'pending' },
    { id: '1.7', category: 'Data Accuracy', test: 'Empty state shows 0, not placeholder values', status: 'pending' },

    { id: '2.1', category: 'Real-Time Updates', test: 'Add production log → dashboard updates', status: 'pending' },
    { id: '2.2', category: 'Real-Time Updates', test: 'Complete LCA → product count updates', status: 'pending' },
    { id: '2.3', category: 'Real-Time Updates', test: 'Add Scope 1/2 → emissions update', status: 'pending' },
    { id: '2.4', category: 'Real-Time Updates', test: 'Add Scope 3 overhead → emissions update', status: 'pending' },
    { id: '2.5', category: 'Real-Time Updates', test: 'Refresh button refetches all data', status: 'pending' },

    { id: '3.1', category: 'Cross-Page Consistency', test: 'Dashboard matches company footprint page', status: 'pending' },
    { id: '3.2', category: 'Cross-Page Consistency', test: 'Dashboard matches products page', status: 'pending' },
    { id: '3.3', category: 'Cross-Page Consistency', test: 'All pages use same data sources', status: 'pending' },

    { id: '4.1', category: 'Preview Mode', test: 'Preview banner shows when no corporate_reports exist', status: 'pending' },
    { id: '4.2', category: 'Preview Mode', test: 'Preview mode calculates from production_logs × LCAs', status: 'pending' },
    { id: '4.3', category: 'Preview Mode', test: 'Generate Report button links to correct page', status: 'pending' },
    { id: '4.4', category: 'Preview Mode', test: 'Preview mode disappears after generating report', status: 'pending' },
  ]);

  const updateTestStatus = (id: string, status: 'pass' | 'fail') => {
    setTests(tests.map(t => t.id === id ? { ...t, status } : t));
  };

  const passCount = tests.filter(t => t.status === 'pass').length;
  const failCount = tests.filter(t => t.status === 'fail').length;
  const pendingCount = tests.filter(t => t.status === 'pending').length;

  return (
    <Card className="mt-8 border-amber-200 dark:border-amber-800">
      <CardHeader className="bg-amber-50 dark:bg-amber-950/30">
        <CardTitle className="flex items-center justify-between">
          <span>Dashboard Test Checklist (Development Only)</span>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-green-500">{passCount} Passed</Badge>
            <Badge variant="destructive">{failCount} Failed</Badge>
            <Badge variant="secondary">{pendingCount} Pending</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {Object.entries(
            tests.reduce((acc, test) => {
              if (!acc[test.category]) acc[test.category] = [];
              acc[test.category].push(test);
              return acc;
            }, {} as Record<string, TestItem[]>)
          ).map(([category, categoryTests]) => (
            <div key={category} className="space-y-3">
              <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 border-b pb-2">
                {category}
              </h3>
              {categoryTests.map(test => (
                <div key={test.id} className="flex items-center gap-3 pl-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded transition-colors">
                  <span className="text-xs text-muted-foreground font-mono min-w-[2.5rem]">
                    {test.id}
                  </span>
                  <span className="text-sm flex-1">{test.test}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateTestStatus(test.id, 'pass')}
                      className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
                        test.status === 'pass'
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 hover:bg-green-100 dark:hover:bg-green-900'
                      }`}
                    >
                      Pass
                    </button>
                    <button
                      onClick={() => updateTestStatus(test.id, 'fail')}
                      className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
                        test.status === 'fail'
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900'
                      }`}
                    >
                      Fail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Testing Instructions:</h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Run through each test manually in the browser</li>
            <li>Mark as Pass ✓ or Fail ✗ based on actual behaviour</li>
            <li>All tests must pass before deploying to production</li>
            <li><strong className="text-amber-600 dark:text-amber-400">IMPORTANT:</strong> Remove this component before production deployment</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
