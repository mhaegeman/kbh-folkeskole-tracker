// Collects news articles mentioning each school from Bing News RSS and the
// GDELT news archive. Results are cached per school in data/raw/news/ so the
// script can be interrupted and resumed. Use --refresh to refetch everything.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RAW, CURATED, sleep } from './config.mjs';

const NEWS_DIR = path.join(RAW, 'news');
mkdirSync(NEWS_DIR, { recursive: true });
const refresh = process.argv.includes('--refresh');
const useGdelt = !process.argv.includes('--no-gdelt');
const only = process.argv.find((a) => a.startsWith('--id='))?.slice(5);

const register = JSON.parse(readFileSync(path.join(RAW, 'register.json'), 'utf8'));
const aliasesFile = path.join(CURATED, 'aliases.json');
const aliases = existsSync(aliasesFile) ? JSON.parse(readFileSync(aliasesFile, 'utf8')) : {};

const UA = 'Mozilla/5.0 (kbh-folkeskole-tracker; personal school research)';

const decode = (s = '') =>
  s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();

const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '');

function realUrl(link) {
  try {
    const u = new URL(link);
    return u.searchParams.get('url') || link;
  } catch {
    return link;
  }
}

async function bing(q) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setmkt=da-DK&count=50`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => ({
    title: tag(it, 'title'),
    url: realUrl(tag(it, 'link')),
    date: tag(it, 'pubDate') ? new Date(tag(it, 'pubDate')).toISOString() : null,
    source: tag(it, 'News:Source') || null,
    snippet: tag(it, 'description').slice(0, 300),
    via: 'bing',
  }));
}

function stripInternal({ exact, ...a }) {
  return a;
}

let lastGdelt = 0;
let gdeltStrikes = 0;
async function gdelt(q, retry = true) {
  if (gdeltStrikes >= 3) return []; // rate-limited repeatedly: give up for this run
  const wait = 6000 - (Date.now() - lastGdelt);
  if (wait > 0) await sleep(wait);
  lastGdelt = Date.now();
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=75&sort=datedesc&startdatetime=20170101000000`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const text = await res.text();
    if (text.startsWith('Please limit')) {
      if (!retry) {
        if (++gdeltStrikes >= 3) console.warn('GDELT keeps rate-limiting; continuing with Bing only.');
        return [];
      }
      await sleep(30000);
      return gdelt(q, false);
    }
    gdeltStrikes = 0;
    if (!text.startsWith('{')) return [];
    return (JSON.parse(text).articles || []).map((a) => ({
      title: a.title,
      url: a.url,
      date: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}T00:00:00Z` : null,
      source: a.domain,
      snippet: '',
      via: 'gdelt',
      language: a.language,
    }));
  } catch {
    return [];
  }
}

const norm = (s = '') => s.toLowerCase().normalize('NFC').replace(/\s+/g, ' ');

for (const s of register) {
  if (only && s.id !== only) continue;
  const file = path.join(NEWS_DIR, `${s.id}.json`);
  if (!refresh && existsSync(file)) continue;

  const base = s.name.split(',')[0].trim();
  const names = [base, ...(aliases[s.id] || [])];
  const context = [s.city, s.municipality, 'København', 'Frederiksberg'].map(norm);

  const found = [];
  for (const n of names) {
    for (const a of await bing(`"${n}"`)) found.push({ ...a, exact: true });
    for (const a of await bing(`${n} ${s.city}`)) found.push({ ...a, exact: false });
    if (useGdelt) for (const a of await gdelt(`"${n}"`)) found.push({ ...a, exact: true });
  }

  // Keep articles that mention the school by name; for names shared with
  // schools elsewhere in Denmark, also require a local place name.
  const seen = new Set();
  const articles = found
    .filter((a) => a.url && a.title)
    .filter((a) => {
      const key = norm(a.title).slice(0, 80);
      if (seen.has(a.url) || seen.has(key)) return false;
      seen.add(a.url);
      seen.add(key);
      return true;
    })
    .filter((a) => {
      const text = norm(`${a.title} ${a.snippet}`);
      const mentions = names.some((n) => text.includes(norm(n)));
      const local = context.some((c) => text.includes(c));
      // Exact-phrase hits matched the article body, so the name need not be
      // in the title; loose queries must mention the school explicitly.
      if (s.nameIsAmbiguous) return mentions && local;
      return a.exact || mentions;
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 40)
    .map(stripInternal);

  writeFileSync(file, JSON.stringify({ id: s.id, name: s.name, fetchedAt: new Date().toISOString(), articles }, null, 1));
  console.log(`${s.id} ${base}: ${articles.length} articles`);
  await sleep(800);
}
console.log('News done.');
