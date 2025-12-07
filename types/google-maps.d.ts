// Type declarations for Google Maps JavaScript API

declare global {
  interface Window {
    google?: typeof google;
  }
}

declare namespace google {
  namespace maps {
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    namespace places {
      interface PlaceResult {
        formatted_address?: string;
        name?: string;
        geometry?: {
          location: LatLng;
        };
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
        types?: string[];
      }

      interface AutocompleteOptions {
        types?: string[];
        fields?: string[];
        componentRestrictions?: {
          country?: string | string[];
        };
      }

      class Autocomplete {
        constructor(
          inputField: HTMLInputElement,
          options?: AutocompleteOptions
        );
        addListener(
          eventName: string,
          handler: () => void
        ): void;
        getPlace(): PlaceResult;
      }
    }

    namespace event {
      function clearInstanceListeners(instance: any): void;
    }
  }
}

export {};
