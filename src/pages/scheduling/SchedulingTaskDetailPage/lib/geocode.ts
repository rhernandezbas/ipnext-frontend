interface Coordinates {
  lat: number;
  lng: number;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'User-Agent': 'ipnext-admin' };

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set('lat', String(coords.lat));
  url.searchParams.set('lon', String(coords.lng));
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) return null;

  const data = (await res.json()) as { display_name?: string };
  return data.display_name ?? null;
}
