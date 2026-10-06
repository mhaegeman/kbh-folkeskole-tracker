import type { Indicators, School } from './types';

export type IndicatorKey = keyof Omit<Indicators, 'wellbeingTop' | 'pupilTrend'>;

export interface IndicatorDef {
  key: IndicatorKey;
  label: string;
  short: string;
  higherIsBetter: boolean;
  description: string;
  /** Formats a raw value for the score breakdown. */
  format: (v: number) => string;
  /** Rank within a peer group instead of across all schools. */
  peer?: (s: School) => string;
}

const n = (v: number, d: number) => v.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v: number, d: number) => {
  const r = Number(v.toFixed(d));
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + n(Math.abs(r), d);
};

/** The indicators that make up the Skolescore, in display order. */
export const INDICATORS: IndicatorDef[] = [
  { key: 'grade', label: 'Exam results', short: 'Grades', higherIsBetter: true, format: (v) => `${n(v, 1)} avg. grade`,
    description: 'Average in the mandatory 9th-grade leaving exams (3-year mean, 7-point scale).' },
  { key: 'valueAdded', label: 'Value added', short: 'Value added', higherIsBetter: true, format: (v) => `${signed(v, 2)} grade pts vs expected`,
    description: 'Grades compared with what the pupils’ socio-economic background predicts (the Ministry’s “socioøkonomisk reference”, 3-year mean). Positive = the school lifts pupils more than expected.' },
  { key: 'wellbeing', label: 'Wellbeing', short: 'Wellbeing', higherIsBetter: true, format: (v) => `${n(v, 2)} / 5`,
    description: 'General wellbeing indicator from the national pupil survey, grades 4–9 (scale 1–5).' },
  { key: 'climate', label: 'Social climate', short: 'Climate', higherIsBetter: true, format: (v) => `${signed(v, 1)} pts vs Denmark`,
    description: 'Average of the survey questions on bullying, teasing, loneliness, feeling safe, belonging, liking the school and calm in class: how many percentage points better (+) or worse (−) the school is than the national figure.' },
  { key: 'absence', label: 'Low absence', short: 'Absence', higherIsBetter: false, format: (v) => `${n(v, 1)}% of days`,
    description: 'Average pupil absence in % of school days (lower is better).' },
  { key: 'qualifiedTeaching', label: 'Qualified teachers', short: 'Qualified', higherIsBetter: true, format: (v) => `${n(v, 0)}% of lessons`,
    description: 'Share of lessons taught by a teacher qualified in the subject — Danish, maths and English when published per subject, otherwise all subjects.' },
  { key: 'classSize', label: 'Smaller classes', short: 'Class size', higherIsBetter: false, format: (v) => `${n(v, 1)} pupils`,
    description: 'Average number of pupils per class (lower is better).' },
  { key: 'toEducation', label: 'Goes on to education', short: 'Next step', higherIsBetter: true, format: (v) => `${n(v, 0)}% of leavers`,
    description: 'Share of pupils in a youth education programme in September after finishing 9th/10th grade.' },
  { key: 'gradeTrend', label: 'Improving results', short: 'Trend', higherIsBetter: true, format: (v) => `${signed(v, 2)} grade pts / year`,
    description: 'Direction of exam grades over the last 6 years (grade points per year).' },
  { key: 'retention', label: 'Families stay & join', short: 'Retention', higherIsBetter: true, format: (v) => `${signed(v, 1)}% per year group`,
    description: 'How year groups change from one school year to the next (e.g. 3rd → 4th grade), averaged over the last 3 years. Positive = pupils join, negative = families move their children elsewhere. The 6th → 7th step is skipped because many pupils change school there by design.' },
  { key: 'fromOutside', label: 'Draws families from afar', short: 'Draw', higherIsBetter: true, format: (v) => `${n(v, 0)}% from other municipalities`,
    peer: (s) => (s.isPrivate ? 'private' : 'public'),
    description: 'Share of pupils living outside the school’s municipality (3-year mean) — families choosing to travel. Ranked among public or among private schools, since private schools naturally recruit more widely.' },
];

