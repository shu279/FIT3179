/* Vega-Lite creates the Studio-style inputs from params.bind in the JSON.
 * Plain JavaScript shares their signals between the three embedded maps and
 * supplies an opt-in play/pause button. Brushing itself is defined in JSON. */
async function initialiseMapControls(chartViews, resetCityBrush) {
  const names=['state_choropleth','premiership_symbols','grand_final_flows'];
  const controller=chartViews.get(names[0])?.view;
  let symbols=chartViews.get(names[1])?.view;
  const status=document.querySelector('#map-season-summary');
  const periodStatus=document.querySelector('#map-period-summary');
  const flowStatus=document.querySelector('#map-final-summary');
  const play=document.querySelector('#play-map');
  const reset=document.querySelector('#reset-map');
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
    play.textContent='Play years';play.setAttribute('aria-pressed','false');
  };
  function updatePeriod(){
    const period=symbols.signal('usePeriod');
    const range=symbols.signal('mapTimeBrush').season || [2012,2025];
    const first=Math.max(2012,Math.ceil(range[0]));
    const last=Math.min(2025,Math.floor(range[1]));
    periodStatus.textContent=!period?`City map: ${controller.signal('selectedSeason')}. Drag below the map to compare a period.`:
      first>last?'The brush falls between seasons. Widen it to include a completed season.':
      `City map: ${first}–${last}. Circle area shows the average number of finalists per season; colour shows the share of club-seasons reaching finals.`;
  }
  function updateSeason(){
    const year=controller.signal('selectedSeason');
    const final=finals.find(row=>row.season===year);
    status.textContent=`Season ${year} · the year and map controls apply to all three maps. Play years advances from 2012 to 2025.`;
    flowStatus.textContent=final?`${year}: ${final.winner} (${final.winner_city}) defeated ${final.runner_up} (${final.runner_city}).`+
      (final.winner_city===final.runner_city?' Both clubs were based in the same city, so there is no connecting line.':' The line connects club home cities; it does not represent travel.'):
      `${year} Grand Final: hover over the markers for the clubs and results.`;
    updatePeriod();
  }
  // Each map has its own Studio-style inputs, so they remain within reach when
  // scrolling. Share changes in both directions, skipping equal values to avoid
  // feedback loops (including array-valued projection centres).
  function attachSharedInputs(source,view){
    for(const signal of ['selectedSeason','mapZoom','mapCentre','showPhysical','showCultural']){
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
          if(symbols.signal('usePeriod')){
            symbols.signal('usePeriod',false);
            Promise.resolve().then(()=>symbols.runAsync()).catch(console.error);
          }
          updateSeason();
        }
      });
    }
  }
  function attachBrush(){
    symbols.addSignalListener('mapTimeBrush',(_name,selection)=>{
      stop();
      // The full map and its long table are filtered by this selection in JSON.
      // Queue after this signal's dataflow finishes; running it from its own
      // listener can re-enter Vega before its pending-run promise is assigned.
      Promise.resolve().then(()=>symbols.signal('usePeriod',Boolean(selection.season)).runAsync()).then(updatePeriod).catch(console.error);
    });
    symbols.addSignalListener('usePeriod',updatePeriod);
  }
  names.forEach(name=>attachSharedInputs(name,chartViews.get(name).view));
  attachBrush();
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
    playing=true;play.textContent='Pause years';play.setAttribute('aria-pressed','true');
    await symbols.signal('usePeriod',false).runAsync();
    if(controller.signal('selectedSeason')>=2025)await controller.signal('selectedSeason',2012).runAsync();
    timer=setTimeout(tick,1100);
  });
  reset.addEventListener('click',async()=>{
    stop();
    await controller.signal('selectedSeason',2025).signal('mapZoom',1).signal('mapCentre',[0,-28])
      .signal('showPhysical',true).signal('showCultural',true).runAsync();
    // Re-embed the city chart so the brush rectangle and its data both reset.
    if(resetCityBrush)await resetCityBrush();
    else await symbols.change('mapTimeBrush_store',vega.changeset().remove(()=>true)).signal('usePeriod',false).runAsync();
    updateSeason();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',()=>{closed=true;stop();},{once:true});
  updateSeason();
  return {pause:stop,replaceCityView(view){
    symbols=view;attachSharedInputs('premiership_symbols',view);attachBrush();
    // A reader may change another map while this one is being re-embedded.
    for(const name of ['selectedSeason','mapZoom','mapCentre','showPhysical','showCultural'])view.signal(name,controller.signal(name));
    Promise.resolve().then(()=>view.runAsync()).then(updateSeason).catch(console.error);
  }};
}

// Re-embedding on resize avoids Vega-Lite 5.20's empty-interval resize error.
// Restore through public JSON parameter values, preserving the selected period.
function captureCityMapState(view){
  return Object.fromEntries(['selectedSeason','mapZoom','mapCentre','showPhysical','showCultural','usePeriod','mapTimeBrush']
    .map(name=>[name,view.signal(name)]));
}
function restoreCityMapState(spec,state,resetPeriod=false){
  for(const param of spec.params)if(Object.hasOwn(state,param.name))param.value=state[param.name];
  if(resetPeriod)spec.params.find(param=>param.name==='usePeriod').value=false;
  const brush=spec.vconcat[1].params.find(param=>param.name==='mapTimeBrush');
  if(!resetPeriod && state.mapTimeBrush.season)brush.value={season:state.mapTimeBrush.season};
  else delete brush.value;
}
if(typeof module!=='undefined')module.exports={captureCityMapState,restoreCityMapState};
