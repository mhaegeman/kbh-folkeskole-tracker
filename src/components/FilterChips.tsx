import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';
import { DEFAULT_FILTERS, useStore, type Filters } from '../lib/store';
import { Popover } from './Popover';
import { PriorityPicker, activePreset } from './PriorityPicker';

const TYPES: { id: Filters['types'][number]; label: string }[] = [
  { id: 'folkeskole', label: 'Folkeskole' },
  { id: 'private', label: 'Private / friskole' },
  { id: 'international', label: 'International' },
];
const LANGS = [{ id: 'en', label: 'English' }, { id: 'fr', label: 'French' }, { id: 'de', label: 'German' }];
const DISTANCES = [1, 2, 4, 8, 15];
const FEES: { v: number | null; label: string }[] = [
  { v: null, label: 'Any fee' }, { v: 0, label: 'Free only' }, { v: 1500, label: 'Up to 1,500 kr' }, { v: 2500, label: 'Up to 2,500 kr' }, { v: 4000, label: 'Up to 4,000 kr' },
];

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={clsx('flex min-h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-[15px] transition',
        on ? 'border-2 border-accent bg-accent-soft font-bold' : 'border border-border hover:border-border-strong')}>
      {children}
      <span className={clsx('h-5 w-5 rounded-full border-2', on ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_var(--surface)]' : 'border-border-strong')} aria-hidden="true" />
    </button>
  );
}

