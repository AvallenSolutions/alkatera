"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Edit, Save, X } from "lucide-react";
import { GoogleAddressInput } from "@/components/ui/google-address-input";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Supplier } from "@/hooks/data/useSuppliers";

interface SupplierLocationTabProps {
  supplier: Supplier;
  onUpdate: () => void;
}

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  country_code: string;
}

export function SupplierLocationTab({ supplier, onUpdate }: SupplierLocationTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);

  useEffect(() => {
    if (supplier.country) {
      setLocationData({
        address: supplier.country,
        lat: 0,
        lng: 0,
        country_code: supplier.country,
      });
    }
  }, [supplier]);

  const handleLocationSelect = (result: {
    formatted_address: string;
    lat: number;
    lng: number;
    country_code: string;
    city?: string;
    locality_level: 'city' | 'region' | 'country';
  }) => {
    if (!result) return;

    setLocationData({
      address: result.formatted_address,
      lat: result.lat,
      lng: result.lng,
      country_code: result.country_code,
    });
  };

  const handleSave = async () => {
    if (!locationData) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("suppliers")
        .update({
          country: locationData.country_code || locationData.address,
        })
        .eq("id", supplier.id);

      if (error) throw error;

      toast.success("Location updated successfully");
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error updating location:", error);
      toast.error(error.message || "Failed to update location");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Supplier Location</CardTitle>
            <CardDescription>
              Geographic location and facility information
            </CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Location
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Search Location</Label>
                <GoogleAddressInput
                  onAddressSelect={handleLocationSelect}
                  placeholder="Search for supplier location..."
                />
                <p className="text-xs text-muted-foreground">
                  Search for the supplier's primary facility or headquarters
                </p>
              </div>

              {locationData && (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">{locationData.address}</p>
                      {locationData.lat !== 0 && locationData.lng !== 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Coordinates: {locationData.lat.toFixed(6)}, {locationData.lng.toFixed(6)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={loading || !locationData}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Saving..." : "Save Location"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {supplier.country ? (
                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Location</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {supplier.country}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No location information available
                  </p>
                  <Button onClick={() => setIsEditing(true)}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location Benefits</CardTitle>
          <CardDescription>
            Why add location data?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <span className="text-xs text-primary font-medium">1</span>
              </div>
              <div>
                <p className="font-medium">Transport Emissions Calculation</p>
                <p className="text-muted-foreground">
                  Automatically calculate transport emissions based on distance to your facilities
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <span className="text-xs text-primary font-medium">2</span>
              </div>
              <div>
                <p className="font-medium">Regional Emission Factors</p>
                <p className="text-muted-foreground">
                  Apply location-specific emission factors for more accurate LCA calculations
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <span className="text-xs text-primary font-medium">3</span>
              </div>
              <div>
                <p className="font-medium">Supply Chain Visualisation</p>
                <p className="text-muted-foreground">
                  Map your supply chain network and identify optimisation opportunities
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
