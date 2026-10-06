import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { explainScore, unscoredReason, type ScoreLine } from '../lib/score';
import { useStore } from '../lib/store';
import { ordinal } from '../lib/format';
import type { School } from '../lib/types';
import { ScoreBadge } from './ScoreBadge';

const pts = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toLocaleString('da-DK', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}`;

function listNames(lines: ScoreLine[]) {
  const names = lines.map((l) => l.def.label.toLowerCase());
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** "Why this score?" — each indicator's contribution relative to a typical school (50). */
export function ScoreBreakdown({ s }: { s: School }) {
  const { scores, weights, medians } = useStore();
  const r = scores.get(s.id);
  const lines = explainScore(s, r, weights, medians);
  const scored = lines.filter((l) => l.status === 'scored' || l.status === 'estimated');
  const maxImpact = Math.max(4, ...scored.map((l) => Math.abs(l.impact)));
  const strengths = scored.filter((l) => l.impact >= 1).sort((a, b) => b.impact - a.impact).slice(0, 3);
  const weaknesses = scored.filter((l) => l.impact <= -1).sort((a, b) => a.impact - b.impact).slice(0, 3);
  const ratedCount = [...scores.values()].filter((x) => x.score !== null).length;

  return (
    <section className="card p-5" id="score-breakdown">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Why this score?</h2>
          <p className="max-w-2xl text-xs text-ink-3">
            A typical school scores 50. Each indicator moves the score up or down depending on how the school ranks (its percentile) and how much
            weight the indicator carries for this school. Contributions add up to the final score. Change the weights under
            <Link to="/" className="text-accent hover:underline"> Adjust ranking</Link>.
          </p>
        </div>
        <ScoreBadge result={r} size="md" />
      </div>

      {r?.score == null ? (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{unscoredReason(s)}</p>
      ) : (
        <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
          <b className="text-ink">Score {Math.round(r.score)}</b> — rank {r.rank} of {ratedCount}.{' '}
          {strengths.length > 0 && <>Lifted by <b className="text-ink">{listNames(strengths)}</b>. </>}
          {weaknesses.length > 0 && <>Held back by <b className="text-ink">{listNames(weaknesses)}</b>. </>}
          {!strengths.length && !weaknesses.length && 'Close to typical on every indicator. '}
          {r.credibility < 1
            ? <>Data covers only {Math.round(r.dataShare * 100)}% of the weighted indicators, so indicator effects are scaled down to {Math.round(r.credibility * 100)}% (limited-data adjustment) — the score stays closer to typical until more is known.</>
            : r.dataShare < 0.75 && <>Based on {Math.round(r.dataShare * 100)}% of the weighted indicators, so treat with some caution.</>}
        </div>
      )}

      <div className="mt-4 overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-semibold">Indicator</th>
              <th className="py-2 pr-3 font-semibold">This school</th>
              <th className="py-2 pr-3 font-semibold">Typical</th>
              <th className="py-2 pr-3 text-right font-semibold">Rank</th>
              <th className="py-2 pr-3 text-right font-semibold">Weight</th>
              <th className="w-56 py-2 text-center font-semibold">Effect on score</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const active = l.status === 'scored' || l.status === 'estimated';
              return (
                <tr key={l.def.key} className={clsx('border-t border-border', !active && 'text-ink-3')} title={l.def.description}>
                  <td className="py-2 pr-3">
                    <span className={active ? 'font-medium text-ink' : ''}>{l.def.label}</span>
                    {l.status === 'estimated' && <span className="ml-1.5 rounded bg-accent-soft px-1 text-[10px] font-semibold text-accent">EST.</span>}
                  </td>
                  <td className="py-2 pr-3 tabular">{l.value !== null ? l.def.format(l.value) : '—'}</td>
                  <td className="py-2 pr-3 tabular text-ink-3">{l.median !== null ? l.def.format(l.median) : '—'}</td>
                  <td className="py-2 pr-3 text-right tabular">{active && l.percentile !== null ? `${ordinal(l.percentile)} pct` : ''}</td>
                  <td className="py-2 pr-3 text-right tabular">{active ? `${Math.round(l.share * 100)}%` : ''}</td>
                  <td className="py-2">
                    {active && r?.score != null ? <ImpactBar impact={l.impact} max={maxImpact} /> : <span className="block text-center text-xs">{l.reason}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {r?.score != null && (
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="py-2 pr-3 font-semibold text-ink" colSpan={5}>
                  Typical school 50 {pts(r.score - 50)} = <span className="tabular">{Math.round(r.score)}</span>
                  {r.credibility < 1 && <span className="ml-2 text-xs font-normal text-ink-3">(effects scaled to {Math.round(r.credibility * 100)}% for limited data)</span>}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-3 text-[11px] text-ink-3">
        “Typical” is the median across greater Copenhagen{lines.some((l) => l.def.peer) ? ' (among public or private schools for “draws families from afar”)' : ''}.
        Rank is the school’s percentile: 100th = best. Weight is the indicator’s effective share of this school’s score. <Link to="/about" className="text-accent hover:underline">Method</Link>
      </p>
    </section>
  );
}

/** Diverging bar centred on zero: blue adds points, red subtracts. */
function ImpactBar({ impact, max }: { impact: number; max: number }) {
  const w = (Math.abs(impact) / max) * 50;
  const pos = impact >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-3 flex-1">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border" />
        <span
          className="absolute inset-y-0 rounded-[3px]"
          style={{ width: `${Math.max(w, 0.8)}%`, [pos ? 'left' : 'right']: '50%', background: pos ? 'var(--div-pos)' : 'var(--div-neg)' }}
        />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular text-ink">{pts(impact)}</span>
    </div>
  );
}
