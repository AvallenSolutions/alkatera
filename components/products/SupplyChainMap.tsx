"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Package, Droplets, Factory } from "lucide-react";
import type { ProductIngredient, ProductPackaging } from "@/hooks/data/useProductData";
import type { FacilityLocation } from "@/hooks/data/useFacilityLocation";

import "leaflet/dist/leaflet.css";

interface SupplyChainMapProps {
  facility: FacilityLocation | null;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
}

function MapBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [bounds, map]);

  return null;
}

function createCustomIcon(color: string, IconComponent: any): L.DivIcon {
  const iconHtml = `
    <div style="
      background-color: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    ">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        ${IconComponent === "factory" ? '<rect x="2" y="10" width="20" height="12" /><path d="M2 10V3l6 3v4" /><path d="M14 10V3l6 3v4" />' :
          IconComponent === "droplets" ? '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" /><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />' :
          '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" />'}
      </svg>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export function SupplyChainMap({ facility, ingredients, packaging }: SupplyChainMapProps) {
  const facilityIcon = useMemo(() => createCustomIcon("#84cc16", "factory"), []);
  const ingredientIcon = useMemo(() => createCustomIcon("#22d3ee", "droplets"), []);
  const packagingIcon = useMemo(() => createCustomIcon("#fb923c", "package"), []);

  const ingredientsWithLocation = useMemo(
    () => ingredients.filter(ing => ing.origin_lat && ing.origin_lng),
    [ingredients]
  );

  const packagingWithLocation = useMemo(
    () => packaging.filter(pkg => pkg.origin_lat && pkg.origin_lng),
    [packaging]
  );

  const bounds = useMemo(() => {
    const positions: [number, number][] = [];

    if (facility?.address_lat && facility?.address_lng) {
      positions.push([facility.address_lat, facility.address_lng]);
    }

    ingredientsWithLocation.forEach(ing => {
      if (ing.origin_lat && ing.origin_lng) {
        positions.push([ing.origin_lat, ing.origin_lng]);
      }
    });

    packagingWithLocation.forEach(pkg => {
      if (pkg.origin_lat && pkg.origin_lng) {
        positions.push([pkg.origin_lat, pkg.origin_lng]);
      }
    });

    if (positions.length === 0) return null;

    return L.latLngBounds(positions);
  }, [facility, ingredientsWithLocation, packagingWithLocation]);

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

  const defaultCenter: [number, number] = facility?.address_lat && facility?.address_lng
    ? [facility.address_lat, facility.address_lng]
    : [51.5074, -0.1278];

  const defaultZoom = 6;

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

  return (
    <div className="w-full h-[450px] relative rounded-lg overflow-hidden border border-white/10">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full"
        style={{ background: "#0a0a0b" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles opacity-80"
        />

        <MapBounds bounds={bounds} />

        {facility && (
          <Marker
            position={[facility.address_lat, facility.address_lng]}
            icon={facilityIcon}
          >
            <Popup className="custom-popup">
              <div className="p-2">
                <div className="flex items-center gap-2 mb-2">
                  <Factory className="h-4 w-4 text-lime-500" />
                  <h3 className="font-semibold text-sm">Production Facility</h3>
                </div>
                <p className="text-xs font-medium">{facility.name}</p>
                {facility.address_line1 && (
                  <p className="text-xs text-slate-600 mt-1">
                    {facility.address_line1}
                    {facility.address_city && `, ${facility.address_city}`}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {ingredientsWithLocation.map((ingredient) => {
          if (!ingredient.origin_lat || !ingredient.origin_lng || !facility?.address_lat || !facility?.address_lng) return null;

          const positions: [number, number][] = [
            [ingredient.origin_lat, ingredient.origin_lng],
            [facility.address_lat, facility.address_lng],
          ];

          return (
            <div key={`ingredient-${ingredient.id}`}>
              <Polyline
                positions={positions}
                color="#22d3ee"
                weight={2}
                opacity={0.5}
                dashArray="5, 5"
              />
              <Marker
                position={[ingredient.origin_lat, ingredient.origin_lng]}
                icon={ingredientIcon}
              >
                <Popup className="custom-popup">
                  <div className="p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets className="h-4 w-4 text-cyan-400" />
                      <h3 className="font-semibold text-sm">Ingredient</h3>
                    </div>
                    <p className="text-xs font-medium">{ingredient.material_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {ingredient.quantity} {ingredient.unit}
                    </p>
                    {ingredient.distance_km && (
                      <p className="text-xs text-slate-600 mt-1">
                        Distance: {formatDistance(Number(ingredient.distance_km))} km
                      </p>
                    )}
                    {ingredient.origin_address && (
                      <p className="text-xs text-slate-600 mt-1">
                        {ingredient.origin_address}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}

        {packagingWithLocation.map((pkg) => {
          if (!pkg.origin_lat || !pkg.origin_lng || !facility?.address_lat || !facility?.address_lng) return null;

          const positions: [number, number][] = [
            [pkg.origin_lat, pkg.origin_lng],
            [facility.address_lat, facility.address_lng],
          ];

          return (
            <div key={`packaging-${pkg.id}`}>
              <Polyline
                positions={positions}
                color="#fb923c"
                weight={2}
                opacity={0.5}
                dashArray="5, 5"
              />
              <Marker
                position={[pkg.origin_lat, pkg.origin_lng]}
                icon={packagingIcon}
              >
                <Popup className="custom-popup">
                  <div className="p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-orange-400" />
                      <h3 className="font-semibold text-sm">Packaging</h3>
                    </div>
                    <p className="text-xs font-medium">{pkg.material_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {pkg.quantity} {pkg.unit}
                    </p>
                    {pkg.distance_km && (
                      <p className="text-xs text-slate-600 mt-1">
                        Distance: {formatDistance(Number(pkg.distance_km))} km
                      </p>
                    )}
                    {pkg.origin_address && (
                      <p className="text-xs text-slate-600 mt-1">
                        {pkg.origin_address}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>

      <div className="absolute top-4 right-4 backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg px-4 py-3 z-[1000] space-y-2 min-w-[200px]">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-white/70">Locations</p>
          <p className="text-xs text-white font-semibold">
            {totalLocations}
          </p>
        </div>
        <div className="border-t border-white/20 pt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-cyan-300/90 flex items-center gap-1.5">
              <Droplets className="h-3 w-3" />
              Ingredients
            </p>
            <p className="text-xs text-white font-medium">
              {formatDistance(totalIngredientDistance)} km
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-orange-300/90 flex items-center gap-1.5">
              <Package className="h-3 w-3" />
              Packaging
            </p>
            <p className="text-xs text-white font-medium">
              {formatDistance(totalPackagingDistance)} km
            </p>
          </div>
        </div>
        <div className="border-t border-white/20 pt-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-white font-semibold">Total Distance</p>
            <p className="text-sm text-white font-bold">
              {formatDistance(totalSupplyChainDistance)} km
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
