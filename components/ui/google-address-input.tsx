"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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

export function GoogleAddressInput({
  value = '',
  onAddressSelect,
  placeholder = "Search for city or factory location...",
  disabled = false,
  className = '',
  required = false,
}: GoogleAddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scriptError, setScriptError] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const initializingRef = useRef(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (disabled || initializingRef.current) {
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Google Maps API key not found');
      setScriptError(true);
      setIsLoading(false);
      return;
    }

    initializingRef.current = true;

    const loadScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
          resolve();
          return;
        }

        const existingScript = document.getElementById('google-maps-script');

        if (existingScript) {
          existingScript.addEventListener('load', () => resolve());
          existingScript.addEventListener('error', () => reject(new Error('Script failed to load')));
          return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=Function.prototype`;
        script.async = true;
        script.defer = true;

        script.addEventListener('load', () => {
          console.log('Google Maps script loaded successfully');
          resolve();
        });

        script.addEventListener('error', () => {
          console.error('Failed to load Google Maps script');
          reject(new Error('Failed to load Google Maps script'));
        });

        document.head.appendChild(script);
      });
    };

    const initializeAutocomplete = async () => {
      if (!inputRef.current) {
        setIsLoading(false);
        return;
      }

      try {
        await loadScript();

        if (!google.maps || !google.maps.places) {
          throw new Error('Google Maps Places library not available');
        }

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['geocode', 'establishment'],
          fields: ['address_components', 'geometry', 'formatted_address', 'name', 'types'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          handlePlaceSelect(place);
        });

        autocompleteRef.current = autocomplete;
        setIsLoading(false);
        console.log('Autocomplete initialized successfully');
      } catch (error) {
        console.error('Error initializing autocomplete:', error);
        setScriptError(true);
        setIsLoading(false);
      }
    };

    initializeAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [disabled]);

  const getLocalityLevel = (place: google.maps.places.PlaceResult): 'city' | 'region' | 'country' => {
    const types = place.types || [];

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

  const extractCountryCode = (place: google.maps.places.PlaceResult): string => {
    const addressComponents = place.address_components || [];

    for (const component of addressComponents) {
      if (component.types.includes('country')) {
        return component.short_name || '';
      }
    }

    return '';
  };

  const extractCity = (place: google.maps.places.PlaceResult): string | undefined => {
    const addressComponents = place.address_components || [];

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

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (!place || !place.geometry || !place.geometry.location) {
      toast.error('Please select a location from the dropdown suggestions');
      return;
    }

    const localityLevel = getLocalityLevel(place);

    if (localityLevel === 'country' || localityLevel === 'region') {
      toast.error('Please select a more specific location (city or factory name)', {
        description: 'We need at least city-level precision for accurate transport calculations.',
      });

      if (inputRef.current) {
        inputRef.current.value = '';
        setInputValue('');
      }
      return;
    }

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const country_code = extractCountryCode(place);
    const city = extractCity(place);
    const formatted_address = place.formatted_address || place.name || '';

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Invalid coordinates received. Please try again.');
      return;
    }

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
  };

  if (scriptError) {
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        <span className="text-sm text-muted-foreground">Loading location search...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`pl-10 ${className}`}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
