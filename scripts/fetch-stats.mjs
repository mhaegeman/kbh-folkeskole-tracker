// Downloads per-school statistics from the Ministry's official API
// (api.uddannelsesstatistik.dk). Requires UDDSTAT_API_KEY in .env.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { RAW, MUNICIPALITIES, loadEnv, sleep } from './config.mjs';

loadEnv();
const KEY = process.env.UDDSTAT_API_KEY;
if (!KEY) {
  console.error('Missing UDDSTAT_API_KEY in .env (get a free key at https://api.uddannelsesstatistik.dk)');
  process.exit(1);
}

const M = (name) => `[Measures].[${name}]`;
const ID = '[Institution].[Afdelingsnummer]';
const YEAR = '[Skoleår].[Skoleår]';

/** The last n school years, e.g. ['2022/2023', …, '2025/2026']. */
function recentSchoolYears(n) {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: n }, (_, i) => `${start - n + 1 + i}/${start - n + 2 + i}`);
}

// Wellbeing-survey questions shown as "social climate" (grades 0–3 and 4–9 versions).
export const CLIMATE_QUESTIONS = [
  'Er du blevet mobbet i dette skoleår?',
  'Er der nogen, der driller dig, så du bliver ked af det?',
  'Føler du dig ensom?',
  'Føler du dig alene i skolen?',
  'Hvor ofte føler du dig tryg i skolen?',
  'Jeg føler, at jeg hører til på min skole.',
  'Er du glad for din skole?',
  'Hvis der er larm i klassen, kan lærerne hurtigt få skabt ro.',
  'Jeg synes, toiletterne på skolen er pæne og rene.',
  'Er toiletterne på skolen rene?',
];

// Each dataset is fetched for all configured municipalities in one request.
const DATASETS = [
  {
    key: 'overview', emne: 'OVER', underemne: 'OVERSKO', detail: [ID, YEAR],
    measures: {
      pupils: 'Elevtal', classSize: 'Klassekvotient', classSizeMunicipality: 'Klassekvotient Kommune',
      classSizeNational: 'Klassekvotient Land', absence: 'Samlet elevfravær',
      absenceMunicipality: 'Samlet elevfravær Kommune', absenceNational: 'Samlet elevfravær Land',
      grade: 'Karaktergennemsnit', gradeMunicipality: 'Karaktergennemsnit Kommune', gradeNational: 'Karaktergennemsnit Land',
      qualifiedTeaching: 'Kompetencedækning', qualifiedTeachingMunicipality: 'Kompetencedækning Kommune',
      qualifiedTeachingNational: 'Kompetencedækning Land',
      socrefDiff: 'SocRef Forskel', socrefGrade: 'SocRef Karaktergennemsnit',
      socrefExpected: 'SocRef Socioøkonomisk reference', socrefSignificant: 'SocRef Signifikant forskel',
      wellbeingTop: 'Andel med højest trivsel', wellbeingTopMunicipality: 'Andel med højest trivsel Kommune',
      wellbeingTopNational: 'Andel med højest trivsel Land',
      toEducation: 'Overgang til UU fra 9. og 10. kl. sept året efter',
      toEducationMunicipality: 'Overgang til UU fra 9. og 10. kl. sept året efter Kommune',
      toEducationNational: 'Overgang til UU fra 9. og 10. kl. sept året efter Land',
    },
  },
  {
    key: 'grades', emne: 'KARA', underemne: 'KARAGNS', detail: [ID, YEAR],
    measures: {
      gradeMandatory: 'Gennemsnit i obl. 9.-klasseprøver',
      gradeBound: 'Gennemsnit i bundne 9.-klasseprøver',
      shareMin2: 'Andel elever med mindst 2 i obl. 9.-klasseprøver',
      examTakers: 'Antal elever med karakter eller anden status i prøver',
    },
  },
  {
    key: 'danishMath', emne: 'KARA', underemne: 'KARADM', detail: [ID, YEAR],
    measures: {
      danish: 'Gennemsnit - Dansk bundne prøver',
      math: 'Gennemsnit - Matematik bundne prøver',
    },
  },
  {
    key: 'wellbeing', emne: 'TRIV', underemne: 'TRIVIND',
    detail: [ID, YEAR, '[Trivselsindikator].[Trivselsindikator]', '[Klassetrin].[Klassetringruppe]'],
    measures: { score: 'Indikatorsvar' },
  },
  {
    key: 'absence', emne: 'ELEVFRAV', underemne: 'FRAVAAR', detail: [ID, '[Tid].[Skoleår]'],
    measures: {
      absence: 'Gennemsnitligt fravær per skoleår', illegal: 'Ulovligt fravær per skoleår',
      sick: 'Sygefravær per skoleår', over10: 'Over 10 procent',
    },
  },
  {
    key: 'staff', emne: 'PERS', underemne: 'ELEVERAARSVAERK', detail: [ID, YEAR],
    measures: { pupilsPerStaff: 'Elever pr årsværk', pupilsPerTeacher: 'Elever pr lærerårsværk' },
  },
  {
    key: 'pupils', emne: 'ELEV', underemne: 'ELEVEX', detail: [ID, YEAR, '[Klassetrin].[Klassetrin]'],
    measures: { pupils: 'Antal elever' },
  },
  {
    key: 'climate', emne: 'TRIV', underemne: 'TRIVSP',
    detail: [ID, YEAR, '[Spørgsmål].[Spørgsmål]', '[Svar].[Svar]', '[Svar].[Svarværdi]'],
    filters: { '[Spørgsmål].[Spørgsmål]': CLIMATE_QUESTIONS, '[Skoleår].[Skoleår]': recentSchoolYears(4) },
    measures: { share: 'Svarfordeling', shareMunicipality: 'Svarfordeling - Kommunetal', shareNational: 'Svarfordeling - Landstal', answers: 'Antal svar' },
  },
  {
    key: 'residence', emne: 'ELEV', underemne: 'ELEVEX', detail: [ID, YEAR, '[GSElevtal JaNej].[Bor I Institutionskommune]'],
    filters: { '[Skoleår].[Skoleår]': recentSchoolYears(6) },
    measures: { pupils: 'Antal elever' },
  },
  {
    key: 'qualifiedBySubject', emne: 'KOMP', underemne: 'KOMPEX', detail: [ID, YEAR, '[Fag].[Fag]', '[Klassetrin].[Skoletrin]'],
    filters: { '[Skoleår].[Skoleår]': recentSchoolYears(3) },
    measures: { share: 'Med kompetence andel', shareMunicipality: 'Med kompetence andel - kommunegennemsnit', shareNational: 'Med kompetence andel - landsgennemsnit' },
  },
  {
    // Only French, to detect schools teaching it (incl. private schools, where
    // subject-level teacher data isn't published).
    key: 'frenchExams', emne: 'KARA', underemne: 'KARAFF', detail: [ID, YEAR],
    filters: { '[Fag].[Fag]': ['Fransk 2. fremmedsprog'], '[Skoleår].[Skoleår]': recentSchoolYears(3) },
    measures: { pupils: 'Antal elever med karakter', average: 'Elevgennemsnit (uden vægtning)' },
  },
  {
    key: 'inclusion', emne: 'ELEV', underemne: 'ELEVEX', detail: [ID, YEAR],
    measures: { pupils: 'Antal elever', inclusion: 'Inklusionsgrad', specialShare: 'Andel der modtager seg specialundervisning' },
  },
];