export function FilterChips({ compactSearch = false }: { compactSearch?: boolean }) {
  const { filters, setFilters, home, filtered, weights, data, schools, shortlist } = useStore();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleIn = <K extends 'types' | 'languages' | 'municipalities'>(k: K, v: string) =>
    setFilters((f) => {
      const arr = f[k] as string[];
      return { ...f, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });
  const preset = activePreset(weights);
  const showN = (close: () => void) => (
    <button type="button" className="btn btn-primary w-full text-[15px]" onClick={close}>Show {filtered.length} schools</button>
  );
  const moreCount = [filters.municipalities.length > 0, filters.minGrade !== null, filters.minScore !== null, filters.maxBullied !== null, filters.onlyShortlist, filters.includeSpecial].filter(Boolean).length;
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const typeLabel = filters.types.length === 0 ? 'All school types' : filters.types.length === 1 ? TYPES.find((t) => t.id === filters.types[0])!.label : `${filters.types.length} types`;
  const langLabel = filters.languages.length === 0 ? 'Language' : filters.languages.map((l) => LANGS.find((x) => x.id === l)?.label).join(', ');
  const feeLabel = FEES.find((f) => f.v === filters.maxMonthlyFee)?.label ?? (filters.maxMonthlyFee !== null ? `Up to ${filters.maxMonthlyFee.toLocaleString('da-DK')} kr` : 'Any fee');
  const distLabel = home && filters.maxDistanceKm !== null ? `Within ${filters.maxDistanceKm.toLocaleString('da-DK')} km` : 'Any distance';

  return (
    <div className="flex items-center gap-2 max-sm:no-scrollbar max-sm:overflow-x-auto sm:flex-wrap">
      <label className={clsx('relative flex shrink-0 items-center', compactSearch ? 'w-40' : 'w-44 xl:w-52')}>
        <Search size={16} className="pointer-events-none absolute left-3.5 text-ink-3" aria-hidden="true" />
        <span className="sr-only">Search schools</span>
        <input type="search" value={filters.query} onChange={(e) => set('query', e.target.value)} placeholder="Search schools"
          className="h-10 w-full rounded-full border border-border-strong bg-surface pl-10 pr-3 text-sm outline-none focus:border-accent" />
      </label>

      <Popover title="What matters to you?" label={<>Priority: {preset?.label ?? 'Custom'}</>} active width={460} footer={showN}>
        {() => <PriorityPicker />}
      </Popover>

      <Popover title="Distance from home" label={distLabel} active={!!home && filters.maxDistanceKm !== null} footer={showN}>
        {() => home ? (
          <div className="space-y-2">
            <p className="pb-1 text-sm text-ink-2">Straight-line distance from {home.label.split(',')[0]}.</p>
            {DISTANCES.map((d) => <Option key={d} on={filters.maxDistanceKm === d} onClick={() => set('maxDistanceKm', d)}>Within {d} km</Option>)}
            <Option on={filters.maxDistanceKm === null} onClick={() => set('maxDistanceKm', null)}>Any distance</Option>
          </div>
        ) : (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">Add your address in the search bar at the top to filter by distance and see travel times and your district school.</p>
        )}
      </Popover>

      <Popover title="School type" label={typeLabel} active={filters.types.length > 0} footer={showN}>
        {() => (
          <div className="space-y-2">
            {TYPES.map((t) => <Option key={t.id} on={filters.types.includes(t.id)} onClick={() => toggleIn('types', t.id)}>{t.label}</Option>)}
            {filters.types.length > 0 && <button type="button" className="min-h-10 text-sm font-bold text-accent" onClick={() => set('types', [])}>Show all types</button>}
          </div>
        )}
      </Popover>

      <Popover title="Monthly fee" label={feeLabel} active={filters.maxMonthlyFee !== null} footer={showN}>
        {() => (
          <div className="space-y-2">
            {FEES.map((f) => <Option key={String(f.v)} on={filters.maxMonthlyFee === f.v} onClick={() => set('maxMonthlyFee', f.v)}>{f.label}</Option>)}
            <p className="pt-1 text-xs text-ink-3">Folkeskoler are free. Fees exclude SFO (after-school care).</p>
          </div>
        )}
      </Popover>

      <Popover title="Teaching language" label={langLabel} active={filters.languages.length > 0} footer={showN}>
        {() => (
          <div className="space-y-2">
            {LANGS.map((l) => <Option key={l.id} on={filters.languages.includes(l.id)} onClick={() => toggleIn('languages', l.id)}>{l.label}</Option>)}
            <p className="pt-1 text-xs text-ink-3">Schools that teach some or all subjects in this language.</p>
          </div>
        )}
      </Popover>

      <Popover title="More filters" label={<>More filters{moreCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-highlight px-1 text-xs font-bold text-highlight-ink">{moreCount}</span>}</>}
        active={false} width={400} align="right" footer={showN}>
        {() => (
          <div className="space-y-6">
            <Range label="Minimum Skolescore" value={filters.minScore} min={0} max={95} step={5} show={(v) => `${v}+`} onChange={(v) => set('minScore', v)} />
            <Range label="Minimum exam average" value={filters.minGrade} min={4} max={10} step={0.1} show={(v) => `${v.toLocaleString('da-DK', { minimumFractionDigits: 1 })}+`} onChange={(v) => set('minGrade', v)} />
            <Range label="At most % bullied (grades 4–9)" value={filters.maxBullied} min={3} max={25} step={1} show={(v) => `${v}% or less`} onChange={(v) => set('maxBullied', v)} />
            <div>
              <h3 className="eyebrow mb-2">Municipality</h3>
              <div className="flex flex-wrap gap-2">
                {data?.municipalities.map((m) => (
                  <button key={m} type="button" className="chip chip-sm" aria-pressed={filters.municipalities.includes(m)} onClick={() => toggleIn('municipalities', m)}>
                    {m} <span className="opacity-70">{schools.filter((s) => s.municipality === m && !s.special && !s.tenthGradeOnly).length}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-[15px]">
              <input type="checkbox" className="h-5 w-5" checked={filters.onlyShortlist} onChange={(e) => set('onlyShortlist', e.target.checked)} />
              Only my shortlist ({shortlist.length})
            </label>
            <label className="flex min-h-11 items-center gap-3 text-[15px]">
              <input type="checkbox" className="h-5 w-5" checked={filters.includeSpecial} onChange={(e) => set('includeSpecial', e.target.checked)} />
              Include special-needs units and 10th-grade centres
            </label>
          </div>
        )}
      </Popover>

      {dirty && (
        <button type="button" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-soft"
          onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
          <X size={15} /> Clear
        </button>
      )}
    </div>
  );
}

function Range({ label, value, min, max, step, show, onChange }: {
  label: string; value: number | null; min: number; max: number; step: number; show: (v: number) => string; onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="eyebrow">{label}</h3>
        {value !== null
          ? <button type="button" className="inline-flex min-h-8 items-center gap-1 text-sm font-bold text-accent" onClick={() => onChange(null)}>{show(value)} <X size={13} /></button>
          : <span className="text-sm text-ink-3">Any</span>}
      </div>
      <input type="range" className="mt-2 w-full" min={min} max={max} step={step} value={value ?? (label.startsWith('At most') ? max : min)} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
