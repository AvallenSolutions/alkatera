'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Database, Loader2 } from 'lucide-react';
import { OpenLcaProcessBrowser, type OpenLcaProcess } from './OpenLcaProcessBrowser';

interface ActivityDataPoint {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  source_type: string;
  data_payload: any;
  activity_date: string;
  created_at: string;
}

interface LcaWorkbenchProps {
  facilityId?: string;
  lcaReportId?: string;
  activityData?: ActivityDataPoint[];
  onDataPointAdded?: () => void;
}

export function LcaWorkbench({
  facilityId,
  lcaReportId,
  activityData = [],
  onDataPointAdded,
}: LcaWorkbenchProps) {
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [localActivityData, setLocalActivityData] = useState<ActivityDataPoint[]>(activityData);

  const handleProcessSelect = async (selectedProcess: OpenLcaProcess) => {
    setIsCreating(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-activity-data-point`;

      const payload = {
        facilityId: facilityId || null,
        lcaReportId: lcaReportId || null,
        sourceType: 'platform_estimate',
        dataPayload: {
          openLcaProcessId: selectedProcess.id,
          openLcaProcessName: selectedProcess.name,
          openLcaCategory: selectedProcess.category,
        },
        name: selectedProcess.name,
        category: selectedProcess.category,
        quantity: 1,
        unit: 'unit',
        activityDate: new Date().toISOString().split('T')[0],
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create activity data point');
      }

      const result = await response.json();

      setLocalActivityData((prev) => [result.dataPoint, ...prev]);

      toast.success('Platform estimate added successfully');

      if (onDataPointAdded) {
        onDataPointAdded();
      }
    } catch (error: any) {
      console.error('Error creating activity data point:', error);
      toast.error(error.message || 'Failed to add platform estimate');
    } finally {
      setIsCreating(false);
    }
  };

  const getSourceTypeBadge = (sourceType: string) => {
    // Visual compliance mandate: Platform estimates must be visually distinct
    switch (sourceType) {
      case 'linked_lca_report':
        return <Badge className="bg-green-600">Tier 1: LCA Report</Badge>;
      case 'supplier_provided':
        return <Badge className="bg-amber-500">Tier 2: Supplier Data</Badge>;
      case 'platform_estimate':
        // Muted grey styling for platform estimates (compliance requirement)
        return <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">Platform Estimate</Badge>;
      case 'user_provided':
        return <Badge variant="outline">Tier 3: Manual Entry</Badge>;
      default:
        return <Badge variant="outline">{sourceType}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-centre justify-between">
          <div>
            <CardTitle>LCA Workbench</CardTitle>
            <CardDescription>Manage activity data points and estimates</CardDescription>
          </div>
          <Button onClick={() => setIsBrowserOpen(true)} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Platform Estimate
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {localActivityData.length === 0 ? (
          <div className="flex flex-col items-centre justify-centre py-12 text-centre border rounded-lg">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No activity data yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Add platform estimates from the OpenLCA database or input manual data to start
              building your LCA.
            </p>
            <Button onClick={() => setIsBrowserOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Platform Estimate
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Process Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Data Source</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localActivityData.map((dataPoint) => (
                <TableRow key={dataPoint.id}>
                  <TableCell className="font-medium">{dataPoint.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dataPoint.category}
                  </TableCell>
                  <TableCell>
                    {dataPoint.quantity} {dataPoint.unit}
                  </TableCell>
                  <TableCell>{getSourceTypeBadge(dataPoint.source_type)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(dataPoint.activity_date).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <OpenLcaProcessBrowser
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onProcessSelect={handleProcessSelect}
      />
    </Card>
  );
}
