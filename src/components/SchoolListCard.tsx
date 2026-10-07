import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { fmt, fmtDKK, fmtDistance, fmtDuration, fmtSigned, shortName, typeLabel } from '../lib/format';
import type { School } from '../lib/types';
import { ScoreBadge } from './ScoreBadge';
import { LangTag } from './LangTag';

/** One school in the Explore list. Clicking selects it on the map; the name opens the school page. */
export function SchoolListCard({ s, selected, isDistrict, onSelect, onHover }: {
  s: School; selected: boolean; isDistrict?: boolean; onSelect: (s: School) => void; onHover: (id: string | null) => void;
}) {
  const { scores, shortlist, toggleShortlist, travel, distanceTo, home } = useStore();
  const r = scores.get(s.id);
  const t = travel.get(s.id);
  const d = t?.distance ?? distanceTo(s);
  const on = shortlist.includes(s.id);
  const va = s.indicators.valueAdded;
  return (
    <article
      className={clsx('group relative flex gap-3.5 rounded-[20px] bg-surface p-3.5 transition sm:p-4',
        selected ? 'border-2 border-accent shadow-[0_4px_16px_color-mix(in_srgb,var(--accent)_15%,transparent)]' : 'border border-border hover:border-border-strong')}
      onMouseEnter={() => onHover(s.id)} onMouseLeave={() => onHover(null)}
    >
      <ScoreBadge result={r} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-bold leading-snug">
            {/* The stretched button makes the whole card select the school; the name link sits above it. */}
            <button type="button" className="text-left after:absolute after:inset-0 after:rounded-[20px] after:content-['']" onClick={() => onSelect(s)} aria-label={`Show ${shortName(s.name)} on the map`}>
              <span className="sr-only">Show on map: </span>
            </button>
            <Link to={`/school/${s.id}`} className="relative z-[1] hover:text-accent hover:underline">{shortName(s.name)}</Link>
          </h3>
          {home && d !== null && (
            <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold tabular">
              {t?.duration != null ? fmtDuration(t.duration) : fmtDistance(d)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
          <span>{typeLabel(s)} · {s.municipality}</span>
          {s.languages.filter((l) => l !== 'da').map((l) => <LangTag key={l} lang={l} />)}
          {isDistrict && <span className="rounded-md bg-accent px-1.5 py-px text-[11px] font-bold text-accent-ink">Your district</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-ink-2">
          <span>Exams <b className="text-ink tabular">{fmt(s.indicators.grade, 1)}</b></span>
          <span>Value added <b className={clsx('tabular', va !== null && va > 0.2 ? 'text-good' : va !== null && va < -0.2 ? 'text-bad' : 'text-ink')}>{fmtSigned(va, 1)}</b></span>
          <span>Class <b className="text-ink tabular">{fmt(s.indicators.classSize, 1)}</b></span>
          <b className="text-ink">{s.isPrivate ? (s.fees.monthly != null ? `${fmtDKK(s.fees.monthly)}/mo` : 'Fee n/a') : 'Free'}</b>
        </div>
      </div>
      <button type="button" onClick={() => toggleShortlist(s.id)} aria-pressed={on} aria-label={on ? `Remove ${shortName(s.name)} from shortlist` : `Add ${shortName(s.name)} to shortlist`}
        className={clsx('relative z-[1] -mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center self-start rounded-full hover:bg-surface-2', on ? 'text-highlight' : 'text-ink-3')}>
        <Star size={19} fill={on ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
