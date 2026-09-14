# Data sources for AFL team consistency across seasons

Research checked on 14 September 2026. League confirmed by the project owner: AFL. Recommended scope: the men's AFL competition, starting in 2012.

Use **Squiggle match results + AFL Tables season summaries + ABS state boundaries + Wikidata locations**. Natural Earth provides the graticule requested in the project notes. These sources cover results, ladder positions, finals participation, premierships and geography without requiring player-level statistics.

This is a source-selection guide. Source pages and documentation were inspected; a complete dataset has not yet been downloaded, joined or validated. Proposed columns and file-size targets below are design recommendations, not claims about files already created.

**How this fits the assignment.** The local [project notes](specification.md) establish the theme. The [assignment specification, version 1.1](rublic/Data%20Visualisation%202%20Specifications_v1.1.pdf), pages 2–3, requires reliable real-world data, the most recent available dataset, at least two sources, three different map idioms and a minimum of ten charts. Repeated charts/small multiples count as one chart. Page 5 sets higher complexity requirements for higher grades, including more than ten charts. Page 1 limits the data downloaded by the final webpage to less than a few megabytes.

The PDF also clarifies two shorthand notes: Pure.css is optional, and the navigation restriction concerns links/buttons that swap major page sections; source links and suitable chart interaction are allowed.