export type Weights = Record<IndicatorKey, number>;

export const PRESETS: { id: string; label: string; weights: Weights }[] = [
  { id: 'balanced', label: 'Balanced', weights: { grade: 18, valueAdded: 17, wellbeing: 11, climate: 13, absence: 8, qualifiedTeaching: 9, classSize: 6, toEducation: 6, gradeTrend: 4, retention: 5, fromOutside: 3 } },
  { id: 'academic', label: 'Academic', weights: { grade: 35, valueAdded: 20, wellbeing: 5, climate: 5, absence: 7, qualifiedTeaching: 12, classSize: 2, toEducation: 8, gradeTrend: 4, retention: 2, fromOutside: 0 } },
  { id: 'teaching', label: 'Teaching quality', weights: { grade: 8, valueAdded: 40, wellbeing: 8, climate: 8, absence: 5, qualifiedTeaching: 15, classSize: 5, toEducation: 5, gradeTrend: 4, retention: 2, fromOutside: 0 } },
  // Only indicators published for both public and private schools, for a fair comparison.
  { id: 'like', label: 'Like-for-like', weights: { grade: 26, valueAdded: 32, wellbeing: 0, climate: 0, absence: 0, qualifiedTeaching: 0, classSize: 11, toEducation: 13, gradeTrend: 8, retention: 7, fromOutside: 3 } },
  { id: 'wellbeing', label: 'Wellbeing first', weights: { grade: 8, valueAdded: 8, wellbeing: 25, climate: 25, absence: 12, qualifiedTeaching: 4, classSize: 12, toEducation: 2, gradeTrend: 0, retention: 4, fromOutside: 0 } },
];

export const DEFAULT_WEIGHTS = PRESETS[0].weights;

export interface ScoreResult {
  score: number | null;           // 0–100
  letter: string | null;
  coverage: number;               // share of the *applicable* weight with data (0–1)
  dataShare: number;              // share of the total weight with data (0–1)
  parts: Partial<Record<IndicatorKey, number>>; // percentile 0–100 per indicator
  notApplicable: IndicatorKey[];
  estimated: IndicatorKey[];      // indicators derived from non-Ministry sources
  /** Multiplier (0–1) pulling the score toward 50 when little data exists. */
  credibility: number;
  rank?: number;
}

/** Minimum share of the applicable weight that must have data for a score. */
const MIN_COVERAGE = 0.6;
/**
 * Below this share of the total weight with data, the score is pulled toward
 * 50 proportionally: less evidence → a less extreme score.
 */
export const FULL_CREDIBILITY = 0.6;
/** A score needs at least one of these outcome measures. */
const OUTCOMES: IndicatorKey[] = ['grade', 'valueAdded', 'wellbeing', 'climate', 'absence'];

/**
 * Indicators that cannot exist for a school, as opposed to missing data:
 * schools without 9th grade sit no leaving exams, and the Ministry does not
 * publish wellbeing, survey answers, absence or teacher qualifications for
 * private schools.
 */
export function notApplicable(s: School): IndicatorKey[] {
  const na: IndicatorKey[] = [];
  if (s.topGrade !== null && s.topGrade < 9) na.push('grade', 'valueAdded', 'toEducation', 'gradeTrend');
  const survey: IndicatorKey[] = ['wellbeing', 'climate', 'absence', 'qualifiedTeaching'];
  if (s.isPrivate) na.push(...survey);
  // Public international schools (e.g. the European School) don't take part either.
  else if (s.isInternational) na.push(...survey.filter((k) => s.indicators[k] === null));
  // Foreign-curriculum schools that don't sit the Danish exams (Sankt Petri, say, does):
  // no Danish value added, and leavers mostly continue abroad or in the school's own
  // IB/Bac track, which the Danish youth-education statistic doesn't capture.
  if (s.isInternational && s.indicators.grade === null) na.push('valueAdded', 'toEducation');
  return [...new Set(na)];
}

