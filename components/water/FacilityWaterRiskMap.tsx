'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, AlertTriangle, MapPin, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { FacilityWaterSummary } from '@/hooks/data/useFacilityWaterData';

import 'leaflet/dist/leaflet.css';

interface FacilityWaterRiskMapProps {
  facilities: FacilityWaterSummary[];
  loading?: boolean;
  height?: number;
  onFacilityClick?: (facility: FacilityWaterSummary) => void;
  selectedFacilityId?: string;
  className?: string;
}

function MapBounds({ facilities }: { facilities: FacilityWaterSummary[] }) {
  const map = useMap();

  useEffect(() => {
    const validFacilities = facilities.filter(f => f.latitude && f.longitude);
    if (validFacilities.length === 0) return;

    if (validFacilities.length === 1) {
      map.setView([validFacilities[0].latitude!, validFacilities[0].longitude!], 10);
    } else {
      const bounds = L.latLngBounds(
        validFacilities.map(f => [f.latitude!, f.longitude!])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [facilities, map]);

  return null;
}

function createRiskIcon(riskLevel: 'high' | 'medium' | 'low', isSelected: boolean = false): L.DivIcon {
  const colors = {
    high: { bg: '#ef4444', border: '#dc2626' },
    medium: { bg: '#f59e0b', border: '#d97706' },
    low: { bg: '#22c55e', border: '#16a34a' },
  };

  const { bg, border } = colors[riskLevel];
  const size = isSelected ? 40 : 32;
  const borderWidth = isSelected ? 4 : 3;

  const iconHtml = `
    <div style="position: relative;">
      <div style="
        background-color: ${bg};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: ${borderWidth}px solid ${isSelected ? 'white' : 'rgba(255, 255, 255, 0.9)'};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)${isSelected ? ', 0 0 0 3px ' + border : ''};
        transition: all 0.2s ease;
      ">
        <svg
          width="${size * 0.5}"
          height="${size * 0.5}"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
          <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function getRiskBadgeVariant(riskLevel: 'high' | 'medium' | 'low') {
  switch (riskLevel) {
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-green-100 text-green-700 border-green-200';
  }
}

export function FacilityWaterRiskMap({
  facilities,
  loading = false,
  height = 400,
  onFacilityClick,
  selectedFacilityId,
  className,
}: FacilityWaterRiskMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const validFacilities = useMemo(() => {
    return facilities.filter(f => f.latitude && f.longitude);
  }, [facilities]);

  const riskCounts = useMemo(() => {
    return {
      high: facilities.filter(f => f.risk_level === 'high').length,
      medium: facilities.filter(f => f.risk_level === 'medium').length,
      low: facilities.filter(f => f.risk_level === 'low').length,
    };
  }, [facilities]);

  const defaultCenter: [number, number] = [51.5074, -0.1278];

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Facility Water Risk Map</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full rounded-lg" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  if (validFacilities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Facility Water Risk Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center text-muted-foreground text-sm gap-3 bg-muted/30 rounded-lg"
            style={{ height }}
          >
            <MapPin className="h-10 w-10 opacity-40" />
            <div className="text-center">
              <p className="font-medium">No facility locations available</p>
              <p className="text-xs mt-1">Add location data to facilities to view on map</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const mapHeight = isExpanded ? 600 : height;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Facility Water Risk Map</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 text-xs">
              {riskCounts.high > 0 && (
                <Badge variant="outline" className={getRiskBadgeVariant('high')}>
                  {riskCounts.high} High
                </Badge>
              )}
              {riskCounts.medium > 0 && (
                <Badge variant="outline" className={getRiskBadgeVariant('medium')}>
                  {riskCounts.medium} Medium
                </Badge>
              )}
              {riskCounts.low > 0 && (
                <Badge variant="outline" className={getRiskBadgeVariant('low')}>
                  {riskCounts.low} Low
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg overflow-hidden border" style={{ height: mapHeight }}>
          <MapContainer
            center={defaultCenter}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds facilities={validFacilities} />

            {validFacilities.map((facility) => (
              <Marker
                key={facility.facility_id}
                position={[facility.latitude!, facility.longitude!]}
                icon={createRiskIcon(facility.risk_level, facility.facility_id === selectedFacilityId)}
                eventHandlers={{
                  click: () => onFacilityClick?.(facility),
                }}
              >
                <Popup>
                  <div className="min-w-[200px] p-1">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm">{facility.facility_name}</h3>
                      <Badge variant="outline" className={`text-xs ${getRiskBadgeVariant(facility.risk_level)}`}>
                        {facility.risk_level.charAt(0).toUpperCase() + facility.risk_level.slice(1)}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground mb-3">
                      {facility.city && `${facility.city}, `}{facility.country}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Water Consumption:</span>
                        <span className="font-medium">
                          {facility.total_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">AWARE Factor:</span>
                        <span className="font-medium">{facility.aware_factor.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Scarcity Impact:</span>
                        <span className="font-medium">
                          {facility.scarcity_weighted_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³ eq
                        </span>
                      </div>
                      {facility.recycling_rate_percent > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recycling Rate:</span>
                          <span className="font-medium text-green-600">
                            {facility.recycling_rate_percent.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {onFacilityClick && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3 h-7 text-xs"
                        onClick={() => onFacilityClick(facility)}
                      >
                        View Details
                      </Button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span>Risk based on AWARE water scarcity factors</span>
          </div>
          <span>{validFacilities.length} of {facilities.length} facilities mapped</span>
        </div>
      </CardContent>
    </Card>
  );
}
