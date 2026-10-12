# AFL team consistency

Staying at the Top of AFL is a data visualisation of the 18 AFL clubs across the 2012–2025 seasons, built with HTML, Pure.css, JavaScript and Vega/Vega-Lite.

- [Visualisation](https://shu279.github.io/FIT3179/)

## Files

```text
index.html    Visualisation
css/          Styles
js/           JavaScript and Vega/Vega-Lite chart JSON
data/         Chart data, TopoJSON and source manifests
images/       Images
vendor/       Pure.css and Vega libraries
scripts/      Data preparation and validation
```

## Chart idioms

The page has 15 chart sections. The assignment rubric (v1.2, page 5) treats maps and idioms other than its listed basic charts as advanced, and counts a small-multiples series once.

These eight distinct idioms fall outside the rubric’s listed basic charts:

| Idiom | Chart specification | What it communicates |
| --- | --- | --- |
| Heatmap | [ladder_heatmap.json](js/ladder_heatmap.json) | Every club’s regular-season ladder position across fourteen seasons. |
| Treemap | [top_four_treemap.json](js/top_four_treemap.json) | Each club’s share of the 56 top-four ladder places, encoded by rectangle area. |
| Sankey diagram | [finals_return.json](js/finals_return.json) | Counts and conditional percentages of clubs retaining, gaining or losing finals participation. |
| Choropleth map | [state_choropleth.json](js/state_choropleth.json) | State finals percentages with actual finalist / club counts. |
| Proportional-symbol map | [premiership_symbols.json](js/premiership_symbols.json) | Finals participation by home city, across one season or a period. |
| Connection map | [grand_final_flows.json](js/grand_final_flows.json) | The home cities of Grand Final opponents, including same-city matchups. |
| Interval timeline (Gantt-style) | [finals_streaks.json](js/finals_streaks.json) | The start, end and duration of consecutive finals runs, with multiple intervals per club. |
| Box-and-whisker plot | [season_boxplot.json](js/season_boxplot.json) | Each club’s median, middle half and range of annual win rates. |

The finals-run timeline positions each interval by its start and end season on a calendar axis. This count does not rely on classifying the ladder-change histogram, lollipop chart, rank-journey lines or win-rate area charts as advanced. The different map idioms count separately; their extra timeline and controls do not. Basic charts remain where direct comparisons are clearer, including the premiership bar chart.

The six win-rate area charts use a shared 0–100% scale. Dark-green height directly shows the share of games won; pale green completes the remaining share, including draws and losses. Each strip uses the fourteen observed season records, and hovering a year updates all six readouts. The strips count as one basic area-chart series. The specification retains the filename `club_horizon.json` for existing references, but no longer uses a folded horizon encoding.

Numerical findings appear next to their marks: direct finals counts, longest-run labels, Geelong’s top-four denominator, title years, win-rate change arrows and a bracket for small rank changes. Win-rate row notes explain the six-club selection. Narrative introductions use the available section width, while technical captions and map descriptions retain a shorter reading measure. Map descriptions sit alongside the maps on larger screens.

Regenerate specifications with `node scripts/create-specs.cjs` and validate data, encodings and interactions with `node scripts/validate.cjs`.
