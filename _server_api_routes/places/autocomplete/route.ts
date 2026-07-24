import { NextRequest, NextResponse } from 'next/server';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input')?.trim() || '';
  const mode = searchParams.get('mode') || 'city';
  const cityName = searchParams.get('cityName')?.trim() || '';
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!input || input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps API key is not configured', suggestions: [] },
      { status: 500 },
    );
  }

  const cacheKey = `${mode}:${cityName}:${lat}:${lng}:${input.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ suggestions: cached.data });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('components', 'country:in');
    url.searchParams.set('language', 'en');

    if (mode === 'city') {
      url.searchParams.set('types', '(cities)');
    } else {
      const localityInput = cityName ? `${input} ${cityName}` : input;
      url.searchParams.set('input', localityInput);
      if (lat && lng) {
        url.searchParams.set('location', `${lat},${lng}`);
        url.searchParams.set('radius', '50000');
        url.searchParams.set('strictbounds', 'false');
      }
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places autocomplete error:', data.status, data.error_message);
      return NextResponse.json(
        { error: data.error_message || 'Places autocomplete failed', suggestions: [] },
        { status: 502 },
      );
    }

    const suggestions = (data.predictions || []).map((prediction: {
      place_id: string;
      description: string;
      structured_formatting?: { main_text: string; secondary_text: string };
    }) => ({
      place_id: prediction.place_id,
      description: prediction.description,
      main_text: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
      secondary_text: prediction.structured_formatting?.secondary_text || '',
    }));

    cache.set(cacheKey, { data: suggestions, timestamp: Date.now() });
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Places autocomplete route error:', error);
    return NextResponse.json(
      { error: 'Failed to search locations', suggestions: [] },
      { status: 500 },
    );
  }
}
