export interface PlaceSuggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

export interface PlaceDetailsResult {
  lat: number;
  lng: number;
  formatted_address?: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

function getComponent(
  components: PlaceDetailsResult['address_components'],
  types: string[],
): string {
  if (!components) return '';
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match?.long_name) return match.long_name;
  }
  return '';
}

/** Extract city name only (e.g. Hyderabad from full Google result). */
export function extractCityName(details: PlaceDetailsResult, fallbackText?: string): string {
  const fromComponents =
    getComponent(details.address_components, [
      'locality',
      'administrative_area_level_2',
      'administrative_area_level_3',
    ]) || '';

  if (fromComponents) return fromComponents.trim();

  const text = fallbackText || details.formatted_address || '';
  if (!text) return '';
  return text.split(',')[0]?.trim() || '';
}

/** Extract state name (e.g. Telangana) from place details. */
export function extractStateName(details: PlaceDetailsResult, fallbackText?: string): string {
  const fromComponents =
    getComponent(details.address_components, ['administrative_area_level_1']) || '';

  if (fromComponents) return fromComponents.trim();

  const text = fallbackText || details.formatted_address || '';
  if (!text) return '';

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    if (candidate && !/^\d{5,6}$/.test(candidate) && !/^india$/i.test(candidate)) {
      return candidate;
    }
  }

  return '';
}

/** Extract locality/neighborhood name only (e.g. Madhapur). */
export function extractLocalityName(details: PlaceDetailsResult, fallbackText?: string): string {
  const fromComponents =
    getComponent(details.address_components, [
      'sublocality_level_1',
      'sublocality',
      'sublocality_level_2',
      'neighborhood',
      'political',
    ]) || '';

  if (fromComponents) return fromComponents.trim();

  const text = fallbackText || details.formatted_address || '';
  if (!text) return '';
  return text.split(',')[0]?.trim() || '';
}

export function suggestionDisplayName(suggestion: PlaceSuggestion): string {
  return suggestion.main_text || suggestion.description.split(',')[0]?.trim() || '';
}
