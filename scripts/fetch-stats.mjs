// Downloads per-school statistics from the Ministry's official API
// (api.uddannelsesstatistik.dk). Requires UDDSTAT_API_KEY in .env.
import { writeFileSync } from 'node:fs';
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
    filtre: { '[Institution].[Beliggenhedskommune]': MUNICIPALITIES },
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

const out = { fetchedAt: new Date().toISOString(), source: 'api.uddannelsesstatistik.dk', datasets: {} };
for (const ds of DATASETS) {
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

writeFileSync(path.join(RAW, 'stats.json'), JSON.stringify(out));
console.log('Saved data/raw/stats.json');
