// Generates the standalone, human-readable Vega-Lite/Vega specifications.
// These files can be opened independently in the Vega Editor with local data URLs replaced.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const summary = require('../data/team_summary.json');
const seasons = require('../data/team_seasons.json');
const order=summary.map(d=>d.team);
const ink='#21372b',green='#31553b',sage='#a8bd9c',orange='#c96636',muted='#747c6f',grid='#dedfd4';
const config={background:'transparent',font:'Helvetica Neue, Arial, sans-serif',view:{stroke:null},axis:{domain:false,tickColor:grid,gridColor:grid,labelColor:muted,titleColor:muted,titleFontWeight:'normal',labelFontSize:15,titleFontSize:15,labelPadding:9,titlePadding:14,labelOverlap:true,labelLimit:150},legend:{labelColor:ink,titleColor:muted,labelFontSize:15,titleFontSize:15,orient:'bottom',titleFontWeight:'normal',padding:8},range:{category:[green,orange,'#aa9148','#838c76','#637963']}};
const base={ '$schema':'https://vega.github.io/schema/vega-lite/v5.json',width:'container',height:360,autosize:{type:'fit',contains:'padding',resize:true},padding:5,config};
const data=url=>({url:'data/'+url+'.json'});
const field=(field,type='quantitative',extra={})=>({field,type,...extra});
const tip=(field,title,format)=>({field,title,...(format?{format}:{}),type:['team','city','band'].includes(field)?'nominal':'quantitative'});
const save=(name,spec)=>fs.writeFileSync(path.join(root,'specs',name+'.json'),JSON.stringify({...base,...spec},null,2)+'\n');
const focus=[{name:'focusTeam',value:'All clubs'}];
const focused={condition:{test:"focusTeam === 'All clubs' || datum.team === focusTeam",value:1},value:0.22};
const years=[2012,2015,2018,2021,2025];

// Each observation compares the same club in consecutive completed seasons.
const byClubSeason=new Map(seasons.map(d=>[`${d.id}:${d.season}`,d]));
const transitions=seasons.flatMap(d=>{
 const previous=byClubSeason.get(`${d.id}:${d.season-1}`);
 return previous?[{team:d.team,from_season:previous.season,season:d.season,previous_rank:previous.rank,rank:d.rank,change:previous.rank-d.rank,from_finals:previous.finalist,to_finals:d.finalist}]:[];
});
fs.writeFileSync(path.join(root,'data/season_transitions.json'),JSON.stringify(transitions,null,2)+'\n');
const transitionLinks=[];
const sourceOffsets={1:0,0:0},targetOffsets={1:0,0:0};
for(const from of [1,0])for(const to of [1,0]){
 const count=transitions.filter(d=>d.from_finals===from&&d.to_finals===to).length;
 transitionLinks.push({from,to,count,source_offset:sourceOffsets[from],target_offset:targetOffsets[to],label:from?(to?'Reached finals again':'Missed finals next year'):(to?'Returned to finals':'Missed finals both years'),color:from?(to?green:orange):(to?sage:'#d6dace')});
 sourceOffsets[from]+=count;targetOffsets[to]+=count;
}
fs.writeFileSync(path.join(root,'data/finals_transition_totals.json'),JSON.stringify(transitionLinks,null,2)+'\n');

save('rank_profiles',{
 description:'Number of seasons each club spent in the top four, fifth to eighth, or ninth to eighteenth on the regular-season ladder.',height:550,
 data:data('team_seasons'),
 transform:[{calculate:"datum.rank <= 4 ? 0 : datum.rank <= 8 ? 1 : 2",as:'band_order'}],
 mark:{type:'bar',stroke:'#f3f2e9',strokeWidth:1.5,size:20},
 encoding:{
  y:field('team','nominal',{sort:order,axis:{title:null,ticks:false}}),
  x:{aggregate:'count',type:'quantitative',stack:'zero',scale:{domain:[0,14]},axis:{title:'Seasons',values:[0,2,4,6,8,10,12,14]}},
  color:field('band','nominal',{scale:{domain:['Top four','5th–8th','9th–18th'],range:[green,sage,'#d6dace']},legend:null}),
  order:field('band_order'),
  tooltip:[tip('team','Club'),tip('band','Ladder group'),{aggregate:'count',type:'quantitative',title:'Seasons'}]
 }
});

