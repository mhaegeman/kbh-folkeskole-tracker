import { Info, RotateCcw } from 'lucide-react';
import { INDICATORS, PRESETS } from '../lib/score';
import { useStore } from '../lib/store';

export function WeightsPanel({ compact = false }: { compact?: boolean }) {
  const { weights, setWeights } = useStore();
  const total = INDICATORS.reduce((a, d) => a + weights[d.key], 0) || 1;
  const active = PRESETS.find((p) => INDICATORS.every((d) => p.weights[d.key] === weights[d.key]))?.id;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">What matters to you?</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.id} className="chip" aria-pressed={active === p.id} onClick={() => setWeights(p.weights)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {INDICATORS.map((d) => (
          <label key={d.key} className="block">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-ink">
                {d.label}
                {!compact && (
                  <span title={d.description} className="text-ink-3 cursor-help"><Info size={13} /></span>
                )}
              </span>
              <span className="tabular text-xs text-ink-3">{Math.round((weights[d.key] / total) * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={50} step={1} value={weights[d.key]} className="w-full"
              aria-label={`Weight for ${d.label}`}
              onChange={(e) => setWeights({ ...weights, [d.key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-ink-3">◐ = score built on partial data. The Ministry doesn’t publish wellbeing, absence or teacher-qualification figures for private schools, so their score leans on exam results. Use <b>Like-for-like</b> to compare public and private schools on the same indicators.</p>
      <button className="btn text-xs" onClick={() => setWeights(PRESETS[0].weights)}>
        <RotateCcw size={14} /> Reset to balanced
      </button>
    </div>
  );
}
