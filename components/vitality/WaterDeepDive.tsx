import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Droplets, AlertTriangle } from 'lucide-react';
import { FacilityWaterRisk } from '@/hooks/data/useCompanyMetrics';

interface WaterDeepDiveProps {
  facilityWaterRisks: FacilityWaterRisk[];
}

export function WaterDeepDive({ facilityWaterRisks }: WaterDeepDiveProps) {
  const highRiskFacilities = facilityWaterRisks.filter(f => f.risk_level === 'high');
  const mediumRiskFacilities = facilityWaterRisks.filter(f => f.risk_level === 'medium');
  const lowRiskFacilities = facilityWaterRisks.filter(f => f.risk_level === 'low');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Facility Water Risk Map
              </CardTitle>
              <CardDescription>
                Geographic water scarcity analysis using AWARE method
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              AWARE
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-2 border-red-200 bg-red-50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">
                    High Risk
                  </span>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div className="text-3xl font-bold text-red-900">
                  {highRiskFacilities.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Facilities in water-stressed regions
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 bg-amber-50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                    Medium Risk
                  </span>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-3xl font-bold text-amber-900">
                  {mediumRiskFacilities.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Moderate water scarcity concern
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">
                    Low Risk
                  </span>
                  <Droplets className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-green-900">
                  {lowRiskFacilities.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Abundant water resources
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Facility Risk Details</h3>
            <div className="space-y-2">
              {facilityWaterRisks.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No facility water risk data available. Add facilities with location data to see risk analysis.
                  </CardContent>
                </Card>
              ) : (
                facilityWaterRisks.map((facility) => {
                  const riskConfig = {
                    high: {
                      bgColor: 'bg-red-50',
                      borderColor: 'border-red-200',
                      textColor: 'text-red-700',
                      badgeClass: 'bg-red-600',
                    },
                    medium: {
                      bgColor: 'bg-amber-50',
                      borderColor: 'border-amber-200',
                      textColor: 'text-amber-700',
                      badgeClass: 'bg-amber-600',
                    },
                    low: {
                      bgColor: 'bg-green-50',
                      borderColor: 'border-green-200',
                      textColor: 'text-green-700',
                      badgeClass: 'bg-green-600',
                    },
                  };

                  const config = riskConfig[facility.risk_level];

                  return (
                    <Card key={facility.facility_id} className={`${config.bgColor} ${config.borderColor} border-2`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <MapPin className={`h-4 w-4 ${config.textColor}`} />
                              <span className="font-semibold">{facility.facility_name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Location: {facility.location_country_code}</span>
                              <span>AWARE Factor: {facility.water_scarcity_aware.toFixed(1)} m³ world eq/m³</span>
                            </div>
                          </div>
                          <Badge variant="default" className={config.badgeClass}>
                            {facility.risk_level.toUpperCase()}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-900">
                About AWARE Water Scarcity
              </p>
              <p className="text-xs text-muted-foreground">
                AWARE (Available WAter REmaining) is a spatially-explicit characterisation factor that measures water scarcity at country/regional level. Higher factors indicate greater water stress. This method is required for CSRD E3 reporting.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline" className="text-xs">UNEP SETAC</Badge>
                <Badge variant="outline" className="text-xs">ISO 14046</Badge>
                <Badge variant="outline" className="text-xs">CSRD E3 Compliant</Badge>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
