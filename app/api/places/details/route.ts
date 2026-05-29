import { NextRequest, NextResponse } from 'next/server';

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId')?.trim();

  if (!placeId) {
    return NextResponse.json({ error: 'Missing placeId parameter' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 500 });
  }

  const cached = cache.get(placeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set(
      'fields',
      'geometry,formatted_address,address_components,name',
    );
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      console.error('Places details error:', data.status, data.error_message);
      return NextResponse.json(
        { error: data.error_message || 'Failed to get place details' },
        { status: 502 },
      );
    }

    const result = data.result;
    const lat = result.geometry?.location?.lat ?? 0;
    const lng = result.geometry?.location?.lng ?? 0;

    const responseData = {
      lat,
      lng,
      formatted_address: result.formatted_address as string | undefined,
      address_components: result.address_components as Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }>,
      name: result.name as string | undefined,
    };

    cache.set(placeId, { data: responseData, timestamp: Date.now() });
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Places details route error:', error);
    return NextResponse.json({ error: 'Failed to get place details' }, { status: 500 });
  }
}
