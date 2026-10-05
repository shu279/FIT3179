/* Plain JavaScript: embed JSON specs, link the club selector and size compound views. */
'use strict';
const chartViews = new Map();
let mapControls;

async function renderChart(element, {resetMapPeriod=false}={}) {
  const name = element.dataset.spec;
  const previous=chartViews.get(name);
  const cityState=name==='premiership_symbols' && previous ? captureCityMapState(previous.view) : null;
  if(cityState)mapControls?.pause();
  chartViews.get(name)?.view.finalize();
  chartViews.delete(name);
  element.setAttribute('aria-busy','true');
  element.innerHTML = '<p class="chart-loading">Loading visualisation…</p>';
  try {
    const response = await fetch(`js/${name}.json`, {cache:'no-cache'});
    if (!response.ok) throw new Error(`Specification request failed (${response.status})`);
    const spec = await response.json();
    if(cityState)restoreCityMapState(spec,cityState,resetMapPeriod);
    const isVega = spec.$schema.includes('/vega/');
    const layout = chartLayout(spec,element.clientWidth);
    if (isVega) spec.width = element.clientWidth;
    element.replaceChildren();
    const result = await vegaEmbed(element, spec, {
      actions:false,renderer:'svg',tooltip:{theme:'custom'},defaultStyle:false,
      ...(name==='state_choropleth'?{bind:'#map-season-control'}:{}),
      ...(name==='grand_final_flows'?{bind:'#map-final-season-control'}:{}),
      mode:isVega?'vega':'vega-lite'
    });
    chartViews.set(name,{view:result.view,element,isVega,width:element.clientWidth,spec,layout});
    if(name==='premiership_symbols')mapControls?.replaceCityView(result.view);
    if(name==='ladder_bump'){
      const updatePeriod=(_signal,selection)=>{
        const range=selection.season||[2012,2025];
        const first=Math.max(2012,Math.ceil(range[0]));
        const last=Math.min(2025,Math.floor(range[1]));
        const status=document.querySelector('#journey-summary');
        status.textContent=first>last?'This range falls between seasons. Widen the selection to include a year.':`${first}–${last} · ${last-first+1} season${last===first?'':'s'} included in the win-rate comparison.`;
      };
      result.view.addSignalListener('seasonBrush',updatePeriod);
      updatePeriod('seasonBrush',result.view.signal('seasonBrush'));
    }
    element.dataset.rendered='true';
  } catch(error) {
    console.error(`Could not render ${name}:`,error);
    const message=document.createElement('p');
    message.className='chart-error';
    message.textContent='This chart could not load. Please reload the page. Original data sources are listed below.';
    element.replaceChildren(message);
    element.dataset.rendered='error';
  } finally { element.setAttribute('aria-busy','false'); }
}

async function initialiseClubControl() {
  const heatmap=chartViews.get('ladder_heatmap');
  const status=document.querySelector('#club-summary');
  if(!heatmap)return;
  try {
    const response=await fetch('data/team_summary.json');
    if(!response.ok)throw new Error('Club summary unavailable');
    const clubs=await response.json();
    // Vega-Lite creates the dropdown from params.bind in ladder_heatmap.json.
    // This small bridge shares its value with the separately embedded chart and prose.
    const updateClub=(_name,value)=>{
      const club=clubs.find(d=>d.team===value);
      status.textContent=club?`${club.team}: ${club.finals} of 14 seasons in finals · ${club.win_rate.toFixed(1)}% of regular-season games won · ${club.premierships} premiership${club.premierships===1?'':'s'}.`:'Geelong and Sydney set the standard for returning to finals.';
      const frequency=chartViews.get('finals_frequency');
      if(frequency)frequency.view.signal('focusTeam',value).runAsync().catch(error=>console.error('Club highlighting:',error));
    };
    heatmap.view.addSignalListener('focusTeam',updateClub);
    updateClub('focusTeam',heatmap.view.signal('focusTeam'));
  } catch(error) {console.error(error);status.textContent='The club summary and linked highlighting are unavailable.';}
}

function initialiseResize() {
  let timer;
  const observer=new ResizeObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      for(const entry of chartViews.values()){
        const width=Math.floor(entry.element.clientWidth);
        if(width>0&&Math.abs(width-entry.width)>2){
          entry.width=width;
          const layout=chartLayout(entry.spec,width);
          if((layout.type==='facet'&&layout.columns!==entry.layout.columns)||entry.spec.usermeta?.layout==='map-timeline'){
            renderChart(entry.element);
          }else{
            if(layout.type==='facet')entry.view.signal('child_width',layout.plotWidth);
            else entry.view.width(layout.plotWidth);
            if(layout.mapHeight){
              if(layout.type==='concat')entry.view.signal('city_map_height',layout.mapHeight);
              else entry.view.height(layout.mapHeight);
            }
            entry.layout=layout;
            entry.view.resize().runAsync().catch(error=>console.error('Chart resize:',error));
          }
        }
      }
    },160);
  });
  chartViews.forEach(entry=>observer.observe(entry.element));
  window.addEventListener('pagehide',()=>{observer.disconnect();chartViews.forEach(entry=>entry.view.finalize());},{once:true});
}

async function initialise() {
  const figures=[...document.querySelectorAll('[data-spec]')];
  // Render the opening charts first, then the rest in bounded groups.
  for(let i=0;i<figures.length;i+=3)await Promise.all(figures.slice(i,i+3).map(renderChart));
  await initialiseClubControl();
  document.querySelector('#reset-journey').addEventListener('click',()=>{
    const entry=chartViews.get('ladder_bump');
    if(entry)renderChart(entry.element);
  });
  mapControls=await initialiseMapControls(chartViews,()=>{
    const element=document.querySelector('[data-spec="premiership_symbols"]');
    return element?.getAttribute('aria-busy')==='true' ? Promise.resolve() : renderChart(element,{resetMapPeriod:true});
  });
  initialiseResize();
  document.documentElement.dataset.chartsReady=String(chartViews.size);
}
initialise();
