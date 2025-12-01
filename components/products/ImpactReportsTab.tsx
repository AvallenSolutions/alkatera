"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, FileText, AlertCircle, ExternalLink, CheckCircle, FileWarning } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { ProductLCA } from "@/hooks/data/useProductData";

interface ImpactReportsTabProps {
  productId: string;
  isHealthy: boolean;
  lcaReports: ProductLCA[];
  onCalculate: () => void;
}

export function ImpactReportsTab({
  productId,
  isHealthy,
  lcaReports,
  onCalculate,
}: ImpactReportsTabProps) {
  return (
    <div className="space-y-6">
      {/* Generator Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle>Impact Calculation Engine</CardTitle>
              <CardDescription>
                Generate a new environmental impact report for this product
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isHealthy && (
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Setup Required:</strong> Add ingredients and packaging to enable calculation.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-4">
            <Button
              size="lg"
              disabled={!isHealthy}
              onClick={onCalculate}
              className="flex-1"
            >
              <Calculator className="h-5 w-5 mr-2" />
              Calculate New Impact Report
            </Button>
            {isHealthy && (
              <p className="text-sm text-slate-500">
                System will analyse {lcaReports.length > 0 ? 'updated' : 'initial'} recipe data
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Table Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-500 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle>Calculation History</CardTitle>
              <CardDescription>
                View all environmental impact reports for this product
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {lcaReports.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p className="text-base font-medium mb-2">No reports generated yet</p>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Once you've added ingredients and packaging, calculate your first impact report to see environmental metrics.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Run</TableHead>
                    <TableHead>System Boundary</TableHead>
                    <TableHead className="text-right">Total Impact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lcaReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {format(new Date(report.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {report.system_boundary || 'Cradle-to-Gate'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {report.aggregated_impacts?.climate_change_gwp100
                          ? `${report.aggregated_impacts.climate_change_gwp100.toFixed(3)} kg CO₂e`
                          : '—'
                        }
                      </TableCell>
                      <TableCell>
                        {report.status === 'verified' ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border-slate-200">
                            <FileWarning className="h-3 w-3 mr-1" />
                            Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/products/${productId}/lca/${report.id}/review`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View Report
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
