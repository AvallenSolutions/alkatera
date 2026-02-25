"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X, AlertCircle } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  country?: string;
  countryCode?: string;
}

interface LocationPickerProps {
  value?: string;
  onLocationSelect: (location: LocationData) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

/**
 * Location picker powered by Google Places API.
 *
 * Replaces the previous Nominatim/OpenStreetMap implementation which had
 * rate-limiting and reliability issues. Uses the same `/api/places/*` proxy
 * routes as GoogleAddressInput, but retains the LocationData interface for
 * backwards compatibility with all consumers.
 */
export function LocationPicker({
  value = "",
  onLocationSelect,
  placeholder = "Search for a city or address...",
  disabled = false,
  required = false,
  className = "",
}: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchPredictions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setPredictions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      // Google Places autocomplete — no type restriction for flexibility
      // (returns cities, addresses, establishments, factories, etc.)
      const url = `/api/places/autocomplete?input=${encodeURIComponent(query.trim())}`;

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to search locations");
      }

      const data = await response.json();

      if (data.status === "ZERO_RESULTS") {
        setPredictions([]);
      } else if (data.predictions) {
        setPredictions(data.predictions);
        if (data.predictions.length > 0) {
          setIsOpen(true);
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Location search error:", err);
        setError(err.message || "Failed to search locations. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  const extractCountryCode = (addressComponents: any[]): string | undefined => {
    for (const component of addressComponents) {
      if (component.types.includes("country")) {
        return component.short_name?.toUpperCase();
      }
    }
    return undefined;
  };

  const extractCountryName = (addressComponents: any[]): string | undefined => {
    for (const component of addressComponents) {
      if (component.types.includes("country")) {
        return component.long_name;
      }
    }
    return undefined;
  };

  const extractCity = (addressComponents: any[]): string | undefined => {
    for (const component of addressComponents) {
      if (
        component.types.includes("locality") ||
        component.types.includes("postal_town") ||
        component.types.includes("administrative_area_level_2")
      ) {
        return component.long_name;
      }
    }
    return undefined;
  };

  const getLocalityLevel = (types: string[]): "city" | "region" | "country" => {
    if (
      types.includes("locality") ||
      types.includes("sublocality") ||
      types.includes("postal_town") ||
      types.includes("establishment") ||
      types.includes("premise") ||
      types.includes("street_address") ||
      types.includes("route")
    ) {
      return "city";
    }
    if (
      types.includes("administrative_area_level_1") ||
      types.includes("administrative_area_level_2")
    ) {
      return "region";
    }
    if (types.includes("country")) {
      return "country";
    }
    // Default to city for unknown types (better to accept than reject)
    return "city";
  };

  const handleSelectPlace = async (prediction: PlacePrediction) => {
    try {
      setIsLoading(true);
      setIsOpen(false);

      const response = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(prediction.place_id)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch place details");
      }

      const data = await response.json();
      const place = data.result;

      if (!place || !place.geometry || !place.geometry.location) {
        throw new Error("Invalid place data received");
      }

      const localityLevel = getLocalityLevel(place.types || []);

      // Require at least city-level precision for accurate transport calculations
      if (localityLevel === "country") {
        toast.error("Please select a more specific location (city or address)", {
          description: "We need at least city-level precision for accurate transport calculations.",
        });
        setInputValue("");
        return;
      }

      const lat = place.geometry.location.lat;
      const lng = place.geometry.location.lng;
      const addressComponents = place.address_components || [];
      const formattedAddress = place.formatted_address || place.name || "";

      const locationData: LocationData = {
        lat,
        lng,
        address: formattedAddress,
        city: extractCity(addressComponents),
        country: extractCountryName(addressComponents),
        countryCode: extractCountryCode(addressComponents),
      };

      setInputValue(formattedAddress);
      setPredictions([]);
      onLocationSelect(locationData);
    } catch (err: any) {
      console.error("Location selection error:", err);
      toast.error("Failed to select location", {
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setInputValue("");
    setPredictions([]);
    setIsOpen(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Show API key error state
  if (error && error.includes("API key")) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 border border-destructive rounded-md bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive">
            Google Maps unavailable. Please check API key configuration.
          </span>
        </div>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          {isLoading && (
            <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
          {inputValue && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-transparent"
              onClick={handleClear}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Input
            type="text"
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={`pl-10 pr-10 ${className}`}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (predictions.length > 0) {
                setIsOpen(true);
              }
            }}
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {predictions.length === 0 && !isLoading && inputValue.length >= 3 && (
              <CommandEmpty className="py-6 text-center text-sm">
                No locations found. Try a different search.
              </CommandEmpty>
            )}
            {predictions.length === 0 && !isLoading && inputValue.length < 3 && (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                Type at least 3 characters to search...
              </CommandEmpty>
            )}
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Searching...
              </div>
            )}
            {error && !error.includes("API key") && (
              <div className="py-6 text-center text-sm text-destructive">
                {error}
              </div>
            )}
            {predictions.length > 0 && (
              <CommandGroup>
                {predictions.map((prediction) => (
                  <CommandItem
                    key={prediction.place_id}
                    onSelect={() => handleSelectPlace(prediction)}
                    className="cursor-pointer"
                  >
                    <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium truncate">
                        {prediction.structured_formatting.main_text}
                      </span>
                      {prediction.structured_formatting.secondary_text && (
                        <span className="text-xs text-muted-foreground truncate">
                          {prediction.structured_formatting.secondary_text}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
