import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, LayoutGrid, List, SlidersHorizontal, Star, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { FiltersBar } from '../components/FiltersBar';
import { WeightsPanel } from '../components/WeightsPanel';
import { ScoreBadge } from '../components/ScoreBadge';
import { Sparkline } from '../components/TrendChart';
import { ScatterInsight } from '../components/ScatterInsight';
import { LangTag } from '../components/LangTag';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, shortName, typeLabel } from '../lib/format';
import type { School } from '../lib/types';

type SortKey = 'score' | 'name' | 'grade' | 'valueAdded' | 'wellbeing' | 'absence' | 'classSize' | 'pupils' | 'fee' | 'distance';

const COLUMNS: { key: SortKey; label: string; title?: string; align?: 'right' }[] = [
  { key: 'score', label: 'Score' },
  { key: 'name', label: 'School' },
  { key: 'grade', label: 'Exams', title: '9th-grade exam average, 3-year mean', align: 'right' },
  { key: 'valueAdded', label: 'Value added', title: 'Grades vs. socio-economic expectation (3-year mean)', align: 'right' },
  { key: 'wellbeing', label: 'Wellbeing', title: 'General wellbeing, 1–5', align: 'right' },
  { key: 'absence', label: 'Absence', align: 'right' },
  { key: 'classSize', label: 'Class', title: 'Pupils per class', align: 'right' },
  { key: 'pupils', label: 'Pupils', align: 'right' },
  { key: 'fee', label: 'Fee / mo', align: 'right' },
  { key: 'distance', label: 'From home', align: 'right' },
];