save('rank_changes',{
 description:'Distribution of 234 year-to-year ladder changes across 18 clubs and 13 consecutive-season pairs. Positive values indicate improvement.',height:340,
 data:data('season_transitions'),
 mark:{type:'bar',stroke:'#f3f2e9',strokeWidth:1},
 encoding:{
  x:field('change','ordinal',{sort:'ascending',scale:{domain:Array.from({length:31},(_,i)=>i-15)},axis:{title:'Change in ladder places',labelAngle:0,labelExpr:"datum.value % 5 === 0 ? (datum.value > 0 ? '+' + datum.value : datum.value) : ''"}}),
  y:{aggregate:'count',type:'quantitative',axis:{title:'Club-season changes',tickMinStep:1}},
  color:{condition:[{test:'datum.change > 0',value:green},{test:'datum.change < 0',value:orange}],value:sage},
  tooltip:[tip('change','Places gained / lost','+d'),{aggregate:'count',type:'quantitative',title:'Club-season changes'}]
 }
});

// A two-stage Sankey: band width represents actual club-season transitions.
const finalsReturn={
 '$schema':'https://vega.github.io/schema/vega/v5.json',description:'Finals participation in one season and the next, pooling 2012–2013 through 2024–2025. Every link counts club-season transitions.',
 width:700,height:420,padding:0,autosize:{type:'none',resize:true},background:'transparent',
 signals:[
  {name:'top',value:66},{name:'gap',value:56},
  {name:'unit',update:`(height - top - gap - 12) / ${transitions.length}`},
  {name:'left',value:12},{name:'right',update:'width - 12'},{name:'barWidth',value:10},
  {name:'missedStart',update:`top + ${sourceOffsets[1]} * unit + gap`}
 ],
 data:[
  {name:'links',url:'data/finals_transition_totals.json',transform:[
   {type:'formula',expr:'(datum.from ? top : missedStart) + datum.source_offset * unit',as:'sy'},
   {type:'formula',expr:'(datum.to ? top : missedStart) + datum.target_offset * unit',as:'ty'},
   {type:'formula',expr:'datum.count * unit',as:'thickness'}
  ]},
  {name:'nodes',values:[0,1].flatMap(stage=>[1,0].map(finalist=>({stage,finalist,count:sourceOffsets[finalist],label:finalist?'Played finals':'Missed finals'})))},
  {name:'headers',values:[{stage:0,label:'This season'},{stage:1,label:'Next season'}]}
 ],
 marks:[
  {type:'path',from:{data:'links'},encode:{update:{
   path:{signal:"'M' + (left+barWidth) + ',' + datum.sy + ' C' + (width*.45) + ',' + datum.sy + ' ' + (width*.55) + ',' + datum.ty + ' ' + (right-barWidth) + ',' + datum.ty + ' L' + (right-barWidth) + ',' + (datum.ty+datum.thickness) + ' C' + (width*.55) + ',' + (datum.ty+datum.thickness) + ' ' + (width*.45) + ',' + (datum.sy+datum.thickness) + ' ' + (left+barWidth) + ',' + (datum.sy+datum.thickness) + ' Z'"},
   fill:{field:'color'},fillOpacity:{value:0.82},stroke:{value:'#f3f2e9'},strokeWidth:{value:1},
   tooltip:{signal:"{'Outcome':datum.label,'Club-season transitions':datum.count,'Share of starting group':format(datum.count / (datum.from ? "+sourceOffsets[1]+" : "+sourceOffsets[0]+"),'.1%')}"}
  },hover:{fillOpacity:{value:1}}}},
  {type:'rect',from:{data:'nodes'},encode:{update:{x:{signal:'datum.stage ? right-barWidth : left'},width:{signal:'barWidth'},y:{signal:'datum.finalist ? top : missedStart'},height:{signal:'datum.count * unit'},fill:{signal:"datum.finalist ? '#31553b' : '#a8bd9c'"}}}},
  {type:'text',from:{data:'headers'},encode:{update:{x:{signal:'datum.stage ? right : left'},y:{value:15},align:{signal:"datum.stage ? 'right' : 'left'"},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fontWeight:{value:600},fill:{value:ink},text:{field:'label'}}}},
  {type:'text',from:{data:'nodes'},encode:{update:{x:{signal:'datum.stage ? right : left'},y:{signal:'(datum.finalist ? top : missedStart) - 13'},align:{signal:"datum.stage ? 'right' : 'left'"},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fill:{value:ink},text:{field:'label'}}}}
 ]
};
fs.writeFileSync(path.join(root,'specs/finals_return.json'),JSON.stringify(finalsReturn,null,2)+'\n');


