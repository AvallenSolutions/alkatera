'use client';

/**
 * Map tab for a vineyard / orchard / arable field.
 *
 * Shows the land unit on a satellite basemap with a single marker colour-coded
 * by the ESA WorldCover land-cover check (green = on farmland, amber = the pin
 * looks wrong, grey = no data), plus the SoilGrids soil-carbon baseline. Reuses
 * the runtime-key + useJsApiLoader pattern from FacilityWaterRiskMap.
 */

import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Leaf, Layers, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';

export type LandUnitType = 'vineyard' | 'orchard' | 'arable_field';

interface GeoData {
  name: string;
  hectares: number | null;
  lat: number | null;
  lng: number | null;
  hasCoords: boolean;
  soilCarbon: {
    value: number;
    unit: string;
    depthCm: number;
    verificationStatus: string;
    sampleDate: string;
    source: string | null;
  } | null;
  landCover: { code: number | null; label: string | null } | null;
  validation: { status: 'match' | 'mismatch' | 'unknown'; detectedLabel: string | null; message: string };
}

const VALIDATION = {
  match: { color: '#22c55e', label: 'On farmland', Icon: CheckCircle2, badge: 'bg-green-100 text-green-700 border-green-200' },
  mismatch: { color: '#f59e0b', label: 'Check location', Icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  unknown: { color: '#94a3b8', label: 'No land-cover data', Icon: HelpCircle, badge: 'bg-slate-100 text-slate-600 border-slate-200' },
} as const;

const TYPE_LABEL: Record<LandUnitType, string> = {
  vineyard: 'vineyard',
  orchard: 'orchard',
  arable_field: 'field',
};

export function LandUnitMap({ type, id }: { type: LandUnitType; id: string }) {
  const { apiKey, loading: keyLoading } = useGoogleMapsKey();
  const [data, setData] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/geo/land-unit?type=${type}&id=${id}`)
      .then((r) => (r.ok ? r.json() : r.json().then((b) => Promise.reject(new Error(b?.error || 'Failed to load map data')))))
      .then((d: GeoData) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  if (loading || keyLoading) {
    return <Skeleton className="w-full rounded-lg" style={{ height: 420 }} />;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!data?.hasCoords) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted/30 text-sm text-muted-foreground"
        style={{ height: 320 }}
      >
        <MapPin className="h-10 w-10 opacity-40" />
        <div className="text-center">
          <p className="font-medium">No location set for this {TYPE_LABEL[type]}</p>
          <p className="mt-1 text-xs">
            Add a location and we&apos;ll plot it here and auto-fill a soil-carbon baseline.
          </p>
        </div>
      </div>
    );
  }
  if (!apiKey) {
    return <p className="text-sm text-muted-foreground">Map unavailable: Google Maps key not configured.</p>;
  }

  return <LandUnitMapInner data={data} apiKey={apiKey} type={type} />;
}

function LandUnitMapInner({ data, apiKey, type }: { data: GeoData; apiKey: string; type: LandUnitType }) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey });
  const [infoOpen, setInfoOpen] = useState(true);

  const center = useMemo(() => ({ lat: data.lat!, lng: data.lng! }), [data.lat, data.lng]);
  const v = VALIDATION[data.validation.status];
  const isEstimate = data.soilCarbon?.verificationStatus === 'unverified';

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border" style={{ height: 420 }}>
        {!isLoaded ? (
          <div className="flex h-full items-center justify-center bg-muted/20">
            <p className="text-sm text-muted-foreground">Loading map…</p>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={15}
            options={{
              mapTypeId: 'hybrid',
              disableDefaultUI: true,
              zoomControl: true,
              fullscreenControl: true,
            }}
          >
            <Marker
              position={center}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: v.color,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                scale: 11,
              }}
              onClick={() => setInfoOpen(true)}
            />
            {infoOpen && (
              <InfoWindow position={center} onCloseClick={() => setInfoOpen(false)}>
                <div className="min-w-[200px] p-1 text-slate-800">
                  <h3 className="mb-1 text-sm font-semibold">{data.name}</h3>
                  <p className="mb-2 text-xs capitalize text-slate-500">
                    {TYPE_LABEL[type]}
                    {data.hectares != null ? ` · ${data.hectares} ha` : ''}
                  </p>
                  {data.soilCarbon && (
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="text-slate-500">Soil carbon (0-30cm):</span>
                      <span className="font-medium">{data.soilCarbon.value.toFixed(1)} t C/ha</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-500">Land cover:</span>
                    <span className="font-medium">{data.landCover?.label ?? 'No data'}</span>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />
          <v.Icon className="h-3.5 w-3.5" />
          {v.label}
        </span>
        <span className="opacity-60">· marker colour reflects the ESA WorldCover land-cover check</span>
      </div>

      {/* Data cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Leaf className="h-4 w-4 text-primary" />
              Soil carbon
            </div>
            {data.soilCarbon ? (
              <>
                <div className="text-2xl font-semibold">
                  {data.soilCarbon.value.toFixed(1)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">t C/ha (0-30cm)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={isEstimate ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200'}
                  >
                    {isEstimate ? 'Satellite estimate' : 'Verified'}
                  </Badge>
                  {data.soilCarbon.source && (
                    <span className="text-xs text-muted-foreground">{data.soilCarbon.source}</span>
                  )}
                </div>
                {isEstimate && (
                  <p className="text-xs text-muted-foreground">
                    Modelled baseline, not a field measurement. Take a soil sample to verify and claim removals.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No soil-carbon data yet. A baseline is fetched automatically once a location is set.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4 text-primary" />
              Land cover
            </div>
            <div className="text-2xl font-semibold">{data.landCover?.label ?? 'No data'}</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={v.badge}>
                <v.Icon className="mr-1 h-3.5 w-3.5" />
                {v.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{data.validation.message}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