export default function Explore() {
  const { filtered, scores, shortlist, toggleShortlist, home, travel, distanceTo, schools } = useStore();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'score', dir: -1 });
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [showWeights, setShowWeights] = useState(false);

  const value = (s: School, k: SortKey): number | string | null => {
    switch (k) {
      case 'score': return scores.get(s.id)?.score ?? null;
      case 'name': return s.name;
      case 'grade': return s.indicators.grade;
      case 'valueAdded': return s.indicators.valueAdded;
      case 'wellbeing': return s.indicators.wellbeing;
      case 'absence': return s.indicators.absence;
      case 'classSize': return s.indicators.classSize;
      case 'pupils': return s.latest.pupils;
      case 'fee': return s.fees.monthly;
      case 'distance': return travel.get(s.id)?.duration ?? distanceTo(s);
    }
  };

  const rows = useMemo(() => {
    const r = [...filtered];
    r.sort((a, b) => {
      const va = value(a, sort.key), vb = value(b, sort.key);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // missing values always last
      if (vb === null) return -1;
      if (typeof va === 'string') return va.localeCompare(vb as string, 'da') * sort.dir;
      return ((va as number) - (vb as number)) * sort.dir;
    });
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, scores, travel, home]);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' || key === 'absence' || key === 'classSize' || key === 'fee' || key === 'distance' ? 1 : -1 }));

  const withGrades = filtered.filter((s) => s.indicators.grade !== null);
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Find the right school</h1>
          <p className="mt-1 max-w-2xl text-ink-2">
            {schools.filter((s) => !s.special && !s.tenthGradeOnly).length} folkeskoler, private and international schools across Copenhagen and 19 surrounding
            municipalities, ranked with official Ministry data.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={clsx('btn', showWeights && 'btn-primary')} onClick={() => setShowWeights((v) => !v)}>
            <SlidersHorizontal size={16} /> Adjust ranking
          </button>
          <div className="flex overflow-hidden rounded-[10px] border border-border">
            <button className={clsx('px-3 py-2', view === 'table' ? 'bg-accent text-accent-ink' : 'bg-surface')} onClick={() => setView('table')} aria-label="Table view"><List size={16} /></button>
            <button className={clsx('px-3 py-2', view === 'cards' ? 'bg-accent text-accent-ink' : 'bg-surface')} onClick={() => setView('cards')} aria-label="Card view"><LayoutGrid size={16} /></button>
          </div>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Schools shown" value={String(filtered.length)} />
        <Stat label="Avg. exam grade" value={fmt(avg(withGrades.map((s) => s.indicators.grade)), 2)} sub={`${withGrades.length} schools with exams`} />
        <Stat label="Avg. wellbeing" value={fmt(avg(filtered.map((s) => s.indicators.wellbeing)), 2)} sub="scale 1–5" />
        <Stat label="Private schools" value={String(filtered.filter((s) => s.isPrivate).length)}
          sub={`median fee ${fmtDKK(median(filtered.filter((s) => s.isPrivate).map((s) => s.fees.monthly)))}/mo`} />
      </section>

      <div className={clsx('grid gap-5', showWeights && 'lg:grid-cols-[300px_1fr]')}>
        {showWeights && (
          <aside className="card h-fit p-5 lg:sticky lg:top-20">
            <h2 className="mb-1 font-semibold">Skolescore weights</h2>
            <p className="mb-4 text-sm text-ink-3">Each indicator is converted to a percentile among all schools, then combined with your weights.</p>
            <WeightsPanel />
          </aside>
        )}
        <div className="min-w-0 space-y-5">
          <div className="card p-4 sm:p-5"><FiltersBar /></div>

          {!home && (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-ink-2">
              <MapPin size={16} className="text-accent" />
              Set your home address on the <Link to="/map" className="font-medium text-accent hover:underline">map</Link> to see travel times and your district school.
            </div>
          )}

          {view === 'table' ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[980px] whitespace-nowrap text-sm">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
                    <tr>
                      <th className="w-10 px-3 py-3"><span className="sr-only">Shortlist</span></th>
                      <th className="w-10 px-2 py-3">#</th>
                      {COLUMNS.map((c) => (
                        <th key={c.key} className={clsx('px-3 py-3 font-semibold', c.align === 'right' && 'text-right')} title={c.title}>
                          <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => onSort(c.key)}>
                            {c.label}
                            {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => {
                      const r = scores.get(s.id);
                      const t = travel.get(s.id);
                      const d = distanceTo(s);
                      return (
                        <tr key={s.id} className="border-t border-border hover:bg-surface-2/60">
                          <td className="px-3 py-2.5">
                            <button onClick={() => toggleShortlist(s.id)} aria-label="Toggle shortlist"
                              className={shortlist.includes(s.id) ? 'text-[var(--series-2)]' : 'text-ink-3 hover:text-ink'}>
                              <Star size={16} fill={shortlist.includes(s.id) ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td className="px-2 py-2.5 tabular text-ink-3">{r?.rank ?? ''}</td>
                          <td className="px-3 py-2.5"><ScoreBadge result={r} size="sm" /></td>
                          <td className="px-3 py-2.5">
                            <Link to={`/school/${s.id}`} className="font-medium text-ink hover:text-accent">{shortName(s.name)}</Link>
                            <div className="flex items-center gap-1.5 text-xs text-ink-3">
                              <span>{typeLabel(s)}</span><span>·</span><span>{s.municipality}</span>
                              {s.languages.filter((l) => l !== 'da').map((l) => <LangTag key={l} lang={l} />)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular">
                            <div className="flex items-center justify-end gap-2">
                              <Sparkline points={s.series.grade} width={48} height={18} />
                              <span className="w-8">{fmt(s.indicators.grade, 1)}</span>
                            </div>
                          </td>
                          <td className={clsx('px-3 py-2.5 text-right tabular', (s.indicators.valueAdded ?? 0) > 0.2 ? 'text-good' : (s.indicators.valueAdded ?? 0) < -0.2 ? 'text-bad' : '')}>
                            {fmtSigned(s.indicators.valueAdded, 1)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular">{fmt(s.indicators.wellbeing, 2)}</td>
                          <td className="px-3 py-2.5 text-right tabular">{fmt(s.indicators.absence, 1, '%')}</td>
                          <td className="px-3 py-2.5 text-right tabular">{fmt(s.indicators.classSize, 1)}</td>
                          <td className="px-3 py-2.5 text-right tabular">{s.latest.pupils ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular">{s.isPrivate ? fmtDKK(s.fees.monthly) : <span className="text-good">Free</span>}</td>
                          <td className="px-3 py-2.5 text-right tabular text-ink-2">{t?.duration != null ? fmtDuration(t.duration) : fmtDistance(d)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <p className="p-8 text-center text-ink-3">No schools match these filters.</p>}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((s) => <SchoolCard key={s.id} s={s} />)}
            </div>
          )}

          <ScatterInsight schools={filtered} />
        </div>
      </div>
    </div>
  );
}

function median(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x !== null && x > 0).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular">{value}</div>
      {sub && <div className="text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

function SchoolCard({ s }: { s: School }) {
  const { scores, shortlist, toggleShortlist, travel, distanceTo } = useStore();
  const r = scores.get(s.id);
  const t = travel.get(s.id);
  return (
    <div className="card flex flex-col p-4 transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <ScoreBadge result={r} size="md" showNumber={false} />
        <div className="min-w-0 flex-1">
          <Link to={`/school/${s.id}`} className="block truncate font-semibold hover:text-accent">{shortName(s.name)}</Link>
          <div className="text-xs text-ink-3">{typeLabel(s)} · {s.municipality}</div>
        </div>
        <button onClick={() => toggleShortlist(s.id)} aria-label="Toggle shortlist"
          className={shortlist.includes(s.id) ? 'text-[var(--series-2)]' : 'text-ink-3 hover:text-ink'}>
          <Star size={18} fill={shortlist.includes(s.id) ? 'currentColor' : 'none'} />
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini label="Exams" value={fmt(s.indicators.grade, 1)} />
        <Mini label="Value add." value={fmtSigned(s.indicators.valueAdded, 1)} />
        <Mini label="Wellbeing" value={fmt(s.indicators.wellbeing, 2)} />
        <Mini label="Pupils" value={String(s.latest.pupils ?? '—')} />
        <Mini label="Class size" value={fmt(s.indicators.classSize, 1)} />
        <Mini label="Fee / mo" value={s.isPrivate ? fmtDKK(s.fees.monthly) : 'Free'} />
      </dl>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
        <span className="truncate">{s.address}, {s.postalCode} {s.city}</span>
        <span className="shrink-0 pl-2">{t?.duration != null ? fmtDuration(t.duration) : fmtDistance(distanceTo(s))}</span>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="text-sm font-semibold tabular">{value}</dd>
    </div>
  );
}
