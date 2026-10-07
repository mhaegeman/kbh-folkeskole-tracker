import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { ScoreBadge } from './ScoreBadge';
import { Sparkline } from './TrendChart';
import { LangTag } from './LangTag';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, shortName, typeLabel } from '../lib/format';
import type { School } from '../lib/types';

type SortKey = 'score' | 'name' | 'grade' | 'valueAdded' | 'wellbeing' | 'bullied' | 'absence' | 'classSize' | 'pupils' | 'fee' | 'distance';

const COLUMNS: { key: SortKey; label: string; title?: string; align?: 'right' }[] = [
  { key: 'score', label: 'Score' },
  { key: 'name', label: 'School' },
  { key: 'grade', label: 'Exams', title: '9th-grade exam average, 3-year mean', align: 'right' },
  { key: 'valueAdded', label: 'Value added', title: 'Grades vs. socio-economic expectation (3-year mean)', align: 'right' },
  { key: 'wellbeing', label: 'Wellbeing', title: 'General wellbeing, 1–5', align: 'right' },
  { key: 'bullied', label: 'Bullied', title: 'Pupils in grades 4–9 bullied at least now and then this school year', align: 'right' },
  { key: 'absence', label: 'Absence', align: 'right' },
  { key: 'classSize', label: 'Class', title: 'Pupils per class', align: 'right' },
  { key: 'pupils', label: 'Pupils', align: 'right' },
  { key: 'fee', label: 'Fee / mo', align: 'right' },
  { key: 'distance', label: 'From home', align: 'right' },
];

/** The full sortable table of every filtered school (Explore's "Table" view). */
export function RankingTable() {
  const { filtered, scores, shortlist, toggleShortlist, home, travel, distanceTo } = useStore();
  void home;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'score', dir: -1 });

  const value = (s: School, k: SortKey): number | string | null => {
    switch (k) {
      case 'score': return scores.get(s.id)?.score ?? null;
      case 'name': return s.name;
      case 'grade': return s.indicators.grade;
      case 'valueAdded': return s.indicators.valueAdded;
      case 'wellbeing': return s.indicators.wellbeing;
      case 'bullied': return s.climate?.find((c) => c.key === 'bullied')?.value ?? null;
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
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' || key === 'absence' || key === 'bullied' || key === 'classSize' || key === 'fee' || key === 'distance' ? 1 : -1 }));

  return (
  <div className="card overflow-hidden rounded-3xl">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[1060px] whitespace-nowrap text-sm">
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
                          <td className="px-3 py-2.5"><span className="flex items-center gap-2"><ScoreBadge result={r} size="sm" /><span className="tabular text-ink-2">{r?.score != null ? Math.round(r.score) : 'n/a'}</span></span></td>
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
                          <td className="px-3 py-2.5 text-right tabular">{fmt(s.climate?.find((c) => c.key === 'bullied')?.value, 0, '%')}</td>
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
  );
}
