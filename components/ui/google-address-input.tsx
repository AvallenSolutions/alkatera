"use client";

/// <reference path="../../types/google-maps.d.ts" />

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
  const autocompleteRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scriptError, setScriptError] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (disabled) return;

    const initAutocomplete = () => {
      if (!inputRef.current) return;

      try {
        const google = (window as any).google;
        if (!google || !google.maps || !google.maps.places) {
          throw new Error('Google Maps Places library not loaded');
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
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
        setScriptError(true);
        setIsLoading(false);
      }
    };

    if ((window as any).google?.maps?.places?.Autocomplete) {
      initAutocomplete();
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Google Maps API key not found. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.');
      setScriptError(true);
      setIsLoading(false);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');

    if (existingScript) {
      const checkGoogleLoaded = setInterval(() => {
        if ((window as any).google?.maps?.places?.Autocomplete) {
          clearInterval(checkGoogleLoaded);
          initAutocomplete();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkGoogleLoaded);
        if (!(window as any).google?.maps?.places?.Autocomplete) {
          console.error('Google Maps API failed to load in time');
          setScriptError(true);
          setIsLoading(false);
        }
      }, 10000);

      return () => clearInterval(checkGoogleLoaded);
    }

    const callbackName = `initGoogleMaps_${Date.now()}`;
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      initAutocomplete();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      delete (window as any)[callbackName];
      setScriptError(true);
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName];
      }
    };
  }, [disabled]);

  const getLocalityLevel = (place: any): 'city' | 'region' | 'country' => {
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

  const extractCountryCode = (place: any): string => {
    const addressComponents = place.address_components || [];

    for (const component of addressComponents) {
      if (component.types.includes('country')) {
        return component.short_name || '';
      }
    }

    return '';
  };

  const extractCity = (place: any): string | undefined => {
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

  const handlePlaceSelect = (place: any) => {
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
      />
    </div>
  );
}
