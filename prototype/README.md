# The Long Game — AFL prototype

A single scrolling visual story about consistency across the 18-club AFL era, 2012–2025. Includes 15 main visualisations (three map idioms) and one small introductory chart, using real data retrieved on 14 September 2026.

## Open the prototype

Open this folder in VS Code and use **Live Server** on `index.html`, as in the lecture workflow. Alternatively, from the repository root, run:

```sh
cd prototype
python3 -m http.server 8000 --bind 127.0.0.1
```

Then visit <http://127.0.0.1:8000/>. Serve the folder over HTTP: double-clicking the HTML file can block the JSON requests.

## Lecture-aligned stack

- HTML, Pure.css grids and custom CSS for the page.
- Plain JavaScript and `vegaEmbed` to embed separate, readable JSON specifications.
- Vega-Lite 5.20.1 for thirteen charts, including the small introductory chart; Vega 5.30.0 for the treemap, finals-return flow diagram and radar chart.
- Vega-Embed 6.26.0 and Pure.css 3.0.0, stored in `vendor/` so the page does not need a CDN connection.
- JSON data and a simplified ABS TopoJSON boundary file for the maps.

This follows the Week 7 embedding pattern, Week 8 mapping concepts, Week 9 interaction examples and Week 10 linked views in the local lecture materials. There is no build step or package installation required to run the page. Optional scripts in `scripts/` prepare data, generate specs and validate the results; they do not run in the webpage.

### Week 9 studio patterns

| Studio topic | Implementation |
| --- | --- |
| Dropdown, pp. 21–25 | `ladder_heatmap.json`: `params` with `bind.input: "select"`; conditional opacity highlights the chosen club. |
| Legend selection, pp. 15–20 | `ladder_bump.json`: a point selection bound to the colour legend highlights one or more clubs. |
| Slider filter, pp. 26–29 | `finals_streaks.json`: `bind.input: "range"` and `transform.filter` show runs of at least 1–7 seasons; the axes stay fixed. |
| Tooltips and calculations, pp. 11–14 | Tooltips use readable labels and number formats. `calculate` turns finals/premiership flags into Yes/No text. |
| Text annotations, pp. 30–36 | Text layers label the heatmap and finals totals; map labels also use layers. |
| Multiple charts, pp. 37–39 | HTML containers, Pure.css plus custom CSS, separate JSON files and `vegaEmbed` with `actions: false`. |

The studio includes older `selection` syntax and a Vega-Lite 5 `params` example; this project uses the latter. The club dropdown is defined in JSON, with a small JavaScript signal listener to update the separately embedded finals-frequency chart and summary text. That cross-chart bridge is an extension of the studio's individual-chart controls. The radar, Sankey and treemap are also extensions, written in Vega JSON rather than covered by the Week 9 exercises. The studio's logarithmic COVID axes and population size classes are data-specific examples, so they are not applied to AFL ranks or percentages.

### Week 10 studio patterns

| Studio topic | Implementation |
| --- | --- |
| Overview + detail, pp. 2–8 | `ladder_bump.json`: `vconcat` combines a rank detail chart, full-period overview and win-rate bars. An interval brush in the overview changes the detail domain. |
| Coordinated views, pp. 9–17 | The same brush filters the data for win-rate bars. Rates use total wins / actual games played, not an average of season rates. A window rank updates the “Best” annotation, retaining ties. |
| Time-selectable choropleth, pp. 18–22 | `state_choropleth.json`: the season slider filters a long table of 112 state-year records before looking up each geometry. The legend stays at 0–100%; regions without clubs remain grey with “Not applicable” tooltips. |
| Zoom and map centre, pp. 18–22 | Bound parameters change the projection scale and centre. “Reset map” restores Australia in 2025 at normal zoom. |
| Small multiples, pp. 23–28 | `club_small_multiples.json`: a facet splits six clubs into matching line charts, with shared 2012–2025 and 0–100% scales and a 50% reference line. |

The small multiples use facet because the club is a value in the long table. The layer inside each panel draws the line and its reference rule. `repeat` is an alternative for comparing separate data columns and is not needed here. `chart-layout.js` sizes compound views using plain JavaScript: panels change between three, two and one column, while the selected journey period survives resizing. The lecture's multiple-view patterns are defined in Vega-Lite JSON; no additional chart library is used.

## Where to edit

