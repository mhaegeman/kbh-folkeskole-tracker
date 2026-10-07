import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Plus, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { PRESETS } from '../lib/score';
import { ScoreBadge } from '../components/ScoreBadge';
import { TrendChart } from '../components/TrendChart';
import { activePreset } from '../components/PriorityPicker';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, shortName, typeLabel } from '../lib/format';
import type { School } from '../lib/types';

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
const climate = (s: School, key: string) => s.climate?.find((c) => c.key === key)?.value ?? null;

type RowDef = { label: string; get: (s: School) => number | null; show: (v: number | null, s: School) => string; better?: 'high' | 'low' };

export default function Compare() {
  const { shortlist, byId, scores, toggleShortlist, travel, distanceTo, home, weights, setWeights, filtered } = useStore();
  const [diffOnly, setDiffOnly] = useState(false);
  const schools = shortlist.map((id) => byId.get(id)).filter((s): s is School => !!s);

  if (!schools.length) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-highlight-soft text-highlight"><Star size={30} /></span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Your shortlist is empty</h1>
        <p className="mt-2 text-ink-2">Tap the star on any school to add it here, then compare them side by side.</p>
        <Link to="/" className="btn btn-primary mt-6">Explore schools</Link>
      </div>
    );
  }

  const groups: { title: string; rows: RowDef[] }[] = [
    { title: 'Practical', rows: [
      ...(home ? [{ label: home && travel.size ? 'Travel time' : 'Distance', get: (s: School) => travel.get(s.id)?.duration ?? distanceTo(s), show: (v: number | null, s: School) => (travel.get(s.id)?.duration != null ? fmtDuration(v) : fmtDistance(distanceTo(s))), better: 'low' as const }] : []),
      { label: 'School fee', get: (s) => (s.isPrivate ? s.fees.monthly : 0), show: (v, s) => (s.isPrivate ? (v != null ? `${fmtDKK(v)} / month` : 'Not published') : 'Free'), better: 'low' },
      { label: 'SFO (after school)', get: (s) => s.fees.sfoMonthly, show: (v) => (v != null ? `${fmtDKK(v)} / month` : '—'), better: 'low' },
      { label: 'Pupils', get: (s) => s.latest.pupils, show: (v) => (v === null ? '—' : String(v)) },
      { label: 'Founded', get: (s) => s.founded, show: (v) => (v === null ? '—' : String(v)) },
    ] },
    { title: 'Learning', rows: [
      { label: 'Exam average (3 years)', get: (s) => s.indicators.grade, show: (v) => fmt(v, 1), better: 'high' },
      { label: 'Danish exam', get: (s) => s.latest.danish, show: (v) => fmt(v, 1), better: 'high' },
      { label: 'Maths exam', get: (s) => s.latest.math, show: (v) => fmt(v, 1), better: 'high' },
      { label: 'Value added', get: (s) => s.indicators.valueAdded, show: (v) => fmtSigned(v, 2), better: 'high' },
      { label: 'Goes on to education', get: (s) => s.indicators.toEducation, show: (v) => fmt(v, 0, '%'), better: 'high' },
      { label: 'Class size', get: (s) => s.indicators.classSize, show: (v) => fmt(v, 1), better: 'low' },
      { label: 'Pupils per teacher', get: (s) => s.latest.pupilsPerTeacher, show: (v) => fmt(v, 1), better: 'low' },
      { label: 'Qualified teaching', get: (s) => s.indicators.qualifiedTeaching, show: (v, s) => (v === null && s.isPrivate ? 'Not published' : fmt(v, 0, '%')), better: 'high' },
    ] },
    { title: 'Wellbeing', rows: [
      { label: 'Wellbeing (1–5)', get: (s) => s.indicators.wellbeing, show: (v, s) => (v === null && s.isPrivate ? 'Not published' : fmt(v, 2)), better: 'high' },
      { label: 'Bullied (grades 4–9)', get: (s) => climate(s, 'bullied'), show: (v, s) => (v === null && s.isPrivate ? 'Not published' : fmt(v, 0, '%')), better: 'low' },
      { label: 'Feel safe (grades 4–9)', get: (s) => climate(s, 'safe'), show: (v, s) => (v === null && s.isPrivate ? 'Not published' : fmt(v, 0, '%')), better: 'high' },
      { label: 'Often lonely (grades 4–9)', get: (s) => climate(s, 'lonely'), show: (v, s) => (v === null && s.isPrivate ? 'Not published' : fmt(v, 0, '%')), better: 'low' },
      { label: 'Absence', get: (s) => s.indicators.absence, show: (v, s) => (v === null && s.isPrivate ? 'Not published' : fmt(v, 1, '% of days')), better: 'low' },
    ] },
    { title: 'Families', rows: [
      { label: 'Year groups (net change)', get: (s) => s.indicators.retention, show: (v) => (v === null ? '—' : `${fmtSigned(v, 1)}% a year`), better: 'high' },
      { label: 'Pupil numbers (~5 years)', get: (s) => s.indicators.pupilTrend, show: (v) => (v === null ? '—' : `${fmtSigned(v, 0)}%`) },
      { label: 'Pupils from other municipalities', get: (s) => s.fromOutside.at(-1)?.v ?? null, show: (v) => fmt(v, 0, '%') },
    ] },
  ];

  const best = (r: RowDef) => {
    if (!r.better) return null;
    const vals = schools.map(r.get).filter((v): v is number => v !== null);
    if (vals.length < 2) return null;
    const b = r.better === 'high' ? Math.max(...vals) : Math.min(...vals);
    return vals.every((v) => v === b) ? null : b;
  };
  const differs = (r: RowDef) => new Set(schools.map((s) => r.show(r.get(s), s))).size > 1;

  const mixed = schools.some((s) => s.isPrivate) && schools.some((s) => !s.isPrivate);
  const preset = activePreset(weights);
  const like = PRESETS.find((p) => p.id === 'like')!;
  const partial = schools.filter((s) => (scores.get(s.id)?.dataShare ?? 1) < 0.75);

  const suggestion = schools.length < 4
    ? filtered.filter((s) => !shortlist.includes(s.id) && scores.get(s.id)?.score != null)
      .sort((a, b) => (home ? (distanceTo(a) ?? 1e9) - (distanceTo(b) ?? 1e9) : 0))
      .slice(0, home ? 15 : undefined)
      .sort((a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0))[0]
    : undefined;

  const chartSchools = schools.slice(0, 4);
  const cols = schools.length + (suggestion ? 1 : 0);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-5 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-[40px] sm:leading-[44px]">Your shortlist</h1>
          <p className="mt-1.5 text-base text-ink-2">The better value in each row is highlighted.{schools.length > 4 && ' Charts show the first four schools.'}</p>
        </div>
        <button type="button" className={clsx('btn', diffOnly && 'border-accent bg-accent-soft text-accent')} aria-pressed={diffOnly} onClick={() => setDiffOnly((v) => !v)}>
          Show differences only
        </button>
      </div>

      {(mixed || partial.length > 0) && preset?.id !== 'like' && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-highlight-soft px-5 py-3.5">
          <AlertCircle size={20} className="shrink-0 text-highlight" aria-hidden="true" />
          <p className="min-w-0 flex-[1_1_320px] text-[15px]">
            Private schools don’t report wellbeing, bullying or absence, so {partial.length ? partial.map((s) => shortName(s.name)).join(' and ') + (partial.length > 1 ? '’ scores rest' : '’s score rests') : 'their scores rest'} on fewer indicators.
          </p>
          <button type="button" className="btn border-highlight bg-transparent" onClick={() => setWeights(like.weights)}>Compare like-for-like</button>
        </div>
      )}

      <div className="card mt-5 overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-[15px]" style={{ minWidth: 140 + cols * 190 }}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] w-[130px] bg-surface p-3 text-left align-bottom text-[13px] font-semibold text-ink-2 sm:w-[220px] sm:p-5">
                {schools.length} {schools.length === 1 ? 'school' : 'schools'} · {preset?.label ?? 'Custom'} priority
              </th>
              {schools.map((s, i) => (
                <th key={s.id} scope="col" className="border-l border-border p-3 text-left align-top font-normal sm:p-5">
                  <div className="mb-3 h-1 w-10 rounded-full" style={{ background: COLORS[i] ?? 'var(--series-muted)' }} aria-hidden="true" />
                  <div className="flex items-start gap-3">
                    <ScoreBadge result={scores.get(s.id)} size="md" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/school/${s.id}`} className="text-[17px] font-extrabold leading-snug hover:text-accent">{shortName(s.name)}</Link>
                      <div className="text-[13px] text-ink-2">{typeLabel(s)} · {s.municipality}</div>
                    </div>
                    <button type="button" onClick={() => toggleShortlist(s.id)} className="-mr-2 -mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label={`Remove ${shortName(s.name)} from shortlist`}><X size={17} /></button>
                  </div>
                </th>
              ))}
              {suggestion && (
                <th scope="col" className="border-l border-border p-3 align-top font-normal sm:p-5">
                  <div className="rounded-2xl border-2 border-dashed border-border-strong p-4 text-left">
                    <div className="font-bold">Add a school</div>
                    <div className="mt-1 text-[13px] text-ink-2">
                      Suggested: <Link to={`/school/${suggestion.id}`} className="font-semibold text-ink hover:text-accent">{shortName(suggestion.name)}</Link>, {typeLabel(suggestion).toLowerCase()}
                      {home && distanceTo(suggestion) !== null ? `, ${fmtDistance(distanceTo(suggestion))}` : ''}, score {Math.round(scores.get(suggestion.id)!.score!)}
                    </div>
                    <button type="button" className="btn btn-primary mt-3 min-h-10 px-3.5" onClick={() => toggleShortlist(suggestion.id)}><Plus size={16} /> Add</button>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const rows = g.rows.filter((r) => !diffOnly || differs(r));
              if (!rows.length) return null;
              return [
                <tr key={g.title}>
                  <th colSpan={cols + 1} scope="colgroup" className="eyebrow border-t border-border px-5 pb-2 pt-6 text-left">{g.title}</th>
                </tr>,
                ...rows.map((r) => {
                  const b = best(r);
                  return (
                    <tr key={r.label} className="border-t border-border/70">
                      <th scope="row" className="sticky left-0 z-[1] bg-surface px-3 py-3 text-left text-sm font-semibold sm:px-5 sm:text-[15px]">{r.label}</th>
                      {schools.map((s) => {
                        const v = r.get(s);
                        const text = r.show(v, s);
                        const isBest = b !== null && v === b;
                        return (
                          <td key={s.id} className="border-l border-border px-3 py-2 sm:px-5">
                            <span className={clsx('inline-flex items-center rounded-xl tabular',
                              isBest ? 'bg-accent-soft px-2.5 py-1.5 font-extrabold text-accent' : text === 'Not published' ? 'py-1.5 text-sm text-ink-3' : 'py-1.5 font-semibold')}>
                              {text}{isBest && <span className="sr-only"> (best)</span>}
                            </span>
                          </td>
                        );
                      })}
                      {suggestion && <td className="border-l border-border" />}
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {([
          ['Exam results', (s: School) => s.series.grade, 1, ''],
          ['Value added', (s: School) => s.series.socrefDiff, 1, ''],
          ['Wellbeing (general)', (s: School) => s.series.wellbeing.general ?? [], 2, ''],
          ['Pupils', (s: School) => s.series.pupils, 0, ''],
          ['Absence', (s: School) => s.series.absence, 1, '%'],
          ['Class size', (s: School) => s.series.classSize, 1, ''],
        ] as const).map(([title, get, digits, suffix]) => {
          const series = chartSchools.map((s, i) => ({ name: shortName(s.name), points: get(s), color: COLORS[i] })).filter((x) => x.points.length);
          if (!series.length) return null;
          return (
            <section key={title} className="card p-6">
              <h2 className="mb-3 text-xl font-extrabold tracking-tight">{title}</h2>
              <TrendChart digits={digits} suffix={suffix} zeroLine={title === 'Value added'} series={series} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
