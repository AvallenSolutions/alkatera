"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X } from "lucide-react";
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

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
    country_code?: string;
  };
}

// Rate limiting - Nominatim requires 1 request per second max
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
  return fetch(url);
}

export function LocationPicker({
  value = "",
  onLocationSelect,
  placeholder = "Search for a city or address...",
  disabled = false,
  required = false,
  className = "",
}: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const searchLocations = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setResults([]);
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

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query.trim());
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "10");
      url.searchParams.set("addressdetails", "1");

      const response = await rateLimitedFetch(url.toString());

      if (!response.ok) {
        throw new Error("Failed to search locations");
      }

      const data = await response.json() as NominatimResult[];

      // Filter results to prioritize cities and specific locations
      const filteredResults = data.filter(result => {
        const type = result.type?.toLowerCase() || "";
        const resultClass = result.class?.toLowerCase() || "";

        // Include cities, towns, villages, establishments, and addresses
        return (
          resultClass === "place" ||
          resultClass === "boundary" ||
          type === "city" ||
          type === "town" ||
          type === "village" ||
          type === "suburb" ||
          type === "municipality" ||
          type === "administrative" ||
          type === "industrial" ||
          type === "commercial"
        );
      });

      setResults(filteredResults.length > 0 ? filteredResults : data.slice(0, 8));

      if (filteredResults.length > 0 || data.length > 0) {
        setIsOpen(true);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Location search error:", err);
        setError("Failed to search locations. Please try again.");
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
      searchLocations(newValue);
    }, 400);
  };

  const extractCity = (result: NominatimResult): string | undefined => {
    const addr = result.address;
    if (!addr) return undefined;
    return addr.city || addr.town || addr.village || addr.municipality;
  };

  const handleSelectLocation = (result: NominatimResult) => {
    const city = extractCity(result);
    const country = result.address?.country;
    const countryCode = result.address?.country_code?.toUpperCase();

    const locationData: LocationData = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name,
      city,
      country,
      countryCode,
    };

    setInputValue(result.display_name);
    setIsOpen(false);
    setResults([]);
    onLocationSelect(locationData);
  };

  const handleClear = () => {
    setInputValue("");
    setResults([]);
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

  const formatDisplayName = (displayName: string): { main: string; secondary: string } => {
    const parts = displayName.split(", ");
    return {
      main: parts[0] || displayName,
      secondary: parts.slice(1).join(", "),
    };
  };

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
              if (results.length > 0) {
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
            {results.length === 0 && !isLoading && inputValue.length >= 3 && (
              <CommandEmpty className="py-6 text-center text-sm">
                No locations found. Try a different search.
              </CommandEmpty>
            )}
            {results.length === 0 && !isLoading && inputValue.length < 3 && (
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
            {error && (
              <div className="py-6 text-center text-sm text-destructive">
                {error}
              </div>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((result) => {
                  const { main, secondary } = formatDisplayName(result.display_name);
                  return (
                    <CommandItem
                      key={result.place_id}
                      onSelect={() => handleSelectLocation(result)}
                      className="cursor-pointer"
                    >
                      <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate">{main}</span>
                        {secondary && (
                          <span className="text-xs text-muted-foreground truncate">
                            {secondary}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
