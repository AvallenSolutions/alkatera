"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Package, Droplets, Factory, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductIngredient, ProductPackaging } from "@/hooks/data/useProductData";
import type { FacilityLocation } from "@/hooks/data/useFacilityLocation";
import { InviteSupplierModal } from "./InviteSupplierModal";

import "leaflet/dist/leaflet.css";

interface SupplyChainMapProps {
  facility: FacilityLocation | null;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  productId: number;
  productName: string;
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

function createCustomIcon(color: string, IconComponent: any, isVerified: boolean = false): L.DivIcon {
  const verifiedBadge = isVerified ? `
    <div style="
      position: absolute;
      top: -2px;
      right: -2px;
      background-color: #22c55e;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    ">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  ` : '';

  const iconHtml = `
    <div style="position: relative;">
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
      ${verifiedBadge}
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

export function SupplyChainMap({ facility, ingredients, packaging, productId, productName }: SupplyChainMapProps) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<{
    id: string;
    name: string;
    type: "ingredient" | "packaging";
  } | null>(null);

  const facilityIcon = useMemo(() => createCustomIcon("#84cc16", "factory"), []);

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

          const isVerified = ingredient.data_source === 'supplier' && ingredient.supplier_product_id;
          const ingredientIconForMarker = useMemo(
            () => createCustomIcon("#22d3ee", "droplets", isVerified),
            [isVerified]
          );

          return (
            <div key={`ingredient-${ingredient.id}`}>
              <Polyline
                positions={positions}
                color={isVerified ? "#10b981" : "#22d3ee"}
                weight={2}
                opacity={0.5}
                dashArray="5, 5"
              />
              <Marker
                position={[ingredient.origin_lat, ingredient.origin_lng]}
                icon={ingredientIconForMarker}
              >
                <Popup className="custom-popup" minWidth={200}>
                  <div className="p-2 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets className={`h-4 w-4 ${isVerified ? 'text-emerald-500' : 'text-cyan-400'}`} />
                      <h3 className="font-semibold text-sm">Ingredient</h3>
                      {isVerified && (
                        <div className="ml-auto">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium">{ingredient.material_name}</p>
                    {isVerified && ingredient.supplier_name && (
                      <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified: {ingredient.supplier_name}
                      </p>
                    )}
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
                    {!isVerified && (
                      <div className="mt-3 pt-2 border-t">
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

          const isVerified = pkg.data_source === 'supplier' && pkg.supplier_product_id;
          const packagingIconForMarker = useMemo(
            () => createCustomIcon("#fb923c", "package", isVerified),
            [isVerified]
          );

          return (
            <div key={`packaging-${pkg.id}`}>
              <Polyline
                positions={positions}
                color={isVerified ? "#10b981" : "#fb923c"}
                weight={2}
                opacity={0.5}
                dashArray="5, 5"
              />
              <Marker
                position={[pkg.origin_lat, pkg.origin_lng]}
                icon={packagingIconForMarker}
              >
                <Popup className="custom-popup" minWidth={200}>
                  <div className="p-2 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className={`h-4 w-4 ${isVerified ? 'text-emerald-500' : 'text-orange-400'}`} />
                      <h3 className="font-semibold text-sm">Packaging</h3>
                      {isVerified && (
                        <div className="ml-auto">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium">{pkg.material_name}</p>
                    {isVerified && pkg.supplier_name && (
                      <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified: {pkg.supplier_name}
                      </p>
                    )}
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
                    {!isVerified && (
                      <div className="mt-3 pt-2 border-t">
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