save('ladder_heatmap',{description:'Regular-season ladder position, sorted by seasons reaching finals. Highlight a club using the bound dropdown.',height:530,data:data('team_seasons'),
 // Week 9: a JSON parameter creates the dropdown; opacity highlights the selected club.
 params:[{...focus[0],bind:{input:'select',options:['All clubs',...order.slice().sort()],name:'Highlight a club: '}}],
 transform:[{calculate:"datum.premier === 1 ? 'Yes' : 'No'",as:'won_premiership'}],
 encoding:{x:field('season','ordinal',{axis:{title:null,labelAngle:0,labelFontSize:15,labelExpr:"width < 420 ? (datum.value == 2012 || datum.value == 2018 || datum.value == 2025 ? datum.label : '') : datum.label"}}),y:field('team','nominal',{sort:order,axis:{title:null,labelFontSize:15,ticks:false,labelLimit:150}})},layer:[{mark:{type:'rect',stroke:'#f4f3eb',strokeWidth:3,cornerRadius:2},encoding:{color:field('band','nominal',{scale:{domain:['Top four','5th–8th','9th–18th'],range:[green,sage,'#e4e6da']},legend:null}),opacity:focused,tooltip:[tip('team','Club'),tip('season','Season'),tip('rank','Ladder position'),tip('wins','Wins'),tip('win_rate','Win rate (%)','.1f'),{field:'won_premiership',type:'nominal',title:'Premier'}]}},{mark:{type:'text',fontSize:15,fontWeight:500},encoding:{text:{condition:{test:'width >= 420',field:'rank',type:'quantitative'},value:''},color:{condition:{test:'datum.rank <= 4',value:'#ffffff'},value:'#324533'},opacity:focused}},{transform:[{filter:'datum.premier === 1'}],mark:{type:'point',shape:'diamond',filled:true,size:19,color:orange},encoding:{opacity:focused,xOffset:{value:0},yOffset:{value:-10}}}]});

save('finals_frequency',{description:'Number of seasons in which each club played finals, out of 14.',height:475,data:data('team_summary'),params:focus,encoding:{y:field('team','nominal',{sort:order,axis:{title:null,ticks:false}}),x:field('finals','quantitative',{scale:{domain:[0,14]},axis:{title:'Seasons reaching finals',tickCount:8}}),opacity:focused,tooltip:[tip('team','Club'),tip('finals','Finals seasons'),tip('finals_rate','Share of seasons (%)','.1f')]},layer:[{mark:{type:'rule',strokeWidth:2,color:'#b8c4af'},encoding:{x2:{datum:0}}},{mark:{type:'point',filled:true,size:95,color:green}},{mark:{type:'text',align:'left',dx:9,fontSize:15,color:ink},encoding:{text:field('finals')}}]});

