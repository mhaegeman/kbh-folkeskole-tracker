import { INDICATORS, PRESETS } from '../lib/score';
import { useStore } from '../lib/store';

export default function About() {
  const { data } = useStore();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-[40px] sm:leading-[44px]">How it works</h1>

      <section className="mt-8 space-y-3 text-ink-2">
        <h2 className="text-xl font-semibold text-ink">The Skolescore</h2>
        <p>
          The Skolescore (0–100) combines the indicators below. For each one, every school is placed on a <b>percentile</b> relative to
          the other schools in the area (0 = lowest, 100 = highest; flipped for absence and class size, where lower is better). The
          percentiles are then averaged using your weights. A score of 50 therefore means “typical for greater Copenhagen”.
        </p>
        <p>
          Missing indicators are skipped and the remaining weights are rescaled. A school needs data covering at least 45% of the weight to
          get a score, so international schools that do not take Danish exams usually show “n/a” — that is not a negative judgement.
        </p>
        <p>
          <b>Public vs. private:</b> the Ministry publishes wellbeing, absence and teacher-qualification figures only for folkeskoler. Private
          schools are therefore scored mainly on exams, value added, class size and transitions, which tends to favour them. Scores built on
          less than 75% of the weight are marked ◐. The <b>Like-for-like</b> preset uses only indicators that exist for every school.
        </p>
        <p>
          <b>Score breakdown:</b> every school page has a “Why this score?” table. It starts from 50 (a typical school) and shows how many
          points each indicator adds or subtracts: <i>(percentile − 50) × the indicator’s share of the weight</i>. The contributions add up
          exactly to the score. Indicators that don’t apply to a school, or have no data, carry no weight, and the remaining weights are rescaled.
        </p>
        <p>
          <b>Limited data:</b> when a school has data for less than 60% of the quality weight, its indicator effects are scaled down in
          proportion (e.g. to 60% if it has data for 36%). A school known from only a few measures therefore stays closer to 50 instead of
          jumping to the top on thin evidence.
        </p>
        <p>
          <b>International schools</b> that don’t sit the Danish exams get an <i>estimated</i> exam indicator from their own final exams —
          IB Diploma, European Baccalaureate or French Baccalauréat — compared with that exam’s benchmark (IB world average, all European
          Schools, the AEFE network of French schools abroad). The school’s distance from its benchmark, in standard deviations, is placed
          on the Danish scale (mean 7.4, SD 2.45, computed from the Ministry’s distribution of pupils’ exam averages). These are
          end-of-school exams, not 9th grade, so the result is marked <i>est.</i> Parameters and sources are in
          <code className="rounded bg-surface-2 px-1">data/curated/exam_conversions.json</code>.
        </p>
        <p>Letter tiers: A+ ≥ 85, A ≥ 75, B+ ≥ 65, B ≥ 55, C+ ≥ 45, C ≥ 35, D ≥ 25, E below.</p>
        <div className="card mt-4 divide-y divide-border">
          {INDICATORS.map((d) => (
            <div key={d.key} className="flex gap-4 px-4 py-3">
              <div className="w-44 shrink-0 font-medium text-ink">{d.label}</div>
              <div className="text-sm">{d.description} <span className="text-ink-3">Default weight {PRESETS[0].weights[d.key]}.</span></div>
            </div>
          ))}
        </div>
        <p className="text-sm">
          <b>Why value added matters:</b> exam grades mostly reflect who the pupils are (parents’ education and income). The Ministry’s
          socio-economic reference estimates the grade a school’s pupils <i>would</i> be expected to get, so the difference shows how much the
          school itself contributes. Differences under ~0.5 points are usually not statistically significant.
        </p>
      </section>

      <section className="mt-10 space-y-3 text-ink-2">
        <h2 className="text-xl font-semibold text-ink">Other measures on school pages</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Social climate</b>: individual questions from the national pupil wellbeing survey (bullying, teasing, loneliness,
            feeling safe, belonging, liking the school, calm in class, clean toilets). Each figure is the share of pupils giving the
            listed answers, excluding “prefer not to answer”, compared with the municipality and Denmark. Figures from fewer than 20 answers are faded.</li>
          <li><b>Do families choose this school?</b> The share of pupils living outside the school’s municipality, and how year groups grow
            or shrink from one school year to the next (6th → 7th grade is skipped, because many pupils change school then by design).
            The 3-year average of the latter is the <i>Families stay &amp; join</i> score indicator.</li>
          <li><b>Teacher qualifications by subject</b>: share of lessons taught by a teacher qualified in that subject, per stage (folkeskoler only).</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3 text-ink-2">
        <h2 className="text-xl font-semibold text-ink">Data sources</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>School register</b>: Institutionsregisteret (STIL) — names, addresses, coordinates, contact info, type and ownership.</li>
          <li><b>Statistics</b>: Børne- og Undervisningsministeriet via api.uddannelsesstatistik.dk — exam grades (since 2010/11), socio-economic reference,
            wellbeing survey, absence, class size, pupil numbers, qualified teaching, pupils per teacher and transitions to youth education.</li>
          <li><b>Fees</b>: researched on each private school’s website (monthly fee for a 1st-grade pupil, SFO, one-off fees). Municipal SFO prices from each municipality’s website.</li>
          <li><b>International profiles</b>: official school websites (curriculum, languages, fees, admission rules).</li>
          <li><b>School districts</b>: GeoFA (FKG theme 5710) national skoledistrikter, queried live for your address.</li>
          <li><b>News</b>: Bing News search (and GDELT) for each school’s name; filtered to articles that mention the school.</li>
          <li><b>Maps & routing</b>: OpenStreetMap / CARTO tiles, Photon address search (komoot), OSRM routing (routing.openstreetmap.de).</li>
        </ul>
        {data && (
          <p className="text-sm text-ink-3">
            Dataset built {new Date(data.generatedAt).toLocaleString('en-GB')}
            {data.statsFetchedAt && ` · statistics fetched ${new Date(data.statsFetchedAt).toLocaleDateString('en-GB')}`}.
            Refresh with <code className="rounded bg-surface-2 px-1">npm run data:all</code>.
          </p>
        )}
      </section>

      <section className="mt-10 space-y-3 text-ink-2">
        <h2 className="text-xl font-semibold text-ink">Caveats</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Small schools have few exam pupils, so their yearly numbers can jump around. The score uses 3-year averages to smooth this.</li>
          <li>Wellbeing data covers grades 4–9; private schools are not required to take part in every survey.</li>
          <li>Fees change every year and may depend on grade level, siblings or income. Always confirm with the school.</li>
          <li>The score doesn’t capture pedagogy, values, atmosphere or fit for your children — visit the schools.</li>
        </ul>
      </section>
    </div>
  );
}
