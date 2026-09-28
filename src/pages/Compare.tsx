import { Link } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { ScoreBadge } from '../components/ScoreBadge';
import { TrendChart } from '../components/TrendChart';
import { LangTag } from '../components/LangTag';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, shortName, typeLabel } from '../lib/format';
import type { School } from '../lib/types';

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

const climate = (s: School, key: string) => s.climate?.find((c) => c.key === key)?.value ?? null;

type RowDef = { label: string; get: (s: School) => number | null; show: (v: number | null, s: School) => string; better?: 'high' | 'low' };

export default function Compare() {
  const { shortlist, byId, scores, toggleShortlist, travel, distanceTo, home } = useStore();
  const schools = shortlist.map((id) => byId.get(id)).filter((s): s is School => !!s);

  if (!schools.length) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <Star size={36} className="mx-auto text-ink-3" />
        <h1 className="mt-4 font-display text-3xl font-semibold">Your shortlist is empty</h1>
        <p className="mt-2 text-ink-2">Star schools in the list or on the map to compare them side by side.</p>
        <Link to="/" className="btn btn-primary mt-6">Browse schools</Link>
      </div>
    );
  }

  const rows: RowDef[] = [
    { label: 'Skolescore', get: (s) => scores.get(s.id)?.score ?? null, show: (v) => (v === null ? '—' : String(Math.round(v))), better: 'high' },
    { label: 'Exam average (3 yr)', get: (s) => s.indicators.grade, show: (v) => fmt(v, 2), better: 'high' },
    { label: 'Value added', get: (s) => s.indicators.valueAdded, show: (v) => fmtSigned(v, 2), better: 'high' },
    { label: 'Danish exam', get: (s) => s.latest.danish, show: (v) => fmt(v, 1), better: 'high' },
    { label: 'Maths exam', get: (s) => s.latest.math, show: (v) => fmt(v, 1), better: 'high' },
    { label: 'Wellbeing (1–5)', get: (s) => s.indicators.wellbeing, show: (v) => fmt(v, 2), better: 'high' },
    { label: 'Absence', get: (s) => s.indicators.absence, show: (v) => fmt(v, 1, '%'), better: 'low' },
    { label: 'Class size', get: (s) => s.indicators.classSize, show: (v) => fmt(v, 1), better: 'low' },
    { label: 'Pupils per teacher', get: (s) => s.latest.pupilsPerTeacher, show: (v) => fmt(v, 1), better: 'low' },
    { label: 'Qualified teaching', get: (s) => s.indicators.qualifiedTeaching, show: (v) => fmt(v, 0, '%'), better: 'high' },
    { label: 'Goes on to education', get: (s) => s.indicators.toEducation, show: (v) => fmt(v, 0, '%'), better: 'high' },
    { label: 'Pupils', get: (s) => s.latest.pupils, show: (v) => (v === null ? '—' : String(v)) },
    { label: 'Pupil trend (~5 yr)', get: (s) => s.indicators.pupilTrend, show: (v) => (v === null ? '—' : `${fmtSigned(v, 0)}%`) },
    { label: 'Year groups (net change)', get: (s) => s.indicators.retention, show: (v) => (v === null ? '—' : `${fmtSigned(v, 1)}%`), better: 'high' },
    { label: 'Pupils from outside municipality', get: (s) => s.fromOutside.at(-1)?.v ?? null, show: (v) => fmt(v, 0, '%') },
    { label: 'Bullied (gr. 4–9)', get: (s) => climate(s, 'bullied'), show: (v) => fmt(v, 0, '%'), better: 'low' },
    { label: 'Often lonely (gr. 4–9)', get: (s) => climate(s, 'lonely'), show: (v) => fmt(v, 0, '%'), better: 'low' },
    { label: 'Feel safe (gr. 4–9)', get: (s) => climate(s, 'safe'), show: (v) => fmt(v, 0, '%'), better: 'high' },
    { label: 'Teaches French', get: (s) => (s.teachesFrench || s.languages.includes('fr') ? 1 : 0), show: (v, s) => (s.languages.includes('fr') ? 'In French' : v ? 'Yes (2nd language)' : s.qualifiedBySubject ? 'No' : '—') },
    { label: 'School fee / month', get: (s) => s.fees.monthly, show: (v, s) => (s.isPrivate ? fmtDKK(v) : 'Free'), better: 'low' },
    { label: 'SFO / month', get: (s) => s.fees.sfoMonthly, show: (v) => fmtDKK(v), better: 'low' },
    ...(home ? [{ label: 'Travel time', get: (s: School) => travel.get(s.id)?.duration ?? null, show: (v: number | null, s: School) => (v != null ? fmtDuration(v) : fmtDistance(distanceTo(s))), better: 'low' as const }] : []),
  ];

  const best = (r: RowDef) => {
    if (!r.better) return null;
    const vals = schools.map(r.get).filter((v): v is number => v !== null);
    if (vals.length < 2) return null;
    return r.better === 'high' ? Math.max(...vals) : Math.min(...vals);
  };

  const chartSchools = schools.slice(0, 4);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Compare your shortlist</h1>
      <p className="mt-1 text-ink-2">Best value in each row is highlighted.{schools.length > 4 && ' Charts show the first four schools.'}</p>

      <div className="card mt-5 overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-48 p-4" />
              {schools.map((s, i) => (
                <th key={s.id} className="min-w-44 p-4 text-left align-top font-normal">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="mb-1 h-1 w-8 rounded-full" style={{ background: COLORS[i] ?? 'var(--series-muted)' }} />
                      <Link to={`/school/${s.id}`} className="font-semibold text-ink hover:text-accent">{shortName(s.name)}</Link>
                      <div className="text-xs text-ink-3">{typeLabel(s)} · {s.municipality} {s.languages.filter((l) => l !== 'da').map((l) => <LangTag key={l} lang={l} />)}</div>
                    </div>
                    <button onClick={() => toggleShortlist(s.id)} className="text-ink-3 hover:text-ink" aria-label="Remove"><X size={16} /></button>
                  </div>
                  <div className="mt-2"><ScoreBadge result={scores.get(s.id)} size="sm" /></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = best(r);
              return (
                <tr key={r.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-ink-3">{r.label}</td>
                  {schools.map((s) => {
                    const v = r.get(s);
                    return (
                      <td key={s.id} className={clsx('px-4 py-2.5 tabular', b !== null && v === b && 'font-semibold text-good')}>
                        {r.show(v, s)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {([
          ['Exam results', (s: School) => s.series.grade, 1, ''],
          ['Value added', (s: School) => s.series.socrefDiff, 1, ''],
          ['Pupils', (s: School) => s.series.pupils, 0, ''],
          ['Wellbeing (general)', (s: School) => s.series.wellbeing.general ?? [], 2, ''],
          ['Absence', (s: School) => s.series.absence, 1, '%'],
          ['Class size', (s: School) => s.series.classSize, 1, ''],
        ] as const).map(([title, get, digits, suffix]) => (
          <section key={title} className="card p-5">
            <h2 className="mb-3 font-semibold">{title}</h2>
            <TrendChart digits={digits} suffix={suffix} zeroLine={title === 'Value added'}
              series={chartSchools.map((s, i) => ({ name: shortName(s.name), points: get(s), color: COLORS[i] })).filter((x) => x.points.length)} />
          </section>
        ))}
      </div>
    </div>
  );
}