/** Indicator value, falling back to estimates from non-Ministry sources. */
function valueOf(s: School, key: IndicatorKey): { v: number | null; estimated: boolean } {
  const v = s.indicators[key];
  if (typeof v === 'number') return { v, estimated: false };
  if (key === 'grade' && s.external?.gradeEstimate) return { v: s.external.gradeEstimate.value, estimated: true };
  return { v: null, estimated: false };
}

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
const peerOf = (def: IndicatorDef, s: School) => def.peer?.(s) ?? 'all';

/** Median official value per indicator and peer group, for context in the breakdown. */
export type Medians = Partial<Record<IndicatorKey, Record<string, number>>>;
export function computeMedians(schools: School[]): Medians {
  const out: Medians = {};
  for (const def of INDICATORS) {
    const groups = new Map<string, number[]>();
    for (const s of schools) {
      const v = s.indicators[def.key];
      if (typeof v !== 'number') continue;
      const g = peerOf(def, s);
      groups.set(g, [...(groups.get(g) || []), v]);
    }
    out[def.key] = Object.fromEntries([...groups].map(([g, vs]) => {
      vs.sort((a, b) => a - b);
      return [g, vs.length % 2 ? vs[vs.length >> 1] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2];
    }));
  }
  return out;
}

/**
 * Combines percentiles into a score: indicators are averaged over those with
 * data, then shrunk toward 50 when evidence is thin.
 */
function combine(parts: Partial<Record<IndicatorKey, number>>, na: IndicatorKey[], weights: Weights) {
  let total = 0, used = 0, acc = 0, applicable = 0;
  for (const d of INDICATORS) {
    const w = weights[d.key] || 0;
    const p = parts[d.key];
    total += w;
    if (!na.includes(d.key)) applicable += w;
    if (w > 0 && typeof p === 'number' && !na.includes(d.key)) { used += w; acc += w * p; }
  }
  const avg = used ? acc / used : 50;
  const credibility = total ? Math.min(1, used / total / FULL_CREDIBILITY) : 0;
  return { score: 50 + (avg - 50) * credibility, credibility, total, used, applicable };
}

