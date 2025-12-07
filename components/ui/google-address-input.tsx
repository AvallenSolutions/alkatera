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

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Load Google Maps script and initialize autocomplete
  useEffect(() => {
    if (disabled) return;

    const initAutocomplete = () => {
      if (!inputRef.current) return;

      try {
        const googleMaps = (window as any).google;
        if (!googleMaps || !googleMaps.maps || !googleMaps.maps.places) {
          throw new Error('Google Maps not loaded');
        }

        // Initialize autocomplete with restrictions
        autocompleteRef.current = new googleMaps.maps.places.Autocomplete(
          inputRef.current,
          {
            types: ['(cities)', 'establishment'],
            fields: ['formatted_address', 'geometry', 'address_components', 'types', 'name'],
          }
        );

        // Add place changed listener
        autocompleteRef.current.addListener('place_changed', handlePlaceSelect);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
        setScriptError(true);
        setIsLoading(false);
      }
    };

    // Check if Google Maps is already loaded
    if ((window as any).google?.maps?.places) {
      initAutocomplete();
      return;
    }

    // Load Google Maps script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Google Maps API key not found. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.');
      setScriptError(true);
      setIsLoading(false);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');

    if (existingScript) {
      existingScript.addEventListener('load', initAutocomplete);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initAutocomplete;
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setScriptError(true);
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (autocompleteRef.current && (window as any).google?.maps?.event) {
        (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [disabled]);

  const getLocalityLevel = (place: any): 'city' | 'region' | 'country' => {
    const types = place.types || [];

    // Check for city-level specificity
    if (
      types.includes('locality') ||
      types.includes('sublocality') ||
      types.includes('postal_town') ||
      types.includes('establishment') ||
      types.includes('premise')
    ) {
      return 'city';
    }

    // Check for region-level
    if (
      types.includes('administrative_area_level_1') ||
      types.includes('administrative_area_level_2')
    ) {
      return 'region';
    }

    // Country-level
    if (types.includes('country')) {
      return 'country';
    }

    return 'city'; // Default assumption
  };

  const extractCountryCode = (place: any): string => {
    const addressComponents = place.address_components || [];

    for (const component of addressComponents) {
      if (component.types.includes('country')) {
        return component.short_name;
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
        return component.long_name;
      }
    }

    return undefined;
  };

  const handlePlaceSelect = () => {
    const place = autocompleteRef.current?.getPlace();

    if (!place || !place.geometry || !place.geometry.location) {
      toast.error('Please select a location from the dropdown suggestions');
      return;
    }

    const localityLevel = getLocalityLevel(place);

    // Reject if location is too vague
    if (localityLevel === 'country' || localityLevel === 'region') {
      toast.error('Please select a more specific location (city or factory name)', {
        description: 'We need at least city-level precision for accurate transport calculations.',
      });

      // Clear the input
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

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Invalid coordinates received. Please try again.');
      return;
    }

    // Update input value
    setInputValue(formatted_address);

    // Fire callback with validated data
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
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

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <MapPin className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        required={required}
        className={`pl-10 ${className}`}
      />
    </div>
  );
}
