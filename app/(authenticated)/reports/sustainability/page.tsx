"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Download, Eye, Calendar, Building2 } from 'lucide-react';
import Link from 'next/link';

export default function SustainabilityReportsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Sustainability Reports</h1>
          <p className="text-lg text-muted-foreground">
            Corporate carbon footprint reports and compliance documentation
          </p>
        </div>
        <Link href="/reports/builder">
          <Button className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Generate New Report
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Corporate Carbon Footprint Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Corporate Carbon Footprint Reports
            </CardTitle>
            <CardDescription>
              Organisation-wide GHG emissions reports following the GHG Protocol Corporate Standard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="space-y-1">
                <h4 className="font-semibold">2024 Annual Carbon Footprint</h4>
                <p className="text-sm text-muted-foreground">
                  Complete Scope 1, 2, and 3 emissions inventory
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">GHG Protocol</Badge>
                  <Badge variant="outline" className="text-xs">ISO 14064-1</Badge>
                  <Badge variant="outline" className="text-xs">CSRD E1</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/reports/company-footprint/2024">
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

            <div className="text-center text-sm text-muted-foreground py-8">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No additional reports available</p>
              <p className="text-xs mt-1">Generate your first sustainability report above</p>
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon: Other Report Types */}
        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>CDP Climate Change Disclosure</CardTitle>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
            <CardDescription>
              Prepare responses for the CDP Climate Change questionnaire
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>TCFD-Aligned Climate Report</CardTitle>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
            <CardDescription>
              Task Force on Climate-related Financial Disclosures reporting
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>SBTi Progress Report</CardTitle>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
            <CardDescription>
              Science Based Targets initiative validation and tracking
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