**Time period.** Start with 2012 so the comparison covers the 18-team era: the AFL granted GWS entry as its 18th team from 2012 ([AFL annual report](https://resources.afl.com.au/afl/document/2019/12/05/0b3bf9a6-8f7d-4094-8591-d10f5babd3cf/afl_annual_report_2010_V2-min.pdf)). Use 2012–2025 for completed-season development and retain 2026 as a separate current-season snapshot. The 2026 Grand Final is scheduled for 26 September ([official club finals information](https://www.sydneyswans.com.au/matchday/finals)); refresh results and extend the completed-season analysis to 2026 after it finishes, before the assignment's 25 October deadline. Do not encode an unfinished 2026 premiership outcome as zero. Label every extract with its cutoff date.

| Priority | Source and access | Relevant data | Best role |
|---|---|---|---|
| Core | [Squiggle API](https://api.squiggle.com.au/) — JSON or CSV | Games, teams, scores, dates, venues, finals indicators; actual standings also available | Match outcomes and performance away from home |
| Core | [AFL Tables season summaries](https://afltables.com/afl/teams/geelong/season.html) — HTML tables | Season, games played, wins/draws/losses, ladder rank, finals records and premiership indicators | Long-term consistency and season outcomes |
| Core spatial | [ABS 2026 digital boundaries](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-4-july-2026-june-2031/access-and-downloads/digital-boundary-files) — zipped shapefile | State/territory polygons, codes and names | Australian base maps and state comparisons |
| Core spatial | [Wikidata: example venue record](https://www.wikidata.org/wiki/Q330136) and [Query Service](https://query.wikidata.org/) | Geographic coordinates and stable entity IDs | Venue symbols and endpoints for geographic connections |
| Supporting | [Natural Earth 110m physical vectors](https://www.naturalearthdata.com/downloads/110m-physical-vectors/) — zipped shapefile | 30-degree graticule; optional land/coastline | Geographic reference layer |

**1. Squiggle: machine-readable matches.** Maintained by Max Barry. Documented endpoint examples:

- [Games for 2025, CSV](https://api.squiggle.com.au/?q=games;year=2025;format=csv)
- [Games for 2026, CSV](https://api.squiggle.com.au/?q=games;year=2026;format=csv)
- [Actual standings for 2025, CSV](https://api.squiggle.com.au/?q=standings;year=2025;format=csv)
- [Teams for 2025, JSON](https://api.squiggle.com.au/?q=teams;year=2025)

Use `standings` for actual results; `ladder` contains predictions. Retain team/venue identifiers and finals-stage codes. Use completed games and separate regular-season matches from finals. Documented game coverage extends back to 2000.

Automated downloads require a User-Agent with a contact email, caching and restrained requests. Visitors must not fetch directly from the API: serve saved CSV/JSON through GitHub Pages. Endpoint syntax was checked against documentation; raw responses were not validated here. [API requirements](https://api.squiggle.com.au/).

**2. AFL Tables: most direct match to the topic.** Its club season-summary tables separate home-and-away and finals statistics. They include played/won/drawn/lost, scores for/against, percentage, ladder ranking and flags for premiers, runners-up, minor premiers and finalists. Current pages include 2026 alongside historical seasons. The [Geelong summary](https://afltables.com/afl/teams/geelong/season.html) was inspected, including its 2012–2026 rows; [Essendon's summary](https://afltables.com/afl/teams/essendon/season.html) provides another example. The [2025 season page](https://afltables.com/afl/seas/2025.html) supplies match scores and venues.

Extract one row per club and season. Preserve regular-season rank separately from finals outcome. Convert HTML tables to a compact CSV during preparation. An alternative access tool is the R package [fitzRoy](https://jimmyday12.github.io/fitzRoy/reference/fetch_ladder.html), which supports AFL, AFL Tables and Squiggle ladder sources. Its documentation was checked; the package was not run. fitzRoy is an access tool, not an additional independent data source.

AFL Tables is a specialist statistical archive rather than the league's official publication. Attribute it explicitly. A clear dataset redistribution licence was not established from the inspected pages.

**3. ABS: current Australian states and territories.** Use **ASGS Edition 4, States and Territories – 2026 – Shapefile**, released 22 July 2026. The original project link points to Edition 3 (2021); the 2026 edition is now available. [Dataset page](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-4-july-2026-june-2031/access-and-downloads/digital-boundary-files).

- [Direct 2026 state/territory ZIP](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-4-july-2026-june-2031/access-and-downloads/digital-boundary-files/STE_2026_AUST_SHP_GDA2020.zip)
- Published source download size: approximately 20.34 MB. This is the preparation download, not the file the webpage should load.
- Shapefile join fields: `STE_CODE26` and `STE_NAME26`.
- Convert to geographic longitude/latitude suitable for the map, simplify in Mapshaper and export TopoJSON. Keep shared borders consistent and inspect small territories after simplification.
- Recommended final boundary-file budget: 100–300 KB, subject to visual inspection; this is an estimate.

The [ABS copyright page](https://www.abs.gov.au/website-privacy-copyright-and-disclaimer) provides its general CC BY 4.0 terms and exceptions. Credit the ABS and describe simplification/transformation.

**4. Wikidata: venue and city coordinates.** Use geographic coordinate property `P625` and entity IDs to build a small location lookup. For example, the [Melbourne Cricket Ground record, Q330136](https://www.wikidata.org/wiki/Q330136), contains a coordinate statement with a cited reference. Extract only the venues present in the selected matches. Wikidata's [Query Service](https://query.wikidata.org/) is the bulk-query entrypoint; structured data is [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).

Keep `venue_id`, `venue_name`, `latitude`, `longitude`, `state_code`, `source_url` and `retrieved_at`. Add an alias table to connect source spellings and historical sponsor names to the same ground. Check coordinates against venue or government pages when ambiguous. The single MCG example was verified; coverage of every historical AFL venue still needs checking.

For club-based maps, maintain a separate club-to-home-state/base-city lookup and source each assignment. A club's base is distinct from the location of an individual home fixture. Do not place every Melbourne club at the same stadium coordinate and imply those are separate physical locations.

**5. Natural Earth: requested graticule.** Select “Download 30” in the graticules section of the [110m physical vectors page](https://www.naturalearthdata.com/downloads/110m-physical-vectors/). It lists a 42.3 KB ZIP, version 4.0.0. Natural Earth's [terms](https://www.naturalearthdata.com/about/terms-of-use/) place its map data in the public domain.

The download hyperlink in the page HTML appeared malformed when checked. The corresponding official-host URL is [30-degree graticule ZIP](https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_graticules_30.zip), verified to return HTTP 200 with an application/zip content type and a 43,314-byte content length. A graticule is a supporting layer, not a separate thematic map idiom. Do not treat it as the second analytical dataset.

**How to combine the sources.** Create a stable internal `team_id`, mapping AFL Tables names to Squiggle team IDs. Join season summaries on `team_id + season`. Match venue aliases to Wikidata locations and map home-state codes to ABS state polygons. Keep a source URL beside every manual lookup. Retain conflicting source values for review rather than silently replacing them.

| Proposed prepared file | Grain and columns | Purpose |
|---|---|---|
| `team_seasons.csv` | One club-season; team ID, season, played, wins, draws, losses, regular-season rank, finals appearance, finals wins, premier | Most charts about consistency; 252 rows for 18 clubs × 14 completed seasons (2012–2025), or 270 through 2026 |
| `matches.csv` | One match; source game ID, season, round, date, teams, scores, venue, finals stage, completion | Home/away comparisons and geographic performance |
| `teams.csv` | One club; internal ID, source IDs/names, home-state code, sourced base location | Consistent joins and geographic grouping |
| `venues.csv` | One physical venue; ID, coordinates, state/country, source URL | Map positions |
| `venue_aliases.csv` | One source spelling; source name, venue ID | Historical name reconciliation |
| `australia_states.topojson` | Simplified ABS state/territory polygons | Reused base map |

Prepare summaries before publishing. Target less than 1 MB for the combined prepared data as a practical working budget, and measure the actual result. Raw archives and full API responses need not be downloaded by the page.

**Three map idioms supported by these data.** These are proposed uses, not finished designs:

| Map idiom | Story question | Data combination and definition |
|---|---|---|
| Choropleth | Which states' clubs most often reach finals? | AFL Tables finals participation + club home-state lookup + ABS polygons. Colour by finalist club-seasons / eligible club-seasons, not raw totals. Areas without a club in the study period are “not applicable”. |
| Proportional-symbol map | Where has a highlighted club accumulated wins? | Match results + venue coordinates + ABS background. Symbol area represents wins; show games played and win rate in tooltips. Include a Melbourne inset or aggregation to manage overlap. |
| Geographic flow map | Where does a highlighted club play away fixtures, and how does it perform there? | Match results + sourced club base + venue coordinates. Width represents fixture count; colour can represent destination win rate. Label lines as fixture connections, not observed travel routes or measured travel distance. |

The same files also support a team-by-season rank matrix, a ladder bump chart, finals streak timelines, premiership summaries, home/away comparisons, season-to-season status transitions and performance-versus-consistency comparisons. These provide material for the required broader chart collection; the final sketch still needs a count of distinct charts and effective advanced idioms.

**Definitions that prevent misleading comparisons.** These are recommended analysis choices:

- Define win rate as `100 × wins / games_played`. If draws receive half credit, label the alternative explicitly as a points-based result rate: `100 × (wins + 0.5 × draws) / games_played`.
- AFL ladder “percentage” is `100 × points_for / points_against`, not win rate.
- Use actual games played, not a fixed 22 or 23 denominator. The inspected Geelong table includes 17 games in 2020 and 21 in 2015. Keep finals outside regular-season win-rate calculations. [Season summary](https://afltables.com/afl/teams/geelong/season.html).
- Count **seasons with a finals appearance** separately from the **number of finals matches**. Use actual finals records rather than assuming a reconstructed top eight always qualified. Essendon was officially placed ninth and excluded from the 2013 finals. [AFL statement](https://www.afl.com.au/news/451443/statement-from-afl-chairman-mike-fitzpatrick).
- Measure sustained success with finals appearance rate, top-four frequency, premierships and the season-by-season ladder. Small year-to-year movement alone can also describe a consistently unsuccessful club.
- Separate club home state from match venue state. Where overseas fixtures fall outside an Australian map, state the scope and exclusions.
- Record source author/publisher, exact URL, access date, season coverage, licence/access conditions and transformations for the submission's “What” section. Acknowledge AI assistance as required by the brief.