// Week 10: overview brush controls the detail domain and a separate aggregate view.
const journeyTeams=['Geelong','Hawthorn','Richmond','Brisbane Lions'];
const journeyColors=[green,'#ad8b42','#777f76',orange];
const multiConfig={...config,title:{fontSize:15,fontWeight:600,anchor:'start',color:ink,offset:14},header:{labelFontSize:15,labelColor:ink,labelFontWeight:600,titleFontSize:15}};
const saveMultiple=(name,spec)=>fs.writeFileSync(path.join(root,'specs',name+'.json'),JSON.stringify({
 '$schema':base.$schema,padding:5,autosize:{type:'pad',resize:true},config:multiConfig,...spec
},null,2)+'\n');
const journeyColor={field:'team',type:'nominal',scale:{domain:journeyTeams,range:journeyColors},legend:{title:null,columns:{expr:'width < 385 ? 1 : 2'},symbolType:'stroke',symbolStrokeWidth:3,labelLimit:180}};
const rankAxis={field:'rank',type:'quantitative',scale:{domain:[18.5,0.5],nice:false},axis:{title:'Ladder position',values:[1,4,8,12,18]}};
const journeyOpacity={condition:{param:'journeyClub',value:1},value:0.15};
saveMultiple('ladder_bump',{
 description:'Drag a season range in the overview to zoom the rank detail and compare pooled win rates for the same seasons. Legend selection highlights clubs across views.',
 data:data('team_seasons'),transform:[{filter:{field:'team',oneOf:journeyTeams}}],spacing:32,
 resolve:{scale:{x:'independent',y:'independent',color:'shared'}},
 vconcat:[
  {name:'journey_detail',title:['Ladder positions','in the selected period'],width:900,height:260,
   encoding:{x:field('season','quantitative',{scale:{domain:{param:'seasonBrush'},nice:false,zero:false},axis:{title:null,format:'d',tickMinStep:1,tickCount:6,grid:false}}),y:rankAxis,color:journeyColor,opacity:journeyOpacity,tooltip:[tip('team','Club'),tip('season','Season','d'),tip('rank','Ladder position')]},
   layer:[
    {params:[{name:'journeyClub',select:{type:'point',fields:['team']},bind:'legend'}],mark:{type:'line',clip:true,strokeWidth:2.8}},
    {mark:{type:'point',clip:true,filled:true,size:42}}
   ]},
  {name:'journey_overview',title:['Drag to select','a season range'],width:900,height:90,
   params:[{name:'seasonBrush',select:{type:'interval',encodings:['x'],mark:{fill:green,fillOpacity:0.12,stroke:green}}}],
   mark:{type:'line',strokeWidth:1.8},
   encoding:{x:field('season','quantitative',{scale:{domain:[2012,2025],nice:false,zero:false},axis:{title:null,format:'d',values:years,grid:false}}),y:{...rankAxis,axis:{title:null,values:[1,18]}},color:journeyColor,opacity:journeyOpacity}},
  {name:'journey_summary',title:['Games won','in the selected seasons'],width:900,height:145,
   transform:[{filter:{param:'seasonBrush'}},{aggregate:[{op:'sum',field:'wins',as:'wins'},{op:'sum',field:'played',as:'games'},{op:'count',as:'seasons'},{op:'min',field:'season',as:'first'},{op:'max',field:'season',as:'last'}],groupby:['team']},{calculate:'datum.wins / datum.games * 100',as:'period_win_rate'},{window:[{op:'rank',as:'period_rank'}],sort:[{field:'period_win_rate',order:'descending'}]}],
   encoding:{y:field('team','nominal',{scale:{domain:journeyTeams},axis:{title:null,ticks:false,labelLimit:150}}),x:field('period_win_rate','quantitative',{scale:{domain:[0,100]},axis:{title:['Games won','(%)'],values:[0,25,50,75,100]}}),color:journeyColor,opacity:journeyOpacity,tooltip:[tip('team','Club'),tip('first','First season','d'),tip('last','Last season','d'),tip('seasons','Seasons'),tip('wins','Wins'),tip('games','Games played'),tip('period_win_rate','Win rate (%)','.1f')]},
   layer:[{mark:{type:'bar',size:19}},{transform:[{filter:'datum.period_rank === 1'}],mark:{type:'text',align:'right',dx:-7,fontSize:15,fontWeight:600,color:'#ffffff'},encoding:{text:{value:'Best'},color:{value:'#ffffff'}}}]}
 ]
});

// Week 10: one shared template, split into club panels with fixed comparison scales.
const panelTeams=['Geelong','Sydney','Hawthorn','Richmond','Brisbane Lions','West Coast'];
saveMultiple('club_small_multiples',{
 description:'Six contrasting clubs on the same 2012–2025 time axis and 0–100% win-rate scale. A 50% reference line is shared by every panel.',
 data:data('team_seasons'),transform:[{filter:{field:'team',oneOf:panelTeams}}],
 facet:{field:'team',type:'nominal',sort:panelTeams,header:{title:null,labelOrient:'top',labelAnchor:'start',labelPadding:10}},columns:3,spacing:30,
 spec:{width:280,height:155,layer:[
  {data:{values:[{}]},mark:{type:'rule',color:'#9aa58e',strokeDash:[4,4]},encoding:{y:{datum:50}}},
  {mark:{type:'line',color:green,strokeWidth:2.5},encoding:{x:field('season','quantitative',{scale:{domain:[2012,2025],nice:false,zero:false},axis:{title:null,format:'d',values:[2012,2018,2025],grid:false}}),y:field('win_rate','quantitative',{scale:{domain:[0,100]},axis:{title:null,values:[0,50,100],labelExpr:"datum.value + '%'"}}),tooltip:[tip('team','Club'),tip('season','Season','d'),tip('win_rate','Games won (%)','.1f'),tip('rank','Ladder position')]}}
 ]}
});

