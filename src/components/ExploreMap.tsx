import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GeoJSON, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike, Car, Footprints, Layers, Route as RouteIcon, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { scoreColor, type ScoreResult } from '../lib/score';
import { route as fetchRoute, type Route, type TravelMode } from '../lib/geo';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, shortName, typeLabel } from '../lib/format';
import type { School } from '../lib/types';
import { ScoreBadge, scoreTextColor } from './ScoreBadge';

const CPH: [number, number] = [55.686, 12.53];

export const MODES: { id: TravelMode; label: string; icon: typeof Bike }[] = [
  { id: 'foot', label: 'Walk', icon: Footprints },
  { id: 'bike', label: 'Bike', icon: Bike },
  { id: 'car', label: 'Car', icon: Car },
];

function pinFor(s: School, r: ScoreResult | undefined, selected: boolean, hovered: boolean) {
  const score = r?.score ?? null;
  const cls = ['school-pin', s.isPrivate && 'is-private', selected && 'is-selected', hovered && !selected && 'is-hovered', score === null && 'is-empty'].filter(Boolean).join(' ');
  const size = score === null ? 18 : 32;
  return L.divIcon({
    className: '',
    html: score === null
      ? `<div class="${cls}" aria-label="${shortName(s.name)}, not rated"></div>`
      : `<div class="${cls}" style="background:${scoreColor(score)};color:${scoreTextColor(score)}">${r?.letter ?? ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const homeIcon = L.divIcon({ className: '', html: '<div class="home-pin">You</div>', iconSize: [40, 40], iconAnchor: [20, 20] });

const SchoolMarker = memo(function SchoolMarker({ s, r, selected, hovered, onSelect }: {
  s: School; r: ScoreResult | undefined; selected: boolean; hovered: boolean; onSelect: (s: School) => void;
}) {
  const icon = useMemo(() => pinFor(s, r, selected, hovered), [s, r, selected, hovered]);
  return (
    <Marker position={[s.lat!, s.lng!]} icon={icon} title={shortName(s.name)} keyboard
      zIndexOffset={selected ? 1000 : hovered ? 900 : 0} eventHandlers={{ click: () => onSelect(s) }} />
  );
});

function Focus({ target, zoom }: { target: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, Math.max(map.getZoom(), zoom), { duration: 0.6 }); }, [target, zoom, map]);
  return null;
}

function FitRoute({ route }: { route: Route | null }) {
  const map = useMap();
  useEffect(() => {
    if (route?.coordinates.length) map.flyToBounds(L.latLngBounds(route.coordinates), { padding: [80, 80], duration: 0.6, maxZoom: 15 });
  }, [route, map]);
  return null;
}

function useIsDark() {
  const get = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(get()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function ExploreMap({ list, selected, hoveredId, onSelect, focus }: {
  list: School[]; selected: School | null; hoveredId: string | null; onSelect: (s: School | null) => void; focus: [number, number] | null;
}) {
  const { scores, home, mode, setMode } = useStore();
  const dark = useIsDark();
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [districtGeo, setDistrictGeo] = useState<GeoJSON.FeatureCollection[] | null>(null);
  const [homeFocus, setHomeFocus] = useState<[number, number] | null>(null);

  useEffect(() => { if (home) setHomeFocus([home.lat, home.lng]); }, [home]);

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
    if (!showDistricts || districtGeo) return;
    Promise.all(['København', 'Frederiksberg'].map((m) =>
      fetch(`${import.meta.env.BASE_URL}data/districts_${m}.geojson`).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
      .then((g) => setDistrictGeo(g.filter(Boolean)));
  }, [showDistricts, districtGeo]);

  const pick = (s: School) => onSelect(s);
  const placed = list.filter((s) => s.lat && s.lng);

  return (
    <div className="relative h-full w-full overflow-hidden bg-map md:rounded-3xl md:border md:border-border">
      <MapContainer center={home ? [home.lat, home.lng] : CPH} zoom={home ? 14 : 12} zoomControl={false}
        className={clsx('h-full w-full', dark && 'dark-tiles')}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ZoomControl />
        <Focus target={homeFocus} zoom={14} />
        <Focus target={focus} zoom={14} />
        <FitRoute route={route} />
        {showDistricts && districtGeo?.map((g, i) => (
          <GeoJSON key={i} data={g} style={{ color: 'var(--accent)', weight: 1.5, fillOpacity: 0.06, dashArray: '4 3' }}
            onEachFeature={(f, layer) => layer.bindTooltip(String(f.properties?.name ?? ''), { sticky: true })} />
        ))}
        {route && <Polyline positions={route.coordinates} pathOptions={{ color: 'var(--highlight)', weight: 5, opacity: 0.95 }} />}
        {placed.map((s) => (
          <SchoolMarker key={s.id} s={s} r={scores.get(s.id)} selected={selected?.id === s.id} hovered={hoveredId === s.id} onSelect={pick} />
        ))}
        {home && <Marker position={[home.lat, home.lng]} icon={homeIcon} zIndexOffset={1100} title="Your address" />}
      </MapContainer>

      {selected && (
        <div className="absolute left-4 top-4 z-[500] hidden w-[340px] max-w-[calc(100%-32px)] md:block">
          <SelectedSchoolCard s={selected} route={route} routeLoading={routeLoading} onClose={() => onSelect(null)} />
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-[500] hidden flex-wrap items-center gap-2 md:flex">
        {home && (
          <div role="group" aria-label="Travel mode" className="flex rounded-full bg-surface p-1 shadow-[var(--shadow-chip)]">
            {MODES.map((m) => (
              <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}
                className={clsx('flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold', mode === m.id ? 'bg-ink text-surface' : 'text-ink-2 hover:text-ink')}>
                <m.icon size={15} aria-hidden="true" /> {m.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" aria-pressed={showDistricts} onClick={() => setShowDistricts((v) => !v)}
          className={clsx('flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[var(--shadow-chip)]', showDistricts ? 'bg-accent text-accent-ink' : 'bg-surface text-ink')}>
          <Layers size={16} aria-hidden="true" /> School districts
        </button>
      </div>
      <button type="button" aria-pressed={showDistricts} onClick={() => setShowDistricts((v) => !v)} aria-label="Show school districts"
        className={clsx('absolute right-3 top-3 z-[500] grid h-11 w-11 place-items-center rounded-full shadow-[var(--shadow-chip)] md:hidden', showDistricts ? 'bg-accent text-accent-ink' : 'bg-surface text-ink')}>
        <Layers size={18} />
      </button>
    </div>
  );
}

function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    if (!matchMedia('(min-width: 768px)').matches) return;
    const z = L.control.zoom({ position: 'bottomright' });
    z.addTo(map);
    return () => { z.remove(); };
  }, [map]);
  return null;
}

/** The card for the school picked on the map (overlay on desktop, top of the sheet on phones). */
export function SelectedSchoolCard({ s, route, routeLoading, onClose }: { s: School; route?: Route | null; routeLoading?: boolean; onClose: () => void }) {
  const { scores, shortlist, toggleShortlist, home, mode, travel, distanceTo } = useStore();
  const r = scores.get(s.id);
  const on = shortlist.includes(s.id);
  const bullied = s.climate?.find((c) => c.key === 'bullied')?.value ?? null;
  const stats: [string, string][] = [
    ['Exams', fmt(s.indicators.grade, 1)],
    s.indicators.wellbeing !== null ? ['Wellbeing', `${fmt(s.indicators.wellbeing, 2)}`] : ['Value added', fmtSigned(s.indicators.valueAdded, 1)],
    bullied !== null ? ['Bullied', fmt(bullied, 0, '%')] : ['Class size', fmt(s.indicators.classSize, 1)],
  ];
  const t = travel.get(s.id);
  const dist = route?.distance ?? t?.distance ?? distanceTo(s);
  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-float)] sm:p-5">
      <div className="flex items-start gap-3">
        <ScoreBadge result={r} size="md" />
        <div className="min-w-0 flex-1">
          <Link to={`/school/${s.id}`} className="block text-[17px] font-extrabold leading-snug hover:text-accent">{shortName(s.name)}</Link>
          <div className="text-[13px] text-ink-2">{typeLabel(s)} · {s.municipality}{dist !== null ? ` · ${fmtDistance(dist)}` : ''}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2"><X size={18} /></button>
      </div>
      <dl className="mt-3.5 grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 px-3 py-2">
            <dt className="text-xs text-ink-2">{k}</dt>
            <dd className="text-base font-extrabold tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[13px] text-ink-2">
        {s.isPrivate ? (s.fees.monthly != null ? `${fmtDKK(s.fees.monthly)} / month` : 'Fee not published') : 'Free school'}
        {s.fees.sfoMonthly != null && ` · SFO ${fmtDKK(s.fees.sfoMonthly)} / month`}
      </p>
      {home && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-highlight-soft px-3 py-2 text-[13px]">
          <RouteIcon size={15} className="shrink-0 text-highlight" aria-hidden="true" />
          {routeLoading ? <span className="text-ink-2">Finding the route…</span> : route ? (
            <span><b className="tabular">{fmtDuration(route.duration)}</b> by {MODES.find((m) => m.id === mode)?.label.toLowerCase()} · {fmtDistance(route.distance)}</span>
          ) : t?.duration != null ? (
            <span><b className="tabular">{fmtDuration(t.duration)}</b> by {MODES.find((m) => m.id === mode)?.label.toLowerCase()}</span>
          ) : <span className="text-ink-2">No route found</span>}
        </div>
      )}
      <div className="mt-3.5 flex gap-2">
        <Link to={`/school/${s.id}`} className="btn btn-primary flex-1">View school</Link>
        <button type="button" className={clsx('btn btn-icon', on && 'border-highlight text-highlight')} onClick={() => toggleShortlist(s.id)}
          aria-pressed={on} aria-label={on ? 'Remove from shortlist' : 'Add to shortlist'}>
          <Star size={18} fill={on ? 'currentColor' : 'none'} />
        </button>
        {home && s.lat && (
          <a className="btn px-3 text-sm" target="_blank" rel="noreferrer" title="Public transport route in Google Maps"
            href={`https://www.google.com/maps/dir/?api=1&origin=${home.lat},${home.lng}&destination=${s.lat},${s.lng}&travelmode=transit`}>Transit ↗</a>
        )}
      </div>
    </div>
  );
}
