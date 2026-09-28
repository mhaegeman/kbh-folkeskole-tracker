# Skolekort KBH

A school finder for Copenhagen and the 19 surrounding municipalities. It covers folkeskoler, private schools (friskoler/privatskoler) and international schools, with official Ministry statistics, a composite **Skolescore**, fees, news, a map, school districts and travel times.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (works from any folder / GitHub Pages)
```

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds the site on every push and pull request, and deploys `main` to
**https://mhaegeman.github.io/kbh-folkeskole-tracker/**. The site uses relative paths and hash routing, so it works under the Pages subpath without configuration.

| Trigger | What happens |
|---------|--------------|
| push / pull request | `npm ci && npm run build` |
| push to `main` | build, then deploy to GitHub Pages |
| monthly schedule, or **Actions → Build & deploy → Run workflow** | re-download the register, Ministry statistics and news, then build and deploy |

One-time setup on GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**: `UDDSTAT_API_KEY`. It's only needed for data refreshes.

Refreshed data goes straight to the live site; it is not committed back. To update the data in the repo, run `npm run data:all` locally and commit.

## Pages

| Page | What it does |
|------|--------------|
| **Rankings** | Search, filter (municipality, type, language, fee, grade, score, distance, shortlist) and sort all schools. Table or card view, adjustable score weights, and a grades vs. value-added scatter plot. |
| **Map** | Address search (DAWA), your **district school** (GeoFA skoledistrikter), walk/bike/car travel times to every school (OSRM), route to the selected school, district boundaries for København & Frederiksberg. |
| **School page** | Score breakdown by percentile, headline numbers, trends since 2010 against municipal and national averages, pupils per grade level, costs (fee + SFO), international/French profile, news articles. |
| **International** | Lycée Français, European School, CIS, Rygaards, Bernadotteskolen and other options, sorted by how strong their French offer is. |
| **Compare** | Your starred shortlist side by side, with the best value in each row highlighted and overlaid trend charts. |
| **About** | How the score is calculated, data sources, caveats. |

The shortlist, home address, weights, filters and theme are saved in the browser (localStorage).

## Data pipeline

```bash
npm run data:register   # Institutionsregisteret (instreg.stil.dk), no key needed
npm run data:stats      # api.uddannelsesstatistik.dk, needs UDDSTAT_API_KEY in .env
npm run data:news       # Bing News per school (cached in data/raw/news; --refresh to refetch)
npm run data:build      # merge everything → public/data/schools.json
npm run data:all        # all of the above
```

`.env` (git-ignored):

```
UDDSTAT_API_KEY=<your key from https://api.uddannelsesstatistik.dk>
```

### Files

- `data/raw/`: downloaded register, statistics and news. Regenerate these with the scripts.
- `data/curated/`: hand-researched data: private school fees (`fees_*.json`), international school profiles (`international.json`), municipal SFO prices (`municipal_sfo.json`), district GeoJSON, and `overrides.json` for manual corrections. Nested fields are merged, e.g. `{"147019": {"fees": {"sfoMonthly": 1470}}}`.
- `scripts/config.mjs`: the list of municipalities covered.

### Statistics fetched (per school, per school year)

Exam averages (2010/11 onward), Danish and maths exams, socio-economic reference (value added), wellbeing indicators, absence, class size, pupil numbers per grade, inclusion, qualified teaching (kompetencedækning), pupils per teacher, and transitions to youth education. Municipal and national averages are included for comparison.

## The Skolescore

Each indicator is turned into a percentile among all mainstream schools in the area, then the percentiles are combined as a weighted average. The weights are adjustable in the UI, and there are presets. Missing indicators are skipped and the remaining weights rescaled. A school needs data covering at least 45% of the weight to get a score.

**Caveat:** the Ministry does not publish wellbeing, absence or teacher-qualification figures for private schools, so their scores lean on exam results. These scores are marked ◐. Use the **Like-for-like** preset to compare public and private schools on the same indicators.

## Known gaps

- Fees are missing for 8 private schools whose websites block automated access or don't publish prices.
- Herlev and Ishøj SFO prices come from search excerpts and should be checked manually.
- Municipal international or French-Danish classes in folkeskoler and FLAM (French mother-tongue) groups were not verified.
- Google News is unreachable from this network and GDELT rate-limited every request, so news comes from Bing only.
