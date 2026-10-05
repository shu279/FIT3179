// Exercise actual Vega dataflows and the plain-JavaScript shared map controls.
module.exports=async function({vega,vl,loader,root,read,rows,stateSeasons,cities,items}){
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
 const layout=require('../js/chart-layout.js');
 const {captureCityMapState,restoreCityMapState}=require('../js/map-controls.js');
 const errors=[];
 const logger={level(){return this;},warn(){},info(){},debug(){},error(...args){errors.push(args.map(String).join(' '));}};
 const palette=read('data/map_sources.json').colour;
 const topology=read('data/natural_earth_states.topojson');
 assert.deepEqual(topology.objects.states.geometries.map(d=>d.properties.state_code).sort(),['1','2','3','4','5','6','7','8']);
 assert.deepEqual(Object.keys(read('data/natural_earth_physical.topojson').objects).sort(),['graticules','land','ocean']);
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
     for(const item of shapes){
      const rate=item.datum.finals_rate;
      assert.equal(item.fill,rate===null?'#dedfd5':palette.colours[Math.min(4,Math.floor(rate/20))]);
     }
    }
    const scale=view.scale('color');
    for(const rate of [0,19.999,20,39.999,40,59.999,60,79.999,80,100])assert.equal(scale(rate),palette.colours[Math.min(4,Math.floor(rate/20))]);
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
     assert.ok(Math.max(...table.map(i=>i.y))-Math.min(...table.map(i=>i.y))>40,'Projected cities must not collapse onto one point');
     checkChampion(year);
    }
    const brush=range=>view.change('mapTimeBrush_store',vega.changeset().remove(()=>true).insert(range?[{unit:'map_overview',fields:[{field:'season',channel:'x',type:'R'}],values:[range]}]:[])).runAsync();
    for(const range of [[2012,2015],[2020,2020],[2019,2025]]){
     await view.signal('usePeriod',true).runAsync();await brush(range);
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
     }
    }
    await brush([2014.2,2014.8]);assert.equal(circles().length,0);assert.equal(annotations().length,0);assert.equal(championMarkers().length,0);
    await brush(null);await view.signal('usePeriod',false).runAsync();checkChampion(2025);
   }
   if(name==='grand_final_flows'){
    for(let year=2012;year<=2025;year++){
     await view.signal('selectedSeason',year).runAsync();
     const lines=items(view,i=>i.mark?.marktype==='shape'&&i.datum?.properties?.winner);
     assert.equal(lines.length,year===2021?0:1);
     const participants=items(view,i=>i.mark?.marktype==='symbol'&&i.datum?.result);
     assert.equal(participants.length,2);
     assert.equal(participants.filter(i=>i.datum.result==='Premier').length,1);
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
 for(const id of ['#map-season-summary','#map-period-summary','#map-final-summary','#play-map','#reset-map'])elements.set(id,{
  textContent:'',attributes:{},listeners:{},setAttribute(name,value){this.attributes[name]=value;},addEventListener(name,fn){this.listeners[name]=fn;}
 });
 let pending=null;
 const context={console,vega,fetch:async()=>({ok:true,json:async()=>read('data/grand_finals.json')}),
  setTimeout:fn=>{pending=fn;return 1;},clearTimeout:()=>{pending=null;},
  document:{querySelector:id=>elements.get(id),addEventListener(){}},window:{addEventListener(){}}};
 const initialise=vm.runInNewContext(fs.readFileSync(path.join(root,'js/map-controls.js'),'utf8')+'\n;initialiseMapControls',context);
 await initialise(chartViews);
 const settle=()=>Promise.all([...chartViews.values()].map(entry=>entry.view.runAsync()));
 const controller=chartViews.get('state_choropleth').view;
 await controller.signal('selectedSeason',2018).signal('showPhysical',false).runAsync();await settle();
 for(const {view} of chartViews.values()){assert.equal(view.signal('selectedSeason'),2018);assert.equal(view.signal('showPhysical'),false);}
 // Controls beside the lower maps also update the other maps and their inputs.
 await chartViews.get('grand_final_flows').view.signal('selectedSeason',2021).signal('mapCentre',[13,-33]).runAsync();await settle();
 for(const {view} of chartViews.values()){assert.equal(view.signal('selectedSeason'),2021);assert.deepEqual(view.signal('mapCentre'),[13,-33]);}
 await elements.get('#reset-map').listeners.click();await settle();
 for(const {view} of chartViews.values()){assert.equal(view.signal('selectedSeason'),2025);assert.equal(view.signal('showPhysical'),true);}
 const play=elements.get('#play-map');await play.listeners.click();await settle();
 assert.equal(controller.signal('selectedSeason'),2012);assert.equal(play.attributes['aria-pressed'],'true');
 await pending();await settle();assert.equal(controller.signal('selectedSeason'),2013);
 await play.listeners.click();assert.equal(play.attributes['aria-pressed'],'false');assert.equal(pending,null);
 assert.match(elements.get('#map-final-summary').textContent,/Hawthorn/);
 const symbols=chartViews.get('premiership_symbols').view;
 await symbols.change('mapTimeBrush_store',vega.changeset().insert([{unit:'map_overview',fields:[{field:'season',channel:'x',type:'R'}],values:[[2017,2020]]}])).runAsync();await settle();
 assert.equal(symbols.signal('usePeriod'),true);assert.match(elements.get('#map-period-summary').textContent,/2017–2020/);
 const restoredSpec=read('js/premiership_symbols.json');layout(restoredSpec,1000);restoreCityMapState(restoredSpec,captureCityMapState(symbols));
 const restored=new vega.View(vega.parse(vl.compile(restoredSpec).spec),{renderer:'none',loader,logger});await restored.runAsync();
 assert.deepEqual(restored.signal('mapTimeBrush').season,[2017,2020]);assert.equal(restored.signal('usePeriod'),true);restored.finalize();
 restoreCityMapState(restoredSpec,captureCityMapState(symbols),true);
 assert.equal(restoredSpec.vconcat[1].params[0].value,undefined);assert.equal(restoredSpec.params.find(p=>p.name==='usePeriod').value,false);
 await controller.signal('selectedSeason',2024).runAsync();await settle();
 assert.equal(symbols.signal('usePeriod'),false);assert.match(elements.get('#map-period-summary').textContent,/2024/);
 await elements.get('#reset-map').listeners.click();await settle();
 for(const {view} of chartViews.values())view.finalize();
 assert.deepEqual(errors,[],'No Vega runtime errors');
 console.log('Map checks passed: 14 seasons, fixed class boundaries, no-club regions, layers, zoom, time-brush aggregates, shared controls, play/pause and reset.');
};
