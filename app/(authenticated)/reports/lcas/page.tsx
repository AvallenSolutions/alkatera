"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Award, Eye, Download, Search, Filter, Package, Calendar, Shield } from 'lucide-react';
import Link from 'next/link';

// Mock LCA reports data
const MOCK_LCA_REPORTS = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    product_id: 1,
    product_name: 'Elderflower Pressé 250ml',
    title: '2025 Product Impact Assessment',
    version: '1.0',
    status: 'published' as const,
    dqi_score: 92,
    system_boundary: 'Cradle-to-Gate',
    functional_unit: '250ml bottle',
    assessment_period: 'January 2025',
    published_at: '2025-01-20',
    total_co2e: 0.185,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    product_id: 2,
    product_name: 'Traditional Lemonade 330ml',
    title: '2025 LCA Study',
    version: '1.0',
    status: 'published' as const,
    dqi_score: 88,
    system_boundary: 'Cradle-to-Gate',
    functional_unit: '330ml bottle',
    assessment_period: 'January 2025',
    published_at: '2025-01-18',
    total_co2e: 0.235,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    product_id: 3,
    product_name: 'Ginger Beer 275ml',
    title: '2025 Environmental Profile',
    version: '1.0',
    status: 'draft' as const,
    dqi_score: 76,
    system_boundary: 'Cradle-to-Gate',
    functional_unit: '275ml bottle',
    assessment_period: 'January 2025',
    published_at: null,
    total_co2e: 0.198,
  },
];

export default function LcasPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReports = MOCK_LCA_REPORTS.filter(report =>
    report.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const config = {
      published: { className: 'bg-green-600', label: 'Published' },
      verified: { className: 'bg-blue-600', label: 'Verified' },
      draft: { className: 'bg-gray-500', label: 'Draft' },
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_LCA_REPORTS.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {MOCK_LCA_REPORTS.filter(r => r.status === 'published').length} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average DQI Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(MOCK_LCA_REPORTS.reduce((sum, r) => sum + r.dqi_score, 0) / MOCK_LCA_REPORTS.length)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              High confidence data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">CSRD Compliant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {MOCK_LCA_REPORTS.filter(r => r.dqi_score >= 80).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready for disclosure
            </p>
          </CardContent>
        </Card>
      </div>

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
                        <p className="text-lg font-semibold">{report.total_co2e} kg CO₂eq</p>
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
              <h3 className="font-semibold text-blue-900">About LCA Reports</h3>
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
