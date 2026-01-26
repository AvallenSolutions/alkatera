'use client';

import * as React from 'react';
import { Check, Loader2, MapPin, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  searchLocations,
  getRecentSearches,
  addToRecentSearches,
  popularDestinations,
  getLocationIcon,
  type Location,
} from '@/lib/services/geocoding-service';

interface LocationAutocompleteProps {
  value: Location | null;
  onSelect: (location: Location) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LocationAutocomplete({
  value,
  onSelect,
  placeholder = 'Search for a city or airport...',
  disabled = false,
}: LocationAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<Location[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [recentSearches, setRecentSearches] = React.useState<Location[]>([]);

  // Load recent searches on mount
  React.useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Debounced search
  React.useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchLocations(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelect = (location: Location) => {
    onSelect(location);
    addToRecentSearches(location);
    setRecentSearches(getRecentSearches());
    setOpen(false);
    setSearchQuery('');
  };

  const displayValue = value
    ? `${getLocationIcon(value)} ${value.displayName.split(',')[0]}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isSearching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            )}

            {!isSearching && !searchQuery && (
              <>
                {recentSearches.length > 0 && (
                  <CommandGroup heading="Recent Searches">
                    {recentSearches.map((location) => (
                      <CommandItem
                        key={location.place_id}
                        value={location.place_id}
                        onSelect={() => handleSelect(location)}
                      >
                        <span className="mr-2">
                          {getLocationIcon(location)}
                        </span>
                        <span className="flex-1 truncate">
                          {location.displayName}
                        </span>
                        {value?.place_id === location.place_id && (
                          <Check className="ml-2 h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                <CommandGroup heading="Popular Destinations">
                  {popularDestinations.slice(0, 6).map((location) => (
                    <CommandItem
                      key={location.place_id}
                      value={location.place_id}
                      onSelect={() => handleSelect(location)}
                    >
                      <span className="mr-2">
                        {getLocationIcon(location)}
                      </span>
                      <span className="flex-1 truncate">
                        {location.displayName}
                      </span>
                      {value?.place_id === location.place_id && (
                        <Check className="ml-2 h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {!isSearching && searchQuery && searchResults.length === 0 && (
              <CommandEmpty>
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No locations found for &quot;{searchQuery}&quot;
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Try searching for a major city or airport code
                  </p>
                </div>
              </CommandEmpty>
            )}

            {!isSearching && searchResults.length > 0 && (
              <CommandGroup heading={`Results for "${searchQuery}"`}>
                {searchResults.map((location) => (
                  <CommandItem
                    key={location.place_id}
                    value={location.place_id}
                    onSelect={() => handleSelect(location)}
                  >
                    <span className="mr-2">
                      {getLocationIcon(location)}
                    </span>
                    <span className="flex-1 truncate">
                      {location.displayName}
                    </span>
                    {value?.place_id === location.place_id && (
                      <Check className="ml-2 h-4 w-4" />
                    )}
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
