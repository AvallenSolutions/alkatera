"use client";

import { useCallback, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from "@react-google-maps/api";
import { Package, Droplets, Factory, Mail, CheckCircle2 } from "lucide-react";
import type { ProductIngredient, ProductPackaging } from "@/hooks/data/useProductData";
import type { FacilityLocation } from "@/hooks/data/useFacilityLocation";
import { InviteSupplierModal } from "./InviteSupplierModal";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";

interface SupplyChainMapProps {
  facility: FacilityLocation | null;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  productId: number;
  productName: string;
}

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

/**
 * Outer wrapper: fetches the API key at runtime, then renders the actual map.
 * useJsApiLoader can't react to key changes, so we must only mount the inner
 * component once the key is available.
 */
export function SupplyChainMap(props: SupplyChainMapProps) {
  const { apiKey, loading } = useGoogleMapsKey();

  if (loading || !apiKey) {
    return (
      <div className="w-full h-[450px] bg-muted/20 rounded-lg flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return <SupplyChainMapInner {...props} apiKey={apiKey} />;
}

function SupplyChainMapInner({ facility, ingredients, packaging, productId, productName, apiKey }: SupplyChainMapProps & { apiKey: string }) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<{
    id: string;
    name: string;
    type: "ingredient" | "packaging";
  } | null>(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const ingredientsWithLocation = useMemo(
    () => ingredients.filter(ing => ing.origin_lat && ing.origin_lng),
    [ingredients]
  );

  const packagingWithLocation = useMemo(
    () => packaging.filter(pkg => pkg.origin_lat && pkg.origin_lng),
    [packaging]
  );

  const handleInviteSupplier = (materialId: string, materialName: string, materialType: "ingredient" | "packaging") => {
    setSelectedMaterial({ id: materialId, name: materialName, type: materialType });
    setInviteModalOpen(true);
  };

  const totalIngredientDistance = useMemo(() => {
    return ingredientsWithLocation.reduce((sum, ing) => {
      return sum + (ing.distance_km ? Number(ing.distance_km) : 0);
    }, 0);
  }, [ingredientsWithLocation]);

  const totalPackagingDistance = useMemo(() => {
    return packagingWithLocation.reduce((sum, pkg) => {
      return sum + (pkg.distance_km ? Number(pkg.distance_km) : 0);
    }, 0);
  }, [packagingWithLocation]);

  const totalSupplyChainDistance = totalIngredientDistance + totalPackagingDistance;
  const totalLocations = 1 + ingredientsWithLocation.length + packagingWithLocation.length;

  const formatDistance = (km: number) => {
    return km.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  };

  const center = useMemo(() => {
    if (facility?.address_lat && facility?.address_lng) {
      return { lat: facility.address_lat, lng: facility.address_lng };
    }
    return { lat: 51.5074, lng: -0.1278 };
  }, [facility]);

  const mapOptions = useMemo((): google.maps.MapOptions => ({
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  }), []);

  /** Fit map bounds to all markers once loaded */
  const onMapLoad = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (facility?.address_lat && facility?.address_lng) {
      bounds.extend({ lat: facility.address_lat, lng: facility.address_lng });
      hasPoints = true;
    }

    ingredientsWithLocation.forEach(ing => {
      if (ing.origin_lat && ing.origin_lng) {
        bounds.extend({ lat: ing.origin_lat, lng: ing.origin_lng });
        hasPoints = true;
      }
    });

    packagingWithLocation.forEach(pkg => {
      if (pkg.origin_lat && pkg.origin_lng) {
        bounds.extend({ lat: pkg.origin_lat, lng: pkg.origin_lng });
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, 50);
      // Cap zoom so we don't zoom in too far for single-point or close-together markers
      const listener = google.maps.event.addListener(map, 'idle', () => {
        if ((map.getZoom() || 0) > 12) map.setZoom(12);
        google.maps.event.removeListener(listener);
      });
    }
  }, [facility, ingredientsWithLocation, packagingWithLocation]);

  if (!facility?.address_lat || !facility?.address_lng) {
    return (
      <div className="w-full h-[450px] backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
        <div className="text-center space-y-3 px-6">
          <Factory className="h-12 w-12 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">
            No facility location data available. Add a facility with location coordinates to view the supply chain map.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[450px] bg-muted/20 rounded-lg flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[450px] relative rounded-lg overflow-hidden border border-white/10">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={6}
        options={mapOptions}
        onLoad={onMapLoad}
        onClick={() => setActiveInfoWindow(null)}
      >
        {/* Facility marker */}
        <Marker
          position={{ lat: facility.address_lat, lng: facility.address_lng }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#84cc16",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
            scale: 10,
          }}
          onClick={() => setActiveInfoWindow("facility")}
        />
        {activeInfoWindow === "facility" && (
          <InfoWindow
            position={{ lat: facility.address_lat, lng: facility.address_lng }}
            onCloseClick={() => setActiveInfoWindow(null)}
          >
            <div className="p-1 min-w-[180px]">
              <div className="flex items-center gap-2 mb-1">
                <Factory className="h-4 w-4 text-lime-600" />
                <h3 className="font-semibold text-sm text-slate-800">Production Facility</h3>
              </div>
              <p className="text-xs font-medium text-slate-700">{facility.name}</p>
              {facility.address_line1 && (
                <p className="text-xs text-slate-500 mt-1">
                  {facility.address_line1}
                  {facility.address_city && `, ${facility.address_city}`}
                </p>
              )}
            </div>
          </InfoWindow>
        )}

        {/* Ingredient markers + lines */}
        {ingredientsWithLocation.map((ingredient) => {
          if (!ingredient.origin_lat || !ingredient.origin_lng) return null;
          const isVerified = !!(ingredient.data_source === 'supplier' && ingredient.supplier_product_id);
          const markerId = `ingredient-${ingredient.id}`;

          return (
            <div key={markerId}>
              <Polyline
                path={[
                  { lat: ingredient.origin_lat, lng: ingredient.origin_lng },
                  { lat: facility.address_lat, lng: facility.address_lng },
                ]}
                options={{
                  strokeColor: isVerified ? "#10b981" : "#22d3ee",
                  strokeWeight: 2,
                  strokeOpacity: 0.5,
                  geodesic: true,
                  icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "15px" }],
                }}
              />
              <Marker
                position={{ lat: ingredient.origin_lat, lng: ingredient.origin_lng }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: isVerified ? "#10b981" : "#22d3ee",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                  scale: 8,
                }}
                onClick={() => setActiveInfoWindow(markerId)}
              />
              {activeInfoWindow === markerId && (
                <InfoWindow
                  position={{ lat: ingredient.origin_lat, lng: ingredient.origin_lng }}
                  onCloseClick={() => setActiveInfoWindow(null)}
                >
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets className={`h-4 w-4 ${isVerified ? 'text-emerald-600' : 'text-cyan-500'}`} />
                      <h3 className="font-semibold text-sm text-slate-800">Ingredient</h3>
                      {isVerified && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
                    </div>
                    <p className="text-xs font-medium text-slate-700">{ingredient.material_name}</p>
                    {isVerified && ingredient.supplier_name && (
                      <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified: {ingredient.supplier_name}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {ingredient.quantity} {ingredient.unit}
                    </p>
                    {ingredient.distance_km && (
                      <p className="text-xs text-slate-500 mt-1">
                        Distance: {formatDistance(Number(ingredient.distance_km))} km
                      </p>
                    )}
                    {ingredient.origin_address && (
                      <p className="text-xs text-slate-500 mt-1">{ingredient.origin_address}</p>
                    )}
                    {!isVerified && (
                      <div className="mt-2 pt-2 border-t">
                        <button
                          onClick={() => handleInviteSupplier(ingredient.id, ingredient.material_name, 'ingredient')}
                          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                        >
                          <Mail className="h-3 w-3" />
                          Invite Supplier
                        </button>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </div>
          );
        })}

        {/* Packaging markers + lines */}
        {packagingWithLocation.map((pkg) => {
          if (!pkg.origin_lat || !pkg.origin_lng) return null;
          const isVerified = !!(pkg.data_source === 'supplier' && pkg.supplier_product_id);
          const markerId = `packaging-${pkg.id}`;

          return (
            <div key={markerId}>
              <Polyline
                path={[
                  { lat: pkg.origin_lat, lng: pkg.origin_lng },
                  { lat: facility.address_lat, lng: facility.address_lng },
                ]}
                options={{
                  strokeColor: isVerified ? "#10b981" : "#fb923c",
                  strokeWeight: 2,
                  strokeOpacity: 0.5,
                  geodesic: true,
                  icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "15px" }],
                }}
              />
              <Marker
                position={{ lat: pkg.origin_lat, lng: pkg.origin_lng }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: isVerified ? "#10b981" : "#fb923c",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                  scale: 8,
                }}
                onClick={() => setActiveInfoWindow(markerId)}
              />
              {activeInfoWindow === markerId && (
                <InfoWindow
                  position={{ lat: pkg.origin_lat, lng: pkg.origin_lng }}
                  onCloseClick={() => setActiveInfoWindow(null)}
                >
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className={`h-4 w-4 ${isVerified ? 'text-emerald-600' : 'text-orange-500'}`} />
                      <h3 className="font-semibold text-sm text-slate-800">Packaging</h3>
                      {isVerified && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
                    </div>
                    <p className="text-xs font-medium text-slate-700">{pkg.material_name}</p>
                    {isVerified && pkg.supplier_name && (
                      <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified: {pkg.supplier_name}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {pkg.quantity} {pkg.unit}
                    </p>
                    {pkg.distance_km && (
                      <p className="text-xs text-slate-500 mt-1">
                        Distance: {formatDistance(Number(pkg.distance_km))} km
                      </p>
                    )}
                    {pkg.origin_address && (
                      <p className="text-xs text-slate-500 mt-1">{pkg.origin_address}</p>
                    )}
                    {!isVerified && (
                      <div className="mt-2 pt-2 border-t">
                        <button
                          onClick={() => handleInviteSupplier(pkg.id, pkg.material_name, 'packaging')}
                          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                        >
                          <Mail className="h-3 w-3" />
                          Invite Supplier
                        </button>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </div>
          );
        })}
      </GoogleMap>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg px-4 py-3 z-[1000] space-y-2 min-w-[200px]">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-white/70">Locations</p>
          <p className="text-xs text-white font-semibold">{totalLocations}</p>
        </div>
        <div className="border-t border-white/20 pt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-cyan-300/90 flex items-center gap-1.5">
              <Droplets className="h-3 w-3" />
              Ingredients
            </p>
            <p className="text-xs text-white font-medium">{formatDistance(totalIngredientDistance)} km</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-orange-300/90 flex items-center gap-1.5">
              <Package className="h-3 w-3" />
              Packaging
            </p>
            <p className="text-xs text-white font-medium">{formatDistance(totalPackagingDistance)} km</p>
          </div>
        </div>
        <div className="border-t border-white/20 pt-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-white font-semibold">Total Distance</p>
            <p className="text-sm text-white font-bold">{formatDistance(totalSupplyChainDistance)} km</p>
          </div>
        </div>
      </div>

      {selectedMaterial && (
        <InviteSupplierModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          productId={productId}
          productName={productName}
          materialId={selectedMaterial.id}
          materialName={selectedMaterial.name}
          materialType={selectedMaterial.type}
        />
      )}
    </div>
  );
}
