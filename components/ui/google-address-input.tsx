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
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
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

    const initAutocomplete = async () => {
      if (!containerRef.current) return;

      try {
        const googleMaps = (window as any).google;
        if (!googleMaps || !googleMaps.maps || !googleMaps.maps.places) {
          throw new Error('Google Maps not loaded');
        }

        // Wait for PlaceAutocompleteElement to be available
        await googleMaps.maps.importLibrary('places');

        // Create PlaceAutocompleteElement
        const autocompleteElement = document.createElement('gmp-place-autocomplete') as any;
        autocompleteElement.placeholder = placeholder;

        // Add listener for place selection
        autocompleteElement.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event.place;
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location', 'addressComponents', 'types'],
          });

          handlePlaceSelect(place);
        });

        autocompleteElementRef.current = autocompleteElement;

        // Replace the input with the autocomplete element
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(autocompleteElement);
        }

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
      existingScript.addEventListener('load', () => initAutocomplete());
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => initAutocomplete();
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setScriptError(true);
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (autocompleteElementRef.current) {
        autocompleteElementRef.current.remove();
      }
    };
  }, [disabled, placeholder]);

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
    const addressComponents = place.addressComponents || [];

    for (const component of addressComponents) {
      if (component.types.includes('country')) {
        return component.shortText || component.short_name || '';
      }
    }

    return '';
  };

  const extractCity = (place: any): string | undefined => {
    const addressComponents = place.addressComponents || [];

    for (const component of addressComponents) {
      if (
        component.types.includes('locality') ||
        component.types.includes('postal_town') ||
        component.types.includes('administrative_area_level_2')
      ) {
        return component.longText || component.long_name || '';
      }
    }

    return undefined;
  };

  const handlePlaceSelect = (place: any) => {
    if (!place || !place.location) {
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
      if (autocompleteElementRef.current) {
        autocompleteElementRef.current.value = '';
        setInputValue('');
      }
      return;
    }

    const lat = place.location.lat();
    const lng = place.location.lng();
    const country_code = extractCountryCode(place);
    const city = extractCity(place);
    const formatted_address = place.formattedAddress || place.displayName || '';

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
    <>
      <div className="relative">
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            <span className="text-sm text-muted-foreground">Loading location search...</span>
          </div>
        )}
        <div
          ref={containerRef}
          className={`google-address-input-container ${isLoading ? 'hidden' : ''} ${className}`}
          style={{
            width: '100%',
          }}
        />
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
          gmp-place-autocomplete {
            width: 100%;
          }
          gmp-place-autocomplete input {
            width: 100%;
            padding: 0.5rem 0.75rem;
            padding-left: 2.5rem;
            font-size: 0.875rem;
            line-height: 1.25rem;
            border: 1px solid hsl(var(--border));
            border-radius: 0.375rem;
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
            transition: border-color 0.2s;
          }
          gmp-place-autocomplete input:focus {
            outline: none;
            border-color: hsl(var(--ring));
            box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
          }
          gmp-place-autocomplete input:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          .google-address-input-container {
            position: relative;
          }
          .google-address-input-container::before {
            content: "";
            position: absolute;
            left: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            width: 1rem;
            height: 1rem;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
            pointer-events: none;
            z-index: 10;
          }
        `
      }} />
    </>
  );
}
