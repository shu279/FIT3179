// No package installation needed: validate with the same vendored Vega runtime as the page.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vega=require('../vendor/vega.min.js');
const vm=require('node:vm');
const liteModule={exports:{}};
const liteFactory=vm.runInThisContext('(function(exports,require,module){'+fs.readFileSync(path.resolve(__dirname,'../vendor/vega-lite.min.js'),'utf8')+'\n})');
liteFactory(liteModule.exports,name=>name==='vega'?vega:require(name),liteModule);
const vl=liteModule.exports;
const root=path.resolve(__dirname,'..');
const chartLayout=require('../js/chart-layout.js');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sum=(a,f)=>a.reduce((n,x)=>n+x[f],0);
const loader={...vega.loader(),load:async uri=>fs.readFileSync(path.join(root,uri.split('?')[0]),'utf8')};

async function main(){
 const rows=read('data/team_seasons.json'),clubs=read('data/team_summary.json'),states=read('data/states.json');
 assert.equal(rows.length,252);assert.equal(new Set(rows.map(d=>d.id)).size,18);
 assert.equal(new Set(rows.map(d=>`${d.id}:${d.season}`)).size,252);
 for(let y=2012;y<=2025;y++){
  const ds=rows.filter(d=>d.season===y);
  assert.equal(ds.length,18);assert.equal(sum(ds,'premier'),1);assert.equal(sum(ds,'runner_up'),1);assert.equal(sum(ds,'finalist'),8);
  assert.deepEqual(ds.map(d=>d.rank).sort((a,b)=>a-b),Array.from({length:18},(_,i)=>i+1));
 }
 for(const d of rows){assert.equal(d.played,d.wins+d.draws+d.losses);assert.ok(Math.abs(d.win_rate-d.wins/d.played*100)<0.006);}
 assert.equal(sum(clubs,'finals'),112);assert.equal(sum(clubs,'premierships'),14);
 assert.equal(sum(states,'club_seasons'),252);assert.equal(sum(states,'finals'),112);
 assert.equal(rows.find(d=>d.team==='Essendon'&&d.season===2013).finalist,0);
 assert.equal(rows.find(d=>d.team==='Essendon'&&d.season===2013).rank,9);
 assert.equal(rows.find(d=>d.team==='Geelong'&&d.season===2020).played,17);
 assert.equal(clubs.find(d=>d.team==='Geelong').finals,12);
 assert.equal(clubs.find(d=>d.team==='Brisbane Lions').premierships,2);
 const cities=read('data/cities.json');assert.equal(sum(cities,'premierships'),14);
 assert.ok(cities.every(d=>d.longitude>110&&d.longitude<155&&d.latitude<0));
 const flows=read('data/finals_connections.json');assert.equal(flows.reduce((s,d)=>s+d.properties.count,0),13);
 const topo=read('data/australia_states.topojson');assert.equal(topo.objects.states.geometries.length,8);
 const specs=fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.json'));
 assert.equal(specs.length,15);
 const stateSeasons=read('data/state_seasons.json');
 assert.equal(stateSeasons.length,112);
 for(const d of stateSeasons){
   const records=rows.filter(r=>r.season===d.season&&r.state_code===d.state_code);
   assert.equal(d.clubs,records.length);
   assert.equal(d.finals,sum(records,'finalist'));
   assert.equal(d.finals_rate,records.length?sum(records,'finalist')/records.length*100:null);
 }
 function items(view,predicate){
   const found=[];
   function visit(item){if(predicate(item))found.push(item);for(const child of item.items||[])visit(child);}
   visit(view.scenegraph().root);return found;
 }
 const transitions=read('data/season_transitions.json');
 assert.equal(transitions.length,18*13);
 for(const d of transitions){
   const before=rows.find(r=>r.team===d.team&&r.season===d.from_season);
   const after=rows.find(r=>r.team===d.team&&r.season===d.season);
   assert.equal(d.season,d.from_season+1);
   assert.equal(d.change,before.rank-after.rank);
   assert.equal(d.from_finals,before.finalist);assert.equal(d.to_finals,after.finalist);
 }
 assert.equal(transitions.filter(d=>Math.abs(d.change)<=3).length,129);
 const links=read('data/finals_transition_totals.json');
 assert.equal(sum(links,'count'),transitions.length);
 for(const link of links)assert.equal(link.count,transitions.filter(d=>d.from_finals===link.from&&d.to_finals===link.to).length);
 assert.equal(links.find(d=>d.from===1&&d.to===1).count,65);
 assert.equal(links.find(d=>d.from===0&&d.to===1).count,39);
 const report=[];
 for(const name of specs){
   console.log('Render',name);
   const s=read('js/'+name);const isLite=s.$schema.includes('vega-lite');
   const warnings=[];const logger={level(){return this;},warn(...a){warnings.push(a.join(' '));},info(){},debug(){},error(...a){throw Error(a.join(' '));}};
   for(const width of [1000,340]){
     const spec=structuredClone(s);const layout=chartLayout(spec,width);if(layout.type==='single')spec.width=width;
     const compiled=isLite?vl.compile(spec,{logger}).spec:spec;
     const view=new vega.View(vega.parse(compiled),{renderer:'none',loader,logger});
     await view.runAsync();
     const svg=await view.toSVG();
     assert.ok(svg.startsWith('<svg'));
     // Node uses approximate font metrics; also reject invalid geometry.
     assert.ok(!/\bNaN\b|\bInfinity\b/.test(svg),`${name} invalid geometry`);
     for(const match of svg.matchAll(/font-size="([\d.]+)(?:px)?"/g))assert.ok(+match[1]>=15,`${name}: text below 15px`);
     if(name==='premiership_bars.json'){
       const bars=items(view,item=>item.mark?.name==='title_bars_marks');
       const labels=items(view,item=>item.mark?.name==='title_counts_marks');
       assert.equal(bars.length,9);assert.equal(labels.length,9);
       assert.equal(sum(bars.map(item=>item.datum),'premierships'),14);
       assert.deepEqual(view.scale('x').domain(),[0,3]);
       const expectedOrder=clubs.filter(d=>d.premierships>0).sort((a,b)=>b.premierships-a.premierships||a.team.localeCompare(b.team)).map(d=>d.team);
       assert.deepEqual(view.scale('y').domain(),expectedOrder);
       assert.deepEqual(expectedOrder.slice(0,3),['Hawthorn','Richmond','Brisbane Lions']);
       for(const bar of bars){
         const d=bar.datum;
         assert.equal(d.premierships,clubs.find(club=>club.team===d.team).premierships);
         assert.equal(d.title_years,rows.filter(row=>row.team===d.team&&row.premier).map(row=>row.season).join(', '));
         assert.equal(bar.fill,d.premierships===3?'#c96636':'#31553b');
         assert.equal(bar.x,0,'Bars start at zero');
         assert.ok(Math.abs(bar.width-view.scale('x')(d.premierships))<1e-8,'Bar length is proportional to titles');
         const label=labels.find(item=>item.datum.team===d.team);
         assert.equal(Number(label.text),d.premierships);
         assert.ok(label.bounds.x2<=view.width(),'Count label fits the plot');
       }
     }
     if(name==='finals_return.json'){
       assert.equal(view.data('links').length,4);
       assert.equal(view.data('nodes').length,4);
       assert.equal(sum(view.data('links'),'count'),234);
       const labels=items(view,item=>item.mark?.name==='flow_values');
       assert.deepEqual(labels.map(item=>item.text),['65 (62.5%)','39 (37.5%)','39 (30%)','91 (70%)']);
       for(const label of labels){
         const startingGroup=transitions.filter(d=>d.from_finals===label.datum.from);
         assert.equal(label.datum.source_total,startingGroup.length);
         assert.equal(label.datum.share,startingGroup.filter(d=>d.to_finals===label.datum.to).length/startingGroup.length);
       }
     }
     if(name==='success_comparison.json'){
       const profiles=view.data('profiles');
       assert.equal(profiles.length,10,'Two clubs across five independent measures');
       assert.deepEqual([...new Set(profiles.map(d=>d.team))].sort(),['Geelong','Hawthorn']);
       assert.equal(view.data('metrics').length,5);
       assert.equal(view.data('metrics').find(d=>d.metric==='top_four').label,'Top-four finishes');
       assert.deepEqual(view.scale('percentage').domain(),[0,100]);
       assert.equal(items(view,item=>item.mark?.name==='profile_bars').length,10);
       assert.equal(items(view,item=>['line','path'].includes(item.mark?.marktype)).length,0,'No lines connect different measures');
       for(const d of profiles){
         const clubRows=rows.filter(r=>r.team===d.team);
         const counts={wins:sum(clubRows,'wins'),finals:sum(clubRows,'finalist'),top_four:clubRows.filter(r=>r.rank<=4).length,
           grand_finals:sum(clubRows,'premier')+sum(clubRows,'runner_up'),premierships:sum(clubRows,'premier')};
         assert.equal(d.numerator,counts[d.metric]);
         assert.equal(d.denominator,d.metric==='wins'?sum(clubRows,'played'):14);
         assert.equal(d.rate,d.numerator/d.denominator*100);
         assert.equal(d.value_label,`${d.numerator}/${d.denominator}`);
       }
       assert.equal(profiles.find(d=>d.team==='Geelong'&&d.metric==='top_four').value_label,'10/14');
       assert.equal(profiles.find(d=>d.team==='Hawthorn'&&d.metric==='top_four').value_label,'6/14');
       const bars=items(view,item=>item.mark?.name==='profile_bars');
       for(const bar of bars)assert.ok(Math.abs(bar.width-(view.scale('percentage')(bar.datum.rate)-view.scale('percentage')(0)))<1e-8);
       await view.width(276).runAsync();
       assert.ok(view.signal('plotWidth')>0);
       const narrowLabels=items(view,item=>item.mark?.name==='profile_values');
       assert.equal(narrowLabels.length,10);
       // Node estimates text widths; browser QA checks full rendered label bounds.
       assert.ok(narrowLabels.every(label=>label.x>=view.signal('plotStart')&&label.x<view.width()),'Direct labels stay in the value column on narrow screens');
       await view.width(width).runAsync();
     }
     if(name==='state_choropleth.json'){
       const mapped=()=>items(view,item=>item.mark?.marktype==='shape'&&item.datum?.state_code).map(item=>item.datum);
       for(let year=2012;year<=2025;year++){
         await view.signal('selectedSeason',year).runAsync();
         const table=mapped();
         assert.equal(table.length,8,'Preserve states without clubs');
         assert.equal(table.filter(d=>d.clubs>0).length,5,'State joins must match five states');
         assert.equal(sum(table,'finals'),8);
         for(const item of items(view,i=>i.mark?.marktype==='shape'&&i.datum?.clubs===0)){
           assert.equal(item.fill,'#dedfd5');
           assert.equal(item.datum.rate_label,'Not applicable');
         }
         for(const d of table){
           assert.equal(d.season,year);
           assert.ok(d.geo?.geometry,'Every year-state must have its geometry');
           assert.equal(d.finals_rate,stateSeasons.find(r=>r.season===year&&r.state_code===d.state_code).finals_rate);
         }
         assert.deepEqual(view.scale('color').domain(),[30,40,50,100]);
       }
       await view.signal('mapZoom',3).signal('mapCentre',[13,-33]).runAsync();
       assert.ok(!/\bNaN\b|\bInfinity\b/.test(await view.toSVG()));
       await view.signal('mapZoom',1).signal('mapCentre',[0,-28]).runAsync();
     }
     if(name==='top_four_treemap.json'){
       const leaves=view.data('leaves');
       assert.equal(leaves.length,12);assert.equal(sum(leaves,'count'),56);
       const totalArea=view.width()*view.height();
       for(const d of leaves){
         const records=rows.filter(r=>r.team===d.team&&r.rank<=4);
         assert.equal(d.count,records.length);
         assert.equal(d.years,records.map(r=>r.season).join(', '));
         assert.ok(Math.abs((d.x1-d.x0)*(d.y1-d.y0)/totalArea-d.count/56)<1e-8,'Tile area is proportional to top-four finishes');
         assert.ok(d.x0>=0&&d.x1<=view.width()+1e-8&&d.y0>=0&&d.y1<=view.height()+1e-8);
       }
       assert.equal(leaves.find(d=>d.team==='Geelong').count,10);
       const tiles=items(view,item=>item.mark?.name==='top_four_tiles');
       assert.equal(tiles.length,12);
       assert.equal(tiles.filter(t=>t.fill==='#c96636').length,1);
     }
     if(name==='club_horizon.json'){
       const teams=['Geelong','Sydney','Hawthorn','Richmond','Brisbane Lions','West Coast'];
       const curves=view.data('curves'),records=view.data('records');
       assert.equal(records.length,84);assert.equal(curves.filter(d=>d.observed).length,84);
       assert.deepEqual(view.scale('year').domain(),[2012,2025]);
       for(const d of curves){
         const observed=rows.find(r=>r.team===d.team&&r.season===d.season);
         if(d.observed)assert.equal(d.rate,observed.wins/observed.played*100);
         else{
           assert.ok([25,50,75].includes(d.rate),'Drawing-only points are fold crossings');
           const before=rows.find(r=>r.team===d.team&&r.season===Math.floor(d.season));
           const after=rows.find(r=>r.team===d.team&&r.season===Math.ceil(d.season));
           const interpolated=before.wins/before.played*100+(after.wins/after.played-before.wins/before.played)*100*(d.season-before.season);
           assert.ok(Math.abs(interpolated-d.rate)<1e-8);
         }
         for(const field of ['band_0_25','band_25_50','band_50_75','band_75_100'])assert.ok(d[field]>=0&&d[field]<=25);
         assert.ok(Math.abs(d.band_0_25+d.band_25_50+d.band_50_75+d.band_75_100-d.rate)<1e-8,'Folding preserves the exact win rate');
         if(d.rate>50)assert.equal(d.band_25_50,25,'Higher rates retain the completed lower bands');
       }
       const areas=items(view,item=>item.mark?.marktype==='area'&&item.datum?.team);
       assert.equal(areas.length,curves.length*4);
       for(const area of areas){assert.ok(area.y>=6&&area.y<=38,'Folded areas keep space above and below');assert.equal(area.y2,38);}
       const example=curves.find(d=>d.observed&&d.rate>50&&d.rate<75);
       assert.equal(example.band_0_25,25);assert.equal(example.band_25_50,25);
       assert.ok(Math.abs(example.band_50_75-(example.rate-50))<1e-8);assert.equal(example.band_75_100,0);
       assert.equal(items(view,item=>item.mark?.name==='season_targets').length,84,'Only observed seasons are interactive');
       for(const season of [2012,2018,2025]){
         await view.signal('detailSeason',season).runAsync();
         for(let i=0;i<teams.length;i++){
           const detail=view.data('detail_'+i);assert.equal(detail.length,1);
           assert.equal(detail[0].team,teams[i]);assert.equal(detail[0].season,season);
           const label=items(view,item=>item.mark?.name==='season_readout_'+i)[0];
           assert.equal(label.text,`${(detail[0].wins/detail[0].played*100).toFixed(1)}%`);
         }
       }
     }
     if(['ladder_heatmap.json','finals_frequency.json'].includes(name)){
       await view.signal('focusTeam','Geelong').runAsync();assert.equal(view.signal('focusTeam'),'Geelong');
       if(name==='ladder_heatmap.json'){
         const cells=items(view,item=>item.mark?.name==='ladder_cells_marks');
         const outlines=items(view,item=>item.mark?.name==='champion_outlines_marks');
         assert.equal(cells.length,252);assert.equal(outlines.length,14);
         for(const cell of cells)assert.equal(cell.fill,cell.datum.rank<=4?'#31553b':cell.datum.rank<=8?'#a8bd9c':'#e4e6da','Ladder fill remains visible for every club, including champions');
         for(const outline of outlines){
           const cell=cells.find(item=>item.datum.team===outline.datum.team&&item.datum.season===outline.datum.season);
           assert.equal(cell.datum.premier,1);assert.equal(outline.fill,null);assert.equal(outline.stroke,'#c96636');
           for(const key of ['x','y','width','height','opacity'])assert.equal(outline[key],cell[key],'Champion outline stays aligned with its cell and highlight');
           assert.equal(outline.opacity,outline.datum.team==='Geelong'?1:0.22);
         }
       }
       await view.signal('focusTeam','All clubs').runAsync();
     }
     if(name==='finals_streaks.json'){
       const allRuns=read('data/streaks.json');
       for(const minimum of [3,7,1]){
         await view.signal('minimumRun',minimum).runAsync();
         const visible=view.data('source_0');
         assert.equal(visible.length,allRuns.filter(d=>d.length>=minimum).length);
         assert.ok(visible.every(d=>d.length>=minimum));
         assert.equal(view.scale('y').domain().length,18,'Keep all club rows when filtering');
         if(minimum===7)assert.deepEqual(visible.map(d=>d.team).sort(),['Brisbane Lions','Geelong','Sydney']);
       }
     }
     if(name==='ladder_bump.json'){
       const brush=(range)=>view.change('seasonBrush_store',vega.changeset().remove(()=>true).insert(range?[{unit:'journey_overview',fields:[{field:'season',channel:'x',type:'R'}],values:[range]}]:[])).runAsync();
       const bars=()=>items(view,item=>item.mark?.marktype==='rect'&&Number.isFinite(item.datum?.period_win_rate));
       for(const range of [[2014,2018],[2020,2020],[2019,2025],null]){
         await brush(range);
         assert.equal(bars().length,4);
         if(range&&range[0]!==range[1])assert.deepEqual(view.scale('journey_detail_x').domain(),range);
         for(const item of bars()){
           const expected=rows.filter(r=>r.team===item.datum.team&&(!range||(r.season>=range[0]&&r.season<=range[1])));
           assert.equal(item.datum.seasons,expected.length);
           assert.equal(item.datum.games,sum(expected,'played'));
           assert.ok(Math.abs(item.datum.period_win_rate-sum(expected,'wins')/sum(expected,'played')*100)<1e-8);
         }
         const best=items(view,item=>item.mark?.marktype==='text'&&item.text==='Best');
         const highest=Math.max(...bars().map(item=>item.datum.period_win_rate));
         assert.ok(best.length>0);
         assert.ok(best.every(item=>item.datum.period_win_rate===highest));
       }
       await view.signal('journeyClub_team_legend','Geelong').runAsync();
       const lines=items(view,item=>item.mark?.marktype==='line'&&item.datum?.team);
       assert.ok(lines.length>0);
       for(const item of [...lines,...bars()])assert.equal(item.opacity,item.datum.team==='Geelong'?1:0.15);
       await view.signal('journeyClub_team_legend',null).runAsync();
     }
     // Save render output only as a local QA artifact, outside the webpage.
     fs.mkdirSync('/private/tmp/ass2-chart-renders',{recursive:true});
     fs.writeFileSync(`/private/tmp/ass2-chart-renders/${name.replace('.json','')}-${width}.svg`,svg);
     view.finalize();
   }
   const unexpected=warnings.filter(w=>w!=='Can not resolve event source: window');
   assert.deepEqual([...new Set(unexpected)],[],`${name}: unexpected render warnings`);
   report.push(name);
 }
 await require('./validate-maps.cjs')({vega,vl,loader,root,read,rows,stateSeasons,cities,items});
 const total=fs.readdirSync(path.join(root,'data')).reduce((s,f)=>s+fs.statSync(path.join(root,'data',f)).size,0);
 assert.ok(total<1000000,`Prepared data over budget: ${total}`);
 console.log(JSON.stringify({data_checks:'passed',specs_rendered:report.length,widths:[1000,340],club_highlighting:'passed',streak_filter:'passed',legend_highlighting:'passed',brush_aggregates:'passed',year_map_joins:'passed',horizon_folding:'passed',treemap_areas:'passed',data_bytes:total,charts:report},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
