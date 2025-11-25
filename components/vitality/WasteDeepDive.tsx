import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Recycle, ArrowRight, Package } from 'lucide-react';

export function WasteDeepDive() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Recycle className="h-5 w-5" />
                Material Flow Analysis
              </CardTitle>
              <CardDescription>
                Circular economy & waste tracking (Sankey diagram)
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              CSRD E5
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardContent className="p-8 space-y-4">
              <div className="flex items-center justify-center">
                <Package className="h-16 w-16 text-amber-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Material Flow Visualisation Coming Soon</h3>
                <p className="text-sm text-muted-foreground">
                  Interactive Sankey diagram showing material inputs, product outputs, and waste streams across your operations.
                </p>
              </div>
              <div className="flex justify-center">
                <Badge variant="outline">In Development</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Virgin Materials In</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">--</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tracked via fossil resource scarcity metric
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recycled Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">--</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Percentage of recycled materials used
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Waste Generated</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">--</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total waste from operations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Waste Diverted</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">--</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recycled, composted, or recovered
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex items-start gap-3">
              <ArrowRight className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-900">
                  Enable Full Tracking
                </p>
                <p className="text-xs text-muted-foreground">
                  Connect waste management data and material receipts to see complete circular economy metrics and Sankey flows.
                </p>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
