// Merges the raw register, official statistics, curated research (fees,
// international profiles, SFO prices) and news into public/data/schools.json.
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { RAW, CURATED, PUBLIC_DATA } from './config.mjs';

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);

const register = readJson(path.join(RAW, 'register.json'), []);
const stats = readJson(path.join(RAW, 'stats.json'), { datasets: {} });
const ds = stats.datasets;

const fees = {};
for (const f of readdirSync(CURATED).filter((f) => /^fees_\d+\.json$/.test(f))) {
  for (const row of readJson(path.join(CURATED, f), [])) fees[String(row.id)] = row;
}
const international = readJson(path.join(CURATED, 'international.json'), []);
const internationalById = Object.fromEntries(international.filter((x) => x.id).map((x) => [String(x.id), x]));
const municipalSfo = readJson(path.join(CURATED, 'municipal_sfo.json'), {});
const overrides = readJson(path.join(CURATED, 'overrides.json'), {});
// --no-outcomes: build without the researched outcomes (e.g. while they're being reviewed).
const outcomes = process.argv.includes('--no-outcomes') ? {} : readJson(path.join(CURATED, 'outcomes.json'), {});
const conversionFile = readJson(path.join(CURATED, 'exam_conversions.json'), { exams: [], dk: { mean: 7.4, sd: 2.45 } });
const conversions = conversionFile.exams;

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
function probit(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - lo) return -probit(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Danish-scale estimate from foreign exam results (see data/curated/exam_conversions.json):
 * the school's standardised distance from its exam's own benchmark, averaged over
 * the 3 most recent years, mapped onto the Danish pupil-level distribution.
 */
function gradeEstimate(exams = []) {
  const { mean: dkMean, sd: dkSd } = conversionFile.dk;
  const clamp = (r) => Math.min(0.99, Math.max(0.01, r / 100));
  for (const conv of conversions) {
    const rows = exams
      .filter((e) => e.exam === conv.exam && e.metric === conv.metric && typeof e.value === 'number' && typeof e.benchmark === 'number' && !e.approximate)
      .sort((a, b) => b.year - a.year)
      .slice(0, 3);
    if (!rows.length || rows[0].year < CURRENT_YEAR - 4) continue;
    const z = rows.reduce((acc, e) => acc + (conv.method === 'rate'
      ? probit(clamp(e.value)) - probit(clamp(e.benchmark))
      : (e.value - e.benchmark) / conv.sd), 0) / rows.length;
    const value = Math.round((dkMean + z * dkSd) * 100) / 100;
    const years = rows.map((e) => e.year).sort().join(', ');
    return {
      value: Math.max(-3, Math.min(12, value)),
      z: Math.round(z * 100) / 100,
      basis: `${conv.exam} ${conv.metric.replace(' %', '')} ${years} vs. ${conv.benchmarkLabel}`,
    };
  }
  return null;
}

// ---------- helpers ----------
const byId = (rows = []) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.id)) m.set(r.id, []);
    m.get(r.id).push(r);
  }
  for (const list of m.values()) list.sort((a, b) => a.year.localeCompare(b.year));
  return m;
};
const round = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const mean = (xs) => {
  const v = xs.filter((x) => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
/** Series of {y, v} for a measure, skipping empty values. */
const series = (rows = [], key) => rows.filter((r) => typeof r[key] === 'number').map((r) => ({ y: r.year, v: r[key] }));
const last = (s) => (s.length ? s[s.length - 1] : null);
/** Mean of the last n values, only if the latest is recent enough. */
function recentMean(s, n = 3, minYear = '2022/2023') {
  const tail = s.slice(-n);
  if (!tail.length || last(tail).y < minYear) return null;
  return mean(tail.map((p) => p.v));
}
/** Least-squares slope per year over the last n points. */
function slope(s, n = 6) {
  const t = s.slice(-n);
  if (t.length < 4) return null;
  const xs = t.map((p) => Number(p.y.slice(0, 4)));
  const mx = mean(xs), my = mean(t.map((p) => p.v));
  let num = 0, den = 0;
  t.forEach((p, i) => { num += (xs[i] - mx) * (p.v - my); den += (xs[i] - mx) ** 2; });
  return den ? num / den : null;
}

const overview = byId(ds.overview);
const grades = byId(ds.grades);
const danishMath = byId(ds.danishMath);
const absence = byId(ds.absence);
const staff = byId(ds.staff);
const inclusion = byId(ds.inclusion);

// Wellbeing: average the Mellemtrin and Udskoling scores per indicator/year.
const wellbeing = new Map();
for (const r of ds.wellbeing || []) {
  const key = `${r.id}|${r.year}|${r.Trivselsindikator}`;
  if (!wellbeing.has(key)) wellbeing.set(key, []);
  wellbeing.get(key).push(r.score);
}
const WELLBEING_KEYS = {
  'Generel trivsel': 'general', 'Social trivsel': 'social', 'Faglig trivsel': 'academic',
  'Støtte og inspiration': 'support', 'Ro og orden': 'calm',
};
const wellbeingById = new Map();
for (const [key, scores] of wellbeing) {
  const [id, year, ind] = key.split('|');
  if (!wellbeingById.has(id)) wellbeingById.set(id, {});
  const o = wellbeingById.get(id);
  const k = WELLBEING_KEYS[ind];
  (o[k] ||= []).push({ y: year, v: round(mean(scores), 2) });
}
for (const o of wellbeingById.values()) for (const k in o) o[k].sort((a, b) => a.y.localeCompare(b.y));

// Pupils per grade level for the latest year (class-size structure).
const pupilsByGrade = new Map();
const latestPupilYear = (ds.pupils || []).reduce((m, r) => (r.year > m ? r.year : m), '');
for (const r of ds.pupils || []) {
  if (r.year !== latestPupilYear) continue;
  const g = parseInt(r.Klassetrin, 10);
  if (!pupilsByGrade.has(r.id)) pupilsByGrade.set(r.id, {});
  pupilsByGrade.get(r.id)[g] = r.pupils;
}

// Municipality / national benchmarks per year from the overview dataset.
const benchmarks = {};
for (const s of register) {
  for (const r of overview.get(s.id) || []) {
    const b = ((benchmarks[s.municipality] ||= {})[r.year] ||= {});
    for (const k of ['grade', 'absence', 'classSize', 'wellbeingTop', 'qualifiedTeaching', 'toEducation']) {
      if (typeof r[`${k}Municipality`] === 'number') b[k] = r[`${k}Municipality`];
    }
    const n = ((benchmarks._national ||= {})[r.year] ||= {});
    for (const k of ['grade', 'absence', 'classSize', 'wellbeingTop', 'qualifiedTeaching', 'toEducation']) {
      if (typeof r[`${k}National`] === 'number') n[k] = r[`${k}National`];
    }
  }
}

// Danish averages over the same years as the school indicators below, so the
// score can place a school against Denmark and not only against the area.
const nationalSeries = (k) => Object.entries(benchmarks._national || {})
  .filter(([, b]) => typeof b[k] === 'number').map(([y, b]) => ({ y, v: b[k] }))
  .sort((a, b) => a.y.localeCompare(b.y));
function nationalCoreQualified() {
  const rows = ds.qualifiedBySubject || [];
  const year = rows.reduce((m, r) => (r.year > m ? r.year : m), '');
  const core = new Map();
  for (const r of rows) {
    if (r.year === year && ['Dansk', 'Matematik', 'Engelsk'].includes(r.Fag) && typeof r.shareNational === 'number') core.set(`${r.Fag}|${r.Skoletrin}`, r.shareNational);
  }
  return core.size ? round(mean([...core.values()]), 1) : null;
}
const national = {
  // Bound 9th-grade exams; schools use all mandatory exams when published, which run within ~0.2 of it.
  grade: round(recentMean(nationalSeries('grade')), 2),
  valueAdded: 0, // already measured against the national socio-economic expectation
  wellbeingTop: round(recentMean(nationalSeries('wellbeingTop'), 2), 1),
  climate: 0, // already points vs Denmark
  absence: round(recentMean(nationalSeries('absence'), 2), 2),
  classSize: last(nationalSeries('classSize'))?.v ?? null,
  qualifiedTeaching: nationalCoreQualified() ?? round(recentMean(nationalSeries('qualifiedTeaching'), 2), 1),
  toEducation: round(recentMean(nationalSeries('toEducation'), 2, '2021/2022'), 1),
  gradeTrend: round(slope(nationalSeries('grade')), 3),
};

// ---------- social climate (individual wellbeing-survey questions) ----------
// Each headline is the share of pupils giving the listed answers, excluding
// "prefer not to answer". Answers are matched by text because the grade 0–3
// and 4–9 versions of a question use different scales.
const CLIMATE = [
  { key: 'bullied', q: 'Er du blevet mobbet i dette skoleår?', band: '4–9', polarity: 'bad', answers: ['Meget tit', 'Tit', 'En gang i mellem'], label: 'Bullied at least now and then this school year' },
  { key: 'teased', q: 'Er der nogen, der driller dig, så du bliver ked af det?', band: '0–3', polarity: 'bad', answers: ['Ja, tit'], label: 'Often teased until they’re sad' },
  { key: 'lonely', q: 'Føler du dig ensom?', band: '4–9', polarity: 'bad', answers: ['Meget tit', 'Tit'], label: 'Often feel lonely' },
  { key: 'alone', q: 'Føler du dig alene i skolen?', band: '0–3', polarity: 'bad', answers: ['Ja, tit'], label: 'Often feel alone at school' },
  { key: 'safe', q: 'Hvor ofte føler du dig tryg i skolen?', band: '4–9', polarity: 'good', answers: ['Altid', 'For det meste'], label: 'Feel safe at school always or mostly' },
  { key: 'belong', q: 'Jeg føler, at jeg hører til på min skole.', band: '4–9', polarity: 'good', answers: ['Enig', 'Helt enig'], label: 'Feel they belong at the school' },
  { key: 'likeSchool', q: 'Er du glad for din skole?', band: '0–9', polarity: 'good', answers: ['Ja, meget', 'Tit', 'Meget tit'], label: 'Like their school' },
  { key: 'order', q: 'Hvis der er larm i klassen, kan lærerne hurtigt få skabt ro.', band: '4–9', polarity: 'good', answers: ['Tit', 'Meget tit'], label: 'Teachers quickly restore calm when it’s noisy' },
  { key: 'toilets', q: 'Jeg synes, toiletterne på skolen er pæne og rene.', band: '4–9', polarity: 'good', answers: ['Enig', 'Helt enig'], label: 'Find the toilets clean' },
  { key: 'toiletsYoung', q: 'Er toiletterne på skolen rene?', band: '0–3', polarity: 'good', answers: ['Ja, for det meste'], label: 'Find the toilets clean' },
];
const MIN_ANSWERS = 20;
const climateRows = new Map(); // id|question|year -> rows
for (const r of ds.climate || []) {
  const k = `${r.id}|${r['Spørgsmål']}|${r.year}`;
  if (!climateRows.has(k)) climateRows.set(k, []);
  climateRows.get(k).push(r);
}
const climateYears = [...new Set((ds.climate || []).map((r) => r.year))].sort();
function climateFor(id) {
  const items = [];
  for (const c of CLIMATE) {
    const trend = [];
    let latest = null;
    for (const y of climateYears) {
      const rows = (climateRows.get(`${id}|${c.q}|${y}`) || []).filter((r) => String(r['Svarværdi']) !== '0');
      if (!rows.length) continue;
      const pct = (key) => {
        const tot = rows.reduce((a, r) => a + (r[key] || 0), 0);
        return tot ? (rows.filter((r) => c.answers.includes(r['Svar'])).reduce((a, r) => a + (r[key] || 0), 0) / tot) * 100 : null;
      };
      const n = rows.reduce((a, r) => a + (r.answers || 0), 0);
      const point = { y, v: round(pct('share'), 1), municipality: round(pct('shareMunicipality'), 1), national: round(pct('shareNational'), 1), n };
      if (point.v === null) continue;
      trend.push({ y, v: point.v });
      latest = point;
    }
    if (latest) items.push({ key: c.key, label: c.label, band: c.band, polarity: c.polarity, question: c.q, year: latest.y, value: latest.v, municipality: latest.municipality, national: latest.national, n: latest.n, reliable: latest.n >= MIN_ANSWERS, trend });
  }
  return items.length ? items : null;
}

// ---------- where pupils live / whether families stay ----------
const residenceBy = byId((ds.residence || []).map((r) => ({ ...r, key: r['Bor I Institutionskommune'] })));
function fromOutside(id) {
  const years = {};
  for (const r of residenceBy.get(id) || []) (years[r.year] ||= {})[r.key] = r.pupils;
  const pts = Object.entries(years)
    .filter(([, v]) => (v.Ja || 0) + (v.Nej || 0) > 0)
    .map(([y, v]) => ({ y, v: round(((v.Nej || 0) / ((v.Ja || 0) + (v.Nej || 0))) * 100, 1) }))
    .sort((a, b) => a.y.localeCompare(b.y));
  return pts;
}
// Pupils per grade per year, for following each year group into the next school year.
const gradeCounts = new Map(); // id -> year -> grade -> n
for (const r of ds.pupils || []) {
  const g = parseInt(r.Klassetrin, 10);
  if (!Number.isFinite(g)) continue;
  const m = gradeCounts.get(r.id) || new Map();
  gradeCounts.set(r.id, m);
  const y = m.get(r.year) || {};
  m.set(r.year, y);
  y[g] = (y[g] || 0) + (r.pupils || 0);
}
const nextYear = (y) => `${Number(y.slice(0, 4)) + 1}/${Number(y.slice(0, 4)) + 2}`;
/**
 * Net change of year groups from one school year to the next (grade g → g+1),
 * in % of the starting size, averaged over the last 3 transitions. 6th→7th is
 * skipped because many pupils change school there by design (overbygning).
 */
function cohortFlow(id) {
  const m = gradeCounts.get(id);
  if (!m) return { value: null, series: [] };
  const series = [];
  for (const y of [...m.keys()].sort()) {
    const now = m.get(y), next = m.get(nextYear(y));
    if (!next) continue;
    let from = 0, to = 0;
    for (let g = 0; g <= 8; g++) {
      if (g === 6 || !now[g] || !next[g + 1]) continue;
      from += now[g];
      to += next[g + 1];
    }
    if (from >= 40) series.push({ y: nextYear(y), v: round(((to - from) / from) * 100, 1) });
  }
  const tail = series.slice(-3);
  return { value: tail.length ? round(mean(tail.map((p) => p.v)), 1) : null, series };
}

// ---------- subject-level teacher qualifications ----------
const qualBy = byId(ds.qualifiedBySubject || []);
function qualifiedBySubject(id) {
  const rows = qualBy.get(id) || [];
  if (!rows.length) return null;
  const year = rows[rows.length - 1].year;
  return {
    year,
    rows: rows.filter((r) => r.year === year && typeof r.share === 'number').map((r) => ({
      subject: r.Fag, stage: r.Skoletrin, value: r.share, municipality: r.shareMunicipality, national: r.shareNational,
    })),
  };
}

/**
 * Social-climate index: average number of percentage points the school is
 * better (+) or worse (−) than the national figure, over the survey questions
 * with at least MIN_ANSWERS answers.
 */
function climateIndex(items) {
  const diffs = (items || [])
    .filter((i) => i.reliable && typeof i.national === 'number' && !i.key.startsWith('toilets'))
    .map((i) => (i.polarity === 'good' ? i.value - i.national : i.national - i.value));
  return diffs.length >= 3 ? round(mean(diffs), 2) : null;
}

/** Qualified-teaching share in Danish, maths and English (all stages), latest year. */
function coreQualified(q) {
  const core = (q?.rows || []).filter((r) => ['Dansk', 'Matematik', 'Engelsk'].includes(r.subject));
  return core.length >= 2 ? round(mean(core.map((r) => r.value)), 1) : null;
}

// ---------- news ----------
const news = {};
const newsDir = path.join(RAW, 'news');
if (existsSync(newsDir)) {
  for (const f of readdirSync(newsDir)) {
    const n = readJson(path.join(newsDir, f), null);
    if (n) news[n.id] = n.articles.map(({ title, url, date, source }) => ({ title, url, date, source }));
  }
}

// ---------- classify ----------
const childrenOf = new Map();
for (const s of register) if (s.parentId) childrenOf.set(s.parentId, [...(childrenOf.get(s.parentId) || []), s.id]);

function kindFlags(s) {
  const n = s.name.toLowerCase();
  return {
    tenthGradeOnly: /10\.\s?klasse|10\.klasse|ungdomsskole|\bnext uddannelse\b|^[a-zæøå]+10\b|^ung\S* udskoling/.test(n),
    special: /hospitalsskole|specialskole|heldagsskole|behandling|specialtilbud|\bcenter\b|sprogholdet|modtagelsesklasse/.test(n),
  };
}

const INTERNATIONAL_NAME = /international|lycee|lycée|european school|bernadotte|rygaards|sankt petri|institut sankt joseph/i;

// How much usable Ministry data an entity has (exam years + overview years with outcomes).
const dataScore = (id) =>
  (grades.get(id)?.length || 0) +
  (overview.get(id) || []).filter((r) => [r.grade, r.wellbeingTop, r.absence].some((v) => typeof v === 'number')).length;
const normAddr = (x) => `${(x.address || '').toLowerCase().replace(/[^a-zæøå0-9]/g, '')}|${x.postalCode}`;
const firstToken = (n) => n.toLowerCase().split(/[\s,-]+/)[0];
const registerById = new Map(register.map((x) => [x.id, x]));

// Entities without data that duplicate a school which has the data (a campus of
// a parent school, or an umbrella entity at the same address) are shown as
// campuses of that school instead of as separate, empty schools.
const campusOf = new Map();
for (const s of register) {
  if (dataScore(s.id) > 0) continue;
  const parent = s.parentId && registerById.get(s.parentId);
  if (parent && dataScore(parent.id) > 0) { campusOf.set(s.id, parent.id); continue; }
  const twin = register.find((o) => o.id !== s.id && normAddr(o) === normAddr(s) && dataScore(o.id) > 0 && firstToken(o.name) === firstToken(s.name));
  if (twin) campusOf.set(s.id, twin.id);
}
const campuses = new Map();
for (const [id, host] of campusOf) {
  const c = registerById.get(id);
  campuses.set(host, [...(campuses.get(host) || []), { id, name: c.name, address: `${c.address}, ${c.postalCode} ${c.city}`, lat: c.lat, lng: c.lng }]);
}

const CURRENT_YEAR = new Date().getFullYear();

const schools = [];
for (const s of register) {
  if (campusOf.has(s.id)) continue;
  const ov = overview.get(s.id) || [];
  const gr = grades.get(s.id) || [];
  const dm = danishMath.get(s.id) || [];
  const ab = absence.get(s.id) || [];
  const st = staff.get(s.id) || [];
  const inc = inclusion.get(s.id) || [];
  const wb = wellbeingById.get(s.id) || {};
  const hasData = ov.length + gr.length + inc.length > 0;
  const children = childrenOf.get(s.id) || [];

  // Head offices whose data is reported per department are not shown as schools.
  if (!hasData && children.length) continue;

  const intl = internationalById[s.id];
  const fee = fees[s.id];
  const flags = kindFlags(s);

  // Prefer the long KARAGNS history for grades; fall back to the overview.
  const gradeSeries = series(gr, 'gradeMandatory').length ? series(gr, 'gradeMandatory') : series(ov, 'grade');
  const pupilSeries = series(inc, 'pupils').length ? series(inc, 'pupils') : series(ov, 'pupils');
  const absenceSeries = series(ov, 'absence').length ? series(ov, 'absence') : series(ab, 'absence');

  const isPrivate = s.category !== 'folkeskole' && s.category !== 'international-public';
  const isInternational = s.category.startsWith('international') || !!intl || INTERNATIONAL_NAME.test(s.name)
    || (fee && ['international', 'bilingual'].includes(fee.pedagogy));

  const lastOv = [...ov].reverse();
  const latestOf = (key) => lastOv.find((r) => typeof r[key] === 'number')?.[key] ?? null;
  const latestYearOf = (key) => lastOv.find((r) => typeof r[key] === 'number')?.year ?? null;

  const languages = intl?.languages || fee?.languages || ['da'];
  const sfo = municipalSfo[s.municipality];

  const monthlyFee = isPrivate ? (intl?.monthlyFeeDKK ?? fee?.monthlyFeeDKK ?? null) : 0;
  const feeMonths = fee?.feeMonthsPerYear ?? (intl ? 12 : null);
  const annualFee = isPrivate
    ? (intl?.annualFeeDKK ?? (monthlyFee != null ? monthlyFee * (feeMonths || 12) : null))
    : 0;

  // Highest grade level with pupils (latest year); schools without 9th grade sit no exams.
  const byGrade = pupilsByGrade.get(s.id);
  const topGrade = byGrade ? Math.max(...Object.entries(byGrade).filter(([, n]) => n > 0).map(([g]) => Number(g)).filter((g) => g <= 10)) : null;
  const foundedYear = s.founded ? Number(String(s.founded).slice(0, 4)) : null;

  const school = {
    id: s.id,
    campuses: campuses.get(s.id) || [],
    topGrade: Number.isFinite(topGrade) ? topGrade : null,
    // Opened recently: exam results and surveys only appear after a few years.
    isNew: !!foundedYear && CURRENT_YEAR - foundedYear <= 3 && !(grades.get(s.id)?.length) && dataScore(s.id) < 3,
    founded: foundedYear,
    name: s.name.replace(/\s+/g, ' ').replace(' ,', ','),
    parentId: s.parentId,
    category: s.category,
    isPrivate,
    isInternational,
    ...flags,
    municipality: s.municipality,
    address: s.address,
    postalCode: s.postalCode,
    city: s.city,
    lat: s.lat,
    lng: s.lng,
    website: s.website ? (s.website.startsWith('http') ? s.website : `https://${s.website}`) : null,
    phone: s.phone,
    email: s.email,
    principal: s.principal,
    languages,
    curriculum: intl?.curriculum || fee?.curriculum || (s.category === 'folkeskole' ? 'Danish (Folkeskole)' : 'Danish'),
    pedagogy: fee?.pedagogy || (isInternational ? 'international' : s.category === 'folkeskole' ? 'folkeskole' : null),
    profile: intl?.highlights ? null : fee?.profile || null,
    gradesOffered: intl?.gradesOffered || fee?.gradesOffered || null,
    waitlist: intl?.admission || fee?.waitlist || null,
    fees: {
      monthly: monthlyFee,
      monthsPerYear: feeMonths,
      annual: annualFee,
      sfoMonthly: isPrivate ? fee?.sfoMonthlyDKK ?? null : sfo?.sfoMonthlyDKK ?? null,
      sfoMonthsPerYear: isPrivate ? null : sfo?.monthsPerYear ?? null,
      enrollment: intl?.enrollmentFeeDKK ?? fee?.enrollmentFeeDKK ?? null,
      siblingDiscount: fee?.siblingDiscount || (isPrivate ? null : sfo?.siblingDiscount) || null,
      year: intl?.feeYear || fee?.feeYear || (isPrivate ? null : sfo?.year) || null,
      notes: intl?.feeNotes || fee?.notes || null,
      source: (intl?.sourceUrls && intl.sourceUrls[0]) || fee?.sourceUrl || (isPrivate ? null : sfo?.sourceUrl) || null,
    },
    international: intl ? {
      type: intl.type, curriculum: intl.curriculum, danishOffering: intl.danishOffering,
      accreditation: intl.accreditation, highlights: intl.highlights,
      considerations: intl.considerations, admission: intl.admission, sourceUrls: intl.sourceUrls,
    } : null,
    latest: {
      pupils: last(pupilSeries)?.v ?? null,
      pupilsYear: last(pupilSeries)?.y ?? null,
      classSize: latestOf('classSize'),
      absence: last(absenceSeries)?.v ?? null,
      absenceYear: last(absenceSeries)?.y ?? null,
      grade: last(gradeSeries)?.v ?? null,
      gradeYear: last(gradeSeries)?.y ?? null,
      danish: last(series(dm, 'danish'))?.v ?? null,
      math: last(series(dm, 'math'))?.v ?? null,
      socrefDiff: latestOf('socrefDiff'),
      socrefExpected: latestOf('socrefExpected'),
      socrefSignificant: lastOv.find((r) => r.socrefSignificant)?.socrefSignificant ?? null,
      socrefYear: latestYearOf('socrefDiff'),
      wellbeingTop: latestOf('wellbeingTop'),
      wellbeingGeneral: last(wb.general || [])?.v ?? null,
      qualifiedTeaching: latestOf('qualifiedTeaching'),
      toEducation: latestOf('toEducation'),
      pupilsPerTeacher: last(series(st, 'pupilsPerTeacher'))?.v ?? null,
      inclusion: last(series(inc, 'inclusion'))?.v ?? null,
      shareMin2: last(series(gr, 'shareMin2'))?.v ?? null,
      pupilsByGrade: pupilsByGrade.get(s.id) || null,
    },
    // Indicators used by the composite score (computed client-side with adjustable weights).
    indicators: {
      grade: round(recentMean(gradeSeries), 2),
      valueAdded: round(recentMean(series(ov, 'socrefDiff')), 2),
      wellbeing: round(recentMean(wb.general || [], 2), 2),
      wellbeingTop: round(recentMean(series(ov, 'wellbeingTop'), 2), 1),
      absence: round(recentMean(absenceSeries, 2), 2),
      classSize: latestOf('classSize'),
      // Core subjects (Danish, maths, English) when published, else the overall share.
      qualifiedTeaching: coreQualified(qualifiedBySubject(s.id)) ?? round(recentMean(series(ov, 'qualifiedTeaching'), 2), 1),
      toEducation: round(recentMean(series(ov, 'toEducation'), 2, '2021/2022'), 1),
      gradeTrend: round(slope(gradeSeries), 3),
      retention: cohortFlow(s.id).value,
      climate: climateIndex(climateFor(s.id)),
      fromOutside: fromOutside(s.id).slice(-3).length ? round(mean(fromOutside(s.id).slice(-3).map((p) => p.v)), 1) : null,
      pupilTrend: (() => {
        const p = pupilSeries.slice(-6);
        return p.length >= 4 && p[0].v > 0 ? round(((last(p).v - p[0].v) / p[0].v) * 100, 1) : null;
      })(),
    },
    series: {
      grade: gradeSeries,
      danish: series(dm, 'danish'),
      math: series(dm, 'math'),
      socrefDiff: series(ov, 'socrefDiff'),
      socrefExpected: series(ov, 'socrefExpected'),
      pupils: pupilSeries,
      classSize: series(ov, 'classSize'),
      absence: absenceSeries,
      wellbeingTop: series(ov, 'wellbeingTop'),
      wellbeing: wb,
      qualifiedTeaching: series(ov, 'qualifiedTeaching'),
      pupilsPerTeacher: series(st, 'pupilsPerTeacher'),
    },
    external: outcomes[s.id] ? {
      exams: outcomes[s.id].exams || [],
      wellbeing: outcomes[s.id].wellbeing || [],
      inspection: outcomes[s.id].inspection || [],
      context: Object.fromEntries(Object.entries(outcomes[s.id].context || {}).filter(([, v]) => v !== null && typeof v !== 'object')),
      notes: outcomes[s.id].notes || null,
      // Only used when the school has no Danish exam results of its own.
      gradeEstimate: gradeSeries.length ? null : gradeEstimate(outcomes[s.id].exams),
    } : null,
    climate: climateFor(s.id),
    fromOutside: fromOutside(s.id),
    cohortFlow: cohortFlow(s.id).series,
    qualifiedBySubject: qualifiedBySubject(s.id),
    news: news[s.id] || [],
    hasData,
  };

  // Hand-verified corrections (data/curated/overrides.json); nested objects are merged.
  for (const [k, v] of Object.entries(overrides[s.id] || {})) {
    school[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...school[k], ...v } : v;
  }
  schools.push(school);
}

const out = {
  generatedAt: new Date().toISOString(),
  statsFetchedAt: stats.fetchedAt || null,
  sources: {
    register: 'Institutionsregisteret, Styrelsen for IT og Læring (instreg.stil.dk)',
    stats: 'Børne- og Undervisningsministeriet, api.uddannelsesstatistik.dk',
    fees: 'School websites (researched ' + new Date().toISOString().slice(0, 7) + ')',
    news: 'Bing News / GDELT',
  },
  municipalities: [...new Set(schools.map((s) => s.municipality))].sort((a, b) => a.localeCompare(b, 'da')),
  benchmarks,
  national,
  municipalSfo,
  schools,
};
writeFileSync(path.join(PUBLIC_DATA, 'schools.json'), JSON.stringify(out));
for (const f of readdirSync(CURATED).filter((f) => /^districts_.*\.geojson$/.test(f))) {
  copyFileSync(path.join(CURATED, f), path.join(PUBLIC_DATA, f));
}
const withFee = schools.filter((s) => s.isPrivate && s.fees.monthly != null).length;
console.log(`Built ${schools.length} schools (${schools.filter((s) => s.hasData).length} with stats, ${withFee}/${schools.filter((s) => s.isPrivate).length} private with fees, ${schools.filter((s) => s.news.length).length} with news) → public/data/schools.json`);