/** Danish-formatted number ("25.032", "7,4", "87,5 %") -> number | null */
function num(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/%/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : v; // keep non-numeric values (e.g. "Ja"/"Nej")
}

/** "[Skoleår].[Skoleår].[Skoleår]" -> "Skoleår" */
const shortKey = (k) => k.replace(/^\[.*\]\.\[(.*)\]$/, '$1');

async function query(ds) {
  const body = {
    område: 'GS', emne: ds.emne, underemne: ds.underemne,
    nøgletal: Object.values(ds.measures).map(M),
    detaljering: ds.detail,
    filtre: { '[Institution].[Beliggenhedskommune]': MUNICIPALITIES, ...(ds.filters || {}) },
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.uddannelsesstatistik.dk/Api/v1/statistik', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if (attempt >= 3 || res.status === 400 || res.status === 401) {
      throw new Error(`${ds.key}: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    await sleep(3000 * attempt);
  }
}

// --only=a,b refetches just those datasets and keeps the others from the existing file.
const only = process.argv.find((x) => x.startsWith('--only='))?.slice(7).split(',');
const outFile = path.join(RAW, 'stats.json');
const out = only && existsSync(outFile)
  ? JSON.parse(readFileSync(outFile, 'utf8'))
  : { fetchedAt: new Date().toISOString(), source: 'api.uddannelsesstatistik.dk', datasets: {} };
for (const ds of DATASETS) {
  if (only && !only.includes(ds.key)) continue;
  process.stdout.write(`Fetching ${ds.key} (${ds.underemne})… `);
  const rows = await query(ds);
  const inverse = Object.fromEntries(Object.entries(ds.measures).map(([k, v]) => [v, k]));
  out.datasets[ds.key] = rows
    .map((r) => {
      const o = {};
      for (const [k, v] of Object.entries(r)) {
        const sk = shortKey(k);
        if (sk === 'Afdelingsnummer') o.id = v;
        else if (sk === 'Skoleår') o.year = v;
        else if (inverse[k]) o[inverse[k]] = num(v);
        else o[sk] = v;
      }
      return o;
    })
    .filter((o) => Object.keys(ds.measures).some((m) => o[m] !== null && o[m] !== undefined));
  console.log(`${out.datasets[ds.key].length} rows`);
}

writeFileSync(outFile, JSON.stringify(out));
console.log('Saved data/raw/stats.json');
