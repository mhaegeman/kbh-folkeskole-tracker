# Skolekort København 
![Presentation animated video of the website](docs/skolekort-kbh-reel.mp4)

**Website live 👇 https://mhaegeman.github.io/kbh-folkeskole-tracker/**

## How to actually use it? 
![Demo: the Explore page ranked with the Wellbeing first priority, a home address with district school, bike travel times and route on the map, a school page with its score, strengths and pupil survey, and the shortlist comparison](docs/demo.gif)

<sub>[Full-quality video (MP4)](docs/demo.mp4) · Example: rank schools with the Wellbeing first priority and shortlist the top two, add Gammel Kongevej 10 as home to get the district school, bike times and route, open the school's “Why 66?” and “What pupils say”, then compare the shortlist.</sub>

A school finder for Copenhagen and the 19 surrounding municipalities. It covers folkeskoler, private schools (friskoler/privatskoler) and international schools, with official Ministry statistics, a composite **Skolescore**, fees, news, a map, school districts and travel times.

### Statistics fetched (per school, per school year)

Exam averages (2010/11 onward), Danish and maths exams, socio-economic reference (value added), wellbeing indicators, absence, class size, pupil numbers per grade, inclusion, qualified teaching (kompetencedækning), pupils per teacher, and transitions to youth education. Municipal and national averages are included for comparison.

## The Skolescore

Each indicator is turned into a percentile among all mainstream schools in the area, then the percentiles are combined as a weighted average. The weights are adjustable in the UI, and there are presets. Missing indicators are skipped and the remaining weights rescaled. A school needs data covering at least 45% of the weight to get a score.

**Caveat:** the Ministry does not publish wellbeing, absence or teacher-qualification figures for private schools, so their scores lean on exam results. These scores are marked ◐. Use the **Like-for-like** preset to compare public and private schools on the same indicators.

## Known gaps

- Fees are missing for 8 private schools whose websites block automated access or don't publish prices.
- Herlev and Ishøj SFO prices come from search excerpts and should be checked manually.
- Municipal international or bilingual classes in folkeskoler, and mother-tongue teaching groups, were not verified.
- Google News is unreachable from this network and GDELT rate-limited every request, so news comes from Bing only.
