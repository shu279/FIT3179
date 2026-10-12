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
    const plotWidth = Math.max(120, available - (spec.usermeta?.layout === 'map-timeline' ? (spec.vconcat.length===1 ? 10 : 75) : 140));
    // Flatten the previous arrangement before a resize chooses a new one.
    const panels = journey ? spec.vconcat.flatMap(view=>view.hconcat||[view]) : spec.vconcat;
    panels.forEach(view => {
      view.width = plotWidth;
      if (journey) {
        if(view.name!=='journey_overview'){
          // Only the win-rate panel needs space for its reading note.
          view.title.offset=view.name==='journey_summary'?60:14;
        }
      }
    });
    if(journey){
      const detail=panels.find(view=>view.name==='journey_detail');
      const summary=panels.find(view=>view.name==='journey_summary');
      const overview=panels.find(view=>view.name==='journey_overview');
      const sideBySide=available>=900;
      summary.height=sideBySide?260:145;
      if(sideBySide){
        summary.title.offset=14;
        // Keep the reading note above the bars, within the shared plot height.
        summary.encoding.y.scale.range=[46,260];
      }else delete summary.encoding.y.scale.range;
      if(sideBySide){
        // Leave room for axes and the gap between panels.
        const plotBudget=available-225;
        detail.width=Math.floor(plotBudget*.62);
        summary.width=plotBudget-detail.width;
        overview.width=available-85;
        spec.vconcat=[{hconcat:[detail,summary],spacing:32,resolve:{scale:{x:'independent',y:'independent',color:'shared'}}},overview];
      }else spec.vconcat=panels;
      summary.encoding.x.axis.values=summary.width<200?[0,50,100]:[0,25,50,75,100];
      for(const panel of panels){
        const text=Array.isArray(panel.title.text)?panel.title.text.join(' '):panel.title.text;
        const lines=[''];
        for(const word of text.split(' ')){
          const last=lines.length-1;
          if(lines[last]&&lines[last].length+word.length+1>20)lines.push(word);
          else lines[last]+=(lines[last]?' ':'')+word;
        }
        panel.title.text=panel.width<200?lines:text;
      }
    }
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
