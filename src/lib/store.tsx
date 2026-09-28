import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Dataset, School } from './types';
import { computeScores, DEFAULT_WEIGHTS, type ScoreResult, type Weights } from './score';
import { haversine, travelTable, type AddressHit, type TravelMode } from './geo';

export interface Filters {
  query: string;
  municipalities: string[];
  types: ('folkeskole' | 'private' | 'international')[];
  languages: string[];
  maxMonthlyFee: number | null;
  minGrade: number | null;
  minScore: number | null;
  maxDistanceKm: number | null;
  onlyShortlist: boolean;
  includeSpecial: boolean;
  teachesFrench: boolean;
  maxBullied: number | null;
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  municipalities: [],
  types: [],
  languages: [],
  maxMonthlyFee: null,
  minGrade: null,
  minScore: null,
  maxDistanceKm: null,
  onlyShortlist: false,
  includeSpecial: false,
  teachesFrench: false,
  maxBullied: null,
};

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...(initial as object), ...JSON.parse(raw) } as T : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}

function usePersistedRaw<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}

interface Store {
  data: Dataset | null;
  error: string | null;
  schools: School[];
  byId: Map<string, School>;
  scores: Map<string, ScoreResult>;
  weights: Weights;
  setWeights: (w: Weights) => void;
  filters: Filters;
  setFilters: (f: Filters | ((f: Filters) => Filters)) => void;
  filtered: School[];
  shortlist: string[];
  toggleShortlist: (id: string) => void;
  home: AddressHit | null;
  setHome: (h: AddressHit | null) => void;
  mode: TravelMode;
  setMode: (m: TravelMode) => void;
  travel: Map<string, { duration: number | null; distance: number | null }>;
  travelLoading: boolean;
  distanceTo: (s: School) => number | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = usePersisted<Weights>('kbh.weights', DEFAULT_WEIGHTS);
  const [filters, setFilters] = usePersisted<Filters>('kbh.filters', DEFAULT_FILTERS);
  const [shortlist, setShortlist] = usePersistedRaw<string[]>('kbh.shortlist', []);
  const [home, setHome] = usePersistedRaw<AddressHit | null>('kbh.home', null);
  const [mode, setMode] = usePersistedRaw<TravelMode>('kbh.mode', 'bike');
  const [travel, setTravel] = useState(new Map<string, { duration: number | null; distance: number | null }>());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/schools.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const schools = useMemo(() => data?.schools ?? [], [data]);

  // Travel times from home to every school, recomputed when home or mode changes.
  const [travelLoading, setTravelLoading] = useState(false);
  useEffect(() => {
    if (!home || !schools.length) { setTravel(new Map()); return; }
    const ctrl = new AbortController();
    setTravelLoading(true);
    const targets = schools.filter((s) => s.lat && s.lng).map((s) => ({ id: s.id, lat: s.lat!, lng: s.lng! }));
    // Debounce so StrictMode's double-invoke / quick mode switches don't fire duplicate requests.
    const t = setTimeout(() => {
      travelTable(home, targets, mode, ctrl.signal, setTravel)
        .then(setTravel)
        .catch(() => { /* aborted or offline: keep straight-line distances */ })
        .finally(() => { if (!ctrl.signal.aborted) setTravelLoading(false); });
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [home, mode, schools]);

  const byId = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  // Scores are computed over mainstream schools only, so special units do not skew percentiles.
  const scores = useMemo(
    () => computeScores(schools.filter((s) => !s.special && !s.tenthGradeOnly), weights),
    [schools, weights],
  );

  const distanceTo = (s: School) =>
    home && s.lat && s.lng ? haversine(home, { lat: s.lat, lng: s.lng }) : null;

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return schools.filter((s) => {
      if (!filters.includeSpecial && (s.special || s.tenthGradeOnly)) return false;
      if (q && !`${s.name} ${s.address} ${s.city} ${s.municipality} ${s.postalCode}`.toLowerCase().includes(q)) return false;
      if (filters.municipalities.length && !filters.municipalities.includes(s.municipality)) return false;
      if (filters.types.length) {
        const t = s.isInternational ? 'international' : s.isPrivate ? 'private' : 'folkeskole';
        if (!filters.types.includes(t)) return false;
      }
      if (filters.languages.length && !filters.languages.some((l) => s.languages.includes(l))) return false;
      if (filters.maxMonthlyFee !== null && (s.fees.monthly ?? Infinity) > filters.maxMonthlyFee) return false;
      if (filters.minGrade !== null && (s.indicators.grade ?? -1) < filters.minGrade) return false;
      if (filters.minScore !== null && (scores.get(s.id)?.score ?? -1) < filters.minScore) return false;
      if (filters.onlyShortlist && !shortlist.includes(s.id)) return false;
      // French taught as a subject, or French as a language of instruction.
      if (filters.teachesFrench && !s.teachesFrench && !s.languages.includes('fr')) return false;
      if (filters.maxBullied !== null) {
        const b = s.climate?.find((c) => c.key === 'bullied');
        if (!b || b.value > filters.maxBullied) return false;
      }
      if (filters.maxDistanceKm !== null && home) {
        const d = distanceTo(s);
        if (d === null || d > filters.maxDistanceKm * 1000) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools, filters, scores, shortlist, home]);

  const toggleShortlist = (id: string) =>
    setShortlist((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const value: Store = {
    data, error, schools, byId, scores, weights, setWeights, filters, setFilters, filtered,
    shortlist, toggleShortlist, home, setHome, mode, setMode, travel, travelLoading, distanceTo,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
