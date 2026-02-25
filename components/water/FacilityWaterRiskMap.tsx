'use client';

import { useCallback, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, MapPin, Maximize2 } from 'lucide-react';
import type { FacilityWaterSummary } from '@/hooks/data/useFacilityWaterData';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';

interface FacilityWaterRiskMapProps {
  facilities: FacilityWaterSummary[];
  loading?: boolean;
  height?: number;
  onFacilityClick?: (facility: FacilityWaterSummary) => void;
  selectedFacilityId?: string;
  className?: string;
}

/** Dark-mode map style — neutral greys with subtle brand warmth */
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1210" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5e56" }] },
];

const riskColors = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

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

/**
 * Outer wrapper: fetches the API key at runtime before mounting the map.
 */
export function FacilityWaterRiskMap(props: FacilityWaterRiskMapProps) {
  const { apiKey, loading: keyLoading } = useGoogleMapsKey();

  // Wait for the API key before mounting the inner component, since
  // useJsApiLoader won't re-initialise if the key changes after mount.
  if (keyLoading || !apiKey) {
    return (
      <Card className={props.className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Facility Water Risk Map</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full rounded-lg" style={{ height: props.height || 400 }} />
        </CardContent>
      </Card>
    );
  }

  return <FacilityWaterRiskMapInner {...props} apiKey={apiKey} />;
}

function FacilityWaterRiskMapInner({
  facilities,
  loading = false,
  height = 400,
  onFacilityClick,
  selectedFacilityId,
  className,
  apiKey,
}: FacilityWaterRiskMapProps & { apiKey: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeInfoWindow, setActiveInfoWindow] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

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

  const center = useMemo(() => {
    if (validFacilities.length > 0) {
      return { lat: validFacilities[0].latitude!, lng: validFacilities[0].longitude! };
    }
    return { lat: 51.5074, lng: -0.1278 };
  }, [validFacilities]);

  const mapOptions = useMemo((): google.maps.MapOptions => ({
    styles: DARK_MAP_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    backgroundColor: "#0a0a0b",
  }), []);

  /** Fit map bounds to all facility markers */
  const onMapLoad = useCallback((map: google.maps.Map) => {
    if (validFacilities.length === 0) return;

    if (validFacilities.length === 1) {
      map.setCenter({ lat: validFacilities[0].latitude!, lng: validFacilities[0].longitude! });
      map.setZoom(10);
    } else {
      const bounds = new google.maps.LatLngBounds();
      validFacilities.forEach(f => {
        bounds.extend({ lat: f.latitude!, lng: f.longitude! });
      });
      map.fitBounds(bounds, 50);
      const listener = google.maps.event.addListener(map, 'idle', () => {
        if ((map.getZoom() || 0) > 12) map.setZoom(12);
        google.maps.event.removeListener(listener);
      });
    }
  }, [validFacilities]);

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
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={5}
              options={mapOptions}
              onLoad={onMapLoad}
              onClick={() => setActiveInfoWindow(null)}
            >
              {validFacilities.map((facility) => {
                const isSelected = facility.facility_id === selectedFacilityId;
                const markerId = `facility-${facility.facility_id}`;

                return (
                  <div key={facility.facility_id}>
                    <Marker
                      position={{ lat: facility.latitude!, lng: facility.longitude! }}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: riskColors[facility.risk_level],
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: isSelected ? 4 : 3,
                        scale: isSelected ? 12 : 10,
                      }}
                      onClick={() => {
                        setActiveInfoWindow(markerId);
                        onFacilityClick?.(facility);
                      }}
                    />
                    {activeInfoWindow === markerId && (
                      <InfoWindow
                        position={{ lat: facility.latitude!, lng: facility.longitude! }}
                        onCloseClick={() => setActiveInfoWindow(null)}
                      >
                        <div className="min-w-[200px] p-1">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-sm text-slate-800">{facility.facility_name}</h3>
                            <Badge variant="outline" className={`text-xs ${getRiskBadgeVariant(facility.risk_level)}`}>
                              {facility.risk_level.charAt(0).toUpperCase() + facility.risk_level.slice(1)}
                            </Badge>
                          </div>

                          <div className="text-xs text-slate-500 mb-3">
                            {facility.city && `${facility.city}, `}{facility.country}
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Water Consumption:</span>
                              <span className="font-medium text-slate-700">
                                {facility.total_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">AWARE Factor:</span>
                              <span className="font-medium text-slate-700">{facility.aware_factor.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Scarcity Impact:</span>
                              <span className="font-medium text-slate-700">
                                {facility.scarcity_weighted_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³ eq
                              </span>
                            </div>
                            {facility.recycling_rate_percent > 0 && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Recycling Rate:</span>
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
                      </InfoWindow>
                    )}
                  </div>
                );
              })}
            </GoogleMap>
          )}
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
