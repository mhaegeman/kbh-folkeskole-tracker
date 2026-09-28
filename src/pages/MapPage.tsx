import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike, Car, Footprints, Filter, Landmark, Layers, Loader2, Route as RouteIcon, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { AddressSearch } from '../components/AddressSearch';
import { FiltersBar } from '../components/FiltersBar';
import { ScoreBadge, scoreTextColor } from '../components/ScoreBadge';
import { scoreColor } from '../lib/score';
import { districtMatches, lookupDistrict, route as fetchRoute, type Route, type TravelMode } from '../lib/geo';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, shortName, typeLabel } from '../lib/format';
import type { School } from '../lib/types';

const CPH: [number, number] = [55.686, 12.53];

const MODES: { id: TravelMode; label: string; icon: typeof Bike }[] = [
  { id: 'foot', label: 'Walk', icon: Footprints },
  { id: 'bike', label: 'Bike', icon: Bike },
  { id: 'car', label: 'Car', icon: Car },
];

function pinFor(s: School, score: number | null, letter: string | null, selected: boolean) {
  return L.divIcon({
    className: '',
    html: score === null
      ? `<div class="school-pin is-empty ${s.isPrivate ? 'is-private' : ''} ${selected ? 'is-selected' : ''}"></div>`
      : `<div class="school-pin ${s.isPrivate ? 'is-private' : ''} ${selected ? 'is-selected' : ''}" style="background:${scoreColor(score)};color:${scoreTextColor(score)}">${letter}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

const homeIcon = L.divIcon({
  className: '',
  html: '<div class="home-pin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 10.5 12 3l9 7.5V21H3z"/></svg></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, Math.max(map.getZoom(), 14), { duration: 0.6 }); }, [target, map]);
  return null;
}

function FitRoute({ route }: { route: Route | null }) {
  const map = useMap();
  useEffect(() => {
    if (route?.coordinates.length) map.fitBounds(L.latLngBounds(route.coordinates), { padding: [60, 60] });
  }, [route, map]);
  return null;
}

type SortBy = 'time' | 'score';

export default function MapPage() {
  const { filtered, scores, home, setHome, mode, setMode, travel, travelLoading, distanceTo, byId, shortlist, toggleShortlist } = useStore();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('school');
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [districts, setDistricts] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [districtGeo, setDistrictGeo] = useState<GeoJSON.FeatureCollection[] | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches));

  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // District school for the home address.
  useEffect(() => {
    if (!home) { setDistricts([]); return; }
    const ctrl = new AbortController();
    lookupDistrict(home, ctrl.signal).then(setDistricts);
    return () => ctrl.abort();
  }, [home]);

  // Route from home to the selected school.
  useEffect(() => {
    setRoute(null);
    if (!home || !selected?.lat || !selected.lng) return;
    const ctrl = new AbortController();
    setRouteLoading(true);
    fetchRoute(home, { lat: selected.lat, lng: selected.lng }, mode, ctrl.signal)
      .then(setRoute)
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setRouteLoading(false); });
    return () => ctrl.abort();
  }, [home, selected, mode]);

  useEffect(() => {
    if (selected?.lat && selected.lng && !home) setFlyTarget([selected.lat, selected.lng]);
  }, [selected, home]);

  useEffect(() => {
    if (!showDistricts || districtGeo) return;
    Promise.all(['København', 'Frederiksberg'].map((m) =>
      fetch(`${import.meta.env.BASE_URL}data/districts_${m}.geojson`).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
      .then((g) => setDistrictGeo(g.filter(Boolean)));
  }, [showDistricts, districtGeo]);

  const districtSchools = useMemo(
    () => filtered.filter((s) => s.category === 'folkeskole' && districts.some((d) => districtMatches(d, s.name))),
    [filtered, districts],
  );

  const list = useMemo(() => {
    const l = filtered.filter((s) => s.lat && s.lng);
    const key = (s: School) => (sortBy === 'time' && home ? travel.get(s.id)?.duration ?? (distanceTo(s) ?? 1e9) / 3 : -(scores.get(s.id)?.score ?? -1));
    return l.sort((a, b) => key(a) - key(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, travel, sortBy, home, scores]);

  const select = (s: School | null) => {
    const next = new URLSearchParams(params);
    if (s) next.set('school', s.id); else next.delete('school');
    setParams(next, { replace: true });
    if (s?.lat && s.lng && !home) setFlyTarget([s.lat, s.lng]);
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col-reverse md:flex-row">
      {/* Side panel */}
      <aside className="flex h-[48%] w-full shrink-0 flex-col border-t border-border bg-surface md:h-full md:w-[400px] md:border-r md:border-t-0">
        <div className="space-y-3 border-b border-border p-4">
          <AddressSearch value={home} onChange={(h) => { setHome(h); if (h) setFlyTarget([h.lat, h.lng]); }} />
          <div className="flex items-center gap-2">
            <div className="flex flex-1 overflow-hidden rounded-[10px] border border-border">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={clsx('flex flex-1 items-center justify-center gap-1.5 py-2 text-sm', mode === m.id ? 'bg-accent text-accent-ink' : 'bg-surface text-ink-2 hover:bg-surface-2')}>
                  <m.icon size={15} /> {m.label}
                </button>
              ))}
            </div>
            <button className={clsx('btn px-3', showFilters && 'btn-primary')} onClick={() => setShowFilters((v) => !v)} aria-label="Filters"><Filter size={16} /></button>
          </div>
          {home && (
            <div className="rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent"><Landmark size={13} /> Your district school</div>
              {districts.length === 0 ? (
                <div className="text-ink-2">No district found for this address (some municipalities, e.g. Gentofte and Rødovre, allocate by distance instead).</div>
              ) : districtSchools.length ? (
                districtSchools.map((s) => (
                  <button key={s.id} className="block font-medium text-ink hover:underline" onClick={() => select(s)}>{shortName(s.name)}</button>
                ))
              ) : (
                <div className="text-ink">{districts.join(', ')}</div>
              )}
              <div className="mt-0.5 text-[11px] text-ink-3">Guaranteed place in the local folkeskole (source: GeoFA skoledistrikter)</div>
            </div>
          )}
        </div>

        {showFilters && <div className="max-h-[50%] overflow-auto border-b border-border p-4 scrollbar-thin"><FiltersBar /></div>}

        <div className="flex items-center justify-between px-4 py-2 text-xs text-ink-3">
          <span>{list.length} schools {travelLoading && <Loader2 size={12} className="ml-1 inline animate-spin" />}</span>
          <span className="flex items-center gap-1">
            Sort:
            <button className={clsx('rounded px-1.5 py-0.5', sortBy === 'time' && 'bg-surface-2 text-ink')} onClick={() => setSortBy('time')} disabled={!home}>Travel time</button>
            <button className={clsx('rounded px-1.5 py-0.5', sortBy === 'score' && 'bg-surface-2 text-ink')} onClick={() => setSortBy('score')}>Score</button>
          </span>
        </div>
        <ul className="flex-1 overflow-auto px-2 pb-4 scrollbar-thin">
          {list.map((s) => {
            const t = travel.get(s.id);
            const isDistrict = districtSchools.includes(s);
            return (
              <li key={s.id}>
                <button onClick={() => select(s)}
                  className={clsx('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2', selectedId === s.id && 'bg-accent-soft')}>
                  <ScoreBadge result={scores.get(s.id)} size="sm" showNumber={false} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {shortName(s.name)}
                      {isDistrict && <span className="ml-1.5 rounded bg-accent px-1 py-0.5 text-[10px] font-semibold text-accent-ink">DISTRICT</span>}
                    </div>
                    <div className="truncate text-xs text-ink-3">{typeLabel(s)} · {s.city}{s.isPrivate && s.fees.monthly ? ` · ${fmtDKK(s.fees.monthly)}/mo` : ''}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular">
                    {home ? (
                      <>
                        <div className="font-semibold text-ink">{t?.duration != null ? fmtDuration(t.duration) : '…'}</div>
                        <div className="text-ink-3">{fmtDistance(t?.distance ?? distanceTo(s))}</div>
                      </>
                    ) : <span className="text-ink-3">{fmt(s.indicators.grade, 1)}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Map */}
      <div className="relative min-h-0 flex-1">
        <MapContainer center={CPH} zoom={12} className={clsx('h-full w-full', dark && 'dark-tiles')} zoomControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyTo target={flyTarget} />
          <FitRoute route={route} />
          {showDistricts && districtGeo?.map((g, i) => (
            <GeoJSON key={i} data={g} style={{ color: 'var(--accent)', weight: 1.5, fillOpacity: 0.05, dashArray: '4 3' }}
              onEachFeature={(f, layer) => layer.bindTooltip(String(f.properties?.name ?? ''), { sticky: true })} />
          ))}
          {route && <Polyline positions={route.coordinates} pathOptions={{ color: '#eb6834', weight: 5, opacity: 0.9 }} />}
          {home && <Marker position={[home.lat, home.lng]} icon={homeIcon} zIndexOffset={1000} />}
          {list.map((s) => {
            const r = scores.get(s.id);
            return (
              <Marker key={s.id} position={[s.lat!, s.lng!]} icon={pinFor(s, r?.score ?? null, r?.letter ?? null, selectedId === s.id)}
                eventHandlers={{ click: () => select(s) }} zIndexOffset={selectedId === s.id ? 900 : 0}>
                <Popup>
                  <SchoolPopup s={s} />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Map overlays */}
        <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
          <button className={clsx('btn shadow-md', showDistricts && 'btn-primary')} onClick={() => setShowDistricts((v) => !v)} title="Show school districts (København & Frederiksberg)">
            <Layers size={16} /> Districts
          </button>
        </div>
        <div className="card absolute bottom-4 left-3 z-[500] hidden p-3 text-xs shadow-md sm:block">
          <div className="mb-1.5 font-semibold text-ink-2">Skolescore</div>
          {[['A', 80], ['B', 60], ['C', 40], ['D', 20], ['n/a', null]].map(([l, v]) => (
            <div key={String(l)} className="flex items-center gap-2 py-0.5">
              <span className="h-3 w-3 rounded-full" style={v === null ? { border: '2px solid var(--ink-3)', background: 'var(--surface)' } : { background: scoreColor(v as number) }} /> {l === 'n/a' ? 'No score (not enough data)' : l === 'D' ? 'D / E tier' : `${l} tier`}
            </div>
          ))}
          <div className="mt-1.5 flex items-center gap-2 text-ink-3"><span className="h-3 w-3 rounded-full border border-ink-3" /> public · <span className="h-3 w-3 rounded-[3px] border border-ink-3" /> private</div>
        </div>

        {selected && (
          <div className="card absolute bottom-4 right-3 z-[500] w-[min(360px,calc(100%-24px))] p-4 shadow-xl">
            <button className="absolute right-3 top-3 text-ink-3 hover:text-ink" onClick={() => select(null)} aria-label="Close"><X size={16} /></button>
            <div className="flex items-start gap-3 pr-6">
              <ScoreBadge result={scores.get(selected.id)} size="md" showNumber={false} />
              <div className="min-w-0">
                <div className="font-semibold">{shortName(selected.name)}</div>
                <div className="text-xs text-ink-3">{typeLabel(selected)} · {selected.address}, {selected.city}</div>
              </div>
            </div>
            {home ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <RouteIcon size={16} className="text-[var(--series-2)]" />
                {routeLoading ? <span className="text-ink-3">Calculating route…</span> : route ? (
                  <span><b className="tabular">{fmtDuration(route.duration)}</b> by {MODES.find((m) => m.id === mode)?.label.toLowerCase()} · {fmtDistance(route.distance)}</span>
                ) : <span className="text-ink-3">No route found</span>}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-3">Enter your address to calculate the route.</p>
            )}
            <div className="mt-3 flex gap-2">
              <Link to={`/school/${selected.id}`} className="btn btn-primary flex-1 justify-center text-sm">Open school</Link>
              <button className="btn px-3" onClick={() => toggleShortlist(selected.id)} aria-label="Toggle shortlist">
                <Star size={16} fill={shortlist.includes(selected.id) ? 'currentColor' : 'none'} />
              </button>
              {home && selected.lat && (
                <a className="btn px-3 text-sm" target="_blank" rel="noreferrer" title="Open in Google Maps (public transport)"
                  href={`https://www.google.com/maps/dir/?api=1&origin=${home.lat},${home.lng}&destination=${selected.lat},${selected.lng}&travelmode=transit`}>Transit ↗</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolPopup({ s }: { s: School }) {
  return (
    <div className="w-56 text-sm">
      <div className="font-semibold">{shortName(s.name)}</div>
      <div className="mb-2 text-xs text-ink-3">{typeLabel(s)}</div>
      <div className="grid grid-cols-3 gap-1 text-center text-xs">
        <div><div className="text-ink-3">Exams</div><b className="tabular">{fmt(s.indicators.grade, 1)}</b></div>
        <div><div className="text-ink-3">Value add.</div><b className="tabular">{fmtSigned(s.indicators.valueAdded, 1)}</b></div>
        <div><div className="text-ink-3">Pupils</div><b className="tabular">{s.latest.pupils ?? '—'}</b></div>
      </div>
    </div>
  );
}
