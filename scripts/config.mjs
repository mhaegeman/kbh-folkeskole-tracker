// Shared configuration for the data pipeline.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = path.join(ROOT, 'data', 'raw');
export const CURATED = path.join(ROOT, 'data', 'curated');
export const PUBLIC_DATA = path.join(ROOT, 'public', 'data');

// Copenhagen + surrounding municipalities (Københavns omegn + near North Zealand).
export const MUNICIPALITIES = [
  'København', 'Frederiksberg', 'Gentofte', 'Gladsaxe', 'Lyngby-Taarbæk',
  'Hvidovre', 'Rødovre', 'Tårnby', 'Dragør', 'Herlev', 'Brøndby', 'Glostrup',
  'Ballerup', 'Albertslund', 'Rudersdal', 'Furesø', 'Vallensbæk', 'Ishøj',
  'Høje-Taastrup', 'Hørsholm',
];

// Institution register type ids (instreg.stil.dk).
export const INSTITUTION_TYPES = {
  1012: 'folkeskole',
  1013: 'friskole',
  1017: 'international-public',
  1018: 'international-private',
};

export function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\s+/g, '');
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "København Kommune" / "Københavns Kommune" -> "København" */
export function municipalityShort(name = '') {
  return name.replace(/ Kommune$/, '').replace(/^Københavns$/, 'København').trim();
}