const projection={type:'conicEqualArea',rotate:[-134,0,0],center:[0,-28],parallels:[-18,-36]};
const borders={url:'data/australia_states.topojson',format:{type:'topojson',feature:'states'}};
const mapBase={data:borders,mark:{type:'geoshape',fill:'#e3e6d9',stroke:'#f7f6ef',strokeWidth:1.2}};
const cityLabelLayer={data:data('cities'),transform:[{filter:'datum.grand_finals > 0'}],mark:{type:'text',align:'left',dx:7,dy:-8,fontSize:15,color:ink},encoding:{longitude:field('longitude'),latitude:field('latitude'),text:field('city','nominal')}};
// Week 10: preserve every state-year row, then attach the matching geometry.
const stateMetadata=require('../data/states.json');
const stateSeasons=Array.from({length:14},(_,i)=>2012+i).flatMap(season=>stateMetadata.map(state=>{
 const records=seasons.filter(d=>d.season===season&&d.state_code===state.state_code);
 const finals=records.reduce((n,d)=>n+d.finalist,0);
 return {season,state:state.state,state_name:state.state_name,state_code:state.state_code,clubs:records.length,finals,finals_rate:records.length?finals/records.length*100:null,coverage:records.length?'Clubs in this season':'No AFL club based here'};
}));
fs.writeFileSync(path.join(root,'data/state_seasons.json'),JSON.stringify(stateSeasons,null,2)+'\n');
const stateLabels=[{label:'WA',lon:122,lat:-26},{label:'NT',lon:133,lat:-21},{label:'SA',lon:135,lat:-30},{label:'QLD',lon:145,lat:-22},{label:'NSW',lon:147,lat:-32},{label:'VIC',lon:143,lat:-36.7},{label:'TAS',lon:146.5,lat:-42}];
save('state_choropleth',{
 description:'State finals participation by season, using a fixed 0–100% scale. Year, zoom and centre controls follow the Week 10 studio.',height:400,
 title:{text:{expr:"'Season ' + selectedSeason"},anchor:'start',fontSize:15,color:ink},
 params:[
  {name:'selectedSeason',value:2025,bind:{input:'range',min:2012,max:2025,step:1,name:'Season: '}},
  {name:'mapZoom',value:1,bind:{input:'range',min:1,max:3,step:0.25,name:'Zoom: '}},
  {name:'mapCentre',value:[0,-28],bind:{input:'select',options:[[0,-28],[13,-33],[-12,-26]],labels:['Australia','Eastern states','Western Australia'],name:'Centre: '}}
 ],
 projection:{...projection,center:{expr:'mapCentre'},scale:{expr:'mapZoom * min(width / 0.78, height / 0.66)'},translate:{expr:'[width / 2, height / 2]'}},
 layer:[
  {data:data('state_seasons'),transform:[{filter:'datum.season === selectedSeason'},{calculate:"datum.clubs > 0 ? format(datum.finals_rate, '.1f') + '%' : 'Not applicable'",as:'rate_label'},{lookup:'state_code',from:{data:borders,key:'properties.state_code'},as:'geo'}],
   mark:{type:'geoshape',clip:true,stroke:'#f7f6ef',strokeWidth:1.5,invalid:null},
   encoding:{shape:{field:'geo',type:'geojson'},color:{condition:{test:'datum.clubs === 0',value:'#dedfd5'},field:'finals_rate',type:'quantitative',scale:{domain:[0,100],range:['#edf0de','#acbf94','#31553b']},legend:{title:'Clubs reaching finals (%)',gradientLength:190}},tooltip:[{field:'state_name',type:'nominal',title:'State / territory'},tip('season','Season','d'),tip('clubs','Clubs'),tip('finals','Clubs reaching finals'),{field:'rate_label',title:'Finals rate',type:'nominal'},{field:'coverage',type:'nominal',title:'Coverage'}]}},
  {data:data('state_seasons'),transform:[{filter:'datum.season === selectedSeason'},{lookup:'state',from:{data:{values:stateLabels},key:'label',fields:['lon','lat']}},{filter:'isValid(datum.lon)'}],mark:{type:'text',clip:true,fontSize:15,fontWeight:700},encoding:{longitude:field('lon'),latitude:field('lat'),text:field('state','nominal'),color:{condition:{test:'datum.clubs > 0 && datum.finals_rate >= 65',value:'#ffffff'},value:ink}}}
 ]
});

