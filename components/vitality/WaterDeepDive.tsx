import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Droplets, AlertTriangle, ChevronRight, ArrowLeft, TrendingDown } from 'lucide-react';
import { FacilityWaterRisk } from '@/hooks/data/useCompanyMetrics';

interface WaterDeepDiveProps {
  facilityWaterRisks: FacilityWaterRisk[];
}

export function WaterDeepDive({ facilityWaterRisks }: WaterDeepDiveProps) {
  const [selectedFacility, setSelectedFacility] = useState<FacilityWaterRisk | null>(null);

  const highRiskFacilities = facilityWaterRisks.filter(f => f.risk_level === 'high');
  const mediumRiskFacilities = facilityWaterRisks.filter(f => f.risk_level === 'medium');
  const lowRiskFacilities = facilityWaterRisks.filter(f => f.risk_level === 'low');

  // If a facility is selected, show detailed view
  if (selectedFacility) {
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

    const config = riskConfig[selectedFacility.risk_level];

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFacility(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Overview
              </Button>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {selectedFacility.facility_name}
                </CardTitle>
                <CardDescription>Detailed water scarcity risk assessment</CardDescription>
              </div>
              <Badge variant="default" className={config.badgeClass}>
                {selectedFacility.risk_level.toUpperCase()} RISK
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Card className={`${config.bgColor} border-2 ${config.borderColor}`}>
              <CardContent className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Location</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedFacility.location_country_code}</span>
                      </div>
                      {selectedFacility.latitude && selectedFacility.longitude && (
                        <p className="text-xs text-muted-foreground">
                          Coordinates: {selectedFacility.latitude.toFixed(4)}°N, {selectedFacility.longitude.toFixed(4)}°E
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">AWARE Water Scarcity</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">
                        {selectedFacility.water_scarcity_aware.toFixed(1)}
                      </span>
                      <span className="text-sm text-muted-foreground">m³ world eq/m³</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Characterisation factor for water consumption
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Risk Interpretation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">What this means:</p>
                    <p className="text-sm">
                      {selectedFacility.risk_level === 'high' &&
                        'This location experiences severe water stress. Water consumption here has significant impact on local water availability.'}
                      {selectedFacility.risk_level === 'medium' &&
                        'This location has moderate water stress. Monitor water consumption and consider efficiency improvements.'}
                      {selectedFacility.risk_level === 'low' &&
                        'This location has abundant water resources. Water consumption has minimal impact on local scarcity.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Recommended Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-2">
                    {selectedFacility.risk_level === 'high' && (
                      <>
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs">Prioritise water efficiency measures</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs">Explore alternative water sources (recycling, rainwater)</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs">Consider site relocation for future expansion</p>
                        </div>
                      </>
                    )}
                    {selectedFacility.risk_level === 'medium' && (
                      <>
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs">Implement water monitoring systems</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs">Set water reduction targets</p>
                        </div>
                      </>
                    )}
                    {selectedFacility.risk_level === 'low' && (
                      <>
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs">Maintain efficient operations</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs">Monitor for future climate changes</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-semibold text-blue-900">About AWARE Characterisation</p>
                <p className="text-xs text-muted-foreground">
                  The AWARE method quantifies relative available water remaining per area in a watershed, after human and aquatic ecosystem demands have been met. A higher factor indicates greater water scarcity.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">Low: &lt;20</Badge>
                  <Badge variant="outline" className="text-xs">Medium: 20-40</Badge>
                  <Badge variant="outline" className="text-xs">High: &gt;40</Badge>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                <p className="text-xs text-slate-900">
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
                <p className="text-xs text-slate-900">
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
                <p className="text-xs text-slate-900">
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
                    <Card
                      key={facility.facility_id}
                      className={`${config.bgColor} ${config.borderColor} border-2 cursor-pointer hover:shadow-lg transition-shadow`}
                      onClick={() => setSelectedFacility(facility)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <MapPin className={`h-4 w-4 ${config.textColor}`} />
                              <span className="font-semibold text-slate-900">{facility.facility_name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-900">
                              <span>Location: {facility.location_country_code}</span>
                              <span>AWARE Factor: {facility.water_scarcity_aware.toFixed(1)} m³ world eq/m³</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className={config.badgeClass}>
                              {facility.risk_level.toUpperCase()}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
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
                <Badge variant="outline" className="text-xs text-slate-900">UNEP SETAC</Badge>
                <Badge variant="outline" className="text-xs text-slate-900">ISO 14046</Badge>
                <Badge variant="outline" className="text-xs text-slate-900">CSRD E3 Compliant</Badge>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
