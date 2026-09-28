// Address search (DAWA / Dataforsyningen), routing (OSRM on routing.openstreetmap.de)
// and school district lookup (GeoFA). All endpoints allow browser CORS.

export type LatLng = { lat: number; lng: number };
export type TravelMode = 'foot' | 'bike' | 'car';

export interface AddressHit {
  label: string;
  lat: number;
  lng: number;
}

export async function searchAddress(q: string, signal?: AbortSignal): Promise<AddressHit[]> {
  if (q.trim().length < 3) return [];
  const url = `https://api.dataforsyningen.dk/autocomplete?q=${encodeURIComponent(q)}&type=adresse&per_side=8&fuzzy=`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const hits = (await res.json()) as { tekst: string; data: { x: number; y: number } }[];
  return hits
    .filter((h) => h.data && typeof h.data.x === 'number')
    // DAWA leaves empty floor/door parts as ", ,"; tidy them.
    .map((h) => ({ label: h.tekst.replace(/(,\s*)+,/g, ',').replace(/\s+,/g, ','), lng: h.data.x, lat: h.data.y }));
}

const OSRM = (mode: TravelMode) => `https://routing.openstreetmap.de/routed-${mode}`;

export interface Route {
  duration: number; // seconds
  distance: number; // meters
  coordinates: [number, number][]; // [lat, lng]
}

export async function route(from: LatLng, to: LatLng, mode: TravelMode, signal?: AbortSignal): Promise<Route | null> {
  const url = `${OSRM(mode)}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  const r = data.routes?.[0];
  if (!r) return null;
  return {
    duration: r.duration,
    distance: r.distance,
    coordinates: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
  };
}

type TravelResult = Map<string, { duration: number | null; distance: number | null }>;
const travelCache = new Map<string, TravelResult>();

/**
 * Travel time/distance from one origin to many destinations. Requests are
 * chunked and sent one at a time (the public OSRM server rate-limits), with
 * partial results reported through onProgress. Results are cached per origin+mode.
 */
export async function travelTable(
  from: LatLng,
  targets: { id: string; lat: number; lng: number }[],
  mode: TravelMode,
  signal?: AbortSignal,
  onProgress?: (partial: TravelResult) => void,
): Promise<TravelResult> {
  const key = `${mode}|${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${targets.length}`;
  const cached = travelCache.get(key);
  if (cached) return cached;
  const out: TravelResult = new Map();
  const CHUNK = 95;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK);
    const coords = [from, ...chunk].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `${OSRM(mode)}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { signal });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      if (!res.ok) break;
      const data = await res.json();
      chunk.forEach((t, j) => {
        out.set(t.id, { duration: data.durations?.[0]?.[j + 1] ?? null, distance: data.distances?.[0]?.[j + 1] ?? null });
      });
      onProgress?.(new Map(out));
      break;
    }
  }
  if (out.size) travelCache.set(key, out);
  return out;
}

/** Straight-line distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Which folkeskole district (skoledistrikt) an address belongs to, from the
 * national GeoFA dataset (FKG theme 5710). Returns district names, which are
 * usually — not always — the school's name.
 */
export async function lookupDistrict(p: LatLng, signal?: AbortSignal): Promise<string[]> {
  const sql =
    'SELECT udd_distrikt_navn FROM fkg.t_5710_born_skole_dis WHERE statuskode=3 AND udd_distrikt_type_kode=5 AND starttrin_kode=11 ' +
    `AND ST_Intersects(geometri, ST_Transform(ST_SetSRID(ST_MakePoint(${p.lng},${p.lat}),4326),25832))`;
  try {
    const res = await fetch(`https://geofa.geodanmark.dk/api/v2/sql/fkg?q=${encodeURIComponent(sql)}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const feats = data.features || data.data || [];
    return feats
      .map((f: { properties?: { udd_distrikt_navn?: string }; udd_distrikt_navn?: string }) => f.properties?.udd_distrikt_navn ?? f.udd_distrikt_navn)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Loose match between a district name and a school name. */
export function districtMatches(district: string, schoolName: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/skole(n)?|skolen|distrikt|,.*$/g, '').replace(/[^a-zæøå0-9]/g, '');
  const a = n(district), b = n(schoolName);
  return a.length > 2 && (a === b || b.startsWith(a) || a.startsWith(b));
}
