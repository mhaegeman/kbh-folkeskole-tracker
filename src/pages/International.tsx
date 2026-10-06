import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, Star } from 'lucide-react';
import { useStore } from '../lib/store';
import { ScoreBadge } from '../components/ScoreBadge';
import { fmtDKK, shortName } from '../lib/format';
import { LangTag } from '../components/LangTag';

export default function International() {
  const { schools, scores, shortlist, toggleShortlist } = useStore();
  const intl = schools.filter((s) => s.international).sort((a, b) => shortName(a.name).localeCompare(shortName(b.name), 'da'));
  const others = schools.filter((s) => s.isInternational && !s.international);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <header className="mb-6 max-w-3xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">International & bilingual schools</h1>
        <p className="mt-2 text-ink-2">
          Schools that teach in a language other than Danish, or follow a curriculum from abroad: <b>international schools</b> (IB, Cambridge,
          a national curriculum from abroad), the <b>European School</b>, and <b>Danish schools with a bilingual or international department</b>.
          Languages, fees and admission rules differ a lot, so check the details with each school.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {intl.map((s) => {
          const i = s.international!;
          return (
            <article key={s.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1 text-xs text-ink-3">{s.municipality} · {s.languages.map((l) => <LangTag key={l} lang={l} />)}</div>
                  <Link to={`/school/${s.id}`} className="font-display text-xl font-semibold hover:text-accent">{shortName(s.name)}</Link>
                  <div className="text-sm text-ink-2">{i.curriculum}</div>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge result={scores.get(s.id)} size="sm" showNumber={false} />
                  <button onClick={() => toggleShortlist(s.id)} aria-label="Toggle shortlist"
                    className={shortlist.includes(s.id) ? 'text-[var(--series-2)]' : 'text-ink-3 hover:text-ink'}>
                    <Star size={18} fill={shortlist.includes(s.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-ink-3">Fee (primary)</dt>
                  <dd className="font-semibold tabular">{s.isPrivate ? (s.fees.annual ? `${fmtDKK(s.fees.annual)} / yr` : fmtDKK(s.fees.monthly)) : 'Free'}</dd>
                  {s.fees.year && <dd className="text-[11px] text-ink-3">{s.fees.year}</dd>}
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-ink-3">Grades</dt>
                  <dd className="font-semibold">{s.gradesOffered ?? '—'}</dd>
                  {s.latest.pupils && <dd className="text-[11px] text-ink-3">{s.latest.pupils} pupils</dd>}
                </div>
              </dl>
              <div className="mt-4 space-y-2 text-sm">
                {i.danishOffering && <p><span className="font-medium">Danish: </span><span className="text-ink-2">{i.danishOffering}</span></p>}
              </div>
              {!!i.highlights?.length && (
                <ul className="mt-3 space-y-1 text-sm">
                  {i.highlights.slice(0, 3).map((h) => <li key={h} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-good" /><span className="text-ink-2">{h}</span></li>)}
                </ul>
              )}
              {!!i.considerations?.length && (
                <ul className="mt-2 space-y-1 text-sm">
                  {i.considerations.slice(0, 2).map((h) => <li key={h} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--series-2)]" /><span className="text-ink-2">{h}</span></li>)}
                </ul>
              )}
              <div className="mt-auto flex gap-2 pt-4">
                <Link to={`/school/${s.id}`} className="btn btn-primary text-sm">Details</Link>
                {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="btn text-sm">Website <ExternalLink size={13} /></a>}
              </div>
            </article>
          );
        })}
      </div>

      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Other schools with an international profile</h2>
          <div className="card mt-4 divide-y divide-border">
            {others.map((s) => (
              <Link key={s.id} to={`/school/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <ScoreBadge result={scores.get(s.id)} size="sm" showNumber={false} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{shortName(s.name)}</div>
                  <div className="truncate text-xs text-ink-3">{s.municipality} · {s.profile ?? s.curriculum}</div>
                </div>
                <div className="text-sm tabular text-ink-2">{fmtDKK(s.fees.monthly)}{s.fees.monthly ? '/mo' : ''}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
