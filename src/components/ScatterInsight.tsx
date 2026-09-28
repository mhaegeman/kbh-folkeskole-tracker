import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { School } from '../lib/types';
import { fmt, fmtSigned, shortName } from '../lib/format';

/**
 * Exam grades vs. value added: separates "high grades because of intake"
 * from "school genuinely lifts its pupils".
 */
export function ScatterInsight({ schools }: { schools: School[] }) {
  const nav = useNavigate();
  const pts = (group: 'folkeskole' | 'private') =>
    schools
      .filter((s) => s.indicators.grade !== null && s.indicators.valueAdded !== null)
      .filter((s) => (group === 'private' ? s.isPrivate : !s.isPrivate))
      .map((s) => ({ x: s.indicators.valueAdded!, y: s.indicators.grade!, z: s.latest.pupils ?? 200, id: s.id, name: shortName(s.name) }));
  const pub = pts('folkeskole');
  const priv = pts('private');
  if (pub.length + priv.length < 3) return null;

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">Grades vs. value added</h2>
          <p className="text-sm text-ink-3">Right of the line: pupils do better than their background predicts. Higher: better exam results. Click a dot to open the school.</p>
        </div>
        <div className="flex gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--series-1)' }} /> Folkeskole</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-2)' }} /> Private / international</span>
        </div>
      </div>
      <div style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: -8 }}>
            <CartesianGrid stroke="var(--grid)" />
            <XAxis type="number" dataKey="x" name="Value added" domain={['auto', 'auto']}
              tick={{ fill: 'var(--ink-3)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }}
              label={{ value: 'Value added (grade points vs. expected)', position: 'insideBottom', offset: -12, fill: 'var(--ink-3)', fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="Exam average" domain={['auto', 'auto']}
              tick={{ fill: 'var(--ink-3)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
            <ZAxis type="number" dataKey="z" range={[40, 260]} />
            <ReferenceLine x={0} stroke="var(--ink-3)" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: 'var(--ink-3)' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as { name: string; x: number; y: number; z: number } | undefined;
                if (!p) return null;
                return (
                  <div className="card px-3 py-2 text-xs shadow-lg">
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="text-ink-2">Exam average {fmt(p.y, 1)} · value added {fmtSigned(p.x, 1)}</div>
                    <div className="text-ink-3">{p.z} pupils</div>
                  </div>
                );
              }}
            />
            <Scatter data={pub} fill="var(--series-1)" fillOpacity={0.75} stroke="var(--surface)" strokeWidth={1.5}
              onClick={(d: { id: string }) => nav(`/school/${d.id}`)} cursor="pointer" isAnimationActive={false} />
            <Scatter data={priv} fill="var(--series-2)" fillOpacity={0.8} shape="square" stroke="var(--surface)" strokeWidth={1.5}
              onClick={(d: { id: string }) => nav(`/school/${d.id}`)} cursor="pointer" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
