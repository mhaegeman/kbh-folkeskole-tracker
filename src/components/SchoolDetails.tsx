import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { ClimateItem, School } from '../lib/types';
import { fmt, fmtSigned } from '../lib/format';
import { TrendChart } from './TrendChart';

/** Is the school clearly better/worse than the municipality on this item? */
function tone(item: { value: number; municipality: number | null; polarity: 'good' | 'bad' }, threshold: number) {
  if (item.municipality === null) return null;
  const diff = item.value - item.municipality;
  if (Math.abs(diff) < threshold) return null;
  return (item.polarity === 'good') === diff > 0 ? 'good' : 'bad';
}

/** Horizontal 0–100% bar with municipality and national markers. */
function ShareBar({ item }: { item: ClimateItem }) {
  const t = tone(item, 3);
  const color = t === 'good' ? 'var(--good)' : t === 'bad' ? 'var(--bad)' : 'var(--series-1)';
  return (
    <div className="relative h-2.5 rounded-full bg-surface-2">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(item.value, 1)}%`, background: color, opacity: item.reliable ? 1 : 0.45 }} />
      {item.municipality !== null && (
        <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-ink" style={{ left: `${item.municipality}%` }} title={`Municipality ${fmt(item.municipality, 1)}%`} />
      )}
      {item.national !== null && (
        <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-ink-3" style={{ left: `${item.national}%` }} title={`Denmark ${fmt(item.national, 1)}%`} />
      )}
    </div>
  );
}

export function ClimateSection({ s }: { s: School }) {
  const items = s.climate;
  if (!items?.length) return null;
  const year = items[0].year;
  const bad = items.filter((i) => i.polarity === 'bad');
  const good = items.filter((i) => i.polarity === 'good');
  const bullied = items.find((i) => i.key === 'bullied');
  const safe = items.find((i) => i.key === 'safe');

  const Group = ({ title, list }: { title: string; list: ClimateItem[] }) => (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{title}</h3>
      <ul className="space-y-3">
        {list.map((i) => {
          const t = tone(i, 3);
          return (
            <li key={i.key} title={`“${i.question}” — ${i.n} answers${i.reliable ? '' : ' (few answers: read with care)'}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-2">{i.label} <span className="text-xs text-ink-3">· gr. {i.band}</span></span>
                <span className={clsx('shrink-0 font-semibold tabular', t === 'good' && 'text-good', t === 'bad' && 'text-bad')}>
                  {fmt(i.value, 0)}%
                  <span className="ml-1.5 text-xs font-normal text-ink-3">vs {fmt(i.municipality, 0)}%</span>
                </span>
              </div>
              <ShareBar item={i} />
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Social climate</h2>
      <p className="mb-4 text-xs text-ink-3">
        Answers from the national pupil wellbeing survey, {year}. Black marker = {s.municipality} average, grey = Denmark.
        Green/red = clearly better/worse than the municipality (≥ 3 points).
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Group title="Warning signs (lower is better)" list={bad} />
        <Group title="Positive signs (higher is better)" list={good} />
      </div>
      {(bullied?.trend.length ?? 0) > 1 && (
        <div className="mt-5">
          <h3 className="mb-1 text-sm font-medium">Over time</h3>
          <TrendChart height={180} digits={0} suffix="%" series={[
            { name: 'Bullied (4–9)', points: bullied!.trend, color: 'var(--series-2)' },
            ...(safe ? [{ name: 'Feel safe (4–9)', points: safe.trend, color: 'var(--series-1)' }] : []),
          ]} />
        </div>
      )}
      {items.some((i) => !i.reliable) && (
        <p className="mt-3 flex gap-1.5 text-xs text-ink-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Faded bars are based on fewer than 20 answers.</p>
      )}
    </section>
  );
}

