import clsx from 'clsx';
import type { ScoreResult } from '../lib/score';
import { scoreColor } from '../lib/score';

/** Text colour that stays readable on each score tier. */
export function scoreTextColor(score: number | null) {
  if (score === null) return 'var(--ink-3)';
  if (score >= 70) return 'var(--score-a-ink)';
  if (score >= 50) return 'var(--score-b-ink)';
  if (score >= 30) return 'var(--score-c-ink)';
  return 'var(--score-d-ink)';
}

const DIMS = {
  sm: 'h-9 w-9 rounded-[10px] text-[13px]',
  md: 'h-12 w-12 rounded-[14px] text-base',
  lg: 'h-16 w-16 rounded-[18px] text-xl',
} as const;

/**
 * Skolescore tile: the tier letter with the 0–100 score under it, filled with
 * the tier colour. ◐ marks a score built on partial data.
 */
export function ScoreBadge({ result, size = 'md', showNumber = true, className }: {
  result?: ScoreResult; size?: 'sm' | 'md' | 'lg'; showNumber?: boolean; className?: string;
}) {
  const score = result?.score ?? null;
  const partial = score !== null && result && result.dataShare < 0.75;
  const title = score === null
    ? 'Not rated — open the school page to see why'
    : `Skolescore ${Math.round(score)} / 100${partial ? ` — based on ${Math.round(result!.dataShare * 100)}% of the weighted indicators` : ''}`;
  return (
    <span
      className={clsx('relative inline-grid shrink-0 place-items-center text-center font-extrabold leading-none tabular', DIMS[size], className)}
      style={{ background: score === null ? 'var(--score-none)' : scoreColor(score), color: scoreTextColor(score) }}
      title={title}
      aria-label={title}
    >
      <span>
        <span className="block">{result?.letter ?? '–'}</span>
        {showNumber && score !== null && size !== 'sm' && (
          <span className={clsx('mt-0.5 block font-semibold opacity-90', size === 'lg' ? 'text-xs' : 'text-[11px]')}>{Math.round(score)}</span>
        )}
      </span>
      {partial && (
        <span className="absolute -right-1.5 -top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full border border-border bg-surface text-[11px] leading-none text-ink-2" aria-hidden="true">◐</span>
      )}
    </span>
  );
}
