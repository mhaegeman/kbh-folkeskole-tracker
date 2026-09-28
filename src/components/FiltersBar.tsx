import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Star, X } from 'lucide-react';
import { DEFAULT_FILTERS, useStore, type Filters } from '../lib/store';

const TYPES: { id: Filters['types'][number]; label: string }[] = [
  { id: 'folkeskole', label: 'Folkeskole' },
  { id: 'private', label: 'Private / friskole' },
  { id: 'international', label: 'International' },
];

const LANGS = [
  { id: 'fr', label: 'French' },
  { id: 'en', label: 'English' },
  { id: 'de', label: 'German' },
];

function MunicipalityPicker() {
  const { data, filters, setFilters } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const sel = filters.municipalities;
  const toggle = (m: string) =>
    setFilters((f) => ({ ...f, municipalities: sel.includes(m) ? sel.filter((x) => x !== m) : [...sel, m] }));
  return (
    <div className="relative" ref={ref}>
      <button className="chip" aria-pressed={sel.length > 0} onClick={() => setOpen((o) => !o)}>
        {sel.length === 0 ? 'All municipalities' : sel.length === 1 ? sel[0] : `${sel.length} municipalities`}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="card absolute z-[1000] mt-2 max-h-80 w-64 overflow-auto p-2 shadow-xl scrollbar-thin">
          <button className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink-3 hover:bg-surface-2"
            onClick={() => setFilters((f) => ({ ...f, municipalities: [] }))}>Clear selection</button>
          {data?.municipalities.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
              <input type="checkbox" checked={sel.includes(m)} onChange={() => toggle(m)} className="accent-[var(--accent)]" />
              {m}
              <span className="ml-auto text-xs text-ink-3">{data.schools.filter((s) => s.municipality === m && !s.special && !s.tenthGradeOnly).length}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function FiltersBar({ showDistance = true }: { showDistance?: boolean }) {
  const { filters, setFilters, home, shortlist } = useStore();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleIn = <K extends 'types' | 'languages'>(k: K, v: Filters[K][number]) =>
    setFilters((f) => {
      const arr = f[k] as string[];
      return { ...f, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });
  const dirty = JSON.stringify({ ...filters, query: '' }) !== JSON.stringify({ ...DEFAULT_FILTERS, query: '' }) || filters.query;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          className="input pl-9"
          placeholder="Search school, street, postcode or area…"
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MunicipalityPicker />
        {TYPES.map((t) => (
          <button key={t.id} className="chip" aria-pressed={filters.types.includes(t.id)} onClick={() => toggleIn('types', t.id)}>
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {LANGS.map((l) => (
          <button key={l.id} className="chip" aria-pressed={filters.languages.includes(l.id)} onClick={() => toggleIn('languages', l.id)}>
            {l.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <button className="chip" aria-pressed={filters.onlyShortlist} onClick={() => set('onlyShortlist', !filters.onlyShortlist)}>
          <Star size={13} /> Shortlist ({shortlist.length})
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RangeFilter label="Max monthly fee" value={filters.maxMonthlyFee} min={0} max={12000} step={250}
          display={(v) => (v === 0 ? 'Free only' : `≤ ${v.toLocaleString('da-DK')} kr.`)}
          onChange={(v) => set('maxMonthlyFee', v)} />
        <RangeFilter label="Min exam average" value={filters.minGrade} min={4} max={10} step={0.1}
          display={(v) => `≥ ${v.toLocaleString('da-DK', { minimumFractionDigits: 1 })}`}
          onChange={(v) => set('minGrade', v)} />
        <RangeFilter label="Min Skolescore" value={filters.minScore} min={0} max={95} step={5}
          display={(v) => `≥ ${v}`} onChange={(v) => set('minScore', v)} />
        {showDistance && (
          <RangeFilter label={home ? 'Max distance from home' : 'Distance (set a home address)'} value={home ? filters.maxDistanceKm : null}
            min={0.5} max={25} step={0.5} disabled={!home}
            display={(v) => `≤ ${v.toLocaleString('da-DK')} km`} onChange={(v) => set('maxDistanceKm', v)} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.includeSpecial} onChange={(e) => set('includeSpecial', e.target.checked)} className="accent-[var(--accent)]" />
          Include special-needs units and 10th-grade centres
        </label>
        {dirty && (
          <button className="ml-auto inline-flex items-center gap-1 text-accent hover:underline" onClick={() => setFilters(DEFAULT_FILTERS)}>
            <X size={14} /> Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}

function RangeFilter({ label, value, min, max, step, display, onChange, disabled }: {
  label: string; value: number | null; min: number; max: number; step: number;
  display: (v: number) => string; onChange: (v: number | null) => void; disabled?: boolean;
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-2">{label}</span>
        {value !== null ? (
          <button className="inline-flex items-center gap-1 text-accent" onClick={() => onChange(null)}>
            {display(value)} <X size={12} />
          </button>
        ) : (
          <span className="text-ink-3">Any</span>
        )}
      </div>
      <input
        type="range" className="w-full" min={min} max={max} step={step} disabled={disabled}
        value={value ?? max} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
