'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Link2, TrendingUp, FileCheck, Calendar, Building2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LcaReport {
  id: string;
  report_name: string;
  report_date: string;
  product_name: string | null;
  functional_unit: string | null;
  verification_status: string;
  supplier_id: string | null;
  organizations?: {
    name: string;
  } | null;
}

interface SupplierLcaLinkerProps {
  isOpen: boolean;
  onClose: () => void;
  activityDataPointId: string;
  currentDataPointName: string;
  onLinkSuccess: () => void;
}

export function SupplierLcaLinker({
  isOpen,
  onClose,
  activityDataPointId,
  currentDataPointName,
  onLinkSuccess,
}: SupplierLcaLinkerProps) {
  const [availableReports, setAvailableReports] = useState<LcaReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableLcaReports();
    }
  }, [isOpen]);

  const fetchAvailableLcaReports = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('lca_reports')
        .select(`
          id,
          report_name,
          report_date,
          product_name,
          functional_unit,
          verification_status,
          supplier_id,
          organizations:supplier_id (
            name
          )
        `)
        .order('report_date', { ascending: false });

      if (error) throw error;

      // Transform the data to match the interface
      const transformedData: LcaReport[] = (data || []).map((report: any) => ({
        id: report.id,
        report_name: report.report_name,
        report_date: report.report_date,
        product_name: report.product_name,
        functional_unit: report.functional_unit,
        verification_status: report.verification_status,
        supplier_id: report.supplier_id,
        organizations: Array.isArray(report.organizations) && report.organizations.length > 0
          ? report.organizations[0]
          : null,
      }));

      setAvailableReports(transformedData);
    } catch (err: any) {
      console.error('Error fetching LCA reports:', err);
      setError(err.message || 'Failed to load available LCA reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkReport = async () => {
    if (!selectedReport) {
      toast.error('Please select an LCA report to link');
      return;
    }

    setIsLinking(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        throw new Error('You must be logged in');
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/link-supplier-lca`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityDataPointId,
          lcaReportId: selectedReport,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link LCA report');
      }

      const result = await response.json();

      toast.success('LCA report linked successfully! Data quality upgraded to Tier 1.', {
        description: 'Your data point now has verified supplier data.',
        duration: 5000,
      });

      onLinkSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error linking LCA report:', error);
      toast.error(error.message || 'Failed to link LCA report');
    } finally {
      setIsLinking(false);
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Verification</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleClose = () => {
    setSelectedReport(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-centre gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Upgrade Data Quality: Link Supplier LCA
          </DialogTitle>
          <DialogDescription>
            Link "{currentDataPointName}" to a verified supplier LCA report to upgrade from Tier 3
            (Platform Estimate) to Tier 1 (Verified LCA Data)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Alert className="mb-4">
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <strong>DQI Journey:</strong> Linking to a verified supplier LCA creates an immutable
              audit trail and significantly improves your data quality score.
            </AlertDescription>
          </Alert>

          {isLoading && (
            <div className="flex items-centre justify-centre py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isLoading && availableReports.length === 0 && (
            <div className="flex flex-col items-centre justify-centre py-12 text-centre">
              <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No LCA Reports Available</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                You don't have any supplier LCA reports uploaded yet. Upload verified
                LCA reports from your suppliers to enable quality upgrades.
              </p>
            </div>
          )}

          {!isLoading && availableReports.length > 0 && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {availableReports.map((report) => (
                  <Card
                    key={report.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedReport === report.id
                        ? 'ring-2 ring-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedReport(report.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-centre gap-2">
                            {selectedReport === report.id && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                            {report.report_name}
                          </CardTitle>
                          {report.product_name && (
                            <CardDescription className="mt-1">
                              Product: {report.product_name}
                            </CardDescription>
                          )}
                        </div>
                        {getVerificationBadge(report.verification_status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-centre gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Report Date: {new Date(report.report_date).toLocaleDateString()}</span>
                      </div>
                      {report.organizations && (
                        <div className="flex items-centre gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>Supplier: {report.organizations.name}</span>
                        </div>
                      )}
                      {report.functional_unit && (
                        <div className="flex items-centre gap-2 text-muted-foreground">
                          <span className="font-medium">Functional Unit:</span>
                          <span>{report.functional_unit}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLinking}>
            Cancel
          </Button>
          <Button
            onClick={handleLinkReport}
            disabled={!selectedReport || isLinking}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLinking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Link LCA Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
