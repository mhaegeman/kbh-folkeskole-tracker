import type { Indicators, School } from './types';

export type IndicatorKey = keyof Omit<Indicators, 'wellbeingTop'>;

export interface IndicatorDef {
  key: IndicatorKey;
  label: string;
  short: string;
  higherIsBetter: boolean;
  description: string;
}

/** The indicators that make up the Skolescore, in display order. */
export const INDICATORS: IndicatorDef[] = [
  { key: 'grade', label: 'Exam results', short: 'Grades', higherIsBetter: true,
    description: 'Average in the mandatory 9th-grade leaving exams (3-year mean, 7-point scale).' },
  { key: 'valueAdded', label: 'Value added', short: 'Value added', higherIsBetter: true,
    description: 'Grades compared with what the pupils’ socio-economic background predicts (the Ministry’s “socioøkonomisk reference”, 3-year mean). Positive = the school lifts pupils more than expected.' },
  { key: 'wellbeing', label: 'Wellbeing', short: 'Wellbeing', higherIsBetter: true,
    description: 'General wellbeing indicator from the national pupil survey, grades 4–9 (scale 1–5).' },
  { key: 'absence', label: 'Low absence', short: 'Absence', higherIsBetter: false,
    description: 'Average pupil absence in % of school days (lower is better).' },
  { key: 'qualifiedTeaching', label: 'Qualified teachers', short: 'Qualified', higherIsBetter: true,
    description: 'Share of lessons taught by teachers with a teaching qualification in the subject (“kompetencedækning”).' },
  { key: 'classSize', label: 'Smaller classes', short: 'Class size', higherIsBetter: false,
    description: 'Average number of pupils per class (lower is better).' },
  { key: 'toEducation', label: 'Goes on to education', short: 'Next step', higherIsBetter: true,
    description: 'Share of pupils in a youth education programme in September after finishing 9th/10th grade.' },
  { key: 'gradeTrend', label: 'Improving results', short: 'Trend', higherIsBetter: true,
    description: 'Direction of exam grades over the last 6 years (grade points per year).' },
  { key: 'pupilTrend', label: 'Growing popularity', short: 'Demand', higherIsBetter: true,
    description: 'Change in number of pupils over the last ~5 years — a proxy for how many families choose the school.' },
];

export type Weights = Record<IndicatorKey, number>;

export const PRESETS: { id: string; label: string; weights: Weights }[] = [
  { id: 'balanced', label: 'Balanced', weights: { grade: 22, valueAdded: 20, wellbeing: 16, absence: 10, qualifiedTeaching: 8, classSize: 7, toEducation: 7, gradeTrend: 5, pupilTrend: 5 } },
  { id: 'academic', label: 'Academic', weights: { grade: 40, valueAdded: 20, wellbeing: 8, absence: 8, qualifiedTeaching: 10, classSize: 2, toEducation: 8, gradeTrend: 4, pupilTrend: 0 } },
  { id: 'teaching', label: 'Teaching quality', weights: { grade: 8, valueAdded: 45, wellbeing: 12, absence: 5, qualifiedTeaching: 15, classSize: 5, toEducation: 5, gradeTrend: 5, pupilTrend: 0 } },
  // Only indicators published for both public and private schools, for a fair comparison.
  { id: 'like', label: 'Like-for-like', weights: { grade: 25, valueAdded: 35, wellbeing: 0, absence: 0, qualifiedTeaching: 0, classSize: 10, toEducation: 15, gradeTrend: 10, pupilTrend: 5 } },
  { id: 'wellbeing', label: 'Wellbeing first', weights: { grade: 10, valueAdded: 10, wellbeing: 40, absence: 15, qualifiedTeaching: 5, classSize: 15, toEducation: 5, gradeTrend: 0, pupilTrend: 0 } },
];

export const DEFAULT_WEIGHTS = PRESETS[0].weights;

export interface ScoreResult {
  score: number | null;           // 0–100
  letter: string | null;
  coverage: number;               // share of weight with data (0–1)
  parts: Partial<Record<IndicatorKey, number>>; // percentile 0–100 per indicator
  rank?: number;
}

/** Minimum share of the total weight that must have data for a score. */
const MIN_COVERAGE = 0.45;

export function letterFor(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B+';
  if (score >= 55) return 'B';
  if (score >= 45) return 'C+';
  if (score >= 35) return 'C';
  if (score >= 25) return 'D';
  return 'E';
}

/**
 * Percentile-rank each indicator across all schools (so scores are stable
 * under filtering), then combine with the weights. Missing indicators are
 * skipped and the remaining weights renormalised.
 */
export function computeScores(schools: School[], weights: Weights): Map<string, ScoreResult> {
  const percentiles = new Map<string, Partial<Record<IndicatorKey, number>>>();
  for (const def of INDICATORS) {
    const vals = schools
      .map((s) => ({ id: s.id, v: s.indicators[def.key] }))
      .filter((x): x is { id: string; v: number } => typeof x.v === 'number');
    const sorted = vals.map((x) => x.v).sort((a, b) => a - b);
    for (const { id, v } of vals) {
      // Mid-rank percentile handles ties fairly.
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
      const below = lo;
      let eq = 0;
      while (below + eq < sorted.length && sorted[below + eq] === v) eq++;
      let p = sorted.length > 1 ? ((below + (eq - 1) / 2) / (sorted.length - 1)) * 100 : 50;
      if (!def.higherIsBetter) p = 100 - p;
      if (!percentiles.has(id)) percentiles.set(id, {});
      percentiles.get(id)![def.key] = p;
    }
  }

  const total = INDICATORS.reduce((a, d) => a + (weights[d.key] || 0), 0) || 1;
  const out = new Map<string, ScoreResult>();
  for (const s of schools) {
    const parts = percentiles.get(s.id) || {};
    let wsum = 0, acc = 0;
    for (const d of INDICATORS) {
      const w = weights[d.key] || 0;
      const p = parts[d.key];
      if (w > 0 && typeof p === 'number') { wsum += w; acc += w * p; }
    }
    const coverage = wsum / total;
    const score = coverage >= MIN_COVERAGE && wsum > 0 ? Math.round((acc / wsum) * 10) / 10 : null;
    out.set(s.id, { score, letter: letterFor(score), coverage, parts });
  }

  const ranked = [...out.entries()].filter(([, r]) => r.score !== null).sort((a, b) => b[1].score! - a[1].score!);
  ranked.forEach(([, r], i) => { r.rank = i + 1; });
  return out;
}

export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--score-none)';
  if (score >= 75) return 'var(--score-a)';
  if (score >= 55) return 'var(--score-b)';
  if (score >= 35) return 'var(--score-c)';
  return 'var(--score-d)';
}
