/* Vega-Lite creates the Studio-style inputs from params.bind in the JSON.
 * Plain JavaScript shares their signals between the three embedded maps and
 * supplies an opt-in play/pause button. Brushing itself is defined in JSON. */
async function initialiseMapControls(chartViews, renderCity) {
  const names=['state_choropleth','premiership_symbols','grand_final_flows'];
  const sharedSignals=['selectedSeason','mapCentre','showPhysical','showCultural'];
  const controller=chartViews.get(names[0])?.view;
  let symbols=chartViews.get(names[1])?.view;
  const status=document.querySelector('#map-season-summary');
  const flowYear=document.querySelector('#map-final-year');
  const flowResult=document.querySelector('#map-final-result');
  const flowContext=document.querySelector('#map-final-context');
  const play=document.querySelector('#play-map');
  const reset=document.querySelector('#reset-map');
  const singleMode=document.querySelector('#city-mode-single');
  const periodMode=document.querySelector('#city-mode-period');
  const singleControls=document.querySelector('#city-single-controls');
  const periodControls=document.querySelector('#city-period-controls');
  const sizeLegendTitle=document.querySelector('#city-size-legend-title');
  const cityFrame=document.querySelector('.city-map-frame');
  if(!controller || !symbols || names.some(name=>!chartViews.has(name))){
    play.disabled=true;reset.disabled=true;
    status.textContent='The maps could not load. Reload the page to try again.';
    return;
  }
  let finals=[];
  try {
    const response=await fetch('data/grand_finals.json');
    if(!response.ok)throw Error('Grand Final summary could not load');
    finals=await response.json();
  } catch(error){console.error(error);}
  let playing=false,timer=null,closed=false;
  const stop=()=>{
    playing=false;clearTimeout(timer);timer=null;
    play.textContent='Play';play.setAttribute('aria-pressed','false');
  };
  function updatePeriod(){
    const period=symbols.signal('usePeriod');
    const first=symbols.signal('periodStart');
    const last=symbols.signal('periodEnd');
    singleMode.checked=!period;periodMode.checked=period;
    singleControls.hidden=period;periodControls.hidden=!period;
    sizeLegendTitle.textContent=period?'Average finalists per season':'Finalists';
    cityFrame.setAttribute('data-time-mode',period?'period':'single');
    periodControls.textContent=first===last?`${first} · 1 season`:`${first}–${last} · ${last-first+1} seasons`;
  }
  function updateSeason(){
    const year=controller.signal('selectedSeason');
    const final=finals.find(row=>row.season===year);
    flowYear.textContent=`${year}:`;
    flowResult.textContent=final?`${final.winner} defeated ${final.runner_up}.`:
      'Grand Final opponents';
    flowContext.textContent=final && final.winner_city===final.runner_city?
      'The loop marks opponents based in the same city; it does not represent travel.':
      'The line connects club home cities; it does not represent travel.';
    updatePeriod();
  }
  // Each map has its own Studio-style inputs, so they remain within reach when
  // scrolling. Share changes in both directions, skipping equal values to avoid
  // feedback loops (including array-valued projection centres).
  function attachSharedInputs(source,view){
    for(const signal of sharedSignals){
      view.addSignalListener(signal,(_name,value)=>{
        for(const name of names){
          if(name===source)continue;
          const view=chartViews.get(name)?.view;
          if(!view)continue;
          if(JSON.stringify(view.signal(signal))!==JSON.stringify(value)){
            view.signal(signal,value);
            Promise.resolve().then(()=>view.runAsync()).catch(console.error);
          }
        }
        if(signal==='selectedSeason'){
          updateSeason();
        }
      });
    }
  }
  function attachBrush(){
    symbols.addSignalListener('mapTimeBrush',()=>{
      if(symbols.signal('usePeriod'))stop();
      // Read the rounded endpoints after the selection's dataflow settles.
      Promise.resolve().then(updatePeriod).catch(console.error);
    });
    symbols.addSignalListener('usePeriod',updatePeriod);
  }
  async function changeMode(period){
    stop();
    if(renderCity)await renderCity({cityMode:period});
    else await symbols.signal('usePeriod',period).runAsync();
    updatePeriod();
  }
  singleMode.addEventListener('change',()=>changeMode(false).catch(console.error));
  periodMode.addEventListener('change',()=>changeMode(true).catch(console.error));
  names.forEach(name=>attachSharedInputs(name,chartViews.get(name).view));
  attachBrush();
  singleMode.disabled=false;periodMode.disabled=false;
  async function tick(){
    if(!playing || closed)return;
    const current=controller.signal('selectedSeason');
    if(current>=2025){stop();return;}
    try{
      await controller.signal('selectedSeason',current+1).runAsync();
      if(playing && !closed)timer=setTimeout(tick,1100);
    } catch(error){stop();console.error(error);}
  }
  play.addEventListener('click',async()=>{
    if(playing){stop();return;}
    playing=true;play.textContent='Pause';play.setAttribute('aria-pressed','true');
    if(controller.signal('selectedSeason')>=2025)await controller.signal('selectedSeason',2012).runAsync();
    timer=setTimeout(tick,1100);
  });
  reset.addEventListener('click',async()=>{
    stop();
    await controller.signal('selectedSeason',2025).signal('mapZoom',1).signal('mapCentre',[0,-28])
      .signal('showPhysical',true).signal('showCultural',true).runAsync();
    await symbols.signal('mapZoom',1).signal('mapPan',[0,0]).runAsync();
    // Re-embed the city chart so the brush rectangle and its data both reset.
    if(renderCity)await renderCity({resetMapPeriod:true});
    else await symbols.change('mapTimeBrush_store',vega.changeset().remove(()=>true)).signal('usePeriod',false).runAsync();
    updateSeason();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',()=>{closed=true;stop();},{once:true});
  updateSeason();
  return {pause:stop,replaceCityView(view){
    symbols=view;attachSharedInputs('premiership_symbols',view);attachBrush();
    // A reader may change another map while this one is being re-embedded.
    for(const name of sharedSignals)view.signal(name,controller.signal(name));
    Promise.resolve().then(()=>view.runAsync()).then(updateSeason).catch(console.error);
  }};
}

// Re-embedding on resize avoids Vega-Lite 5.20's empty-interval resize error.
// Restore through public JSON parameter values, preserving the selected period.
function captureCityMapState(view){
  return Object.fromEntries(['selectedSeason','mapZoom','mapCentre','mapPan','showPhysical','showCultural','usePeriod','mapTimeBrush']
    .map(name=>[name,view.signal(name)]));
}
function restoreCityMapState(spec,state,resetPeriod=false){
  for(const param of spec.params)if(Object.hasOwn(state,param.name))param.value=state[param.name];
  if(resetPeriod)spec.params.find(param=>param.name==='usePeriod').value=false;
  const brush=spec.vconcat[1].params.find(param=>param.name==='mapTimeBrush');
  if(!resetPeriod && state.mapTimeBrush.season)brush.value={season:state.mapTimeBrush.season};
  else delete brush.value;
}

// Keep the linked timeline only in Compare period mode. A plain parameter
// preserves its selection while Single season shows just the map and slider.
function configureCityMapMode(spec){
  if(spec.params.find(param=>param.name==='usePeriod').value)return;
  const brush=spec.vconcat[1].params.find(param=>param.name==='mapTimeBrush');
  spec.params.push({name:'mapTimeBrush',value:brush.value || {}});
  // Vega-Lite calls the shared panel height childHeight for a one-panel concat.
  spec.params.push({name:'city_map_height',expr:'childHeight'});
  spec.vconcat=spec.vconcat.slice(0,1);
}
if(typeof module!=='undefined')module.exports={captureCityMapState,restoreCityMapState,configureCityMapMode};