export function computeScores(schools: School[], weights: Weights): Map<string, ScoreResult> {
  const percentiles = new Map<string, Partial<Record<IndicatorKey, number>>>();
  const estimatedBy = new Map<string, IndicatorKey[]>();
  for (const def of INDICATORS) {
    // Percentiles are ranked among Ministry values only (within the peer group),
    // so estimates don't shift other schools.
    const official = new Map<string, number[]>();
    for (const s of schools) {
      const v = s.indicators[def.key];
      if (typeof v !== 'number') continue;
      const g = peerOf(def, s);
      official.set(g, [...(official.get(g) || []), v]);
    }
    for (const vs of official.values()) vs.sort((a, b) => a - b);
    for (const s of schools) {
      const { v, estimated } = valueOf(s, def.key);
      if (v === null) continue;
      const sorted = official.get(peerOf(def, s)) || [];
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
      let eq = 0;
      while (lo + eq < sorted.length && sorted[lo + eq] === v) eq++;
      // Mid-rank percentile handles ties fairly.
      let p = sorted.length > 1 ? Math.min(100, Math.max(0, ((lo + (eq ? (eq - 1) / 2 : 0)) / (sorted.length - 1)) * 100)) : 50;
      if (!def.higherIsBetter) p = 100 - p;
      if (!percentiles.has(s.id)) percentiles.set(s.id, {});
      percentiles.get(s.id)![def.key] = p;
      if (estimated) estimatedBy.set(s.id, [...(estimatedBy.get(s.id) || []), def.key]);
    }
  }

  const out = new Map<string, ScoreResult>();
  for (const s of schools) {
    const parts = percentiles.get(s.id) || {};
    const na = notApplicable(s);
    const f = combine(parts, na, weights);
    const coverage = f.applicable ? Math.min(1, f.used / f.applicable) : 0;
    const hasOutcome = OUTCOMES.some((k) => typeof parts[k] === 'number' && (weights[k] || 0) > 0 && !na.includes(k));
    const score = coverage >= MIN_COVERAGE && hasOutcome && f.used > 0 ? Math.round(f.score * 10) / 10 : null;
    out.set(s.id, {
      score, letter: letterFor(score), coverage, dataShare: f.used / (f.total || 1), parts, notApplicable: na,
      estimated: estimatedBy.get(s.id) || [], credibility: f.credibility,
    });
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

/** Plain-language reason a school has no Skolescore. */
export function unscoredReason(s: School): string {
  if (s.isNew) return `Opened ${s.founded ?? 'recently'} — no published results yet.`;
  if (s.isInternational && !s.hasData) return 'Follows a foreign curriculum, so Danish exam and survey statistics don’t exist for it.';
  if (s.isInternational) return 'Follows a foreign curriculum; the Ministry only publishes pupil numbers and class sizes for it.';
  if (s.isPrivate && s.topGrade !== null && s.topGrade < 9) return 'Private school without 9th grade: no leaving exams, and the Ministry publishes no wellbeing data for private schools.';
  if (s.isPrivate) return 'Doesn’t sit the Danish leaving exams (e.g. Steiner/Waldorf schools are exempt), and the Ministry publishes no wellbeing data for private schools.';
  return 'Not enough published data for a fair score.';
}

/** Why an indicator doesn't apply to a school (see notApplicable). */
export function notApplicableReason(s: School, key: IndicatorKey): string {
  const exam: IndicatorKey[] = ['grade', 'valueAdded', 'toEducation', 'gradeTrend'];
  if (s.topGrade !== null && s.topGrade < 9 && exam.includes(key)) return `School stops at ${s.topGrade}th grade — no leaving exams`;
  if (s.isInternational && s.indicators.grade === null && (key === 'valueAdded' || key === 'toEducation')) return 'Foreign curriculum — Danish measure doesn’t apply';
  if (s.isPrivate) return 'Not published by the Ministry for private schools';
  if (s.isInternational) return 'Not collected for international schools';
  return 'Not applicable';
}

export interface ScoreLine {
  def: IndicatorDef;
  status: 'scored' | 'estimated' | 'na' | 'missing' | 'off';
  value: number | null;
  median: number | null;
  percentile: number | null;
  /** Share of this school's score carried by the indicator (0–1). */
  share: number;
  /** Points added to / subtracted from a typical score of 50. */
  impact: number;
  reason?: string;
}

/**
 * Explains a score as 50 (typical school) plus each indicator's impact:
 * (percentile − 50) × the indicator's share of the weights used. The impacts
 * sum exactly to score − 50.
 */
export function explainScore(s: School, r: ScoreResult | undefined, weights: Weights, medians: Medians): ScoreLine[] {
  const na = r?.notApplicable ?? [];
  const f = r ? combine(r.parts, na, weights) : null;
  return INDICATORS.map((def) => {
    const w = weights[def.key] || 0;
    const p = r?.parts[def.key];
    const raw = s.indicators[def.key] ?? (def.key === 'grade' ? s.external?.gradeEstimate?.value ?? null : null);
    const median = medians[def.key]?.[def.peer?.(s) ?? 'all'] ?? null;
    const base = { def, value: typeof raw === 'number' ? raw : null, median, percentile: typeof p === 'number' ? p : null };
    if (na.includes(def.key)) return { ...base, status: 'na' as const, share: 0, impact: 0, reason: notApplicableReason(s, def.key) };
    if (w === 0) return { ...base, status: 'off' as const, share: 0, impact: 0, reason: 'Weight set to 0' };
    if (typeof p !== 'number' || !f) return { ...base, status: 'missing' as const, share: 0, impact: 0, reason: 'No published data' };
    // Effective share of the final score, including the credibility shrink.
    const share = (w / f.used) * f.credibility;
    const status = r?.estimated.includes(def.key) ? ('estimated' as const) : ('scored' as const);
    return { ...base, status, share, impact: r?.score === null ? 0 : (p - 50) * share };
  });
}
