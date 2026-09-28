// Downloads the official institution register (Institutionsregisteret, STIL) and
// keeps active primary schools in the configured municipalities.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAW, MUNICIPALITIES, INSTITUTION_TYPES, municipalityShort } from './config.mjs';

const URL = 'https://instreg.stil.dk/frontend-api/Institutions';

console.log('Fetching institution register…');
const res = await fetch(URL, { headers: { Accept: 'application/json' } });
if (!res.ok) throw new Error(`Register request failed: ${res.status}`);
const all = await res.json();

const schools = all
  .filter((x) => x.activeCodeName?.startsWith('Aktiv'))
  .filter((x) => INSTITUTION_TYPES[x.institutionTypeId])
  .filter((x) => MUNICIPALITIES.includes(municipalityShort(x.locationMunicipality)))
  .map((x) => ({
    id: String(x.institutionNumber),
    parentId: x.parentInstitutionNumber ? String(x.parentInstitutionNumber) : null,
    name: x.institutionName.trim(),
    unitType: x.unitTypeName,
    category: INSTITUTION_TYPES[x.institutionTypeId],
    institutionType: x.institutionType,
    owner: x.ownerCodeName,
    address: x.address,
    postalCode: x.postalCode,
    city: x.postalDistrict,
    municipality: municipalityShort(x.locationMunicipality),
    lat: x.latitude,
    lng: x.longitude,
    principal: x.principalName,
    phone: x.phoneNumber,
    email: x.email,
    website: x.website,
    cvr: x.cvrNumber,
    founded: x.monthCreated,
  }));

// How many active schools nationwide share each base name — used to decide
// whether news matches need extra location context to be trusted.
const baseName = (n) => n.split(',')[0].trim().toLowerCase();
const nationalNameCount = {};
for (const x of all) {
  if (!x.activeCodeName?.startsWith('Aktiv') || !INSTITUTION_TYPES[x.institutionTypeId]) continue;
  const b = baseName(x.institutionName);
  nationalNameCount[b] = (nationalNameCount[b] || 0) + 1;
}
for (const s of schools) s.nameIsAmbiguous = nationalNameCount[baseName(s.name)] > 1;

writeFileSync(path.join(RAW, 'register.json'), JSON.stringify(schools, null, 1));
console.log(`Saved ${schools.length} schools/departments to data/raw/register.json`);
