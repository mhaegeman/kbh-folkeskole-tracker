import clsx from 'clsx';
import type { ScoreResult } from '../lib/score';
import { scoreColor } from '../lib/score';

/** Light tiers need dark text for contrast. */
export function scoreTextColor(score: number | null) {
  if (score === null) return 'var(--ink-3)';
  if (score >= 75) return 'var(--score-a-ink)';
  if (score >= 55) return 'var(--score-b-ink)';
  if (score >= 35) return 'var(--score-c-ink)';
  return 'var(--score-d-ink)';
}

export function ScoreBadge({ result, size = 'md', showNumber = true }: { result?: ScoreResult; size?: 'sm' | 'md' | 'lg'; showNumber?: boolean }) {
  const score = result?.score ?? null;
  const dims = { sm: 'h-7 min-w-7 text-[11px]', md: 'h-9 min-w-9 text-[13px]', lg: 'h-16 min-w-16 text-2xl' }[size];
  return (
    <div className="inline-flex items-center gap-2" title={score === null ? 'Not enough data for a Skolescore' : `Skolescore ${score} / 100${result && result.coverage < 0.75 ? ` — based on ${Math.round(result.coverage * 100)}% of the weighted indicators` : ''}`}>
      <span
        className={clsx('inline-grid place-items-center rounded-full px-1.5 font-bold tabular', dims)}
        style={{ background: scoreColor(score), color: scoreTextColor(score) }}
      >
        {result?.letter ?? '–'}
      </span>
      {showNumber && (
        <span className={clsx('tabular', size === 'lg' ? 'text-3xl font-semibold' : 'text-sm text-ink-2')}>
          {score === null ? <span className="text-ink-3 text-xs">n/a</span> : Math.round(score)}
          {score !== null && result && result.coverage < 0.75 && <sup className="ml-0.5 text-[10px] text-ink-3" aria-label="partial data">◐</sup>}
        </span>
      )}
    </div>
  );
}
