"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Award, Eye, Download, Search, Filter, Package, Calendar, Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

interface LCAReport {
  id: string;
  product_id: number | null;
  product_name: string;
  title: string;
  version: string;
  status: 'completed' | 'draft' | 'in_progress';
  dqi_score: number;
  system_boundary: string;
  functional_unit: string;
  assessment_period: string;
  published_at: string | null;
  total_co2e: number;
}

export default function LcasPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<LCAReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchLCAReports();
    }
  }, [currentOrganization]);

  const fetchLCAReports = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      // Fetch all product LCAs for the organization
      const { data: lcas, error: lcaError } = await supabase
        .from('product_carbon_footprints')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });

      if (lcaError) {
        console.error('Error fetching LCAs:', lcaError);
        setReports([]);
        return;
      }

      if (!lcas || lcas.length === 0) {
        setReports([]);
        return;
      }

      // Transform the data using total_ghg_emissions from product_lcas
      const transformedReports: LCAReport[] = lcas.map((lca: any) => {
        // Get total GHG emissions from aggregated_impacts JSONB field
        const totalCO2e = lca.aggregated_impacts?.total_carbon_footprint ||
                          lca.aggregated_impacts?.total_climate ||
                          lca.total_ghg_emissions ||
                          0;

        // Calculate DQI score based on status and data completeness
        let dqiScore = 50;
        if (lca.status === 'completed') dqiScore = 85;

        // Check if lifecycle data exists in aggregated_impacts
        const hasLifecycleData =
          lca.aggregated_impacts?.breakdown?.by_lifecycle_stage &&
          Object.keys(lca.aggregated_impacts.breakdown.by_lifecycle_stage).length > 0;
        if (hasLifecycleData) dqiScore += 10;

        // Get product name from stored value in product_lcas
        const productName = lca.product_name || 'Unknown Product';
        const functionalUnit = lca.functional_unit || 'per unit';

        return {
          id: lca.id,
          product_id: lca.product_id,
          product_name: productName,
          title: `${new Date(lca.created_at).getFullYear()} LCA Study`,
          version: '1.0',
          status: lca.status === 'completed' ? 'completed' : 'draft',
          dqi_score: dqiScore,
          system_boundary: lca.system_boundary || 'cradle-to-gate',
          functional_unit: functionalUnit,
          assessment_period: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
          published_at: lca.status === 'completed' ? lca.updated_at : null,
          total_co2e: totalCO2e,
        };
      });

      setReports(transformedReports);
    } catch (error) {
      console.error('Failed to fetch LCA reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report =>
    report.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const config = {
      completed: { className: 'bg-green-600', label: 'Completed' },
      published: { className: 'bg-green-600', label: 'Published' },
      verified: { className: 'bg-blue-600', label: 'Verified' },
      draft: { className: 'bg-gray-500', label: 'Draft' },
      in_progress: { className: 'bg-amber-600', label: 'In Progress' },
    };
    return config[status as keyof typeof config] || config.draft;
  };

  const getDQIBadge = (score: number) => {
    if (score >= 80) return { className: 'bg-green-600', label: 'High Confidence' };
    if (score >= 50) return { className: 'bg-amber-600', label: 'Medium Confidence' };
    return { className: 'bg-red-600', label: 'Modelled' };
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">LCA's & EPD's</h1>
          <p className="text-lg text-muted-foreground">
            Life Cycle Assessments and Environmental Product Declarations
          </p>
        </div>
        <Link href="/products">
          <Button className="gap-2">
            <Package className="h-4 w-4" />
            Create New LCA
          </Button>
        </Link>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name or report title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading ? (
        <Card>
          <CardContent className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reports.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {reports.filter(r => r.status === 'completed').length} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average DQI Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reports.length > 0 ? Math.round(reports.reduce((sum, r) => sum + r.dqi_score, 0) / reports.length) : 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Data quality indicator
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">CSRD Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reports.filter(r => r.dqi_score >= 80).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ready for disclosure
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Reports</h2>

        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No reports found matching your search</p>
              <p className="text-xs mt-1">Try adjusting your search terms</p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => {
            const statusBadge = getStatusBadge(report.status);
            const dqiBadge = getDQIBadge(report.dqi_score);

            return (
              <Card key={report.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{report.product_name}</CardTitle>
                        <Badge variant="default" className={statusBadge.className}>
                          {statusBadge.label}
                        </Badge>
                        <Badge variant="outline">v{report.version}</Badge>
                      </div>
                      <CardDescription>{report.title}</CardDescription>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {report.functional_unit}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {report.assessment_period}
                        </div>
                        {report.published_at && (
                          <div className="flex items-center gap-1">
                            Published: {new Date(report.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{report.dqi_score}/100</span>
                        <Badge variant="default" className={`${dqiBadge.className} text-xs`}>
                          {dqiBadge.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground">Total GHG Emissions</p>
                        <p className="text-lg font-semibold">{report.total_co2e.toFixed(3)} kg CO₂eq</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">System Boundary</p>
                        <p className="text-sm font-medium">{report.system_boundary}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Standards</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">ISO 14044</Badge>
                          <Badge variant="outline" className="text-xs">CSRD</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/products/${report.product_id}/report`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Report
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Award className="h-6 w-6 text-blue-600" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">About Carbon Footprint Reports</h3>
              <p className="text-sm text-blue-800">
                Life Cycle Assessments (LCAs) provide a comprehensive environmental profile of your products following ISO 14044:2006 standards.
                Each report includes cradle-to-gate impacts across multiple environmental categories including climate change, water use,
                land use, and resource depletion.
              </p>
              <p className="text-sm text-blue-800">
                Reports with a DQI score above 80 are suitable for external disclosure under CSRD and GHG Protocol Product Standard.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
