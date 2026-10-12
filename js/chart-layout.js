/* Vega-Lite compound views use explicit panel sizes rather than container sizing. */
function chartLayout(spec, availableWidth) {
  const available = Math.max(240, Math.floor(availableWidth));
  if (spec.facet) {
    const columns = available >= 900 ? 3 : available >= 600 ? 2 : 1;
    const plotWidth = Math.max(130, Math.floor((available - (columns - 1) * 30) / columns) - 85);
    spec.columns = columns;
    spec.spec.width = plotWidth;
    return {type:'facet', columns, plotWidth};
  }
  if (spec.vconcat) {
    const journey = spec.usermeta?.layout === 'journey';
    const sideLegend = journey && available >= 600;
    const plotWidth = Math.max(120, available - (spec.usermeta?.layout === 'map-timeline' ? (spec.vconcat.length===1 ? 10 : 75) : sideLegend ? 300 : 175));
    spec.vconcat.forEach(view => {
      view.width = plotWidth;
      if (journey) {
        // Reserve a side column on wide screens; preserve the plot width on phones.
        const legend = view.encoding.color.legend;
        if (legend) {
          legend.orient = sideLegend ? 'right' : 'top';
          legend.columns = sideLegend ? 1 : {expr:'width < 385 ? 1 : 2'};
        }
        if(view.name!=='journey_overview'){
          if (legend) legend.offset=sideLegend?16:54;
          view.title.offset=sideLegend||!legend?60:14;
        }
      }
    });
    const mapHeight = spec.usermeta?.layout === 'map-timeline' ? Math.max(220,Math.min(440,Math.round(available*0.55))) : null;
    if(mapHeight) spec.vconcat[0].height = mapHeight;
    return {type:'concat', plotWidth, mapHeight};
  }
  const mapHeight = spec.usermeta?.layout === 'connection-map' ? Math.max(240,Math.min(560,Math.round(available*0.82))) :
    spec.usermeta?.layout === 'map' ? Math.max(240,Math.min(400,Math.round(available*0.6))) : null;
  if(mapHeight) spec.height = mapHeight;
  return {type:'single', plotWidth:available, mapHeight};
}

// The same sizing logic is used by the local validation script.
if (typeof module !== 'undefined') module.exports = chartLayout;
