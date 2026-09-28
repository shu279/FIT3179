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
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sum=(a,f)=>a.reduce((n,x)=>n+x[f],0);
const loader={...vega.loader(),load:async uri=>fs.readFileSync(path.join(root,uri),'utf8')};

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
 const specs=fs.readdirSync(path.join(root,'specs')).filter(f=>f.endsWith('.json'));
 assert.equal(specs.length,15);
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
   const s=read('specs/'+name);const isLite=s.$schema.includes('vega-lite');
   const warnings=[];const logger={level(){return this;},warn(...a){warnings.push(a.join(' '));},info(){},debug(){},error(...a){throw Error(a.join(' '));}};
   for(const width of [1000,340]){
     const spec=structuredClone(s);spec.width=width;
     const compiled=isLite?vl.compile(spec,{logger}).spec:spec;
     const view=new vega.View(vega.parse(compiled),{renderer:'none',loader,logger});
     await view.runAsync();
     const svg=await view.toSVG();
     assert.ok(svg.startsWith('<svg'));assert.ok(!/\bNaN\b|\bInfinity\b/.test(svg),`${name} invalid geometry`);
     for(const match of svg.matchAll(/font-size="([\d.]+)(?:px)?"/g))assert.ok(+match[1]>=15,`${name}: text below 15px`);
     if(name==='finals_return.json'){
       assert.equal(view.data('links').length,4);
       assert.equal(view.data('nodes').length,4);
       assert.equal(sum(view.data('links'),'count'),234);
     }
     if(name==='state_choropleth.json'){
       const table=view.data('source_0');
       assert.equal(table.length,8,'Preserve states without clubs');
       assert.equal(table.filter(d=>d.clubs>0).length,5,'State joins must match five states');
     }
     if(['ladder_heatmap.json','finals_frequency.json'].includes(name)){
       await view.signal('focusTeam','Geelong').runAsync();assert.equal(view.signal('focusTeam'),'Geelong');
       await view.signal('focusTeam','All clubs').runAsync();
     }
     // Save render output only as a local QA artifact, outside the webpage.
     fs.mkdirSync('/private/tmp/ass2-chart-renders',{recursive:true});
     fs.writeFileSync(`/private/tmp/ass2-chart-renders/${name.replace('.json','')}-${width}.svg`,svg);
     view.finalize();
   }
   if(warnings.length)console.log('WARN',name,[...new Set(warnings)]);
   report.push(name);
 }
 const total=fs.readdirSync(path.join(root,'data')).reduce((s,f)=>s+fs.statSync(path.join(root,'data',f)).size,0);
 assert.ok(total<1000000,`Prepared data over budget: ${total}`);
 console.log(JSON.stringify({data_checks:'passed',specs_rendered:report.length,widths:[1000,340],club_highlighting:'passed',data_bytes:total,charts:report},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
