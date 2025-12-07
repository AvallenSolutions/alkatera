"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
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

interface GoogleAddressInputProps {
  value?: string;
  onAddressSelect: (address: {
    formatted_address: string;
    lat: number;
    lng: number;
    country_code: string;
    city?: string;
    locality_level: 'city' | 'region' | 'country';
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export function GoogleAddressInput({
  value = '',
  onAddressSelect,
  placeholder = "Search for city or factory location...",
  disabled = false,
  className = '',
  required = false,
}: GoogleAddressInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchPredictions = useCallback(async (input: string) => {
    if (!input || input.length < 3) {
      setPredictions([]);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch suggestions');
      }

      const data = await response.json();

      if (data.status === 'ZERO_RESULTS') {
        setPredictions([]);
      } else if (data.predictions) {
        setPredictions(data.predictions);
        setIsOpen(true);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching predictions:', err);
        setError(err.message);
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

  const getLocalityLevel = (types: string[]): 'city' | 'region' | 'country' => {
    if (
      types.includes('locality') ||
      types.includes('sublocality') ||
      types.includes('postal_town') ||
      types.includes('establishment') ||
      types.includes('premise')
    ) {
      return 'city';
    }

    if (
      types.includes('administrative_area_level_1') ||
      types.includes('administrative_area_level_2')
    ) {
      return 'region';
    }

    if (types.includes('country')) {
      return 'country';
    }

    return 'city';
  };

  const extractCountryCode = (addressComponents: any[]): string => {
    for (const component of addressComponents) {
      if (component.types.includes('country')) {
        return component.short_name || '';
      }
    }
    return '';
  };

  const extractCity = (addressComponents: any[]): string | undefined => {
    for (const component of addressComponents) {
      if (
        component.types.includes('locality') ||
        component.types.includes('postal_town') ||
        component.types.includes('administrative_area_level_2')
      ) {
        return component.long_name || '';
      }
    }
    return undefined;
  };

  const handleSelectPlace = async (prediction: PlacePrediction) => {
    try {
      setIsLoading(true);
      setIsOpen(false);

      const response = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(prediction.place_id)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch place details');
      }

      const data = await response.json();
      const place = data.result;

      if (!place || !place.geometry || !place.geometry.location) {
        throw new Error('Invalid place data received');
      }

      const localityLevel = getLocalityLevel(place.types || []);

      if (localityLevel === 'country' || localityLevel === 'region') {
        toast.error('Please select a more specific location (city or factory name)', {
          description: 'We need at least city-level precision for accurate transport calculations.',
        });
        setInputValue('');
        return;
      }

      const lat = place.geometry.location.lat;
      const lng = place.geometry.location.lng;
      const country_code = extractCountryCode(place.address_components || []);
      const city = extractCity(place.address_components || []);
      const formatted_address = place.formatted_address || place.name || '';

      setInputValue(formatted_address);

      onAddressSelect({
        formatted_address,
        lat,
        lng,
        country_code,
        city,
        locality_level: localityLevel,
      });

      toast.success('Location selected successfully', {
        description: formatted_address,
      });
    } catch (err: any) {
      console.error('Error selecting place:', err);
      toast.error('Failed to select location', {
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (error && error.includes('API key')) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 border border-destructive rounded-md bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive">
            Google Maps unavailable. Please check your API key configuration.
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
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
          <Input
            type="text"
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={`pl-10 ${isLoading ? 'pr-10' : ''} ${className}`}
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
      <PopoverContent className="p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command>
          <CommandList>
            {predictions.length === 0 && !isLoading && inputValue.length >= 3 && (
              <CommandEmpty>No locations found. Try a different search.</CommandEmpty>
            )}
            {predictions.length === 0 && !isLoading && inputValue.length < 3 && (
              <CommandEmpty>Type at least 3 characters to search...</CommandEmpty>
            )}
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Searching...
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
                    <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {prediction.structured_formatting.main_text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {prediction.structured_formatting.secondary_text}
                      </span>
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
