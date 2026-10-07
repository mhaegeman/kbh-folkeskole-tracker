import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import type { Point } from '../lib/types';
import { fmt } from '../lib/format';

export interface TrendSeries {
  name: string;
  points: Point[];
  color: string;
  dashed?: boolean;
  muted?: boolean;
}

/** Multi-series line chart over school years, with a hover crosshair tooltip. */
export function TrendChart({ series, digits = 1, suffix = '', height = 220, domain, zeroLine }: {
  series: TrendSeries[]; digits?: number; suffix?: string; height?: number;
  domain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax']; zeroLine?: boolean;
}) {
  const years = [...new Set(series.flatMap((s) => s.points.map((p) => p.y)))].sort();
  const rows = years.map((y) => {
    const r: Record<string, string | number | null> = { y: y.replace(/^(\d{4})\/(\d{2})(\d{2})$/, '$1/$3') };
    for (const s of series) r[s.name] = s.points.find((p) => p.y === y)?.v ?? null;
    return r;
  });
  if (!rows.length) return <EmptyChart height={height} />;
  const showLegend = series.length > 1;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="y" tick={{ fill: 'var(--ink-3)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={16} />
          <YAxis tick={{ fill: 'var(--ink-3)', fontSize: 11 }} tickLine={false} axisLine={false} domain={domain ?? ['auto', 'auto']}
            tickFormatter={(v: number) => fmt(v, digits)} width={44} />
          {zeroLine && <ReferenceLine y={0} stroke="var(--ink-3)" strokeDasharray="2 3" />}
          <Tooltip
            cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1 }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--ink)' }}
            labelStyle={{ color: 'var(--ink-2)', fontWeight: 600 }}
            formatter={(v: number | string) => (typeof v === 'number' ? fmt(v, digits, suffix) : v)}
          />
          {showLegend && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'var(--ink-2)' }} />}
          {series.map((s) => (
            <Line key={s.name} type="linear" dataKey={s.name} stroke={s.color} strokeWidth={s.muted ? 1.5 : 2}
              strokeDasharray={s.dashed ? '4 4' : undefined} dot={s.muted ? false : { r: 3, strokeWidth: 0, fill: s.color }}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmptyChart({ height = 220 }: { height?: number }) {
  return (
    <div className="grid place-items-center rounded-xl bg-surface-2 text-sm text-ink-3" style={{ height }}>
      No published data
    </div>
  );
}

/** Tiny inline trend line for tables. */
export function Sparkline({ points, width = 72, height = 22 }: { points: Point[]; width?: number; height?: number }) {
  const p = points.slice(-8);
  if (p.length < 2) return <span className="text-ink-3">—</span>;
  const vs = p.map((x) => x.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const d = p.map((x, i) => `${i ? 'L' : 'M'}${(i / (p.length - 1)) * (width - 4) + 2},${height - 3 - ((x.v - min) / span) * (height - 6)}`).join(' ');
  const up = vs[vs.length - 1] >= vs[0];
  return (
    <svg width={width} height={height} aria-label={`Trend from ${fmt(vs[0])} to ${fmt(vs[vs.length - 1])}`}>
      <path d={d} fill="none" stroke={up ? 'var(--series-1)' : 'var(--series-2)'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
