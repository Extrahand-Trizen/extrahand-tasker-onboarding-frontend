'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CircleHelp, Loader2, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  extractCityName,
  extractLocalityName,
  extractStateName,
  suggestionDisplayName,
  type PlaceDetailsResult,
  type PlaceSuggestion,
} from '@/lib/places/googlePlaceUtils';

export interface CitySelectionMeta {
  cityName: string;
  stateName?: string;
  placeId: string;
  lat?: number;
  lng?: number;
}

interface GooglePlaceAutocompleteProps {
  id?: string;
  label: string;
  helperText?: string;
  value: string;
  onValueChange: (value: string) => void;
  mode: 'city' | 'locality';
  citySelection?: CitySelectionMeta | null;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  onCitySelected?: (meta: CitySelectionMeta) => void;
  onClear?: () => void;
  className?: string;
}

async function fetchSuggestions(
  input: string,
  mode: 'city' | 'locality',
  citySelection?: CitySelectionMeta | null,
): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ input, mode });
  if (mode === 'locality' && citySelection) {
    params.set('cityName', citySelection.cityName);
    if (citySelection.lat != null && citySelection.lng != null) {
      params.set('lat', String(citySelection.lat));
      params.set('lng', String(citySelection.lng));
    }
  }

  const response = await fetch(`/api/places/autocomplete?${params.toString()}`);
  const data = await response.json();
  return data.suggestions || [];
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  const response = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch place details');
  }
  return response.json();
}

export function GooglePlaceAutocomplete({
  id,
  label,
  helperText,
  value,
  onValueChange,
  mode,
  citySelection,
  disabled = false,
  error,
  placeholder,
  onCitySelected,
  onClear,
  className,
}: GooglePlaceAutocompleteProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      if (mode === 'locality' && !citySelection?.cityName) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsSearching(true);
      try {
        let results = await fetchSuggestions(query, mode, citySelection);
        if (mode === 'locality' && citySelection?.cityName) {
          const cityLower = citySelection.cityName.toLowerCase();
          results = results.filter(
            (item) =>
              item.description.toLowerCase().includes(cityLower) ||
              item.secondary_text.toLowerCase().includes(cityLower),
          );
        }
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearching(false);
      }
    },
    [mode, citySelection],
  );

  const handleInputChange = (text: string) => {
    setInputValue(text);
    onValueChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(text);
    }, 400);
  };

  const handleClear = () => {
    setInputValue('');
    onValueChange('');
    setSuggestions([]);
    setShowSuggestions(false);
    onClear?.();
  };

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    setIsSelecting(true);
    setShowSuggestions(false);

    try {
      const details = await fetchPlaceDetails(suggestion.place_id);
      const fallback = suggestionDisplayName(suggestion);

      if (mode === 'city') {
        const cityName = extractCityName(details, fallback);
        const stateName = extractStateName(details, suggestion.description);
        setInputValue(cityName);
        onValueChange(cityName);
        onCitySelected?.({
          cityName,
          stateName: stateName || undefined,
          placeId: suggestion.place_id,
          lat: details.lat,
          lng: details.lng,
        });
      } else {
        const localityName = extractLocalityName(details, fallback);
        setInputValue(localityName);
        onValueChange(localityName);
      }
    } catch {
      const fallback = suggestionDisplayName(suggestion);
      setInputValue(fallback);
      onValueChange(fallback);
    } finally {
      setIsSelecting(false);
    }
  };

  const isLocked = mode === 'locality' && !citySelection?.cityName;
  const isDisabled = disabled || isLocked || isSelecting;
  const showClear = !!inputValue.trim() && !isSearching && !isSelecting;

  return (
    <div className={cn('space-y-1.5', className)} ref={containerRef}>
      <Label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </Label>

      <div className="relative">
        <MapPin
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
            isLocked ? 'text-gray-300' : 'text-gray-400',
          )}
          aria-hidden
        />

        <Input
          id={inputId}
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder={
            placeholder ||
            (mode === 'city' ? 'e.g. Hyderabad' : isLocked ? 'Select city first' : 'e.g. Madhapur')
          }
          disabled={isDisabled}
          autoComplete="off"
          className={cn(
            'h-10 pl-9 pr-10',
            isLocked && 'bg-gray-50 text-gray-400',
            error && 'border-red-500 focus-visible:ring-red-500/30',
          )}
        />

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {(isSearching || isSelecting) && (
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" aria-hidden />
          )}
          {!isSearching && !isSelecting && !showClear ? (
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
          ) : null}
          {showClear && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label={`Clear ${label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="absolute z-50 mt-1.5 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-md ring-1 ring-black/5"
            role="listbox"
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.place_id} role="option">
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-amber-50/80"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleSelect(suggestion);
                  }}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {suggestion.main_text}
                    </span>
                    {suggestion.secondary_text ? (
                      <span className="block truncate text-xs text-gray-500">
                        {suggestion.secondary_text}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isLocked ? (
        <p className="text-xs text-amber-700/90">Select a city first to search localities.</p>
      ) : helperText ? (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-gray-500">
          <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
          <span>{helperText}</span>
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
