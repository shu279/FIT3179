// Adapted from FIT3179 Week 8 maps and Week 10 2_interactive / 3_properties.
module.exports=function({base,config,multiConfig,ink,green,orange}){
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const root=path.resolve(__dirname,'..');
 const rows=require('../data/team_seasons.json'),states=require('../data/states.json'),cities=require('../data/cities.json');
 const finals=require('../data/grand_finals.json');
 const palette=require('../data/map_sources.json').colour;
 const write=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
 const sum=(records,field)=>records.reduce((n,d)=>n+d[field],0);
 const years=Array.from({length:14},(_,i)=>2012+i);
 const stateSeasons=years.flatMap(season=>states.map(state=>{
  const records=rows.filter(d=>d.season===season&&d.state_code===state.state_code);
  const count=sum(records,'finalist');
  return {season,state:state.state,state_name:state.state_name,state_code:state.state_code,clubs:records.length,finals:count,
   finals_rate:records.length?count/records.length*100:null,coverage:records.length?'Clubs in this season':'No AFL club based here'};
 }));
 const citySeasons=years.flatMap(season=>cities.map(city=>{
  const records=rows.filter(d=>d.season===season&&d.city===city.city);
  return {season,city:city.city,longitude:city.longitude,latitude:city.latitude,clubs:records.length,finals:sum(records,'finalist'),
   premierships:sum(records,'premier'),grand_finals:sum(records,'premier')+sum(records,'runner_up'),premier:records.filter(d=>d.premier).map(d=>d.team).join(', '),
   finalists:records.filter(d=>d.finalist).map(d=>d.team).join(', ')||'None'};
 }));
 const lookup=Object.fromEntries(cities.map(d=>[d.city,d]));
 const connections=finals.filter(d=>d.winner_city!==d.runner_city).map(d=>({type:'Feature',
  properties:{season:d.season,winner:d.winner,runner_up:d.runner_up,winner_city:d.winner_city,runner_city:d.runner_city},
  geometry:{type:'LineString',coordinates:[d.winner_city,d.runner_city].map(city=>[lookup[city].longitude,lookup[city].latitude])}}));
 const participants=finals.flatMap(d=>[{season:d.season,team:d.runner_up,city:d.runner_city,result:'Runner-up'},
  {season:d.season,team:d.winner,city:d.winner_city,result:'Premier'}].map(row=>({...row,longitude:lookup[row.city].longitude,latitude:lookup[row.city].latitude})));
 write('data/state_seasons.json',stateSeasons);write('data/city_seasons.json',citySeasons);
 write('data/grand_final_seasons.json',connections);write('data/grand_final_participants.json',participants);
 const table=name=>({url:'data/'+name+'.json'});
 const geometryUrl=name=>{
  const file='data/'+name+'.topojson';
  return file+'?v='+crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,12);
 };
 const stateGeometry=geometryUrl('natural_earth_states'),physicalGeometry=geometryUrl('natural_earth_physical');
 // Land and state borders share one topology, keeping their coast identical at every zoom.
 const physical=name=>({url:name==='land'?stateGeometry:physicalGeometry,format:{type:'topojson',feature:name}});
 const borders={url:stateGeometry,format:{type:'topojson',feature:'states'}};
 const commonParams=(bound=false)=>[
  {name:'selectedSeason',value:2025,...(bound?{bind:{input:'range',min:2012,max:2025,step:1,name:'Season: '}}:{})},
  {name:'mapZoom',value:1},
  {name:'mapCentre',value:[0,-28]},
  {name:'showPhysical',value:true},
  {name:'showCultural',value:true}
 ];
 const projection={type:'conicEqualArea',rotate:[-134,0,0],parallels:[-18,-36],center:{expr:'mapCentre'},
  scale:{expr:'mapZoom * min(width / 0.84, height / 0.72)'},translate:{expr:'[width / 2, height / 2]'}};
 const physicalLayers=(height='height')=>[
  // Fill the rectangular viewport; the clipped ocean geometry alone has a
  // curved boundary under the equal-area projection.
  {name:'water_backdrop',data:{values:[{}]},transform:[{filter:'showPhysical'}],
   mark:{type:'rect',clip:true,fill:'#e4eff0',stroke:null,aria:false},
   encoding:{x:{value:0},x2:{value:{expr:'width'}},y:{value:0},y2:{value:{expr:height}}}},
  {name:'physical_ocean',data:physical('ocean'),transform:[{filter:'showPhysical'}],mark:{type:'geoshape',clip:true,fill:'#e4eff0',stroke:null}},
  {name:'physical_land',data:physical('land'),transform:[{filter:'showPhysical'}],mark:{type:'geoshape',clip:true,fill:'#e5e6da',stroke:null}},
  {name:'reference_grid',data:physical('graticules'),transform:[{filter:'showPhysical'}],mark:{type:'geoshape',clip:true,filled:false,stroke:'#bccbca',strokeWidth:0.6,strokeDash:[3,3]}}
 ];
 const borderLayer=()=>({name:'cultural_borders',data:borders,transform:[{filter:'showCultural'}],mark:{type:'geoshape',clip:true,filled:false,stroke:'#748679',strokeWidth:0.8}});
 const stateLabels=[{state:'WA',lon:122,lat:-26},{state:'NT',lon:133,lat:-21},{state:'SA',lon:135,lat:-30},{state:'QLD',lon:145,lat:-22},{state:'NSW',lon:147,lat:-32},{state:'VIC',lon:143,lat:-36.7},{state:'TAS',lon:146.5,lat:-42}];
 const loc={longitude:{field:'longitude',type:'quantitative'},latitude:{field:'latitude',type:'quantitative'}};
 const cityLabels=(finalistsOnly=false)=>[
  // Shared-city matchups have their own city and club annotation.
  {name:'cultural_city_labels',data:table(finalistsOnly?'city_seasons':'cities'),transform:[...(finalistsOnly?[{filter:'datum.season === selectedSeason && datum.grand_finals === 1'}]:[]),{filter:"(width >= 500 || mapZoom >= 2) && showCultural && datum.city !== 'Geelong' && datum.city !== 'Gold Coast'"}],
   mark:{type:'text',clip:true,align:'left',dx:12,dy:-12,fontSize:15,color:ink},encoding:{...loc,text:{field:'city',type:'nominal'}}},
  {name:'cultural_geelong_label',data:table(finalistsOnly?'city_seasons':'cities'),transform:[...(finalistsOnly?[{filter:'datum.season === selectedSeason && datum.grand_finals === 1'}]:[]),{filter:"(width >= 500 || mapZoom >= 2) && showCultural && datum.city === 'Geelong'"}],
   mark:{type:'text',clip:true,align:'right',dx:-12,dy:22,fontSize:15,color:ink},encoding:{...loc,text:{field:'city',type:'nominal'}}},
  {name:'cultural_gold_coast_label',data:table(finalistsOnly?'city_seasons':'cities'),transform:[...(finalistsOnly?[{filter:'datum.season === selectedSeason && datum.grand_finals === 1'}]:[]),{filter:"(width >= 500 || mapZoom >= 2) && showCultural && datum.city === 'Gold Coast'"}],
   mark:{type:'text',clip:true,align:'left',dx:12,dy:19,fontSize:15,color:ink},encoding:{...loc,text:{field:'city',type:'nominal'}}}
 ];
 const rateColor={field:'finals_rate',type:'quantitative',scale:{type:'threshold',domain:palette.thresholds,range:palette.colours},legend:null};
 // Limit titles to their panel: an overflowing title makes fit autosizing shrink
 // the projection again on every signal update at narrow screen widths.
 const mapTitle=text=>({text,anchor:'start',fontSize:15,color:ink,fontWeight:'normal',limit:{expr:'width'}});
 const save=(name,spec)=>write('js/'+name+'.json',{...base,usermeta:{layout:'map'},...spec});
 save('state_choropleth',{
  description:'State choropleth with a five-class ColorBrewer Greens palette and fixed, unequal thresholds at 30%, 40%, 50% and 100%, separating all observed state rates. Labels show clubs reaching finals / all clubs in each state. States without clubs remain grey and have no fraction label.',
  height:440,params:commonParams(true),projection,
  layer:[...physicalLayers(),
   {name:'state_rates',data:table('state_seasons'),transform:[{filter:'datum.season === selectedSeason'},
    {calculate:"datum.clubs > 0 ? format(datum.finals_rate, '.1f') + '%' : 'Not applicable'",as:'rate_label'},
    {lookup:'state_code',from:{data:borders,key:'properties.state_code'},as:'geo'}],
    mark:{type:'geoshape',clip:true,stroke:null,invalid:null},encoding:{shape:{field:'geo',type:'geojson'},
     color:{...rateColor,condition:{test:'datum.clubs === 0',value:'#dedfd5'}},
     tooltip:[{field:'state_name',type:'nominal',title:'State / territory'},{field:'season',type:'quantitative',format:'d',title:'Season'},
      {field:'clubs',type:'quantitative',title:'Clubs based here'},{field:'finals',type:'quantitative',title:'Clubs reaching finals'},
      {field:'rate_label',type:'nominal',title:'Finals rate'},{field:'coverage',type:'nominal',title:'Coverage'}]}},
   borderLayer(),
   {name:'state_count_labels',data:table('state_seasons'),transform:[{filter:'showCultural && datum.season === selectedSeason && datum.clubs > 0'},
    {calculate:"datum.finals + '/' + datum.clubs",as:'count_label'},
    {lookup:'state',from:{data:{values:stateLabels},key:'state',fields:['lon','lat']}},{filter:'isValid(datum.lon)'}],
    mark:{type:'text',clip:true,fontSize:15,fontWeight:600},encoding:{longitude:{field:'lon',type:'quantitative'},latitude:{field:'lat',type:'quantitative'},text:{field:'count_label',type:'nominal'},
     tooltip:[{field:'state_name',type:'nominal',title:'State'},{field:'season',type:'quantitative',format:'d',title:'Season'},
      {field:'finals',type:'quantitative',title:'Clubs reaching finals'},{field:'clubs',type:'quantitative',title:'All clubs in state'},
      {field:'finals_rate',type:'quantitative',format:'.1f',title:'Finals rate (%)'}],
     color:{condition:{test:`datum.finals_rate < ${palette.thresholds.at(-1)}`,value:'#000000'},value:'#ffffff'}}}
  ]
 });
 // Resolve continuous brush edges to inclusive, whole seasons. Even a narrow
 // drag between year ticks includes at least one year instead of an empty map.
 const periodFilter='usePeriod ? datum.season >= periodStart && datum.season <= periodEnd : datum.season === selectedSeason';
 const cityTransform=[{filter:periodFilter},
  {aggregate:[{op:'sum',field:'finals',as:'finals'},{op:'sum',field:'clubs',as:'club_seasons'},{op:'count',as:'season_count'},
   {op:'min',field:'season',as:'first'},{op:'max',field:'season',as:'last'}],groupby:['city','longitude','latitude']},
  {calculate:'datum.finals / datum.club_seasons * 100',as:'finals_rate'},
  {calculate:'datum.finals / datum.season_count',as:'finals_per_season'}];
 const cityTip=[{field:'city',type:'nominal',title:'Home city'},{field:'first',type:'quantitative',format:'d',title:'First season'},
  {field:'last',type:'quantitative',format:'d',title:'Last season'},{field:'finals',type:'quantitative',title:'Finals appearances'},
  {field:'club_seasons',type:'quantitative',title:'Club-seasons'},{field:'finals_per_season',type:'quantitative',format:'.2f',title:'Finalists per season'},
  {field:'finals_rate',type:'quantitative',format:'.1f',title:'Finals rate (%)'}];
 // Filter this layer by the same time selection as the circles. A single year
 // has one champion; hide the annotation when comparing several seasons.
 const championTransform=[{filter:periodFilter},
  {joinaggregate:[{op:'distinct',field:'season',as:'visible_seasons'}]},
  {filter:'datum.visible_seasons === 1 && datum.premierships > 0'}];
 const championText={type:'text',clip:true,fontSize:15,fontWeight:600,lineHeight:18,
  align:{expr:"mapZoom > 1 ? 'center' : datum.city === 'Perth' ? 'left' : 'right'"},
  dx:{expr:"mapZoom > 1 ? 0 : datum.city === 'Perth' ? 16 : width < 500 && (datum.city === 'Melbourne' || datum.city === 'Geelong') ? 24 : -16"},
  dy:{expr:"mapZoom > 1 ? -54 : datum.city === 'Perth' ? -52 : datum.city === 'Melbourne' || datum.city === 'Geelong' ? (width >= 500 ? 44 : -42) : -36"}};
 const championAnnotation={data:table('city_seasons'),transform:[...championTransform,
  {calculate:"[format(datum.season, 'd') + ' champions', datum.premier]",as:'champion_label'}],
  encoding:{...loc,text:{field:'champion_label',type:'nominal'}}};
 write('js/premiership_symbols.json',{
  '$schema':base.$schema,description:'A proportional-symbol map with Single season and Compare period modes. The period brush selects inclusive whole years; fractional endpoints resolve to their nearest seasons. Area shows finalists per season and colour shows finals rate. A diamond and annotation identify the champion when exactly one season is selected.',
  usermeta:{layout:'map-timeline'},padding:5,autosize:{type:'pad',resize:true},config:multiConfig,
  params:[...commonParams(true).map(param=>param.name==='mapZoom'?{...param,bind:{input:'range',min:1,max:8,step:0.25,name:'Zoom: ',element:'#city-zoom-control'}}:
   param.name==='selectedSeason'?{...param,bind:{...param.bind,element:'#city-season-control'}}:param),
   {name:'mapPan',value:[0,0]},
   {name:'usePeriod',value:false},
   {name:'periodStart',expr:'mapTimeBrush.season ? clamp(round(min(mapTimeBrush.season[0], mapTimeBrush.season[1])), 2012, 2025) : 2012'},
   {name:'periodEnd',expr:'mapTimeBrush.season ? clamp(round(max(mapTimeBrush.season[0], mapTimeBrush.season[1])), 2012, 2025) : 2025'}],spacing:28,
  vconcat:[
   {name:'city_map',width:900,height:440,projection:{...projection,scale:{expr:'mapZoom * min(width / 0.84, city_map_height / 0.72)'},translate:{expr:'[width * (0.5 + mapPan[0]), city_map_height * (0.5 + mapPan[1])]'}},
    layer:[...physicalLayers('city_map_height'),borderLayer(),
     {name:'city_symbols',data:table('city_seasons'),transform:cityTransform,
      mark:{type:'circle',clip:true,stroke:ink,strokeWidth:1,opacity:0.85},encoding:{...loc,color:rateColor,
       size:{field:'finals_per_season',type:'quantitative',scale:{domain:[0,9],range:[0,2400]},legend:null},tooltip:cityTip}},
     {name:'zero_city_symbols',data:table('city_seasons'),transform:[...cityTransform,{filter:'datum.finals === 0'}],
      mark:{type:'point',clip:true,shape:'circle',size:35,filled:false,stroke:ink,strokeWidth:1.2},encoding:{...loc,tooltip:cityTip}},
     {name:'premier_location',data:table('city_seasons'),transform:championTransform,
      mark:{type:'point',clip:true,shape:'diamond',filled:true,size:180,color:orange,stroke:'#ffffff',strokeWidth:1},
      encoding:{...loc,tooltip:[{field:'season',type:'quantitative',format:'d',title:'Season'},{field:'premier',type:'nominal',title:'Premier'},{field:'city',type:'nominal',title:'Home city'}]}},
     ...cityLabels(),
     {...championAnnotation,name:'champion_annotation_halo',mark:{...championText,fill:'#f3f2e9',stroke:'#f3f2e9',strokeWidth:4,aria:false}},
     {...championAnnotation,name:'champion_annotation',mark:{...championText,color:orange}}
    ]},
   {name:'map_overview',title:mapTitle('Melbourne finalists per season'),width:900,height:100,data:table('city_seasons'),
    transform:[{filter:"datum.city === 'Melbourne'"}],
    params:[{name:'mapTimeBrush',select:{type:'interval',encodings:['x'],mark:{fill:green,fillOpacity:0.14,stroke:green}}}],
    mark:{type:'line',point:true,color:green,strokeWidth:2.5},
    encoding:{x:{field:'season',type:'quantitative',scale:{domain:[2012,2025],nice:false,zero:false},axis:{title:null,format:'d',values:[2012,2015,2018,2021,2025],grid:false}},
     y:{field:'finals',type:'quantitative',scale:{domain:[0,5],nice:false},axis:{title:null,values:[0,1,2,3,4,5]}},
     tooltip:[{field:'season',type:'quantitative',format:'d',title:'Season'},{field:'finals',type:'quantitative',title:'Melbourne clubs reaching finals'},{field:'finalists',type:'nominal',title:'Clubs'}]}}
  ]
 });
 const sameCityMatchup={data:table('grand_finals'),transform:[
  {filter:'datum.season === selectedSeason && datum.winner_city === datum.runner_city'},
  {lookup:'winner_city',from:{data:table('cities'),key:'city',fields:['longitude','latitude']}},
  {calculate:"['Same-city final: ' + datum.winner_city, datum.winner + ' (Premier)', datum.runner_up + ' (Runner-up)']",as:'matchup_label'}]};
 const sameCityText={type:'text',clip:true,align:'right',dx:{expr:'width < 500 ? 30 : -28'},dy:-94,fontSize:15,fontWeight:600,lineHeight:20};
 save('grand_final_flows',{
  description:'A season-by-season connection map of the home cities of Grand Final opponents. A loop and direct club labels show opponents sharing the same home city. Lines and loops represent matchups, not travel.',
  usermeta:{layout:'connection-map'},
  height:400,params:commonParams(true),projection,
  layer:[...physicalLayers(),borderLayer(),
   {name:'annual_matchup',data:table('grand_final_seasons'),transform:[{filter:'datum.properties.season === selectedSeason'}],
    mark:{type:'geoshape',clip:true,filled:false,stroke:green,strokeWidth:3,opacity:0.8},
    encoding:{tooltip:[{field:'properties.season',type:'quantitative',format:'d',title:'Season'},{field:'properties.winner',type:'nominal',title:'Premier'},{field:'properties.runner_up',type:'nominal',title:'Runner-up'}]}},
   {...sameCityMatchup,name:'same_city_loop',
    mark:{type:'point',clip:true,shape:'M0,0 C-1.1,-0.55 -1.1,-1.65 0,-1.65 C1.1,-1.65 1.1,-0.55 0,0',size:2000,filled:false,stroke:green,strokeWidth:3,opacity:0.8},
    encoding:{...loc,tooltip:[{field:'season',type:'quantitative',format:'d',title:'Season'},{field:'winner_city',type:'nominal',title:'Shared home city'},
     {field:'winner',type:'nominal',title:'Premier'},{field:'runner_up',type:'nominal',title:'Runner-up'}]}},
   {name:'finalist_locations',data:table('grand_final_participants'),transform:[{filter:'datum.season === selectedSeason'}],
    mark:{type:'point',clip:true,strokeWidth:2},encoding:{...loc,
     shape:{field:'result',type:'nominal',scale:{domain:['Runner-up','Premier'],range:['circle','diamond']},legend:null},
     size:{condition:{test:"datum.result === 'Runner-up'",value:300},value:150},
     fill:{field:'result',type:'nominal',scale:{domain:['Runner-up','Premier'],range:['#f3f2e9',orange]},legend:null},stroke:{condition:{test:"datum.result === 'Premier'",value:orange},value:ink},
     tooltip:[{field:'team',type:'nominal',title:'Club'},{field:'result',type:'nominal',title:'Result'},{field:'city',type:'nominal',title:'Home city'}]}},
   ...cityLabels(true),
   {...sameCityMatchup,name:'same_city_annotation_halo',mark:{...sameCityText,fill:'#f3f2e9',stroke:'#f3f2e9',strokeWidth:4,aria:false},encoding:{...loc,text:{field:'matchup_label',type:'nominal'}}},
   {...sameCityMatchup,name:'same_city_annotation',mark:{...sameCityText,color:ink},encoding:{...loc,text:{field:'matchup_label',type:'nominal'}}}]
 });
};
