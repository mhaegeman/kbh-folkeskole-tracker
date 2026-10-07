import { useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { INDICATORS, PRESETS, type Weights } from '../lib/score';
import { useStore } from '../lib/store';

export const PRESET_BLURB: Record<string, string> = {
  balanced: 'A bit of everything',
  academic: 'Exam results lead',
  teaching: 'How much schools lift pupils',
  wellbeing: 'Happy, safe pupils',
  like: 'Fair public vs private',
};

export function activePreset(weights: Weights) {
  return PRESETS.find((p) => INDICATORS.every((d) => p.weights[d.key] === weights[d.key])) ?? null;
}

/** "What matters to you?": presets as big choices, then the resulting weights, with sliders on demand. */
export function PriorityPicker() {
  const { weights, setWeights } = useStore();
  const [fine, setFine] = useState(false);
  const total = INDICATORS.reduce((a, d) => a + weights[d.key], 0) || 1;
  const active = activePreset(weights);
  const max = Math.max(...INDICATORS.map((d) => weights[d.key] / total), 0.01);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-2">Pick a starting point. The ranking updates as you go.</p>
      <div role="radiogroup" aria-label="Priority" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {PRESETS.map((p) => {
          const on = active?.id === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setWeights(p.weights)}
              className={clsx('min-h-16 rounded-2xl px-4 py-3 text-left transition',
                on ? 'border-2 border-accent bg-accent-soft' : 'border border-border bg-surface hover:border-border-strong')}>
              <span className="block font-bold">{p.label}</span>
              <span className="block text-[13px] text-ink-2">{PRESET_BLURB[p.id]}</span>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="eyebrow">{active ? 'How it’s weighted' : 'Your custom weights'}</h3>
          <button type="button" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-accent" onClick={() => setFine((f) => !f)} aria-pressed={fine}>
            <SlidersHorizontal size={15} /> {fine ? 'Done' : 'Fine-tune'}
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {INDICATORS.map((d) => {
            const share = weights[d.key] / total;
            return fine ? (
              <label key={d.key} className="block" title={d.description}>
                <span className="flex justify-between text-sm"><span>{d.label}</span><span className="font-bold tabular">{Math.round(share * 100)}%</span></span>
                <input type="range" min={0} max={50} step={1} value={weights[d.key]} className="w-full" aria-label={`Weight for ${d.label}`}
                  onChange={(e) => setWeights({ ...weights, [d.key]: Number(e.target.value) })} />
              </label>
            ) : (
              <div key={d.key} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3" title={d.description}>
                <span className={clsx('truncate text-[13px]', share === 0 ? 'text-ink-3' : 'text-ink')}>{d.label}</span>
                <span className="relative h-2 rounded-full bg-surface-2">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(share / max) * 100}%` }} />
                </span>
                <span className={clsx('text-right text-[13px] font-bold tabular', share === 0 && 'text-ink-3')}>{Math.round(share * 100)}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-ink-3">
        ◐ marks a score built on partial data: the Ministry doesn’t publish wellbeing, absence or teacher figures for private schools.
        Like-for-like compares every school on the same indicators.
      </p>
      {!active && (
        <button type="button" className="btn w-full" onClick={() => setWeights(PRESETS[0].weights)}><RotateCcw size={15} /> Back to Balanced</button>
      )}
    </div>
  );
}
