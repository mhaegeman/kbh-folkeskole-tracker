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
    tenthGradeOnly: /10\.\s?klasse|10\.klasse|ungdomsskole|\bnext uddannelse\b/.test(n),
    special: /hospitalsskole|specialskole|heldagsskole|behandling|specialtilbud|\bcenter\b/.test(n),
  };
}

const INTERNATIONAL_NAME = /international|lycee|lycée|european school|bernadotte|rygaards|sankt petri|institut sankt joseph/i;

const schools = [];
for (const s of register) {
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

  const school = {
    id: s.id,
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
      type: intl.type, curriculum: intl.curriculum, frenchOffering: intl.frenchOffering,
      danishOffering: intl.danishOffering, accreditation: intl.accreditation, highlights: intl.highlights,
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
      qualifiedTeaching: round(recentMean(series(ov, 'qualifiedTeaching'), 2), 1),
      toEducation: round(recentMean(series(ov, 'toEducation'), 2, '2021/2022'), 1),
      gradeTrend: round(slope(gradeSeries), 3),
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
    news: news[s.id] || [],
    hasData,
  };
  // Hand-verified corrections (data/curated/overrides.json); nested objects are merged.
  for (const [k, v] of Object.entries(overrides[s.id] || {})) {
    school[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...school[k], ...v } : v;
  }
  schools.push(school);
}

// Non-register international options (e.g. after-school French programmes).
const extras = international.filter((x) => !x.id).map((x, i) => ({
  id: `extra-${i + 1}`,
  name: x.name,
  type: x.type,
  municipality: x.municipality,
  address: x.address,
  languages: x.languages,
  curriculum: x.curriculum,
  frenchOffering: x.frenchOffering,
  danishOffering: x.danishOffering,
  gradesOffered: x.gradesOffered || x.ageRange,
  monthlyFee: x.monthlyFeeDKK,
  annualFee: x.annualFeeDKK,
  feeYear: x.feeYear,
  feeNotes: x.feeNotes,
  highlights: x.highlights,
  considerations: x.considerations,
  admission: x.admission,
  website: x.website,
  sourceUrls: x.sourceUrls,
}));

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
  municipalSfo,
  extras,
  schools,
};
writeFileSync(path.join(PUBLIC_DATA, 'schools.json'), JSON.stringify(out));
for (const f of readdirSync(CURATED).filter((f) => /^districts_.*\.geojson$/.test(f))) {
  copyFileSync(path.join(CURATED, f), path.join(PUBLIC_DATA, f));
}
const withFee = schools.filter((s) => s.isPrivate && s.fees.monthly != null).length;
console.log(`Built ${schools.length} schools (${schools.filter((s) => s.hasData).length} with stats, ${withFee}/${schools.filter((s) => s.isPrivate).length} private with fees, ${schools.filter((s) => s.news.length).length} with news, ${extras.length} extras) → public/data/schools.json`);