| File or folder | Purpose |
| --- | --- |
| `index.html` | Narrative, chart containers, source notes |
| `css/style.css` | Colours, typography and responsive layout |
| `js/main.js` | Embedding, club highlighting, selected-period feedback and reset controls |
| `js/chart-layout.js` | Responsive sizes for concatenated and faceted charts |
| `specs/` | One readable Vega/Vega-Lite JSON file per chart |
| `data/manifest.json` | Source URLs, coverage and home-city groupings |
| `data/corrections.json` | Documented source discrepancy and verification URLs |

The dropdown below the heatmap highlights the ladder heatmap and finals-frequency chart. The finals-streak slider hides shorter runs; return it to 1 to restore all runs. Drag across the small ladder-journey timeline to select a period; the upper chart zooms and the bars recalculate for the included seasons. Click a legend label to highlight a club or Shift-click to compare several. Double-click the timeline or press “Show all seasons” to restore the full period; the button also resets club highlighting. A selection falling between annual records shows a message asking for a wider range. The state map has season, zoom and centre controls; the adjacent NSW summary explicitly covers all fourteen years. The radar compares Geelong and Hawthorn on five fixed 0–100% axes; it does not combine the measures into an overall score. Diverging bars show the change in win rate between the two seven-season periods. Hover or tap chart marks for details.

## Data and definitions

- **AFL Tables:** 252 club-season records covering all 18 clubs across 14 seasons. Exact source URLs are in the manifest.
- **ABS:** ASGS Edition 4 state/territory boundaries, simplified with Mapshaper and cropped to mainland Australia and Tasmania. Attribution and licence context appear on the page.
- **Wikidata:** representative city coordinates, under CC0. Club-to-city assignments are author-defined and documented in the manifest.

Win rate is wins divided by actual regular-season games played; draws count as games but not wins. Finals participation uses recorded appearances, preserving Essendon's 2013 exclusion. For each year, the state choropleth uses clubs reaching finals divided by all clubs based in that state; its accompanying sidebar describes the full-period totals. Map connections represent Grand Final opponents, not travel routes.

Port Adelaide's 2024 ladder rank was corrected from 3 in the downloaded club summary to 2, checked against the full-season ladder and official reports. The original value remains in `source_rank`; the correction is recorded separately.

The 2026 snapshot is retained separately and excluded from the story. The snapshot was taken during that season; it is not a current live feed. Before submission, refresh the sources, verify the completed 2026 season, and update the period, aggregates, chart definitions and narrative together.

## Checks and preparation

With Node.js installed, from this folder:

```sh
node scripts/validate.cjs
```

This checks records, ranks, finals totals, every state-year join, selected-period aggregates, missing-region colours, shared facet scales, legend highlighting and all 16 chart specifications at desktop and narrow widths using the bundled libraries. Node cannot attach the brush’s window pointer events, so only that headless warning is ignored; other warnings fail the check. Actual drag, Shift-click, reset and map input interactions were also checked in Chrome at 320, 390, 768 and 1280 pixels, including text sizes and horizontal overflow. The Node check does not replace that browser review.

`scripts/create-specs.cjs` rebuilds the chart JSON, derives the yearly state table and consecutive-season comparisons from the included club-season records. The added stacked bars show time in each ladder group; the flow diagram shows changes in finals participation; the histogram shows year-to-year ladder movement. There are 234 comparisons: 18 clubs × 13 adjacent-season pairs. `scripts/prepare-data.cjs` requires a folder of cached original AFL Tables HTML and Wikidata entity JSON; those temporary downloads are not bundled. The cleaned data is included, so these preparation scripts are unnecessary for viewing or hosting the prototype. Changing the study period also requires updating the scripts' explicit year ranges and the page's text.

## Publish and finish the assignment

The live page is <https://shu279.github.io/FIT3179/>; the root entry opens this `prototype/` folder. GitHub Pages serves **main → /(root)** using **Deploy from a branch**, as in the Week 4 tutorial. Keep the `data/`, `specs/`, `vendor/`, `css/` and `js/` paths alongside this folder's `index.html`. Push changes to `main` and check the Pages deployment in the repository's Actions tab.

This is a prototype. Add your author details, review the AI acknowledgement against the unit's requirements, complete the hand-drawn A4 sketch and tutor feedback, refresh the data, and check the final page at desktop and mobile sizes before submission.

Library projects: [Pure.css](https://purecss.io/), [Vega](https://github.com/vega/vega), [Vega-Lite](https://github.com/vega/vega-lite), [Vega-Embed](https://github.com/vega/vega-embed). Their upstream licences apply to the bundled files.