const cityLabels=[{...cityLabelLayer,transform:[{filter:"datum.grand_finals > 0 && datum.city !== 'Geelong' && datum.city !== 'Melbourne'"}]},{...cityLabelLayer,transform:[{filter:"datum.city === 'Melbourne'"}],mark:{type:'text',align:'left',dx:15,dy:-6,fontSize:15,color:ink}},{...cityLabelLayer,transform:[{filter:"datum.city === 'Geelong'"}],mark:{type:'text',align:'right',dx:-7,dy:20,fontSize:15,color:ink}}];
save('premiership_symbols',{description:'Premiership totals aggregated by club home city. Circle area, not radius, represents title count. Melbourne and Geelong are separate cities.',height:360,projection,layer:[mapBase,{data:data('cities'),transform:[{filter:'datum.premierships > 0'}],mark:{type:'circle',color:orange,opacity:0.65,stroke:orange,strokeWidth:1},encoding:{longitude:field('longitude'),latitude:field('latitude'),size:field('premierships','quantitative',{scale:{domain:[0,9],range:[0,1700]},legend:{title:'Premierships',values:[1,3,9],orient:'bottom'}}),tooltip:[tip('city','Home city'),tip('clubs','Clubs'),tip('premierships','Premierships')]}},...cityLabels]});

save('grand_final_flows',{description:'Connections between the home cities of Grand Final opponents. Line width represents the number of matchups, not physical journeys. Same-city final excluded.',height:360,projection,layer:[mapBase,{data:data('finals_connections'),mark:{type:'geoshape',filled:false,stroke:green,opacity:0.65},encoding:{strokeWidth:field('properties.count','quantitative',{scale:{domain:[1,5],range:[1.5,9]},legend:{title:'Grand Final meetings',values:[1,3,5],orient:'bottom'}}),tooltip:[{field:'properties.pair',type:'nominal',title:'Club home cities'},{field:'properties.count',type:'quantitative',title:'Meetings'},{field:'properties.years',type:'nominal',title:'Seasons'}]}},{data:data('cities'),transform:[{filter:'datum.grand_finals > 0'}],mark:{type:'circle',color:green,opacity:1,size:45,stroke:'#f3f2e9',strokeWidth:1.5},encoding:{longitude:field('longitude'),latitude:field('latitude'),tooltip:[tip('city','Home city'),tip('grand_finals','Grand Final appearances')]}},...cityLabels]});

save('season_boxplot',{description:'Distribution of regular-season win rates for each club over 14 seasons. Box covers the middle half; line is median; whiskers cover the full range.',height:490,data:data('team_seasons'),encoding:{y:field('team','nominal',{sort:order,axis:{title:null,ticks:false}}),x:field('win_rate','quantitative',{scale:{domain:[0,100]},axis:{title:'Regular-season games won (%)',tickCount:6}})},mark:{type:'boxplot',extent:'min-max',size:13,color:sage,median:{color:green,strokeWidth:2},rule:{color:'#8f9f84'},ticks:{color:'#8f9f84'}}});

// Week 9: a range binding filters the data while keeping the club and year axes fixed.
save('finals_streaks',{
 description:'Consecutive runs of finals appearances. Use the slider to show runs of at least the selected number of seasons.',
 height:475,data:data('streaks'),
 params:[{name:'minimumRun',value:1,bind:{input:'range',min:1,max:7,step:1,name:'Minimum run (seasons): '}}],
 transform:[{filter:'datum.length >= minimumRun'}],
 encoding:{
  x:field('start','quantitative',{scale:{domain:[2011.5,2025.5],nice:false},axis:{title:null,format:'d',values:years,labelExpr:"width >= 300 || datum.value == 2012 || datum.value == 2018 || datum.value == 2025 ? datum.label : ''"}}),
  x2:field('end'),
  y:field('team','nominal',{sort:order,scale:{domain:order},axis:{title:null,ticks:false}}),
  color:field('length','quantitative',{scale:{domain:[1,7],range:['#b5c6a7',green]},legend:null}),
  tooltip:[tip('team','Club'),tip('first','First season','d'),tip('last','Last season','d'),tip('length','Consecutive finals seasons')]
 },
 mark:{type:'bar',size:13,cornerRadius:2}
});

