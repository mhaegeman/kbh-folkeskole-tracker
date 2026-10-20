import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronUp, Landmark, List, Loader2, Map as MapIcon, Table2 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { districtMatches, lookupDistrict } from '../lib/geo';
import { shortName } from '../lib/format';
import type { School } from '../lib/types';
import { FilterChips } from '../components/FilterChips';
import { activePreset } from '../components/PriorityPicker';
import { ExploreMap, SelectedSchoolCard } from '../components/ExploreMap';
import { SchoolListCard } from '../components/SchoolListCard';
import { RankingTable } from '../components/RankingTable';
import { ScatterInsight } from '../components/ScatterInsight';

type SortBy = 'score' | 'distance' | 'grade' | 'fee';
type Sheet = 'peek' | 'half' | 'full';

const isPhone = () => !matchMedia('(min-width: 768px)').matches;
const PEEK_PX = 148;
const HALF = 0.45;

export default function Explore() {
  const { filtered, filters, scores, home, travel, travelLoading, distanceTo, byId, weights, schools } = useStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = params.get('view') === 'table' ? 'table' : 'map';
  const selectedId = params.get('school');
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [sheet, setSheet] = useState<Sheet>('half');
  const [districts, setDistricts] = useState<string[]>([]);
  // Phone bottom sheet: drag the handle/header to resize, release to snap.
  const areaRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const justDragged = useRef(false);
  const [dragH, setDragH] = useState<number | null>(null);
  const preset = activePreset(weights);

  // Deep link (#/?school=…): centre the map on that school once.
  useEffect(() => {
    if (selected?.lat && selected.lng) setFocus([selected.lat, selected.lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!home) { setDistricts([]); return; }
    const ctrl = new AbortController();
    lookupDistrict(home, ctrl.signal).then(setDistricts);
    return () => ctrl.abort();
  }, [home]);

  const districtIds = useMemo(
    () => new Set(schools.filter((s) => s.category === 'folkeskole' && districts.some((d) => districtMatches(d, s.name))).map((s) => s.id)),
    [schools, districts],
  );

  const list = useMemo(() => {
    const dist = (s: School) => travel.get(s.id)?.duration ?? (distanceTo(s) ?? 1e9) / 4;
    const key: Record<SortBy, (s: School) => number> = {
      score: (s) => -(scores.get(s.id)?.score ?? -1),
      distance: dist,
      grade: (s) => -(s.indicators.grade ?? -1),
      fee: (s) => (s.isPrivate ? s.fees.monthly ?? 1e9 : 0),
    };
    return [...filtered].sort((a, b) => key[sortBy](a) - key[sortBy](b) || key.score(a) - key.score(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, scores, sortBy, travel, home]);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const select = useCallback((s: School | null) => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (s) next.set('school', s.id); else next.delete('school');
      return next;
    }, { replace: true });
    if (s && isPhone()) setSheet((v) => (v === 'peek' ? 'half' : v));
  }, [setParams]);

  // From the list: on a phone, open the school; on desktop, show it on the map.
  const pickFromList = (s: School) => {
    if (isPhone()) { navigate(`/school/${s.id}`); return; }
    select(s);
    if (s.lat && s.lng) setFocus([s.lat, s.lng]);
  };

  const districtSchool = list.find((s) => districtIds.has(s.id)) ?? null;
  const heading = home && filters.maxDistanceKm !== null
    ? `${list.length} schools within ${filters.maxDistanceKm.toLocaleString('da-DK')} km`
    : `${list.length} ${list.length === 1 ? 'school' : 'schools'}`;

  const toolbar = (
    <div className="flex flex-col gap-2.5 px-3 pb-3 pt-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <FilterChips />
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <div role="group" aria-label="View" className="flex rounded-full border border-border-strong bg-surface p-0.5">
          <button type="button" aria-pressed={view === 'map'} onClick={() => setParam('view', null)}
            className={clsx('flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold', view === 'map' ? 'bg-ink text-surface' : 'text-ink-2')}><MapIcon size={15} /> Map</button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setParam('view', 'table')}
            className={clsx('flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold', view === 'table' ? 'bg-ink text-surface' : 'text-ink-2')}><Table2 size={15} /> Table</button>
        </div>
      </div>
    </div>
  );

  if (view === 'table') {
    return (
      <div className="mx-auto max-w-[1600px]">
        {toolbar}
        <div className="space-y-5 px-3 pb-10 sm:px-6">
          <RankingTable />
          <ScatterInsight schools={filtered} />
        </div>
      </div>
    );
  }

  const sheetH = { peek: 'max-md:h-[148px]', half: 'max-md:h-[45%]', full: 'max-md:h-[calc(100%-12px)]' }[sheet];

  // Track the drag on window so it keeps following the finger once it leaves the handle.
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPhone() || !sheetRef.current || !e.isPrimary) return;
    const startY = e.clientY;
    const startH = sheetRef.current.offsetHeight;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const area = areaRef.current?.clientHeight ?? 0;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dy) < 6) return;
      moved = true;
      setDragH(Math.min(area - 12, Math.max(96, startH - dy)));
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!moved) return;
      // Swallow the click that follows the drag so the handle/List button don't also toggle.
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      const area = areaRef.current?.clientHeight ?? 0;
      const h = sheetRef.current?.offsetHeight ?? 0;
      const snaps: [Sheet, number][] = [['peek', PEEK_PX], ['half', area * HALF], ['full', area - 12]];
      setSheet(snaps.reduce((a, b) => (Math.abs(b[1] - h) < Math.abs(a[1] - h) ? b : a))[0]);
      setDragH(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--header-h)-var(--tabbar-h))] max-w-[1600px] flex-col">
      {toolbar}
      <div ref={areaRef} className="relative min-h-0 flex-1 md:flex md:gap-4 md:px-6 md:pb-5">
        <section ref={sheetRef} aria-label="Schools" style={dragH !== null ? { height: dragH } : undefined}
          className={clsx('z-[700] flex flex-col bg-surface max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-3xl max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.14)]',
            dragH === null && 'max-md:transition-[height]', sheetH, 'md:w-[440px] md:shrink-0 md:bg-transparent lg:w-[480px]')}>
          <div className="shrink-0 max-md:touch-none max-md:select-none" onPointerDown={onDragStart}
            onClickCapture={(e) => { if (justDragged.current) { e.stopPropagation(); e.preventDefault(); } }}>
          <button type="button" className="grid h-8 w-full shrink-0 cursor-grab place-items-center md:hidden" onClick={() => setSheet((v) => (v === 'half' ? 'peek' : 'half'))}
            aria-label={sheet === 'half' ? 'Collapse list' : 'Expand list'}>
            <span className="h-1.5 w-10 rounded-full bg-border-strong" />
          </button>
          <div className="flex shrink-0 items-end justify-between gap-3 px-4 pb-2 md:px-1 md:pb-3">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight md:text-[26px] md:leading-8">{heading}</h1>
              <p className="text-[13px] text-ink-2">
                {sortBy === 'score' ? <>Best match first · {preset?.label ?? 'Custom'} priority</> : sortBy === 'distance' ? 'Closest first' : sortBy === 'grade' ? 'Highest exam average first' : 'Lowest fee first'}
                {travelLoading && <Loader2 size={12} className="ml-1.5 inline animate-spin" aria-label="Loading travel times" />}
              </p>
            </div>
            <div className="hidden md:block">
        <label className="sr-only" htmlFor="sort">Sort schools</label>
              <select id="sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="h-10 max-w-[11rem] rounded-full border border-border-strong bg-surface px-3 text-sm font-semibold">
                <option value="score">Best match first</option>
                <option value="distance" disabled={!home}>Closest first{home ? '' : ' (add address)'}</option>
                <option value="grade">Highest exam average</option>
                <option value="fee">Lowest fee</option>
              </select>
            </div>
            <button type="button" className="flex h-10 items-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-semibold md:hidden"
              onClick={() => setSheet((v) => (v === 'full' ? 'peek' : 'full'))}>
              {sheet === 'full' ? <><MapIcon size={15} /> Map</> : <><List size={15} /> List</>}
            </button>
          </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-auto px-3 pb-6 scrollbar-thin md:px-0 md:pr-1">
            {selected && (
              <div className="md:hidden"><SelectedSchoolCard s={selected} onClose={() => select(null)} /></div>
            )}
            {home && districtSchool && (
              <button type="button" onClick={() => pickFromList(districtSchool)}
                className="flex w-full items-center gap-3 rounded-[20px] bg-accent-soft px-4 py-3 text-left">
                <Landmark size={20} className="shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 text-sm">
                  <span className="block font-bold text-accent">Your district school</span>
                  <span className="block truncate text-ink">{shortName(districtSchool.name)} · guaranteed place</span>
                </span>
              </button>
            )}
            {!home && (
              <p className="rounded-[20px] border border-dashed border-border-strong px-4 py-3 text-sm text-ink-2">
                Add your address at the top to see travel times, distances and your district school.
              </p>
            )}
            {list.map((s) => (
              <SchoolListCard key={s.id} s={s} selected={selectedId === s.id} isDistrict={districtIds.has(s.id)} onSelect={pickFromList} onHover={setHoveredId} />
            ))}
            {list.length === 0 && <p className="p-8 text-center text-ink-2">No schools match these filters.</p>}
            {sheet === 'full' && (
              <button type="button" className="btn mx-auto flex md:hidden" onClick={() => setSheet('peek')}><ChevronUp size={16} className="rotate-180" /> Back to map</button>
            )}
          </div>
        </section>

        <div className="absolute inset-0 isolate md:static md:min-w-0 md:flex-1">
          <ExploreMap list={list} selected={selected} hoveredId={hoveredId} onSelect={select} focus={focus} />
        </div>
      </div>
    </div>
  );
}
