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

These eight distinct advanced idioms form the conservative count:

| Idiom | Chart specification | What it communicates |
| --- | --- | --- |
| Heatmap | [ladder_heatmap.json](js/ladder_heatmap.json) | Every club’s regular-season ladder position across fourteen seasons. |
| Treemap | [top_four_treemap.json](js/top_four_treemap.json) | Each club’s share of the 56 top-four ladder places, encoded by rectangle area. |
| Sankey diagram | [finals_return.json](js/finals_return.json) | Counts and conditional percentages of clubs retaining, gaining or losing finals participation. |
| Choropleth map | [state_choropleth.json](js/state_choropleth.json) | State finals percentages with actual finalist / club counts. |
| Proportional-symbol map | [premiership_symbols.json](js/premiership_symbols.json) | Finals participation by home city, across one season or a period. |
| Connection map | [grand_final_flows.json](js/grand_final_flows.json) | The home cities of Grand Final opponents, including same-city matchups. |
| Horizon chart | [club_horizon.json](js/club_horizon.json) | Six clubs’ absolute win rates from 0% to 100%, using four consecutive folded 25-point bands. All six strips count as one chart. |
| Box-and-whisker plot | [season_boxplot.json](js/season_boxplot.json) | Each club’s median, middle half and range of annual win rates. |

This count does not rely on classifying the finals-run interval timeline, ladder-change histogram, lollipop chart or rank-journey lines as advanced. The different map idioms count separately; their extra timeline and controls do not. Basic charts remain where direct comparisons are clearer, including the premiership bar chart.

The horizon chart uses observed season records for all tooltips and readouts. Interpolated points only locate crossings of the 25%, 50% and 75% drawing boundaries; they are not additional observations. The four absolute win-rate bands are 0–25%, >25–50%, >50–75% and >75–100%, shown in pale green, sage, dark green and orange. Their heights sum to the full win rate; an exact boundary completes the lower band. A six-pixel inset above and below the folded area separates a full band from the row boundary. This folded encoding follows the [horizon-graph idiom documented by Vega](https://vega.github.io/vega/examples/horizon-graph/); the AFL data transforms, layout and linked year readout are implemented for this site.

Numerical findings appear next to their marks: direct finals counts, longest-run labels, Geelong’s top-four denominator, title years, win-rate change arrows and a bracket for small rank changes. Horizon row notes explain the six-club selection. Narrative introductions use the available section width, while technical captions and map descriptions retain a shorter reading measure. Map descriptions sit alongside the maps on larger screens.

Regenerate specifications with `node scripts/create-specs.cjs` and validate data, encodings and interactions with `node scripts/validate.cjs`.
