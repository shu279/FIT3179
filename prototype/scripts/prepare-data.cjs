// Preparation only. The webpage uses HTML, Pure.css, JavaScript and Vega/Vega-Lite.
// Usage: node scripts/prepare-data.cjs /path/to/cached/source/files
const fs = require('node:fs');
const path = require('node:path');
const cache = process.argv[2] || '/private/tmp/ass2-afl-raw';
const dest = path.resolve(__dirname, '../data');
const clubs = [
  ['ADE','Adelaide','adelaide','SA','Adelaide'], ['BRL','Brisbane Lions','brisbanel','QLD','Brisbane'],
  ['CAR','Carlton','carlton','VIC','Melbourne'], ['COL','Collingwood','collingwood','VIC','Melbourne'],
  ['ESS','Essendon','essendon','VIC','Melbourne'], ['FRE','Fremantle','fremantle','WA','Perth'],
  ['GEE','Geelong','geelong','VIC','Geelong'], ['GCS','Gold Coast','goldcoast','QLD','Gold Coast'],
  ['GWS','GWS Giants','gws','NSW','Sydney'], ['HAW','Hawthorn','hawthorn','VIC','Melbourne'],
  ['MEL','Melbourne','melbourne','VIC','Melbourne'], ['NME','North Melbourne','kangaroos','VIC','Melbourne'],
  ['PTA','Port Adelaide','padelaide','SA','Adelaide'], ['RIC','Richmond','richmond','VIC','Melbourne'],
  ['STK','St Kilda','stkilda','VIC','Melbourne'], ['SYD','Sydney','swans','NSW','Sydney'],
  ['WCE','West Coast','westcoast','WA','Perth'], ['WBD','Western Bulldogs','bullldogs','VIC','Melbourne']
];
const stateNames={NSW:'New South Wales',VIC:'Victoria',QLD:'Queensland',SA:'South Australia',WA:'Western Australia',TAS:'Tasmania',NT:'Northern Territory',ACT:'Australian Capital Territory'};
const stateCodes={NSW:'1',VIC:'2',QLD:'3',SA:'4',WA:'5',TAS:'6',NT:'7',ACT:'8'};
const cities={Melbourne:'Q3141',Sydney:'Q3130',Brisbane:'Q34932',Adelaide:'Q5112',Perth:'Q3183',Geelong:'Q25641257','Gold Coast':'Q140075'};
const write=(file,data)=>fs.writeFileSync(path.join(dest,file+'.json'), JSON.stringify(data,null,2)+'\n');
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const round=n=>Math.round(n*100)/100;
const rows=[];
const sourceList=[];
for(const [id,team,slug,state,city] of clubs){
  const source=`https://afltables.com/afl/teams/${slug}/season.html`;
  sourceList.push({team,url:source});
  const html=fs.readFileSync(path.join(cache,slug+'.html'),'utf8');
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').replace(/&nbsp;/g,'').trim());
    const year=+cells[0];
    if(year<2012||year>2026||cells.length!==20)continue;
    const n=i=>+(cells[i]||0);
    const points=i=>+(cells[i].split('.').at(-1)||0);
    const rank=+cells[14].split('/')[0];
    rows.push({id,team,season:year,state,state_code:stateCodes[state],city,played:n(1),wins:n(2),draws:n(3),losses:n(4),points_for:points(5),points_against:points(6),percentage:n(7),rank,finals_games:n(8),finals_wins:n(9),premier:cells[15]==='X'?1:0,runner_up:cells[16]==='X'?1:0,minor_premier:cells[17]==='X'?1:0,finalist:cells[18]==='X'?1:0,win_rate:round(n(2)/n(1)*100),band:rank<=4?'Top four':rank<=8?'5th–8th':'9th–18th'});
  }
}
// Retain the source discrepancy and independently verified replacement.
const rankCorrections=[{id:'PTA',season:2024,source_value:3,verified_value:2,field:'rank',reason:'Club summary duplicates third place; the full season ladder and official AFL report identify Port Adelaide as second.',source_url:'https://afltables.com/afl/teams/padelaide/season.html',verification_urls:['https://afltables.com/afl/seas/2024.html#lad','https://www.afl.com.au/news/1203020/whose','https://www.portadelaidefc.com.au/news/1641192/one-campaign-ends-another-begins']}];
for(const fix of rankCorrections){const d=rows.find(d=>d.id===fix.id&&d.season===fix.season);if(!d)throw Error('Missing correction row');d.source_rank=d.rank;d.rank=fix.verified_value;d.rank_source=fix.verification_urls[0];}
const complete=rows.filter(d=>d.season<=2025).sort((a,b)=>a.team.localeCompare(b.team)||a.season-b.season);
if(complete.length!==252)throw Error(`Expected 252 complete club-seasons, got ${complete.length}`);
for(const d of complete){if(d.played!==d.wins+d.draws+d.losses)throw Error(`Record mismatch ${d.team} ${d.season}`);}
for(let y=2012;y<=2025;y++){
 const season=complete.filter(d=>d.season===y);
 if(season.length!==18||season.reduce((s,d)=>s+d.premier,0)!==1||season.reduce((s,d)=>s+d.runner_up,0)!==1||season.reduce((s,d)=>s+d.finalist,0)!==8)throw Error(`Outcome mismatch ${y}`);
}
const summaries=clubs.map(([id,team,slug,state,city])=>{
 const ds=complete.filter(d=>d.id===id);const finals=ds.reduce((s,d)=>s+d.finalist,0);
 let best=0,streak=0;for(const d of ds){streak=d.finalist?streak+1:0;best=Math.max(best,streak);}
 const first=ds.filter(d=>d.season<=2018),last=ds.filter(d=>d.season>=2019);
 const rate=a=>a.reduce((s,d)=>s+d.wins,0)/a.reduce((s,d)=>s+d.played,0)*100;
 return {id,team,state,state_code:stateCodes[state],city,seasons:ds.length,finals,finals_rate:round(finals/ds.length*100),premierships:ds.reduce((s,d)=>s+d.premier,0),grand_finals:ds.reduce((s,d)=>s+d.premier+d.runner_up,0),win_rate:round(rate(ds)),average_rank:round(avg(ds.map(d=>d.rank))),top_four:ds.filter(d=>d.rank<=4).length,longest_streak:best,early_rate:round(rate(first)),recent_rate:round(rate(last)),change:round(rate(last)-rate(first)),source_url:`https://afltables.com/afl/teams/${slug}/season.html`};
}).sort((a,b)=>b.finals-a.finals||b.win_rate-a.win_rate);
const states=Object.entries(stateNames).map(([state,name])=>{
 const ds=complete.filter(d=>d.state===state); const clubCount=clubs.filter(d=>d[3]===state).length;
 const finals=ds.reduce((s,d)=>s+d.finalist,0);
 return {state,state_name:name,state_code:stateCodes[state],clubs:clubCount,club_seasons:ds.length,finals,finals_rate:ds.length?round(finals/ds.length*100):null,premierships:ds.reduce((s,d)=>s+d.premier,0),coverage:ds.length?'Clubs in study':'No club based here in study period'};
});
const cityData=Object.entries(cities).map(([city,q])=>{
 const entities=JSON.parse(fs.readFileSync(path.join(cache,q+'.json'),'utf8')).entities;
 const entity=entities[q]||Object.values(entities)[0];
 const coords=entity.claims.P625.filter(s=>s.rank!=='deprecated'&&s.mainsnak.datavalue).map(s=>s.mainsnak.datavalue.value)[0];
 if(!coords||coords.latitude>=0||coords.longitude<110||coords.longitude>155)throw Error(`Check coordinate: ${city}`);
 const ds=complete.filter(d=>d.city===city);
 return {city,latitude:coords.latitude,longitude:coords.longitude,clubs:clubs.filter(d=>d[4]===city).length,premierships:ds.reduce((s,d)=>s+d.premier,0),grand_finals:ds.reduce((s,d)=>s+d.premier+d.runner_up,0),wikidata:entity.id,source_url:`https://www.wikidata.org/wiki/${entity.id}`,location_label:entity.labels.en.value};
});
const cityLookup=Object.fromEntries(cityData.map(d=>[d.city,d]));
const grandFinals=[];
for(let y=2012;y<=2025;y++){
 const winner=complete.find(d=>d.season===y&&d.premier),runner=complete.find(d=>d.season===y&&d.runner_up);
 grandFinals.push({season:y,winner:winner.team,runner_up:runner.team,winner_city:winner.city,runner_city:runner.city,winner_rank:winner.rank,runner_rank:runner.rank});
}
const pairs={};
for(const gf of grandFinals){
 if(gf.winner_city===gf.runner_city)continue;
 const [a,b]=[gf.winner_city,gf.runner_city].sort(),key=a+' – '+b;
 if(!pairs[key])pairs[key]={pair:key,from:a,to:b,count:0,years:[]};
 pairs[key].count++;pairs[key].years.push(gf.season);
}
const flows=Object.values(pairs).map(d=>({type:'Feature',properties:{...d,years:d.years.join(', ')},geometry:{type:'LineString',coordinates:[[cityLookup[d.from].longitude,cityLookup[d.from].latitude],[cityLookup[d.to].longitude,cityLookup[d.to].latitude]]}}));
const streaks=[];
for(const club of summaries){
 const ds=complete.filter(d=>d.id===club.id);let start=null;
 for(let i=0;i<=ds.length;i++){
   if(i<ds.length&&ds[i].finalist){if(start===null)start=ds[i].season;}
   else if(start!==null){const end=ds[i-1].season;streaks.push({team:club.team,id:club.id,start:start-0.35,end:end+0.35,first:start,last:end,length:end-start+1});start=null;}
 }
}
const manifest={title:'Staying at the Top of AFL',competition:'AFL men',complete_seasons:[2012,2025],retrieved:'2026-09-14',club_seasons:complete.length,clubs:18,seasons:14,premierships:14,distinct_premiers:summaries.filter(d=>d.premierships>0).length,leading_club:summaries[0],same_city_grand_finals:grandFinals.filter(d=>d.winner_city===d.runner_city).length,sources:{afl_tables:sourceList,abs:'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-4-july-2026-june-2031/access-and-downloads/digital-boundary-files',wikidata:cityData.map(d=>({city:d.city,url:d.source_url}))}};
manifest.home_city_groupings=cityData.map(d=>({city:d.city,clubs:clubs.filter(c=>c[4]===d.city).map(c=>c[1])}));
manifest.location_method='Author-assigned home-city groups represent club bases, not stadiums or match venues. Fremantle is grouped with Perth; Geelong is separate from Melbourne.';
manifest.corrections='corrections.json';
manifest.sources.natural_earth='https://www.naturalearthdata.com/downloads/';
manifest.sources.colorbrewer='https://colorbrewer2.org/#type=sequential&scheme=YlGnBu&n=5';
manifest.map_preparation='map_sources.json';
manifest.legacy_boundary_file='australia_states.topojson is the earlier ABS boundary file, retained for provenance; the current maps use natural_earth_states.topojson and natural_earth_physical.topojson.';
write('team_seasons',complete);write('team_summary',summaries);write('states',states);write('cities',cityData);write('grand_finals',grandFinals);write('finals_connections',flows);write('streaks',streaks);write('manifest',manifest);
write('season_2026_snapshot',rows.filter(d=>d.season===2026));write('corrections',rankCorrections);
console.log(JSON.stringify({club_seasons:complete.length,leading:summaries.slice(0,3),premiers:summaries.filter(d=>d.premierships).map(d=>[d.team,d.premierships]),cityData},null,2));
