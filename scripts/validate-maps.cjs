// Exercise actual Vega dataflows and the plain-JavaScript shared map controls.
module.exports=async function({vega,vl,loader,root,read,rows,stateSeasons,cities,items}){
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
 const layout=require('../js/chart-layout.js');
 const {captureCityMapState,restoreCityMapState,configureCityMapMode}=require('../js/map-controls.js');
 const errors=[];
 const logger={level(){return this;},warn(){},info(){},debug(){},error(...args){errors.push(args.map(String).join(' '));}};
 const palette=read('data/map_sources.json').colour;
 const colourIndex=rate=>palette.thresholds.filter(threshold=>rate>=threshold).length;
 const stateClassCounts=Array(palette.classes).fill(0);
 for(const state of stateSeasons.filter(d=>d.clubs>0))stateClassCounts[colourIndex(state.finals_rate)]++;
 assert.deepEqual(stateClassCounts,[14,2,6,38,10],'Every class is used and 40% is separated from 50%');
 const topology=read('data/natural_earth_states.topojson');
 assert.deepEqual(topology.objects.states.geometries.map(d=>d.properties.state_code).sort(),['1','2','3','4','5','6','7','8']);
 assert.deepEqual(Object.keys(read('data/natural_earth_physical.topojson').objects).sort(),['graticules','ocean']);
 // Exterior state arcs must be exactly the land outline, including islands.
 // Shared arcs ensure identical coordinates even after quantization and zooming.
 const stateArcUse=new Map();
 for(const state of topology.objects.states.geometries)for(const arc of state.arcs.flat(Infinity)){
  const id=arc<0?~arc:arc;stateArcUse.set(id,(stateArcUse.get(id)||0)+1);
 }
 const coast=[...stateArcUse].filter(([,count])=>count===1).map(([id])=>id).sort((a,b)=>a-b);
 const landArcs=topology.objects.land.geometries.flatMap(land=>land.arcs.flat(Infinity)).map(arc=>arc<0?~arc:arc).sort((a,b)=>a-b);
 assert.deepEqual(landArcs,coast,'Land fill and coastal state borders must use identical arcs');
 const cityRows=read('data/city_seasons.json');
 assert.equal(cityRows.length,98);
 for(const d of cityRows){
  const expected=rows.filter(r=>r.season===d.season&&r.city===d.city);
  assert.equal(d.finals,expected.filter(r=>r.finalist).length);
  assert.equal(d.clubs,expected.length);
 }
 const chartViews=new Map();
 for(const width of [1000,320]){
  for(const name of ['state_choropleth','premiership_symbols','grand_final_flows']){
   const spec=read('js/'+name+'.json');layout(spec,width);if(!spec.vconcat)spec.width=width;
   const view=new vega.View(vega.parse(vl.compile(spec).spec),{renderer:'none',loader,logger});await view.runAsync();
   const svg=await view.toSVG();
   fs.writeFileSync(`/private/tmp/ass2-chart-renders/${name}-${width}.svg`,svg);
   const svgWidth=Number(svg.match(/<svg[^>]* width="([\d.]+)"/)[1]);
   assert.ok(svgWidth<=width+5,`${name}: SVG width ${svgWidth} exceeds available ${width}`);
   const physical=()=>items(view,i=>i.mark?.marktype==='shape'&&['#e4eff0','#e5e6da'].includes(i.fill));
   assert.ok(physical().length>0,`${name}: physical layers rendered`);
   await view.signal('showPhysical',false).runAsync();assert.equal(physical().length,0);
   await view.signal('showPhysical',true).runAsync();assert.ok(physical().length>0);
   const borders=()=>items(view,i=>i.mark?.marktype==='shape'&&i.stroke==='#748679');
   assert.equal(borders().length,8);
   await view.signal('showCultural',false).runAsync();assert.equal(borders().length,0);
   await view.signal('showCultural',true).runAsync();assert.equal(borders().length,8);
   if(name==='state_choropleth'){
    for(let year=2012;year<=2025;year++){
     await view.signal('selectedSeason',year).runAsync();
     const shapes=items(view,i=>i.mark?.marktype==='shape'&&i.datum?.state_code);
     assert.equal(shapes.length,8);
     const labels=items(view,i=>i.mark?.name==='state_count_labels_marks');
     assert.equal(labels.length,5,'Show counts only for states with clubs, never 0/0');
     for(const label of labels){
      const expected=stateSeasons.find(d=>d.state_code===label.datum.state_code&&d.season===year);
      assert.equal(label.text,`${expected.finals}/${expected.clubs}`);
      assert.equal(label.fill,expected.finals_rate<palette.light_labels_from?'#000000':'#ffffff');
     }
     assert.equal(labels.reduce((total,label)=>total+label.datum.finals,0),8);
     assert.equal(labels.reduce((total,label)=>total+label.datum.clubs,0),18);
     for(const item of shapes){
      const rate=item.datum.finals_rate;
      assert.equal(item.fill,rate===null?'#dedfd5':palette.colours[colourIndex(rate)]);
     }
    }
    const scale=view.scale('color');
    for(const [rate,expectedClass] of [[0,0],[29.999,0],[30,1],[39.999,1],[40,2],[49.999,2],[50,3],[99.999,3],[100,4]])assert.equal(scale(rate),palette.colours[expectedClass]);
   }
   if(name==='premiership_symbols'){
    const circles=()=>items(view,i=>i.mark?.marktype==='symbol'&&Number.isFinite(i.datum?.finals_per_season));
    const annotations=()=>items(view,i=>i.mark?.name==='champion_annotation_marks');
    const championMarkers=()=>items(view,i=>i.mark?.marktype==='symbol'&&i.shape==='diamond'&&i.datum?.premierships===1);
    const checkChampion=year=>{
     const expected=rows.find(r=>r.season===year&&r.premier);
     const labels=annotations();assert.equal(labels.length,1);
     assert.deepEqual(labels[0].text,[`${year} champions`,expected.team]);
     assert.equal(labels[0].datum.city,expected.city);
     const markers=championMarkers();assert.equal(markers.length,1);
     assert.equal(markers[0].datum.season,year);assert.equal(markers[0].datum.premier,expected.team);
    };
    // Includes either a filled positive symbol or the small empty zero ring.
    for(let year=2012;year<=2025;year++){
     await view.signal('selectedSeason',year).runAsync();
     const table=circles().filter(i=>i.datum.finals>0 || i.size===35);
     assert.equal(table.length,7);
     assert.equal(table.reduce((n,i)=>n+i.datum.finals,0),8);
     for(const item of table.filter(i=>i.datum.finals>0))assert.equal(item.fill,palette.colours[colourIndex(item.datum.finals_rate)]);
     assert.ok(Math.max(...table.map(i=>i.y))-Math.min(...table.map(i=>i.y))>40,'Projected cities must not collapse onto one point');
     checkChampion(year);
    }
    const brush=range=>view.change('mapTimeBrush_store',vega.changeset().remove(()=>true).insert(range?[{unit:'map_overview',fields:[{field:'season',channel:'x',type:'R'}],values:[range]}]:[])).runAsync();
    const ranges=[[2012,2015],[2020,2020],[2019,2025],[2011.8,2012.2],[2024.8,2025.2]];
    for(let year=2012;year<2025;year++)ranges.push([year+0.2,year+0.4],[year+0.6,year+0.8],[year+0.2,year+0.8]);
    for(const rawRange of ranges){
     const range=rawRange.map(year=>Math.max(2012,Math.min(2025,Math.round(year))));
     await view.signal('usePeriod',true).runAsync();await brush(rawRange);
     assert.equal(view.signal('periodStart'),range[0]);assert.equal(view.signal('periodEnd'),range[1]);
     if(range[0]===range[1])checkChampion(range[0]);
     else{assert.equal(annotations().length,0);assert.equal(championMarkers().length,0);}
     const table=circles().filter(i=>i.datum.finals>0 || i.size===35);
     assert.equal(table.length,7);
     for(const item of table){
      const expected=rows.filter(r=>r.city===item.datum.city&&r.season>=range[0]&&r.season<=range[1]);
      const finalists=expected.filter(r=>r.finalist).length;
      assert.equal(item.datum.finals,finalists);
      assert.equal(item.datum.finals_per_season,finalists/(range[1]-range[0]+1));
      assert.equal(item.datum.finals_rate,finalists/expected.length*100);
      if(finalists>0)assert.equal(item.fill,palette.colours[colourIndex(item.datum.finals_rate)]);
     }
    }
    await brush(null);
    assert.equal(view.signal('periodStart'),2012);assert.equal(view.signal('periodEnd'),2025);
    assert.equal(circles().filter(i=>i.datum.finals>0 || i.size===35).length,7,'Clearing the brush includes all seasons');
    await brush(null);await view.signal('usePeriod',false).runAsync();checkChampion(2025);
   }
   if(name==='grand_final_flows'){
    for(let year=2012;year<=2025;year++){
     await view.signal('selectedSeason',year).runAsync();
     const lines=items(view,i=>i.mark?.marktype==='shape'&&i.datum?.properties?.winner);
     assert.equal(lines.length,year===2021?0:1);
     const loops=items(view,i=>i.mark?.name==='same_city_loop_marks');
     const annotations=items(view,i=>i.mark?.name==='same_city_annotation_marks');
     assert.equal(lines.length+loops.length,1,'Every season must display a matchup connection');
     assert.equal(annotations.length,year===2021?1:0);
     const participants=items(view,i=>i.mark?.marktype==='symbol'&&i.datum?.result);
     assert.equal(participants.length,2);
     assert.equal(participants.filter(i=>i.datum.result==='Premier').length,1);
     if(year===2021){
      assert.deepEqual(annotations[0].text,['Same-city final: Melbourne','Melbourne (Premier)','Western Bulldogs (Runner-up)']);
      for(const participant of participants){assert.equal(loops[0].x,participant.x);assert.equal(loops[0].y,participant.y);}
     }
    }
   }
   const before=await view.toSVG();
   await view.signal('mapZoom',4).signal('mapCentre',[11,-38]).runAsync();
   const zoomed=await view.toSVG();assert.ok(zoomed!==before,`${name} at ${width}px: zoom must change projected geometry`);assert.ok(!/\bNaN\b|\bInfinity\b/.test(zoomed));
   await view.signal('mapZoom',1).signal('mapCentre',[0,-28]).runAsync();
   // Match the page's ResizeObserver updates without re-embedding the chart.
   if(width===1000){
    const sizing=layout(spec,320);
    let resizedView=view;
    if(sizing.type==='concat'){
     restoreCityMapState(spec,captureCityMapState(view));
     resizedView=new vega.View(vega.parse(vl.compile(spec).spec),{renderer:'none',loader,logger});await resizedView.runAsync();
    }else await view.width(sizing.plotWidth).height(sizing.mapHeight).resize().runAsync();
    const resized=await resizedView.toSVG();
    assert.ok(Number(resized.match(/<svg[^>]* width="([\d.]+)"/)[1])<=325,`${name}: responsive resize overflow`);
    assert.ok(!/\bNaN\b|\bInfinity\b/.test(resized));
    assert.equal(resizedView.signal('selectedSeason'),2025);
    if(resizedView!==view)resizedView.finalize();
   }
   if(width===320)chartViews.set(name,{view});else view.finalize();
  }
 }
 const elements=new Map();
 for(const id of ['#map-season-summary','#map-period-summary','#map-final-summary','#map-final-context','#play-map','#reset-map',
  '#city-mode-single','#city-mode-period','#city-single-controls','#city-period-controls','#city-period-from','#city-period-to'])elements.set(id,{
  textContent:'',attributes:{},listeners:{},setAttribute(name,value){this.attributes[name]=value;},addEventListener(name,fn){this.listeners[name]=fn;},checkValidity(){return true;}
 });
 let pending=null;
 const context={console,vega,fetch:async()=>({ok:true,json:async()=>read('data/grand_finals.json')}),
  setTimeout:fn=>{pending=fn;return 1;},clearTimeout:()=>{pending=null;},
  document:{querySelector:id=>elements.get(id),addEventListener(){}},window:{addEventListener(){}}};
 const initialise=vm.runInNewContext(fs.readFileSync(path.join(root,'js/map-controls.js'),'utf8')+'\n;initialiseMapControls',context);
 const controls=await initialise(chartViews);
 assert.equal(elements.get('#city-mode-single').checked,true);
 assert.equal(elements.get('#city-period-controls').hidden,true);
 const settle=()=>Promise.all([...chartViews.values()].map(entry=>entry.view.runAsync()));
 const symbols=chartViews.get('premiership_symbols').view;
 // Exercise the actual navigation handlers with screen coordinates at 1:1 scale.
 class NavigationElement extends EventTarget {
  constructor(){super();this.dataset={};this.capture=null;}
  setAttribute(){}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
  getScreenCTM(){return {inverse(){return {};}};}
 }
 const map=new NavigationElement(),resetView=new NavigationElement();
 map.ownerSVGElement={createSVGPoint:()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}})};
 const navigationInit=vm.runInNewContext(fs.readFileSync(path.join(root,'js/city-map-navigation.js'),'utf8')+'\n;initialiseCityMapNavigation',{
  console,AbortController,document:{querySelector:()=>resetView}
 });
 const navigation=navigationInit(symbols,{querySelector:()=>map});
 const symbolPositions=()=>items(symbols,i=>i.mark?.name==='city_symbols_marks').map(i=>({city:i.datum.city,x:i.x,y:i.y,size:i.size}));
 const original=symbolPositions();
 const separation=positions=>{
  const a=positions.find(d=>d.city==='Melbourne'),b=positions.find(d=>d.city==='Geelong');
  return Math.hypot(a.x-b.x,a.y-b.y);
 };
 await symbols.signal('mapZoom',4).runAsync();await settle();
 assert.ok(Math.abs(separation(symbolPositions())/separation(original)-4)<1e-8);
 assert.deepEqual(symbolPositions().map(d=>d.size),original.map(d=>d.size),'Zoom must preserve the circle-size legend');
 for(const name of ['state_choropleth','grand_final_flows'])assert.equal(chartViews.get(name).view.signal('mapZoom'),1);
 const pointer=(type,x,y)=>map.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{button:0,pointerId:1,isPrimary:true,clientX:x,clientY:y}));
 const beforeDrag=symbolPositions();
 pointer('pointerdown',100,100);pointer('pointermove',140,120);await settle();pointer('pointerup',140,120);
 for(const item of symbolPositions()){
  const before=beforeDrag.find(d=>d.city===item.city);
  assert.ok(Math.abs(item.x-before.x-40)<1e-8);assert.ok(Math.abs(item.y-before.y-20)<1e-8);
 }
 assert.equal(map.capture,null);
 const beforeCancel=Array.from(symbols.signal('mapPan'));
 pointer('pointerdown',100,100);pointer('pointercancel',100,100);pointer('pointermove',180,180);await settle();
 assert.deepEqual(Array.from(symbols.signal('mapPan')),beforeCancel);
 const panBeforeKey=Array.from(symbols.signal('mapPan'));
 map.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key:'ArrowLeft'}));await settle();
 assert.ok(Math.abs(symbols.signal('mapPan')[0]-(panBeforeKey[0]-0.08))<1e-8);
 resetView.dispatchEvent(new Event('click'));await settle();
 assert.equal(symbols.signal('mapZoom'),1);assert.deepEqual(Array.from(symbols.signal('mapPan')),[0,0]);
 assert.equal(symbols.signal('selectedSeason'),2025);
 await symbols.signal('mapZoom',4).runAsync();await settle();
 const controller=chartViews.get('state_choropleth').view;
 await controller.signal('selectedSeason',2018).signal('showPhysical',false).runAsync();await settle();
 for(const {view} of chartViews.values()){assert.equal(view.signal('selectedSeason'),2018);assert.equal(view.signal('showPhysical'),false);}
 assert.equal(symbols.signal('mapZoom'),4,'Changing season must preserve city zoom');
 // Controls beside the lower maps also update the other maps and their inputs.
 await chartViews.get('grand_final_flows').view.signal('selectedSeason',2021).signal('mapCentre',[13,-33]).runAsync();await settle();
 for(const {view} of chartViews.values()){assert.equal(view.signal('selectedSeason'),2021);assert.deepEqual(view.signal('mapCentre'),[13,-33]);}
 assert.match(elements.get('#map-final-context').textContent,/same city/);
 assert.match(elements.get('#map-final-context').textContent,/loop/);
 await elements.get('#reset-map').listeners.click();await settle();
 for(const {view} of chartViews.values()){assert.equal(view.signal('selectedSeason'),2025);assert.equal(view.signal('showPhysical'),true);}
 assert.equal(symbols.signal('mapZoom'),1);assert.deepEqual(Array.from(symbols.signal('mapPan')),[0,0]);
 const play=elements.get('#play-map');await play.listeners.click();await settle();
 assert.equal(controller.signal('selectedSeason'),2012);assert.equal(play.attributes['aria-pressed'],'true');
 await pending();await settle();assert.equal(controller.signal('selectedSeason'),2013);
 await play.listeners.click();assert.equal(play.attributes['aria-pressed'],'false');assert.equal(pending,null);
 assert.equal(elements.get('#map-final-summary').textContent,'2013: Hawthorn (Melbourne) defeated Fremantle (Perth).');
 assert.match(elements.get('#map-final-context').textContent,/does not represent travel/);
 await symbols.signal('mapZoom',4).runAsync();await settle();
 await symbols.signal('mapPan',[0.2,-0.15]).runAsync();
 await elements.get('#city-mode-period').listeners.change();await settle();
 assert.equal(elements.get('#city-single-controls').hidden,true);
 assert.equal(elements.get('#city-period-controls').hidden,false);
 await symbols.change('mapTimeBrush_store',vega.changeset().insert([{unit:'map_overview',fields:[{field:'season',channel:'x',type:'R'}],values:[[2017,2020]]}])).runAsync();await settle();
 assert.equal(symbols.signal('usePeriod'),true);assert.match(elements.get('#map-period-summary').textContent,/2017–2020/);
 const restoredSpec=read('js/premiership_symbols.json');layout(restoredSpec,1000);restoreCityMapState(restoredSpec,captureCityMapState(symbols));
 const restored=new vega.View(vega.parse(vl.compile(restoredSpec).spec),{renderer:'none',loader,logger});await restored.runAsync();
 assert.deepEqual(restored.signal('mapTimeBrush').season,[2017,2020]);assert.equal(restored.signal('usePeriod'),true);
 assert.equal(restored.signal('mapZoom'),4);assert.deepEqual(Array.from(restored.signal('mapPan')),[0.2,-0.15]);
 controls.replaceCityView(restored);await restored.runAsync();await Promise.resolve();
 assert.equal(restored.signal('mapZoom'),4,'Re-embedding must not overwrite local zoom with another map');
 assert.deepEqual(Array.from(restored.signal('mapPan')),[0.2,-0.15]);
 controls.replaceCityView(symbols);await settle();restored.finalize();
 restoreCityMapState(restoredSpec,captureCityMapState(symbols),true);
 assert.equal(restoredSpec.vconcat[1].params[0].value,undefined);assert.equal(restoredSpec.params.find(p=>p.name==='usePeriod').value,false);
 await controller.signal('selectedSeason',2024).runAsync();await settle();
 assert.equal(symbols.signal('usePeriod'),true);assert.match(elements.get('#map-period-summary').textContent,/2017–2020/);
 await play.listeners.click();await settle();
 assert.equal(symbols.signal('usePeriod'),true,'Play must not override the explicit Compare period mode');
 await play.listeners.click();await settle();
 await elements.get('#city-mode-single').listeners.change();await settle();
 assert.equal(symbols.signal('usePeriod'),false);assert.match(elements.get('#map-period-summary').textContent,/2024/);
 const singleSpec=read('js/premiership_symbols.json');
 restoreCityMapState(singleSpec,captureCityMapState(symbols));configureCityMapMode(singleSpec);layout(singleSpec,320);
 assert.equal(singleSpec.vconcat.length,1,'Single season has no timeline');
 const singleView=new vega.View(vega.parse(vl.compile(singleSpec).spec),{renderer:'none',loader,logger});await singleView.runAsync();
 assert.deepEqual(singleView.signal('mapTimeBrush').season,[2017,2020]);
 assert.equal(items(singleView,i=>i.mark?.name==='city_symbols_marks').length,7);
 const comparisonSpec=read('js/premiership_symbols.json');
 const previousState=captureCityMapState(singleView);previousState.usePeriod=true;
 restoreCityMapState(comparisonSpec,previousState);configureCityMapMode(comparisonSpec);layout(comparisonSpec,320);
 assert.equal(comparisonSpec.vconcat.length,2,'Compare period includes the timeline');
 const comparisonView=new vega.View(vega.parse(vl.compile(comparisonSpec).spec),{renderer:'none',loader,logger});await comparisonView.runAsync();
 assert.deepEqual(comparisonView.signal('mapTimeBrush').season,[2017,2020]);
 assert.equal(comparisonView.signal('periodStart'),2017);assert.equal(comparisonView.signal('periodEnd'),2020);
 singleView.finalize();comparisonView.finalize();
 await elements.get('#city-mode-period').listeners.change();await settle();
 elements.get('#city-period-from').value='2022';await elements.get('#city-period-from').listeners.change();await settle();
 assert.equal(symbols.signal('periodStart'),2022);assert.equal(symbols.signal('periodEnd'),2022,'Crossed endpoints select a single season');
 await elements.get('#reset-map').listeners.click();await settle();
 navigation.destroy();
 for(const {view} of chartViews.values())view.finalize();
 assert.deepEqual(errors,[],'No Vega runtime errors');
 console.log('Map checks passed: 14 seasons, fixed class boundaries, no-club regions, layers, zoom, whole-year brushes, independent period mode, mode restoration, shared controls, play/pause and reset.');
};