export function FamiliesSection({ s }: { s: School }) {
  const outside = s.fromOutside;
  const flow = s.cohortFlow;
  if (!outside.length && !flow.length) return null;
  const latestOutside = outside.at(-1);
  const retention = s.indicators.retention;
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Do families choose this school?</h2>
      <p className="mb-4 text-xs text-ink-3">Two signals of reputation: families travelling in from other municipalities, and whether year groups grow or shrink as children move up.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <div className="text-xs text-ink-3">Pupils living outside {s.municipality}</div>
          <div className="text-2xl font-semibold tabular">{fmt(latestOutside?.v, 0)}%</div>
          <div className="text-xs text-ink-3">{latestOutside?.y}</div>
        </div>
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <div className="text-xs text-ink-3">Year groups from one year to the next</div>
          <div className={clsx('text-2xl font-semibold tabular', (retention ?? 0) > 1 && 'text-good', (retention ?? 0) < -3 && 'text-bad')}>
            {retention === null ? '—' : `${fmtSigned(retention, 1)}%`}
          </div>
          <div className="text-xs text-ink-3">{retention === null ? 'not enough data' : retention >= 0 ? 'pupils join (3-year average)' : 'pupils leave (3-year average)'}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {outside.length > 1 && (
          <div>
            <h3 className="mb-1 text-sm font-medium">From outside the municipality</h3>
            <TrendChart height={170} digits={1} suffix="%" series={[{ name: 'From outside', points: outside, color: 'var(--series-1)' }]} />
          </div>
        )}
        {flow.length > 1 && (
          <div>
            <h3 className="mb-1 text-sm font-medium">Net change of year groups</h3>
            <TrendChart height={170} digits={1} suffix="%" zeroLine series={[{ name: 'Net change', points: flow, color: 'var(--series-1)' }]} />
          </div>
        )}
      </div>
    </section>
  );
}

const SUBJECT_EN: Record<string, string> = {
  Dansk: 'Danish', Matematik: 'Maths', Engelsk: 'English', Billedkunst: 'Visual arts', Biologi: 'Biology',
  'Fransk 2. fremmedsprog': 'French (2nd language)', 'Tysk 2. fremmedsprog': 'German (2nd language)', 'Tysk 3. fremmedsprog': 'German (3rd language)',
  'Fysik/kemi': 'Physics/chemistry', Geografi: 'Geography', Historie: 'History', 'Håndværk og Design': 'Crafts & design',
  Idræt: 'PE', Kristendomskundskab: 'Religious studies', Madkundskab: 'Food & cooking', Musik: 'Music',
  'Natur/teknik': 'Science (gr. 1–6)', Samfundsfag: 'Social studies',
};
const subjectEn = (s: string) => {
  const elective = s.startsWith('Praktisk/Musisk valgfag: ');
  const base = s.replace('Praktisk/Musisk valgfag: ', '').replace('Håndværk/design', 'Håndværk og Design');
  return (elective ? 'Elective: ' : '') + (SUBJECT_EN[base] ?? base);
};

const STAGES = ['Indskoling', 'Mellemtrin', 'Udskoling'];
const STAGE_LABEL: Record<string, string> = { Indskoling: 'Gr. 0–3', Mellemtrin: 'Gr. 4–6', Udskoling: 'Gr. 7–9' };

export function QualificationsSection({ s }: { s: School }) {
  const q = s.qualifiedBySubject;
  if (!q?.rows.length) return null;
  const stages = STAGES.filter((st) => q.rows.some((r) => r.stage === st));
  const subjects = [...new Set(q.rows.map((r) => r.subject))]
    .sort((a, b) => {
      const core = ['Dansk', 'Matematik', 'Engelsk'];
      const ia = core.indexOf(a), ib = core.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.localeCompare(b, 'da');
    });
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Teacher qualifications by subject</h2>
      <p className="mb-3 text-xs text-ink-3">
        Share of lessons taught by a teacher qualified in the subject ({q.year}). Red = 10+ points below the {s.municipality} average; hover a value for the averages.
      </p>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr>
              <th className="py-2 pr-4">Subject</th>
              {stages.map((st) => <th key={st} className="py-2 pr-4 text-right">{STAGE_LABEL[st] ?? st}</th>)}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj) => (
              <tr key={subj} className="border-t border-border">
                <td className="py-1.5 pr-4 text-ink-2">
                  {subjectEn(subj)}
                </td>
                {stages.map((st) => {
                  const r = q.rows.find((x) => x.subject === subj && x.stage === st);
                  if (!r) return <td key={st} className="py-1.5 pr-4 text-right text-ink-3">—</td>;
                  const below = r.municipality !== null && r.value < r.municipality - 10;
                  return (
                    <td key={st} className={clsx('py-1.5 pr-4 text-right tabular', below && 'font-semibold text-bad')}
                      title={`${s.municipality} ${fmt(r.municipality, 0)}% · Denmark ${fmt(r.national, 0)}%`}>
                      {fmt(r.value, 0)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