save('era_change',{
 description:'Change in aggregate regular-season win rate from 2012–2018 to 2019–2025, in percentage points. Positive values indicate improvement.',
 height:475,data:data('team_summary'),layer:[
  {mark:{type:'bar',size:17},encoding:{
   y:field('team','nominal',{sort:{field:'change',order:'descending'},axis:{title:null,ticks:false}}),
   x:field('change','quantitative',{scale:{domain:[-45,45],nice:false},axis:{title:['Change in win rate','(percentage points)'],values:[-40,-20,0,20,40],format:'+d'}}),
   color:{condition:{test:'datum.change >= 0',value:green},value:orange},
   tooltip:[tip('team','Club'),tip('early_rate','2012–2018 win rate (%)','.1f'),tip('recent_rate','2019–2025 win rate (%)','.1f'),tip('change','Change (percentage points)','+.1f')]
  }},
  {data:{values:[{}]},mark:{type:'rule',color:ink,strokeWidth:1.2},encoding:{x:{datum:0}}}
 ]
});

// Radar axes all use percentages with a fixed 0–100 scale, never per-axis maxima.
const radarMetrics=[
 {field:'win_rate',label:'Games won'},
 {field:'finals_rate',label:'Finals'},
 {field:'top_four_rate',label:'Top four'},
 {field:'grand_final_rate',label:'Grand Finals'},
 {field:'premiership_rate',label:'Premierships'}
].map((d,i)=>({...d,angle:i*2*Math.PI/5-Math.PI/2}));
const polygonPath=ratio=>radarMetrics.map((d,i)=>
 `'${i?'L':'M'}' + (cx + radius * (${ratio(d)}) * cos(${d.angle})) + ',' + (cy + radius * (${ratio(d)}) * sin(${d.angle}))`
).join(" + ' ' + ")+" + ' Z'";
const successRadar={
 '$schema':'https://vega.github.io/schema/vega/v5.json',
 description:'Five measures of sustained success for Geelong and Hawthorn in 2012–2025. All axes use percentages from zero at the centre to 100 at the outer ring.',
 width:700,height:420,padding:0,autosize:{type:'none',resize:true},background:'transparent',
 signals:[{name:'cx',update:'width / 2'},{name:'cy',update:'height / 2'},
  {name:'radius',update:'max(50, min(160, (width - 160) / 2))'}],
 data:[
  {name:'profiles',url:'data/team_summary.json',transform:[
   {type:'filter',expr:"datum.team === 'Geelong' || datum.team === 'Hawthorn'"},
   {type:'formula',expr:'datum.top_four / datum.seasons * 100',as:'top_four_rate'},
   {type:'formula',expr:'datum.grand_finals / datum.seasons * 100',as:'grand_final_rate'},
   {type:'formula',expr:'datum.premierships / datum.seasons * 100',as:'premiership_rate'}
  ]},
  {name:'metrics',values:radarMetrics},
  {name:'rings',values:[{value:25},{value:50},{value:75},{value:100}]},
  {name:'tickLabels',source:'rings',transform:[{type:'filter',expr:'datum.value === 50 || datum.value === 100'}]}
 ],
 scales:[{name:'clubColor',type:'ordinal',domain:['Geelong','Hawthorn'],range:[green,orange]}],
 marks:[
  {type:'path',from:{data:'rings'},encode:{update:{
   path:{signal:polygonPath(()=> 'datum.value / 100')},fill:{value:null},stroke:{value:grid},strokeWidth:{value:1}
  }}},
  {type:'rule',from:{data:'metrics'},encode:{update:{
   x:{signal:'cx'},y:{signal:'cy'},x2:{signal:'cx + radius * cos(datum.angle)'},y2:{signal:'cy + radius * sin(datum.angle)'},stroke:{value:grid},strokeWidth:{value:1}
  }}},
  {type:'path',name:'clubProfiles',from:{data:'profiles'},encode:{update:{
   path:{signal:polygonPath(d=>`datum.${d.field} / 100`)},
   fill:{scale:'clubColor',field:'team'},fillOpacity:{value:0.1},stroke:{scale:'clubColor',field:'team'},strokeWidth:{value:3},
   strokeDash:{signal:"datum.team === 'Hawthorn' ? [7,4] : [1,0]"},
   tooltip:{signal:"{'Club':datum.team,'Games won':format(datum.win_rate / 100,'.1%'),'Seasons reaching finals':format(datum.finals / datum.seasons,'.1%'),'Seasons in top four':format(datum.top_four_rate / 100,'.1%'),'Seasons reaching Grand Final':format(datum.grand_final_rate / 100,'.1%'),'Seasons winning premiership':format(datum.premiership_rate / 100,'.1%')}"}
  },hover:{fillOpacity:{value:0.22},strokeWidth:{value:4}}}},
  {type:'text',from:{data:'tickLabels'},encode:{update:{
   x:{signal:'cx - 7'},align:{value:'right'},y:{signal:'cy - radius * datum.value / 100'},text:{signal:"datum.value + '%'"},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fill:{value:muted},baseline:{value:'middle'}
  }}},
  {type:'text',from:{data:'metrics'},encode:{update:{
   x:{signal:'cx + (radius + 30) * cos(datum.angle)'},y:{signal:'cy + (radius + 30) * sin(datum.angle)'},
   text:{field:'label'},lineBreak:{value:'\n'},lineHeight:{value:18},align:{value:'center'},baseline:{value:'middle'},
   font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fill:{value:ink}
  }}}
 ]
};
fs.writeFileSync(path.join(root,'specs/success_radar.json'),JSON.stringify(successRadar,null,2)+'\n');

