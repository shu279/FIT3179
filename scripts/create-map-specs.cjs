// Adapted from FIT3179 Week 8 maps and Week 10 2_interactive / 3_properties.
module.exports=function({base,config,multiConfig,ink,green,orange}){
 const fs=require('node:fs'),path=require('node:path');
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
 const physical=name=>({url:'data/natural_earth_physical.topojson',format:{type:'topojson',feature:name}});
 const borders={url:'data/natural_earth_states.topojson',format:{type:'topojson',feature:'states'}};
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
  {name:'physical_land',data:physical('land'),transform:[{filter:'showPhysical'}],mark:{type:'geoshape',clip:true,fill:'#e5e6da',stroke:'#adb7a5',strokeWidth:0.6}},
  {name:'reference_grid',data:physical('graticules'),transform:[{filter:'showPhysical'}],mark:{type:'geoshape',clip:true,filled:false,stroke:'#bccbca',strokeWidth:0.6,strokeDash:[3,3]}}
 ];
 const borderLayer=()=>({name:'cultural_borders',data:borders,transform:[{filter:'showCultural'}],mark:{type:'geoshape',clip:true,filled:false,stroke:'#748679',strokeWidth:0.8}});
 const stateLabels=[{state:'WA',lon:122,lat:-26},{state:'NT',lon:133,lat:-21},{state:'SA',lon:135,lat:-30},{state:'QLD',lon:145,lat:-22},{state:'NSW',lon:147,lat:-32},{state:'VIC',lon:143,lat:-36.7},{state:'TAS',lon:146.5,lat:-42}];
 const loc={longitude:{field:'longitude',type:'quantitative'},latitude:{field:'latitude',type:'quantitative'}};
 const cityLabels=(finalistsOnly=false)=>[
  // Restrict labels to the two participating home cities in the connection map.
  {name:'cultural_city_labels',data:table(finalistsOnly?'city_seasons':'cities'),transform:[...(finalistsOnly?[{filter:'datum.season === selectedSeason && datum.grand_finals > 0'}]:[]),{filter:"(width >= 500 || mapZoom >= 2) && showCultural && datum.city !== 'Geelong' && datum.city !== 'Gold Coast'"}],
   mark:{type:'text',clip:true,align:'left',dx:12,dy:-12,fontSize:15,color:ink},encoding:{...loc,text:{field:'city',type:'nominal'}}},
  {name:'cultural_geelong_label',data:table(finalistsOnly?'city_seasons':'cities'),transform:[...(finalistsOnly?[{filter:'datum.season === selectedSeason && datum.grand_finals > 0'}]:[]),{filter:"(width >= 500 || mapZoom >= 2) && showCultural && datum.city === 'Geelong'"}],
   mark:{type:'text',clip:true,align:'right',dx:-12,dy:22,fontSize:15,color:ink},encoding:{...loc,text:{field:'city',type:'nominal'}}},
  {name:'cultural_gold_coast_label',data:table(finalistsOnly?'city_seasons':'cities'),transform:[...(finalistsOnly?[{filter:'datum.season === selectedSeason && datum.grand_finals > 0'}]:[]),{filter:"(width >= 500 || mapZoom >= 2) && showCultural && datum.city === 'Gold Coast'"}],
   mark:{type:'text',clip:true,align:'left',dx:12,dy:19,fontSize:15,color:ink},encoding:{...loc,text:{field:'city',type:'nominal'}}}
 ];
 const rateColor={field:'finals_rate',type:'quantitative',scale:{type:'threshold',domain:palette.thresholds,range:palette.colours},legend:null};
 // Limit titles to their panel: an overflowing title makes fit autosizing shrink
 // the projection again on every signal update at narrow screen widths.
 const mapTitle=text=>({text,anchor:'start',fontSize:15,color:ink,fontWeight:'normal',limit:{expr:'width'}});
 const save=(name,spec)=>write('js/'+name+'.json',{...base,usermeta:{layout:'map'},...spec});
 save('state_choropleth',{
  description:'Week 10 long-table lookup and year selection, with Week 8 threshold classes. The map stays at a fixed national view with Natural Earth physical and cultural layers over a rectangular ocean background.',
  height:440,title:mapTitle({expr:"'State finals rate · ' + selectedSeason"}),params:commonParams(true),projection,
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
   {name:'cultural_state_labels',data:table('state_seasons'),transform:[{filter:'showCultural && datum.season === selectedSeason'},
    {lookup:'state',from:{data:{values:stateLabels},key:'state',fields:['lon','lat']}},{filter:'isValid(datum.lon)'}],
    mark:{type:'text',clip:true,fontSize:15,fontWeight:600},encoding:{longitude:{field:'lon',type:'quantitative'},latitude:{field:'lat',type:'quantitative'},text:{field:'state',type:'nominal'},
     color:{condition:{test:`datum.clubs > 0 && datum.finals_rate < ${palette.thresholds[0]}`,value:'#000000'},value:'#ffffff'}}}
  ]
 });
 // Week 10: the interval brush filters the map's data before aggregation.
 // The period checkbox lets readers switch back to the shared single-year view.
 const periodFilter={or:[{and:['usePeriod',{param:'mapTimeBrush'}]},'!usePeriod && datum.season === selectedSeason']};
 const cityTransform=[{filter:periodFilter},
  {aggregate:[{op:'sum',field:'finals',as:'finals'},{op:'sum',field:'clubs',as:'club_seasons'},{op:'count',as:'season_count'},
   {op:'min',field:'season',as:'first'},{op:'max',field:'season',as:'last'}],groupby:['city','longitude','latitude']},
  {calculate:'datum.finals / datum.club_seasons * 100',as:'finals_rate'},
  {calculate:'datum.finals / datum.season_count',as:'finals_per_season'}];
 const cityTip=[{field:'city',type:'nominal',title:'Home city'},{field:'first',type:'quantitative',format:'d',title:'First season'},
  {field:'last',type:'quantitative',format:'d',title:'Last season'},{field:'finals',type:'quantitative',title:'Finals appearances'},
  {field:'club_seasons',type:'quantitative',title:'Club-seasons'},{field:'finals_per_season',type:'quantitative',format:'.2f',title:'Finalists per season'},
  {field:'finals_rate',type:'quantitative',format:'.1f',title:'Finals rate (%)'}];
 write('js/premiership_symbols.json',{
  '$schema':base.$schema,description:'A proportional-symbol map linked to an interval brush. Area shows finalists per season, colour uses the same five finals-rate classes as the state map. A diamond identifies the selected season’s premier.',
  usermeta:{layout:'map-timeline'},padding:5,autosize:{type:'pad',resize:true},config:multiConfig,
  params:[...commonParams(true),{name:'usePeriod',value:false,bind:{input:'checkbox',name:'Compare the brushed period: '}}],spacing:28,
  vconcat:[
   {name:'city_map',width:900,height:440,projection:{...projection,scale:{expr:'mapZoom * min(width / 0.84, city_map_height / 0.72)'},translate:{expr:'[width / 2, city_map_height / 2]'}},
    layer:[...physicalLayers('city_map_height'),borderLayer(),
     {name:'city_symbols',data:table('city_seasons'),transform:cityTransform,
      mark:{type:'circle',clip:true,stroke:ink,strokeWidth:1,opacity:0.85},encoding:{...loc,color:rateColor,
       size:{field:'finals_per_season',type:'quantitative',scale:{domain:[0,9],range:[0,2400]},legend:null},tooltip:cityTip}},
     {name:'zero_city_symbols',data:table('city_seasons'),transform:[...cityTransform,{filter:'datum.finals === 0'}],
      mark:{type:'point',clip:true,shape:'circle',size:35,filled:false,stroke:ink,strokeWidth:1.2},encoding:{...loc,tooltip:cityTip}},
     {name:'premier_location',data:table('city_seasons'),transform:[{filter:'!usePeriod && datum.season === selectedSeason && datum.premierships > 0'}],
      mark:{type:'point',clip:true,shape:'diamond',filled:true,size:180,color:orange,stroke:'#ffffff',strokeWidth:1},
      encoding:{...loc,tooltip:[{field:'season',type:'quantitative',format:'d',title:'Season'},{field:'premier',type:'nominal',title:'Premier'},{field:'city',type:'nominal',title:'Home city'}]}},
     ...cityLabels()]},
   {name:'map_overview',title:mapTitle('Drag to select years'),width:900,height:100,data:table('city_seasons'),
    transform:[{filter:"datum.city === 'Melbourne'"}],
    params:[{name:'mapTimeBrush',select:{type:'interval',encodings:['x'],mark:{fill:green,fillOpacity:0.14,stroke:green}}}],
    mark:{type:'line',point:true,color:green,strokeWidth:2.5},
    encoding:{x:{field:'season',type:'quantitative',scale:{domain:[2012,2025],nice:false,zero:false},axis:{title:null,format:'d',values:[2012,2015,2018,2021,2025],grid:false}},
     y:{field:'finals',type:'quantitative',scale:{domain:[0,9]},axis:{title:null,values:[0,3,6,9]}},
     tooltip:[{field:'season',type:'quantitative',format:'d',title:'Season'},{field:'finals',type:'quantitative',title:'Melbourne clubs reaching finals'},{field:'finalists',type:'nominal',title:'Clubs'}]}}
  ]
 });
 save('grand_final_flows',{
  description:'A season-by-season connection map of the home cities of Grand Final opponents. The common year and map controls update it alongside the other maps. Lines represent matchups, not travel.',
  height:400,title:mapTitle({expr:"'Grand Final · ' + selectedSeason"}),params:commonParams(true),projection,
  layer:[...physicalLayers(),borderLayer(),
   {name:'annual_matchup',data:table('grand_final_seasons'),transform:[{filter:'datum.properties.season === selectedSeason'}],
    mark:{type:'geoshape',clip:true,filled:false,stroke:green,strokeWidth:3,opacity:0.8},
    encoding:{tooltip:[{field:'properties.season',type:'quantitative',format:'d',title:'Season'},{field:'properties.winner',type:'nominal',title:'Premier'},{field:'properties.runner_up',type:'nominal',title:'Runner-up'}]}},
   {name:'finalist_locations',data:table('grand_final_participants'),transform:[{filter:'datum.season === selectedSeason'}],
    mark:{type:'point',clip:true,strokeWidth:2},encoding:{...loc,
     shape:{field:'result',type:'nominal',scale:{domain:['Runner-up','Premier'],range:['circle','diamond']},legend:{title:null}},
     size:{condition:{test:"datum.result === 'Runner-up'",value:300},value:150},
     fill:{field:'result',type:'nominal',scale:{domain:['Runner-up','Premier'],range:['#f3f2e9',orange]},legend:{title:null}},stroke:{condition:{test:"datum.result === 'Premier'",value:orange},value:ink},
     tooltip:[{field:'team',type:'nominal',title:'Club'},{field:'result',type:'nominal',title:'Result'},{field:'city',type:'nominal',title:'Home city'}]}},
   ...cityLabels(true)]
 });
};
