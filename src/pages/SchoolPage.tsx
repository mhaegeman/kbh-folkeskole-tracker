import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe, Mail, MapPin, Newspaper, Phone, Star, User, Info, AlertTriangle, CheckCircle2, Map as MapIcon, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { explainScore, unscoredReason, type ScoreLine } from '../lib/score';
import { haversine } from '../lib/geo';
import { ScoreBadge } from '../components/ScoreBadge';
import { TrendChart, type TrendSeries } from '../components/TrendChart';
import { ClimateSection, FamiliesSection, QualificationsSection } from '../components/SchoolDetails';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { Popover } from '../components/Popover';
import { PriorityPicker, activePreset } from '../components/PriorityPicker';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, LANGUAGE_LABEL, ordinal, relDate, shortName, typeLabel } from '../lib/format';
import type { Point, School } from '../lib/types';

export default function SchoolPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId, scores, data, shortlist, toggleShortlist, travel, distanceTo, home, mode, weights, medians, schools } = useStore();
  const s = id ? byId.get(id) : undefined;
  if (!data) return null;
  if (!s) return <div className="mx-auto max-w-3xl p-10 text-center text-ink-2">School not found. <Link to="/" className="font-bold text-accent">Back to schools</Link></div>;

  const r = scores.get(s.id);
  const preset = activePreset(weights);
  const bench = (key: 'grade' | 'absence' | 'classSize' | 'wellbeingTop' | 'qualifiedTeaching', who: string): Point[] =>
    Object.entries(data.benchmarks[who] || {}).filter(([, b]) => typeof b[key] === 'number').map(([y, b]) => ({ y, v: b[key]! })).sort((a, b) => a.y.localeCompare(b.y));
  const withBench = (name: string, points: Point[], key: Parameters<typeof bench>[0]): TrendSeries[] => {
    if (!points.length) return [];
    const from = points[0].y;
    return [
      { name, points, color: 'var(--series-1)' },
      { name: s.municipality, points: bench(key, s.municipality).filter((p) => p.y >= from), color: 'var(--series-2)', dashed: true, muted: true },
      { name: 'Denmark', points: bench(key, '_national').filter((p) => p.y >= from), color: 'var(--series-muted)', dashed: true, muted: true },
    ].filter((x) => x.points.length);
  };
  const t = travel.get(s.id);
  const d = t?.distance ?? distanceTo(s);
  const inShortlist = shortlist.includes(s.id);
  const wb = s.series.wellbeing;
  const rated = [...scores.values()].filter((x) => x.score !== null).length;
  const lines = explainScore(s, r, weights, medians);
  const goBack = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/'));

  const kpis: [string, string, string?][] = [
    ['Pupils', s.latest.pupils != null ? String(s.latest.pupils) : '—'],
    ['Exam average', fmt(s.indicators.grade, 1), '3-year mean'],
    s.indicators.wellbeing !== null ? ['Wellbeing', fmt(s.indicators.wellbeing, 2), '/ 5'] : ['Value added', fmtSigned(s.indicators.valueAdded, 1), 'grade points'],
    ['Class size', fmt(s.indicators.classSize, 1)],
    ['Fee', s.isPrivate ? (s.fees.monthly != null ? fmtDKK(s.fees.monthly) : 'n/a') : 'Free', s.isPrivate && s.fees.monthly != null ? '/ mo' : undefined],
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">
      <button type="button" onClick={goBack} className="mb-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent">
        <ArrowLeft size={17} /> Back to schools
      </button>

      <div className="flex flex-wrap items-stretch gap-4 sm:gap-5">
        <header className="card flex min-w-0 flex-[999_1_560px] flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-wrap gap-2 text-[13px]">
            <span className="rounded-full bg-accent-soft px-3 py-1 font-bold text-accent">{typeLabel(s)}</span>
            <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold">{s.municipality}</span>
            {s.gradesOffered && <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold">Grades {s.gradesOffered}</span>}
            {s.languages.filter((l) => l !== 'da').map((l) => <span key={l} className="rounded-full bg-surface-2 px-3 py-1 font-semibold">{LANGUAGE_LABEL[l] ?? l}</span>)}
          </div>
          <div>
            <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl">{shortName(s.name)}</h1>
            {s.name.includes(',') && <div className="mt-1 text-ink-2">{s.name.split(',').slice(1).join(',').trim()}</div>}
            <p className="mt-2 text-base text-ink-2">
              {s.address}, {s.postalCode} {s.city}
              {home && d !== null && <> · <b className="text-ink">{t?.duration != null ? `${fmtDuration(t.duration)} by ${mode === 'foot' ? 'foot' : mode}` : fmtDistance(d)}</b> from {home.label.split(',')[0]}</>}
            </p>
            {s.profile && <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">{s.profile}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={clsx('btn', inShortlist ? 'border-highlight text-ink' : 'btn-primary')} onClick={() => toggleShortlist(s.id)} aria-pressed={inShortlist}>
              <Star size={18} fill={inShortlist ? 'var(--highlight)' : 'none'} stroke={inShortlist ? 'var(--highlight)' : 'currentColor'} /> {inShortlist ? 'On your shortlist' : 'Add to shortlist'}
            </button>
            <Link className="btn" to={`/?school=${s.id}`}><MapIcon size={17} /> {home ? 'Route on map' : 'Show on map'}</Link>
            {s.website && <a className="btn" href={s.website} target="_blank" rel="noreferrer"><Globe size={17} /> Website</a>}
          </div>
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
            {kpis.map(([k, v, sub]) => (
              <div key={k} className="rounded-2xl bg-surface-2 px-4 py-3">
                <dt className="text-[13px] text-ink-2">{k}</dt>
                <dd className="text-2xl font-extrabold tabular">{v}{sub && <span className="ml-1 text-sm font-medium text-ink-2">{sub}</span>}</dd>
              </div>
            ))}
          </dl>
        </header>

        <aside aria-label="Skolescore" className="flex flex-[1_1_300px] flex-col gap-4 rounded-3xl p-6 sm:max-w-[420px] sm:p-7"
          style={{ background: r?.score != null ? 'var(--score-a)' : 'var(--surface-2)', color: r?.score != null ? 'var(--score-a-ink)' : 'var(--ink)' }}>
          <div className="text-sm font-semibold opacity-85">Skolescore · {preset?.label ?? 'Custom'} priority</div>
          {r?.score != null ? (
            <>
              <div className="flex items-end gap-3">
                <span className="text-[88px] font-extrabold leading-[0.85] tracking-[-0.04em] tabular">{Math.round(r.score)}</span>
                <span className="mb-1 grid h-10 min-w-10 place-items-center rounded-xl bg-surface px-2.5 text-xl font-extrabold text-ink">{r.letter}</span>
              </div>
              <p className="text-base leading-snug">
                Ranked <b>{ordinal(r.rank ?? 0)} of {rated}</b> rated schools.{' '}
                {r.dataShare < 0.75 ? <>Based on {Math.round(r.dataShare * 100)}% of the weighted indicators ◐.</> : 'Based on all its published indicators.'}
              </p>
              <div className="h-2.5 rounded-full bg-current/20" aria-hidden="true"><div className="h-full rounded-full bg-current" style={{ width: `${r.score}%` }} /></div>
            </>
          ) : (
            <>
              <div className="text-4xl font-extrabold">Not rated</div>
              <p className="text-sm leading-relaxed">{unscoredReason(s)}</p>
            </>
          )}
          <div className="mt-auto text-ink">
            <Popover title="What matters to you?" label="Change what matters" width={460} footer={(close) => <button type="button" className="btn btn-primary w-full" onClick={close}>Done</button>}>
              {() => <PriorityPicker />}
            </Popover>
          </div>
        </aside>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-4 sm:mt-5 sm:gap-5">
        <div className="min-w-0 flex-[999_1_560px] space-y-4 sm:space-y-5">
          {!s.hasData && (
            <div className="card flex gap-3 p-5 text-sm text-ink-2">
              <Info size={18} className="shrink-0 text-accent" />
              <p>The Ministry publishes no statistics for this school. International schools following a foreign curriculum (e.g. IB or Cambridge) usually do not sit the Danish exams or the national wellbeing survey.</p>
            </div>
          )}

          {r?.score != null && <WhySection s={s} lines={lines} score={r.score} />}

          {s.series.grade.length > 0 && (
            <ChartCard title="Exam results over time" subtitle="Average in the mandatory 9th-grade exams (7-point scale), against the municipality and Denmark">
              <TrendChart series={withBench('This school', s.series.grade, 'grade')} digits={1} height={260} />
            </ChartCard>
          )}

          <PupilVoice s={s} />

          {s.latest.pupilsByGrade && <GradeLevels byGrade={s.latest.pupilsByGrade} year={s.latest.pupilsYear} retention={s.indicators.retention} />}

          <details className="group card overflow-hidden">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 sm:px-7">
              <span>
                <span className="block text-xl font-extrabold tracking-tight">More detail</span>
                <span className="block text-sm text-ink-2">Full score calculation, trends for every indicator, pupil survey, teacher qualifications and news</span>
              </span>
              <ChevronDown size={22} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-5 border-t border-border bg-bg p-3 sm:p-5">
              <ScoreBreakdown s={s} />
              <div className="grid gap-5 md:grid-cols-2">
                <ChartCard title="Value added" subtitle="Actual minus expected grade given pupils’ background">
                  <TrendChart series={[{ name: 'Value added', points: s.series.socrefDiff, color: 'var(--series-1)' }]} digits={1} zeroLine />
                </ChartCard>
                <ChartCard title="Danish & maths" subtitle="9th-grade bound exams">
                  <TrendChart series={[
                    { name: 'Danish', points: s.series.danish, color: 'var(--series-1)' },
                    { name: 'Maths', points: s.series.math, color: 'var(--series-2)' },
                  ].filter((x) => x.points.length)} digits={1} />
                </ChartCard>
                <ChartCard title="Number of pupils" subtitle="Total enrolled">
                  <TrendChart series={[{ name: 'Pupils', points: s.series.pupils, color: 'var(--series-1)' }]} digits={0} />
                </ChartCard>
                <ChartCard title="Wellbeing" subtitle="Pupil survey, grades 4–9 (1–5)">
                  <TrendChart series={[
                    { name: 'General', points: wb.general ?? [], color: 'var(--series-1)' },
                    { name: 'Social', points: wb.social ?? [], color: 'var(--series-2)' },
                    { name: 'Calm & order', points: wb.calm ?? [], color: 'var(--series-3)' },
                  ].filter((x) => x.points.length)} digits={2} />
                </ChartCard>
                <ChartCard title="Absence" subtitle="% of school days missed">
                  <TrendChart series={withBench('This school', s.series.absence, 'absence')} digits={1} suffix="%" />
                </ChartCard>
                <ChartCard title="Class size" subtitle="Average pupils per class">
                  <TrendChart series={withBench('This school', s.series.classSize, 'classSize')} digits={1} />
                </ChartCard>
              </div>
              <ClimateSection s={s} />
              <FamiliesSection s={s} />
              <QualificationsSection s={s} />
              {s.external && <ExternalSection s={s} />}
            </div>
          </details>

          <NewsSection s={s} />
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 sm:max-w-[420px] sm:gap-5">
          <FeesCard s={s} />
          <ContactCard s={s} />
          {s.international && <InternationalCard s={s} />}
          <NearbyCard s={s} schools={schools} />
        </aside>
      </div>
    </div>
  );
}

/** Strengths and watch-outs: where the school ranks on each scored indicator, in plain words. */
function WhySection({ s, lines, score }: { s: School; lines: ScoreLine[]; score: number }) {
  const active = lines.filter((l) => (l.status === 'scored' || l.status === 'estimated') && l.percentile !== null);
  const allStrengths = active.filter((l) => l.percentile! >= 60).sort((a, b) => b.percentile! - a.percentile!);
  const strengths = allStrengths.slice(0, 6);
  const watch = active.filter((l) => l.percentile! < 40).sort((a, b) => a.percentile! - b.percentile!);
  const middle = active.filter((l) => l.percentile! >= 40 && l.percentile! < 60);
  const moreStrengths = allStrengths.slice(6);
  const na = lines.filter((l) => l.status === 'na');
  const Row = ({ l, good }: { l: ScoreLine; good: boolean }) => (
    <li className="border-t border-border py-3 first:border-t-0" title={l.def.description}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{l.def.label}{l.status === 'estimated' && <span className="ml-1.5 rounded bg-accent-soft px-1 text-[11px] font-bold text-accent">EST.</span>}</span>
        <span className={clsx('shrink-0 text-sm font-bold', good ? 'text-accent' : 'text-bad')}>
          {good ? `Top ${Math.max(1, Math.round(100 - l.percentile!))}%` : `Bottom ${Math.max(1, Math.round(l.percentile!))}%`}
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-surface-2">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, l.percentile!)}%`, background: good ? 'var(--accent)' : 'var(--highlight)' }} />
        <span className="absolute -top-1 left-1/2 h-4 w-0.5 rounded bg-ink-3" title="Middle school" />
      </div>
      <div className="mt-1 text-[13px] text-ink-2">
        {l.value !== null ? l.def.format(l.value) : '—'}{l.median !== null && <> · middle school {l.def.format(l.median)}</>}
      </div>
    </li>
  );
  return (
    <section className="card p-6 sm:p-7" aria-labelledby="why">
      <h2 id="why" className="text-2xl font-extrabold tracking-tight">Why {Math.round(score)}?</h2>
      <p className="mt-1 text-[15px] text-ink-2">How {shortName(s.name)} ranks against all schools on each indicator. The line marks the middle school.</p>
      <div className="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2">
        <div>
          <h3 className="eyebrow mb-1 !text-good">Strengths</h3>
          {strengths.length ? <ul>{strengths.map((l) => <Row key={l.def.key} l={l} good />)}</ul> : <p className="text-sm text-ink-2">No indicator in the top 40%.</p>}
        </div>
        <div>
          <h3 className="eyebrow mb-1 !text-bad">Worth a closer look</h3>
          {watch.length ? <ul>{watch.map((l) => <Row key={l.def.key} l={l} good={false} />)}</ul> : <p className="text-sm text-ink-2">No indicator in the bottom 40%.</p>}
          {(middle.length > 0 || na.length > 0 || moreStrengths.length > 0) && (
            <div className="mt-4 space-y-2 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-ink-2">
              {moreStrengths.length > 0 && <p>Also strong: {moreStrengths.map((l) => `${l.def.label.toLowerCase()} (top ${Math.max(1, Math.round(100 - l.percentile!))}%)`).join(', ')}.</p>}
              {middle.length > 0 && <p>Around the middle: {middle.map((l) => `${l.def.label.toLowerCase()} (${ordinal(l.percentile!)} percentile)`).join(', ')}.</p>}
              {na.length > 0 && <p>Not published for this school: {na.map((l) => l.def.label.toLowerCase()).join(', ')}.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const VOICE = ['likeSchool', 'safe', 'belong', 'bullied', 'lonely', 'toilets'];

/** Headline pupil-survey answers against Denmark. */
function PupilVoice({ s }: { s: School }) {
  const items = VOICE.map((k) => s.climate?.find((c) => c.key === k)).filter((c): c is NonNullable<typeof c> => !!c);
  if (!items.length) return null;
  return (
    <section className="card p-6 sm:p-7" aria-labelledby="voice">
      <h2 id="voice" className="text-2xl font-extrabold tracking-tight">What pupils say</h2>
      <p className="mt-1 text-[15px] text-ink-2">National pupil survey {items[0].year}, compared with all of Denmark.</p>
      <div className="mt-5 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => {
          const delta = c.national !== null ? Math.round((c.value - c.national) * 10) / 10 : null;
          const better = delta !== null && (c.polarity === 'good' ? delta > 0 : delta < 0);
          return (
            <div key={c.key} className="rounded-2xl bg-surface-2 p-4" title={`“${c.question}” — ${c.n} answers${c.reliable ? '' : ' (few answers: read with care)'}`}>
              <div className="min-h-10 text-sm font-semibold leading-5">{c.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold leading-8 tabular">{fmt(c.value, 0)}%</span>
                {delta !== null && Math.abs(delta) >= 1 && (
                  <span className={clsx('text-sm font-bold', better ? 'text-good' : 'text-bad')}>{delta > 0 ? '+' : '−'}{fmt(Math.abs(delta), 0)} pts</span>
                )}
              </div>
              <div className="text-[13px] text-ink-2">Denmark: {fmt(c.national, 0, '%')} · grades {c.band}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ContactCard({ s }: { s: School }) {
  const rows = [
    s.principal && { icon: User, label: 'Principal', value: s.principal },
    s.phone && { icon: Phone, label: 'Phone', value: s.phone, href: `tel:${s.phone.replace(/\s/g, '')}` },
    s.email && { icon: Mail, label: 'Email', value: s.email, href: `mailto:${s.email}` },
    { icon: MapPin, label: 'Address', value: `${s.address}, ${s.postalCode} ${s.city}` },
  ].filter(Boolean) as { icon: typeof User; label: string; value: string; href?: string }[];
  return (
    <section className="card p-6">
      <h2 className="text-xl font-extrabold tracking-tight">Contact</h2>
      <dl className="mt-3 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-3">
            <r.icon size={17} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-ink-2">{r.label}</dt>
              <dd className="break-words font-semibold">{r.href ? <a className="text-accent hover:underline" href={r.href}>{r.value}</a> : r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Closest rated schools to this one, to keep people exploring. */
function NearbyCard({ s, schools }: { s: School; schools: School[] }) {
  const { scores } = useStore();
  if (!s.lat || !s.lng) return null;
  const near = schools
    .filter((x) => x.id !== s.id && x.lat && x.lng && !x.special && !x.tenthGradeOnly && scores.get(x.id)?.score != null)
    .map((x) => ({ x, d: haversine({ lat: s.lat!, lng: s.lng! }, { lat: x.lat!, lng: x.lng! }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
  if (!near.length) return null;
  return (
    <section className="card p-6">
      <h2 className="text-xl font-extrabold tracking-tight">Nearby schools</h2>
      <ul className="mt-2">
        {near.map(({ x, d }) => (
          <li key={x.id} className="border-t border-border first:border-t-0">
            <Link to={`/school/${x.id}`} className="flex min-h-14 items-center gap-3 py-2.5 hover:text-accent">
              <ScoreBadge result={scores.get(x.id)} size="sm" />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{shortName(x.name)}</b>
                <span className="block text-[13px] text-ink-2">{typeLabel(x)} · {fmtDistance(d)} away</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 sm:p-7">
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {subtitle && <p className="mb-4 mt-1 text-sm text-ink-2">{subtitle}</p>}
      {children}
    </section>
  );
}

function GradeLevels({ byGrade, year, retention }: { byGrade: Record<string, number>; year: string | null; retention: number | null }) {
  const entries = Object.entries(byGrade).map(([g, n]) => [Number(g), n] as const).sort((a, b) => a[0] - b[0]);
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return (
    <section className="card p-6 sm:p-7">
      <h2 className="text-2xl font-extrabold tracking-tight">Pupils per year group</h2>
      <p className="mb-5 mt-1 text-[15px] text-ink-2">
        {year} · shows how many classes (spor) each year group has.
        {retention !== null && Math.abs(retention) >= 0.5 && (retention > 0
          ? ` Year groups grow by ${fmt(retention, 1)}% a year on average, so families tend to stay and join.`
          : ` Year groups shrink by ${fmt(-retention, 1)}% a year on average, so some families move their children elsewhere.`)}
      </p>
      <div className="flex h-44 items-end gap-1.5 sm:gap-2">
        {entries.map(([g, n]) => (
          <div key={g} className="group flex flex-1 flex-col items-center gap-1" title={`${g}. klasse: ${n} pupils`}>
            <span className="text-xs font-bold tabular">{n}</span>
            <div className="w-full max-w-12 rounded-t-lg rounded-b-sm" style={{ height: `${(n / max) * 120}px`, background: 'var(--series-1)' }} />
            <span className="text-xs text-ink-2">{g}.</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeesCard({ s }: { s: School }) {
  const f = s.fees;
  const sfoAnnual = f.sfoMonthly != null ? f.sfoMonthly * (f.sfoMonthsPerYear ?? 11) : null;
  return (
    <section className="card p-6">
      <h2 className="text-xl font-extrabold tracking-tight">Costs</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="School fee" value={s.isPrivate ? (f.monthly != null ? `${fmtDKK(f.monthly)} / month` : 'Not published') : 'Free (public school)'} />
        {s.isPrivate && f.annual != null && <Row label="Per year" value={fmtDKK(f.annual)} />}
        {f.enrollment != null && <Row label="One-off fees" value={fmtDKK(f.enrollment)} />}
        <Row label={s.isPrivate ? 'After-school (SFO)' : `Municipal SFO (${s.municipality})`} value={f.sfoMonthly != null ? `${fmtDKK(f.sfoMonthly)} / month` : '—'} />
        {!s.isPrivate && sfoAnnual != null && <Row label="SFO per year" value={`≈ ${fmtDKK(sfoAnnual)}`} />}
      </dl>
      {f.siblingDiscount && <p className="mt-3 text-xs text-ink-2"><span className="font-medium text-ink">Siblings: </span>{f.siblingDiscount}</p>}
      {f.notes && (
        <details className="mt-3 text-xs text-ink-3">
          <summary className="cursor-pointer font-semibold text-ink-2">Notes on this price</summary>
          <p className="mt-1 break-words">{f.notes}</p>
        </details>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
        <span>{f.year ? `Prices ${f.year}` : ''}</span>
        {f.source && <a href={f.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Source <ExternalLink size={11} /></a>}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">Fees change yearly — always confirm with the school.</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-medium tabular">{value}</dd>
    </div>
  );
}

function InternationalCard({ s }: { s: School }) {
  const i = s.international!;
  return (
    <section className="card p-6">
      <h2 className="text-xl font-extrabold tracking-tight">International profile</h2>
      <dl className="mt-3 space-y-3 text-sm">
        {i.curriculum && <Block label="Curriculum" value={i.curriculum} />}
        {i.danishOffering && <Block label="Danish" value={i.danishOffering} />}
        {i.accreditation && <Block label="Accreditation" value={i.accreditation} />}
        {i.admission && <Block label="Admission" value={i.admission} />}
      </dl>
      {!!i.highlights?.length && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {i.highlights.map((h) => <li key={h} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-good" />{h}</li>)}
        </ul>
      )}
      {!!i.considerations?.length && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {i.considerations.map((h) => <li key={h} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--series-2)]" />{h}</li>)}
        </ul>
      )}
    </section>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="text-ink-2">{value}</dd>
    </div>
  );
}

function ExternalSection({ s }: { s: School }) {
  const x = s.external!;
  // One row per exam + measure: latest year, with earlier years inline.
  const groups = new Map<string, typeof x.exams>();
  for (const e of x.exams) {
    const k = `${e.exam}|${e.metric}`;
    groups.set(k, [...(groups.get(k) || []), e]);
  }
  const exams = [...groups.values()].map((g) => [...g].sort((a, b) => b.year - a.year))
    .sort((a, b) => a[0].exam.localeCompare(b[0].exam) || a[0].metric.localeCompare(b[0].metric));
  const ctx = Object.entries(x.context || {}).filter(([k, v]) => v !== null && v !== '' && !k.toLowerCase().includes('source'));
  const label: Record<string, string> = {
    pupilTeacherRatio: 'Pupils per teacher', averageClassSize: 'Average class size', nationalities: 'Nationalities',
    teacherTurnover: 'Teacher turnover', universityDestinations: 'University destinations',
  };
  return (
    <section className="card p-6">
      <h2 className="text-xl font-extrabold tracking-tight">Results from other sources</h2>
      <p className="mb-3 text-xs text-ink-3">Published by the school or its exam body. Not Ministry statistics, so not directly comparable with Danish exam grades.</p>
      {exams.length > 0 && (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr><th className="py-2 pr-4">Exam</th><th className="py-2 pr-4">Measure (latest year)</th><th className="py-2 pr-4 text-right">School</th><th className="py-2 pr-4 text-right">Benchmark</th><th className="py-2" /></tr>
            </thead>
            <tbody>
              {exams.map((g, i) => {
                const e = g[0];
                const history = g.slice(1, 5);
                return (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="py-2 pr-4 font-medium">{e.exam}</td>
                    <td className="py-2 pr-4 text-ink-2">
                      {e.metric}
                      <div className="text-xs text-ink-3">
                        {e.year}{e.candidates ? ` · ${e.candidates} candidates` : ''}
                        {history.length > 0 && ` · earlier: ${history.map((h) => `${fmt(h.value, h.value % 1 ? 1 : 0)} (${h.year})`).join(', ')}`}
                      </div>
                    </td>
                    <td className={clsx('py-2 pr-4 text-right font-semibold tabular', e.benchmark != null && (e.value > e.benchmark ? 'text-good' : e.value < e.benchmark ? 'text-bad' : ''))}>{fmt(e.value, e.value % 1 ? 1 : 0)}</td>
                    <td className="py-2 pr-4 text-right tabular text-ink-2" title={e.benchmarkLabel ?? undefined}>{e.benchmark != null ? fmt(e.benchmark, e.benchmark % 1 ? 1 : 0) : '—'}</td>
                    <td className="py-2">{e.sourceUrl && <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-accent" aria-label="Source"><ExternalLink size={13} /></a>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {x.wellbeing.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Wellbeing & satisfaction surveys</h3>
          <ul className="mt-1 space-y-1 text-sm text-ink-2">
            {x.wellbeing.map((w, i) => (
              <li key={i}>{w.survey} {w.year}: <b className="tabular text-ink">{fmt(w.value, w.value % 1 ? 1 : 0)}</b> {w.metric}
                {w.sourceUrl && <a href={w.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 inline-block text-accent"><ExternalLink size={11} /></a>}</li>
            ))}
          </ul>
        </div>
      )}
      {x.inspection.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Inspection & accreditation</h3>
          <ul className="mt-1 space-y-2 text-sm text-ink-2">
            {x.inspection.map((r, i) => (
              <li key={i}>
                {r.year && <span className="tabular text-ink-3">{r.year} · </span>}{r.conclusion}
                {r.concerns && <div className="mt-0.5 flex gap-1.5 text-xs"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-[var(--series-2)]" />{r.concerns}</div>}
                {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 inline-block text-accent"><ExternalLink size={11} /></a>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ctx.length > 0 && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {ctx.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
              <dt className="text-xs text-ink-3">{label[k] ?? k}</dt>
              <dd className="text-ink">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {x.notes && <p className="mt-3 text-xs text-ink-3">{x.notes}</p>}
    </section>
  );
}

function NewsSection({ s }: { s: School }) {
  const q = encodeURIComponent(`"${shortName(s.name)}"`);
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><Newspaper size={18} /> In the news</h2>
        <a className="text-xs text-accent hover:underline" href={`https://www.google.com/search?q=${q}&tbm=nws`} target="_blank" rel="noreferrer">Search more ↗</a>
      </div>
      {s.news.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">No recent articles found.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {s.news.slice(0, 12).map((n) => (
            <li key={n.url} className="py-2.5">
              <a href={n.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-accent">{n.title}</a>
              <div className="text-xs text-ink-3">{[n.source, relDate(n.date)].filter(Boolean).join(' · ')}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-3">Collected automatically from news search; may include articles only loosely related to the school.</p>
    </section>
  );
}