const tree=[{team:'AFL',parent:null,premierships:0},...summary.filter(d=>d.premierships).map(d=>({team:d.team,parent:'AFL',premierships:d.premierships}))];
fs.writeFileSync(path.join(root,'data/premiership_tree.json'),JSON.stringify(tree,null,2)+'\n');
const treemap={
 '$schema':'https://vega.github.io/schema/vega/v5.json',description:'Every rectangle represents a premiership-winning club; its area is proportional to titles in 2012–2025.',width:600,height:330,padding:0,autosize:{type:'none',resize:true},background:'transparent',
 data:[{name:'tree',url:'data/premiership_tree.json',transform:[{type:'stratify',key:'team',parentKey:'parent'},{type:'treemap',field:'premierships',sort:{field:'value',order:'descending'},method:'squarify',ratio:1.4,size:[{signal:'width'},{signal:'height'}],paddingInner:5}]},{name:'leaves',source:'tree',transform:[{type:'filter',expr:'!datum.children'}]}],
 scales:[{name:'fill',type:'ordinal',domain:['Hawthorn','Richmond','Brisbane Lions','Geelong','Sydney','Collingwood','Western Bulldogs','West Coast','Melbourne'],range:['#a07740',green,'#a14e36','#496c4d','#65845d','#72876b','#839278','#506b51','#6b7e5c']}],
 marks:[{type:'rect',from:{data:'leaves'},encode:{enter:{stroke:{value:'#f3f2e9'},strokeWidth:{value:1}},update:{x:{field:'x0'},y:{field:'y0'},x2:{field:'x1'},y2:{field:'y1'},fill:{scale:'fill',field:'team'},tooltip:{signal:"{'Club':datum.team,'Premierships':datum.premierships,'Share of titles':format(datum.premierships/14,'.0%')}"}}}},
 {type:'text',from:{data:'leaves'},encode:{enter:{fill:{value:'#fffdf4'},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:32},fontWeight:{value:700},baseline:{value:'top'}},update:{x:{signal:'datum.x0 + 12'},y:{signal:'datum.y0 + 12'},text:{field:'premierships'}}}},
 {type:'text',from:{data:'leaves'},encode:{enter:{fill:{value:'#fffdf4'},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fontWeight:{value:500},baseline:{value:'bottom'}},update:{x:{signal:'datum.x0 + 12'},y:{signal:'datum.y1 - 13'},text:{field:'team'},limit:{signal:'datum.x1 - datum.x0 - 22'}}}}
 ]};
fs.writeFileSync(path.join(root,'specs/premiership_treemap.json'),JSON.stringify(treemap,null,2)+'\n');
console.log('Created 15 chart specs.');
