import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe, Mail, MapPin, Newspaper, Phone, Star, User, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { INDICATORS, unscoredReason } from '../lib/score';
import { ScoreBadge } from '../components/ScoreBadge';
import { TrendChart, type TrendSeries } from '../components/TrendChart';
import { ClimateSection, FamiliesSection, QualificationsSection } from '../components/SchoolDetails';
import { ordinal, fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, LANGUAGE_LABEL, relDate, shortName, typeLabel } from '../lib/format';
import type { Point, School } from '../lib/types';

const pinIcon = L.divIcon({ className: '', html: '<div class="school-pin" style="background:var(--accent)">●</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

export default function SchoolPage() {
  const { id } = useParams();
  const { byId, scores, data, shortlist, toggleShortlist, travel, distanceTo, home, mode } = useStore();
  const s = id ? byId.get(id) : undefined;
  if (!data) return null;
  if (!s) return <div className="mx-auto max-w-3xl p-10 text-center text-ink-2">School not found. <Link to="/" className="text-accent">Back to list</Link></div>;

  const r = scores.get(s.id);
  const bench = (key: 'grade' | 'absence' | 'classSize' | 'wellbeingTop' | 'qualifiedTeaching', who: string): Point[] =>
    Object.entries(data.benchmarks[who] || {}).filter(([, b]) => typeof b[key] === 'number').map(([y, b]) => ({ y, v: b[key]! })).sort((a, b) => a.y.localeCompare(b.y));
  const withBench = (name: string, points: Point[], key: Parameters<typeof bench>[0]): TrendSeries[] => {
    if (!points.length) return [];
    const from = points[0].y;
    return [
      { name, points, color: 'var(--series-1)' },
      { name: `${s.municipality} avg.`, points: bench(key, s.municipality).filter((p) => p.y >= from), color: 'var(--series-muted)', dashed: true, muted: true },
      { name: 'Denmark avg.', points: bench(key, '_national').filter((p) => p.y >= from), color: 'var(--series-3)', dashed: true, muted: true },
    ].filter((x) => x.points.length);
  };
  const t = travel.get(s.id);
  const inShortlist = shortlist.includes(s.id);
  const wb = s.series.wellbeing;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ArrowLeft size={14} /> All schools</Link>

      {/* Header */}
      <header className="card mb-5 overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_320px]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">{typeLabel(s)}</span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">{s.municipality}</span>
              {s.languages.map((l) => <span key={l} className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">{LANGUAGE_LABEL[l] ?? l}</span>)}
              {s.gradesOffered && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">Grades {s.gradesOffered}</span>}
              {s.teachesFrench && !s.languages.includes('fr') && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">Teaches French (2nd language)</span>}
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{shortName(s.name)}</h1>
            {s.name.includes(',') && <div className="text-ink-3">{s.name.split(',').slice(1).join(',').trim()}</div>}
            {s.profile && <p className="mt-3 max-w-2xl text-ink-2">{s.profile}</p>}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {s.address}, {s.postalCode} {s.city}</span>
              {s.website && <a className="inline-flex items-center gap-1.5 text-accent hover:underline" href={s.website} target="_blank" rel="noreferrer"><Globe size={14} /> Website</a>}
              {s.phone && <a className="inline-flex items-center gap-1.5" href={`tel:${s.phone}`}><Phone size={14} /> {s.phone}</a>}
              {s.email && <a className="inline-flex items-center gap-1.5 hover:underline" href={`mailto:${s.email}`}><Mail size={14} /> {s.email}</a>}
              {s.principal && <span className="inline-flex items-center gap-1.5"><User size={14} /> {s.principal}</span>}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className={clsx('btn', inShortlist && 'btn-primary')} onClick={() => toggleShortlist(s.id)}>
                <Star size={16} fill={inShortlist ? 'currentColor' : 'none'} /> {inShortlist ? 'On shortlist' : 'Add to shortlist'}
              </button>
              <Link className="btn" to={`/map?school=${s.id}`}><MapPin size={16} /> Route on map</Link>
              {home && (
                <span className="inline-flex items-center px-2 text-sm text-ink-2">
                  {t?.duration != null ? `${fmtDuration(t.duration)} by ${mode} · ${fmtDistance(t.distance)}` : `${fmtDistance(distanceTo(s))} straight line`}
                </span>
              )}
            </div>
          </div>
          <div className="h-56 md:h-full">
            {s.lat && s.lng && (
              <MapContainer center={[s.lat, s.lng]} zoom={15} className="h-full w-full" scrollWheelZoom={false} zoomControl={false} attributionControl={false}>
                <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[s.lat, s.lng]} icon={pinIcon} />
              </MapContainer>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          {/* Key figures */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Exam average" value={fmt(s.latest.grade, 1)} sub={s.latest.gradeYear ?? undefined} />
            <Kpi label="Value added" value={fmtSigned(s.latest.socrefDiff, 1)} sub={s.latest.socrefSignificant ? translateSig(s.latest.socrefSignificant) : undefined}
              tone={s.latest.socrefSignificant === 'Over niveau' ? 'good' : s.latest.socrefSignificant === 'Under niveau' ? 'bad' : undefined} />
            <Kpi label="Pupils" value={String(s.latest.pupils ?? '—')} sub={s.latest.pupilsYear ?? undefined} />
            <Kpi label="Class size" value={fmt(s.latest.classSize, 1)} sub="pupils per class" />
            <Kpi label="Absence" value={fmt(s.latest.absence, 1, '%')} sub={s.latest.absenceYear ?? undefined} />
            <Kpi label="Wellbeing" value={fmt(s.latest.wellbeingGeneral, 2)} sub={s.latest.wellbeingTop != null ? `${fmt(s.latest.wellbeingTop, 0)}% top wellbeing` : 'scale 1–5'} />
            <Kpi label="Qualified teaching" value={fmt(s.latest.qualifiedTeaching, 0, '%')} sub="lessons by subject-qualified teachers" />
            <Kpi label="Danish / Maths" value={`${fmt(s.latest.danish, 1)} / ${fmt(s.latest.math, 1)}`} sub="9th-grade exams" />
          </section>

          {!s.hasData && (
            <div className="card flex gap-3 p-4 text-sm text-ink-2">
              <Info size={18} className="shrink-0 text-accent" />
              <p>The Ministry publishes no statistics for this school. International schools following a foreign curriculum (e.g. French or IB) usually do not sit the Danish exams or the national wellbeing survey.</p>
            </div>
          )}

          <ChartCard title="Exam results over time" subtitle="Average in the mandatory 9th-grade exams (7-point scale)">
            <TrendChart series={withBench('This school', s.series.grade, 'grade')} digits={1} />
          </ChartCard>

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

          {s.latest.pupilsByGrade && <GradeLevels byGrade={s.latest.pupilsByGrade} year={s.latest.pupilsYear} />}

          {s.external && <ExternalSection s={s} />}

          <NewsSection s={s} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-4">
              <ScoreBadge result={r} size="lg" showNumber={false} />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Skolescore</div>
                <div className="text-3xl font-semibold tabular">{r?.score != null ? Math.round(r.score) : '—'}<span className="text-base text-ink-3"> / 100</span></div>
                {r?.rank && <div className="text-sm text-ink-2">Rank {r.rank} of {[...scores.values()].filter((x) => x.score !== null).length}</div>}
              </div>
            </div>
            {r?.score == null && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{unscoredReason(s)}</p>}
            {!!r?.estimated.length && (
              <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-ink-2">
                Exam results estimated from {s.external?.gradeEstimate?.basis}. <Link to="/about" className="text-accent hover:underline">How</Link>
              </p>
            )}
            <div className="mt-4 space-y-2.5">
              {INDICATORS.map((d) => {
                const p = r?.parts[d.key];
                return (
                  <div key={d.key} title={d.description}>
                    <div className="flex justify-between text-xs"><span className="text-ink-2">{d.label}</span><span className="tabular text-ink-3">{p != null ? `${ordinal(p)} pct${r?.estimated.includes(d.key) ? ' · est.' : ''}` : r?.notApplicable.includes(d.key) ? 'n/a for this school' : 'no data'}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      {p != null && <div className="h-full rounded-full" style={{ width: `${Math.max(p, 2)}%`, background: 'var(--series-1)' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-ink-3">Percentile among {[...scores.values()].filter((x) => x.score !== null).length} rated schools. {r && r.dataShare < 1 && `Based on ${Math.round(r.dataShare * 100)}% of the weighted indicators${r.notApplicable.length ? ' (some don’t apply to this school)' : ''}.`} <Link to="/about" className="text-accent hover:underline">How it works</Link></p>
          </section>

          <FeesCard s={s} />
          {s.international && <InternationalCard s={s} />}
        </aside>
      </div>
    </div>
  );
}

function translateSig(v: string) {
  return v === 'Over niveau' ? 'Significantly above expected' : v === 'Under niveau' ? 'Significantly below expected' : 'In line with expected';
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className={clsx('mt-0.5 text-2xl font-semibold tabular', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</div>
      {sub && <div className="truncate text-xs text-ink-3" title={sub}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-ink-3">{subtitle}</p>}
      {children}
    </section>
  );
}

function GradeLevels({ byGrade, year }: { byGrade: Record<string, number>; year: string | null }) {
  const entries = Object.entries(byGrade).map(([g, n]) => [Number(g), n] as const).sort((a, b) => a[0] - b[0]);
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Pupils per grade level</h2>
      <p className="mb-4 text-xs text-ink-3">{year} · shows how many classes (spor) each year group has</p>
      <div className="flex h-40 items-end gap-2">
        {entries.map(([g, n]) => (
          <div key={g} className="group flex flex-1 flex-col items-center gap-1" title={`${g}. klasse: ${n} pupils`}>
            <span className="text-[11px] tabular text-ink-3 opacity-0 transition group-hover:opacity-100">{n}</span>
            <div className="w-full max-w-10 rounded-t-[4px]" style={{ height: `${(n / max) * 110}px`, background: 'var(--series-1)' }} />
            <span className="text-[11px] text-ink-3">{g}.</span>
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
    <section className="card p-5">
      <h2 className="font-semibold">Costs</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="School fee" value={s.isPrivate ? (f.monthly != null ? `${fmtDKK(f.monthly)} / month` : 'Not published') : 'Free (public school)'} />
        {s.isPrivate && f.annual != null && <Row label="Per year" value={fmtDKK(f.annual)} />}
        {f.enrollment != null && <Row label="One-off fees" value={fmtDKK(f.enrollment)} />}
        <Row label={s.isPrivate ? 'After-school (SFO)' : `Municipal SFO (${s.municipality})`} value={f.sfoMonthly != null ? `${fmtDKK(f.sfoMonthly)} / month` : '—'} />
        {!s.isPrivate && sfoAnnual != null && <Row label="SFO per year" value={`≈ ${fmtDKK(sfoAnnual)}`} />}
      </dl>
      {f.siblingDiscount && <p className="mt-3 text-xs text-ink-2"><span className="font-medium text-ink">Siblings: </span>{f.siblingDiscount}</p>}
      {f.notes && <p className="mt-3 text-xs text-ink-3">{f.notes}</p>}
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
    <section className="card p-5">
      <h2 className="font-semibold">International profile</h2>
      <dl className="mt-3 space-y-3 text-sm">
        {i.curriculum && <Block label="Curriculum" value={i.curriculum} />}
        {i.frenchOffering && <Block label="French" value={i.frenchOffering} />}
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
  const exams = [...x.exams].sort((a, b) => a.exam.localeCompare(b.exam) || a.metric.localeCompare(b.metric) || b.year - a.year);
  const ctx = Object.entries(x.context || {}).filter(([k, v]) => v !== null && v !== '' && !k.toLowerCase().includes('source'));
  const label: Record<string, string> = {
    pupilTeacherRatio: 'Pupils per teacher', averageClassSize: 'Average class size', nationalities: 'Nationalities',
    teacherTurnover: 'Teacher turnover', universityDestinations: 'University destinations',
  };
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Results from other sources</h2>
      <p className="mb-3 text-xs text-ink-3">Published by the school or its exam body. Not Ministry statistics, so not directly comparable with Danish exam grades.</p>
      {exams.length > 0 && (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr><th className="py-2 pr-4">Exam</th><th className="py-2 pr-4">Year</th><th className="py-2 pr-4">Measure</th><th className="py-2 pr-4 text-right">School</th><th className="py-2 pr-4 text-right">Benchmark</th><th className="py-2" /></tr>
            </thead>
            <tbody>
              {exams.map((e, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 pr-4 font-medium">{e.exam}</td>
                  <td className="py-2 pr-4 tabular">{e.year}</td>
                  <td className="py-2 pr-4 text-ink-2">{e.metric}{e.candidates ? ` · ${e.candidates} candidates` : ''}</td>
                  <td className={clsx('py-2 pr-4 text-right font-semibold tabular', e.benchmark != null && (e.value > e.benchmark ? 'text-good' : e.value < e.benchmark ? 'text-bad' : ''))}>{fmt(e.value, e.value % 1 ? 1 : 0)}</td>
                  <td className="py-2 pr-4 text-right tabular text-ink-2" title={e.benchmarkLabel ?? undefined}>{e.benchmark != null ? fmt(e.benchmark, e.benchmark % 1 ? 1 : 0) : '—'}</td>
                  <td className="py-2">{e.sourceUrl && <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-accent" aria-label="Source"><ExternalLink size={13} /></a>}</td>
                </tr>
              ))}
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
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><Newspaper size={18} /> In the news</h2>
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
