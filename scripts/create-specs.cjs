// Generates the standalone, human-readable Vega-Lite/Vega specifications.
// These files can be opened independently in the Vega Editor with local data URLs replaced.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const summary = require('../data/team_summary.json');
const seasons = require('../data/team_seasons.json');
const order=summary.map(d=>d.team);
const ink='#21372b',green='#31553b',sage='#a8bd9c',orange='#c96636',lowerLadder='#c1c6b7',muted=ink,grid='#dedfd4';
const config={background:'transparent',font:'Helvetica Neue, Arial, sans-serif',view:{stroke:null},axis:{domain:false,tickColor:grid,gridColor:grid,labelColor:muted,titleColor:muted,titleFontWeight:'normal',labelFontSize:15,titleFontSize:15,labelPadding:9,titlePadding:14,labelOverlap:true,labelLimit:150},legend:{labelColor:ink,titleColor:muted,labelFontSize:15,titleFontSize:15,orient:'bottom',titleFontWeight:'normal',padding:8},range:{category:[green,orange,'#aa9148','#838c76','#637963']}};
const base={ '$schema':'https://vega.github.io/schema/vega-lite/v5.json',width:'container',height:360,autosize:{type:'fit',contains:'padding',resize:true},padding:5,config};
const data=url=>({url:'data/'+url+'.json'});
const field=(field,type='quantitative',extra={})=>({field,type,...extra});
const tip=(field,title,format)=>({field,title,...(format?{format}:{}),type:['team','city','band'].includes(field)?'nominal':'quantitative'});
const save=(name,spec)=>fs.writeFileSync(path.join(root,'js',name+'.json'),JSON.stringify({...base,...spec},null,2)+'\n');
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
 transitionLinks.push({from,to,count,source_offset:sourceOffsets[from],target_offset:targetOffsets[to],label:from?(to?'Reached finals again':'Missed finals next year'):(to?'Returned to finals':'Missed finals both years'),color:from?(to?orange:green):(to?sage:'#d6dace')});
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
  color:field('band','nominal',{scale:{domain:['Top four','5th–8th','9th–18th'],range:[green,sage,lowerLadder]},legend:null}),
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
  color:{condition:[{test:'datum.change > 0',value:orange},{test:'datum.change < 0',value:green}],value:sage},
  tooltip:[tip('change','Places gained / lost','+d'),{aggregate:'count',type:'quantitative',title:'Club-season changes'}]
 }
});

// A two-stage Sankey: band width represents actual club-season transitions.
const finalsReturn={
 '$schema':'https://vega.github.io/schema/vega/v5.json',description:'Finals participation in one season and the next, pooling 2012–2013 through 2024–2025. Every flow is labelled with its transition count and percentage of the starting group.',
 width:700,height:420,padding:0,autosize:{type:'none',resize:true},background:'transparent',
 signals:[
  {name:'top',value:66},{name:'gap',value:56},
  {name:'unit',update:`(height - top - gap - 12) / ${transitions.length}`},
  {name:'left',value:12},{name:'right',update:'width - 12'},{name:'barWidth',value:10},
  {name:'missedStart',update:`top + ${sourceOffsets[1]} * unit + gap`},
  // Locate labels on each cubic curve before the two changing-outcome flows cross.
  {name:'labelT',update:'width < 360 ? 0.15 : 0.25'},
  {name:'labelX',update:'pow(1-labelT,3)*(left+barWidth) + 3*pow(1-labelT,2)*labelT*width*.45 + 3*(1-labelT)*pow(labelT,2)*width*.55 + pow(labelT,3)*(right-barWidth)'}
 ],
 data:[
  {name:'links',url:'data/finals_transition_totals.json',transform:[
   {type:'joinaggregate',groupby:['from'],ops:['sum'],fields:['count'],as:['source_total']},
   {type:'formula',expr:'datum.count / datum.source_total',as:'share'},
   {type:'formula',expr:"datum.count + ' (' + format(datum.share, datum.count * 100 % datum.source_total ? '.1%' : '.0%') + ')'",as:'value_label'},
   {type:'formula',expr:'(datum.from ? top : missedStart) + datum.source_offset * unit',as:'sy'},
   {type:'formula',expr:'(datum.to ? top : missedStart) + datum.target_offset * unit',as:'ty'},
   {type:'formula',expr:'datum.count * unit',as:'thickness'},
   {type:'formula',expr:'datum.sy + (datum.ty-datum.sy) * (3*labelT*labelT - 2*labelT*labelT*labelT) + datum.thickness/2',as:'label_y'}
  ]},
  {name:'nodes',values:[0,1].flatMap(stage=>[1,0].map(finalist=>({stage,finalist,count:sourceOffsets[finalist],label:finalist?'Played finals':'Missed finals'})))},
  {name:'headers',values:[{stage:0,label:'This season'},{stage:1,label:'Next season'}]}
 ],
 marks:[
  {type:'path',from:{data:'links'},encode:{update:{
   path:{signal:"'M' + (left+barWidth) + ',' + datum.sy + ' C' + (width*.45) + ',' + datum.sy + ' ' + (width*.55) + ',' + datum.ty + ' ' + (right-barWidth) + ',' + datum.ty + ' L' + (right-barWidth) + ',' + (datum.ty+datum.thickness) + ' C' + (width*.55) + ',' + (datum.ty+datum.thickness) + ' ' + (width*.45) + ',' + (datum.sy+datum.thickness) + ' ' + (left+barWidth) + ',' + (datum.sy+datum.thickness) + ' Z'"},
   fill:{field:'color'},fillOpacity:{value:0.82},stroke:{value:'#f3f2e9'},strokeWidth:{value:1},
   tooltip:{signal:"{'Outcome':datum.label,'Club-season transitions':datum.count,'Starting-group transitions':datum.source_total,'Share of starting group':format(datum.share,'.1%')}"}
  },hover:{fillOpacity:{value:1}}}},
  {type:'rect',from:{data:'nodes'},encode:{update:{x:{signal:'datum.stage ? right-barWidth : left'},width:{signal:'barWidth'},y:{signal:'datum.finalist ? top : missedStart'},height:{signal:'datum.count * unit'},fill:{signal:"datum.finalist ? '#c96636' : '#a8bd9c'"}}}},
  {name:'flow_values',type:'text',interactive:false,from:{data:'links'},encode:{update:{x:{signal:'labelX'},y:{field:'label_y'},align:{value:'center'},baseline:{value:'middle'},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fontWeight:{value:600},fill:{signal:"datum.from && !datum.to ? '#ffffff' : '#21372b'"},text:{field:'value_label'}}}},
  {type:'text',from:{data:'headers'},encode:{update:{x:{signal:'datum.stage ? right : left'},y:{value:15},align:{signal:"datum.stage ? 'right' : 'left'"},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fontWeight:{value:600},fill:{value:ink},text:{field:'label'}}}},
  {type:'text',from:{data:'nodes'},encode:{update:{x:{signal:'datum.stage ? right : left'},y:{signal:'(datum.finalist ? top : missedStart) - 13'},align:{signal:"datum.stage ? 'right' : 'left'"},font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fill:{value:ink},text:{field:'label'}}}}
 ]
};
fs.writeFileSync(path.join(root,'js/finals_return.json'),JSON.stringify(finalsReturn,null,2)+'\n');


save('ladder_heatmap',{description:'Regular-season ladder position, sorted by seasons reaching finals. Every cell is filled by ladder position; an orange outline separately identifies the season champion. Highlight a club using the bound dropdown.',height:530,data:data('team_seasons'),
 // Week 9: a JSON parameter creates the dropdown; opacity highlights the selected club.
 params:[{...focus[0],bind:{input:'select',options:['All clubs',...order.slice().sort()],name:'Highlight a club: '}}],
 transform:[{calculate:"datum.premier === 1 ? 'Yes' : 'No'",as:'won_premiership'}],
 encoding:{x:field('season','ordinal',{axis:{title:null,labelAngle:0,labelFontSize:15,labelExpr:"width < 420 ? (datum.value == 2012 || datum.value == 2018 || datum.value == 2025 ? datum.label : '') : datum.label"}}),y:field('team','nominal',{sort:order,axis:{title:null,labelFontSize:15,ticks:false,labelLimit:150}}),
  tooltip:[tip('team','Club'),tip('season','Season'),tip('rank','Ladder position'),tip('wins','Wins'),tip('win_rate','Win rate (%)','.1f'),{field:'won_premiership',type:'nominal',title:'Season champion'}]},
 layer:[
  {name:'ladder_cells',mark:{type:'rect',stroke:'#f4f3eb',strokeWidth:3,cornerRadius:2},encoding:{
   color:field('band','nominal',{scale:{domain:['Top four','5th–8th','9th–18th'],range:[green,sage,lowerLadder]},legend:null}),
   opacity:focused
  }},
  {name:'champion_outlines',transform:[{filter:'datum.premier === 1'}],mark:{type:'rect',fill:null,stroke:orange,strokeWidth:2.5,cornerRadius:2},encoding:{opacity:focused}},
  {mark:{type:'text',fontSize:15,fontWeight:500},encoding:{
   text:{condition:{test:'width >= 420',field:'rank',type:'quantitative'},value:''},
   color:{condition:{test:'datum.rank <= 4',value:'#ffffff'},value:ink},
   opacity:focused
  }}
 ]
});

save('finals_frequency',{description:'Number of seasons in which each club played finals, out of 14.',height:475,data:data('team_summary'),params:focus,encoding:{y:field('team','nominal',{sort:order,axis:{title:null,ticks:false}}),x:field('finals','quantitative',{scale:{domain:[0,14]},axis:{title:'Seasons reaching finals',tickCount:8}}),opacity:focused,tooltip:[tip('team','Club'),tip('finals','Finals seasons'),tip('finals_rate','Share of seasons (%)','.1f')]},layer:[{mark:{type:'rule',strokeWidth:2,color:'#b8c4af'},encoding:{x2:{datum:0}}},{mark:{type:'point',filled:true,size:95,color:green}},{mark:{type:'text',align:'left',dx:9,fontSize:15,color:ink},encoding:{text:field('finals')}}]});

// Week 10: overview brush controls the detail domain and a separate aggregate view.
const journeyTeams=['Geelong','Hawthorn','Richmond','Brisbane Lions'];
const journeyColors=[green,'#ad8b42','#777f76',orange];
const multiConfig={...config,title:{fontSize:15,fontWeight:600,anchor:'start',color:ink,offset:14},header:{labelFontSize:15,labelColor:ink,labelFontWeight:600,titleFontSize:15}};
const saveMultiple=(name,spec)=>fs.writeFileSync(path.join(root,'js',name+'.json'),JSON.stringify({
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
  {name:'journey_detail',title:'Ladder positions in the selected period',width:900,height:260,
   encoding:{x:field('season','quantitative',{scale:{domain:{param:'seasonBrush'},nice:false,zero:false},axis:{title:null,format:'d',tickMinStep:1,tickCount:6,grid:false}}),y:rankAxis,color:journeyColor,opacity:journeyOpacity,tooltip:[tip('team','Club'),tip('season','Season','d'),tip('rank','Ladder position')]},
   layer:[
    {params:[{name:'journeyClub',select:{type:'point',fields:['team']},bind:'legend'}],mark:{type:'line',clip:true,strokeWidth:2.8}},
    {mark:{type:'point',clip:true,filled:true,size:42}}
   ]},
  {name:'journey_overview',title:'Drag to select a season range',width:900,height:90,
   params:[{name:'seasonBrush',select:{type:'interval',encodings:['x'],mark:{fill:green,fillOpacity:0.12,stroke:green}}}],
   mark:{type:'line',strokeWidth:1.8},
   encoding:{x:field('season','quantitative',{scale:{domain:[2012,2025],nice:false,zero:false},axis:{title:null,format:'d',values:years,grid:false}}),y:{...rankAxis,axis:{title:null,values:[1,18]}},color:journeyColor,opacity:journeyOpacity}},
  {name:'journey_summary',title:'Games won in the selected seasons',width:900,height:145,
   transform:[{filter:{param:'seasonBrush'}},{aggregate:[{op:'sum',field:'wins',as:'wins'},{op:'sum',field:'played',as:'games'},{op:'count',as:'seasons'},{op:'min',field:'season',as:'first'},{op:'max',field:'season',as:'last'}],groupby:['team']},{calculate:'datum.wins / datum.games * 100',as:'period_win_rate'},{window:[{op:'rank',as:'period_rank'}],sort:[{field:'period_win_rate',order:'descending'}]}],
   encoding:{y:field('team','nominal',{scale:{domain:journeyTeams},axis:{title:null,ticks:false,labelLimit:150}}),x:field('period_win_rate','quantitative',{scale:{domain:[0,100]},axis:{title:'Games won (%)',values:[0,25,50,75,100]}}),color:journeyColor,opacity:journeyOpacity,tooltip:[tip('team','Club'),tip('first','First season','d'),tip('last','Last season','d'),tip('seasons','Seasons'),tip('wins','Wins'),tip('games','Games played'),tip('period_win_rate','Win rate (%)','.1f')]},
   layer:[{mark:{type:'bar',size:19}},{transform:[{filter:'datum.period_rank === 1'}],mark:{type:'text',align:'right',dx:-7,fontSize:15,fontWeight:600,color:'#ffffff'},encoding:{text:{value:'Best'},color:{value:'#ffffff'}}}]}
 ]
});

// Week 10: one shared template, split into club panels with fixed comparison scales.
// Case studies: the two finals leaders, the two title leaders, and the largest
// rise/fall in pooled win rate among title winners (2012–2018 versus 2019–2025).
const panelTeams=['Geelong','Sydney','Hawthorn','Richmond','Brisbane Lions','West Coast'];
saveMultiple('club_small_multiples',{
 description:'Six selected case studies: Geelong and Sydney had the most finals appearances; Hawthorn and Richmond won the most titles; Brisbane Lions and West Coast had the largest rise and fall in pooled win rate among premiership winners, comparing 2012–2018 with 2019–2025. All panels share 2012–2025, a 0–100% win-rate scale and a 50% reference line.',
 data:data('team_seasons'),transform:[{filter:{field:'team',oneOf:panelTeams}}],
 facet:{field:'team',type:'nominal',sort:panelTeams,header:{title:null,labelOrient:'top',labelAnchor:'start',labelPadding:10}},columns:3,spacing:30,
 spec:{width:280,height:155,layer:[
  {data:{values:[{}]},mark:{type:'rule',color:'#9aa58e',strokeDash:[4,4]},encoding:{y:{datum:50}}},
  {mark:{type:'line',color:green,strokeWidth:2.5},encoding:{x:field('season','quantitative',{scale:{domain:[2012,2025],nice:false,zero:false},axis:{title:null,format:'d',values:[2012,2018,2025],grid:false}}),y:field('win_rate','quantitative',{scale:{domain:[0,100]},axis:{title:null,values:[0,50,100],labelExpr:"datum.value + '%'"}}),tooltip:[tip('team','Club'),tip('season','Season','d'),tip('win_rate','Games won (%)','.1f'),tip('rank','Ladder position')]}}
 ]}
});

// Week 8/10 map layers and coordinated time controls.
require('./create-map-specs.cjs')({base,config,multiConfig,ink,green,orange});

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
   x:field('change','quantitative',{scale:{domain:[-45,45],nice:false},axis:{title:'Change in win rate (percentage points)',values:[-40,-20,0,20,40],format:'+d'}}),
   color:{condition:{test:'datum.change >= 0',value:orange},value:green},
   tooltip:[tip('team','Club'),tip('early_rate','2012–2018 win rate (%)','.1f'),tip('recent_rate','2019–2025 win rate (%)','.1f'),tip('change','Change (percentage points)','+.1f')]
  }},
  {data:{values:[{}]},mark:{type:'rule',color:ink,strokeWidth:1.2},encoding:{x:{datum:0}}}
 ]
});

// Paired bars compare clubs within each metric, without joining unrelated measures.
const successMetrics=[
 {metric:'wins',label:'Games won (%)'},
 {metric:'finals',label:'Finals appearances (%)'},
 {metric:'top_four',label:'Top-four finishes (%)'},
 {metric:'grand_finals',label:'Grand Final appearances (%)'},
 {metric:'premierships',label:'Premierships (%)'}
].map((d,order)=>({...d,order}));
const comparisonY="datum.order * 100 + (datum.team === 'Geelong' ? 30 : 60)";
const comparisonTip="{'Club':datum.team,'Measure':datum.label,'Percentage':format(datum.rate / 100,'.1%'),'Count':datum.numerator + ' / ' + datum.denominator,'Denominator':datum.metric === 'wins' ? 'Regular-season games played' : 'Completed seasons (2012–2025)'}";
const successComparison={
 '$schema':'https://vega.github.io/schema/vega/v5.json',
 description:'Paired horizontal bars compare Geelong and Hawthorn on five separate measures in 2012–2025. All bars share a fixed 0–100% scale, with percentages and counts directly labelled. Top-four finishes means regular-season ladder ranks 1–4 out of 14 seasons. Games won uses games played; all other measures use seasons.',
 width:700,height:540,padding:{top:4,left:16,right:4,bottom:36},autosize:{type:'none',contains:'padding',resize:true},background:'transparent',
 signals:[{name:'plotWidth',update:'max(80, width - 160)'}],
 data:[
  {name:'metrics',values:successMetrics},
  {name:'profiles',url:'data/team_seasons.json',transform:[
   {type:'filter',expr:"datum.team === 'Geelong' || datum.team === 'Hawthorn'"},
   {type:'formula',expr:'datum.rank <= 4 ? 1 : 0',as:'top_four'},
   {type:'formula',expr:'datum.premier + datum.runner_up',as:'grand_final'},
   {type:'aggregate',groupby:['team'],fields:['wins','played','finalist','top_four','grand_final','premier',null],
    ops:['sum','sum','sum','sum','sum','sum','count'],as:['wins','played','finals','top_four','grand_finals','premierships','seasons']},
   {type:'fold',fields:successMetrics.map(d=>d.metric),as:['metric','numerator']},
   {type:'lookup',from:'metrics',key:'metric',fields:['metric'],values:['label','order']},
   {type:'formula',expr:"datum.metric === 'wins' ? datum.played : datum.seasons",as:'denominator'},
   {type:'formula',expr:'datum.numerator / datum.denominator * 100',as:'rate'},
   {type:'formula',expr:"format(datum.rate / 100, '.1%') + ' · ' + datum.numerator + '/' + datum.denominator",as:'value_label'}
  ]}
 ],
 scales:[
  {name:'percentage',type:'linear',domain:[0,100],range:[0,{signal:'plotWidth'}],zero:true,nice:false},
  {name:'clubColor',type:'ordinal',domain:['Geelong','Hawthorn'],range:[green,orange]}
 ],
 axes:[{scale:'percentage',orient:'bottom',values:{signal:'width < 400 ? [0,50,100] : [0,25,50,75,100]'},domain:false,grid:false,tickColor:grid,labelPadding:9,
  labelFont:'Helvetica Neue, Arial, sans-serif',labelFontSize:15,labelColor:ink,encode:{labels:{update:{text:{signal:"datum.value + '%'"}}}}}],
 marks:[
  {name:'metric_labels',type:'text',interactive:false,from:{data:'metrics'},encode:{update:{
   x:{value:0},y:{signal:'datum.order * 100'},text:{field:'label'},baseline:{value:'top'},
   font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fontWeight:{value:600},fill:{value:ink}
  }}},
  {type:'rect',interactive:false,from:{data:'profiles'},encode:{update:{
   x:{value:0},x2:{signal:'plotWidth'},y:{signal:comparisonY},height:{value:20},fill:{value:'#e4e6da'},fillOpacity:{value:0.5}
  }}},
  {name:'profile_bars',type:'rect',from:{data:'profiles'},encode:{update:{
   x:{value:0},x2:{scale:'percentage',field:'rate'},y:{signal:comparisonY},height:{value:20},fill:{scale:'clubColor',field:'team'},
   fillOpacity:{value:1},tooltip:{signal:comparisonTip},aria:{value:true},
   description:{signal:"datum.team + ', ' + datum.label + ': ' + datum.value_label"}
  },hover:{fillOpacity:{value:0.8}}}},
  {name:'profile_values',type:'text',from:{data:'profiles'},encode:{update:{
   x:{scale:'percentage',field:'rate',offset:8},y:{signal:comparisonY+' + 10'},text:{field:'value_label'},baseline:{value:'middle'},
   font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fill:{value:ink},tooltip:{signal:comparisonTip}
  }}}
 ]
};
fs.writeFileSync(path.join(root,'js/success_comparison.json'),JSON.stringify(successComparison,null,2)+'\n');

const tree=[{team:'AFL',parent:null,premierships:0},...summary.filter(d=>d.premierships).map(d=>({team:d.team,parent:'AFL',premierships:d.premierships,short_name:d.id,
 title_years:seasons.filter(row=>row.team===d.team&&row.premier).map(row=>row.season).join(', ')}))];
const treeJSON=JSON.stringify(tree,null,2)+'\n';
fs.writeFileSync(path.join(root,'data/premiership_tree.json'),treeJSON);
const treeVersion=crypto.createHash('sha256').update(treeJSON).digest('hex').slice(0,12);
const bubbleTip="{'Club':datum.team,'Premierships':datum.premierships,'Winning years':datum.title_years,'Share of titles':format(datum.premierships/14,'.1%')}";
const bubbleText={signal:"datum.premierships === 3 ? '#111111' : '#fffdf4'"};
const bubbles={
 '$schema':'https://vega.github.io/schema/vega/v5.json',description:'Packed bubbles showing nine premiership-winning clubs in 2012–2025. Circle area is proportional to titles. Hawthorn and Richmond are highlighted in orange.',width:600,padding:0,autosize:{type:'none',resize:true},background:'transparent',
 signals:[{name:'height',update:'min(width, 640)'}],
 data:[{name:'tree',url:'data/premiership_tree.json?v='+treeVersion,transform:[{type:'stratify',key:'team',parentKey:'parent'},
  {type:'pack',field:'premierships',sort:{field:['value','data.team'],order:['descending','ascending']},size:[{signal:'width'},{signal:'height'}],padding:6}]},
  {name:'leaves',source:'tree',transform:[{type:'filter',expr:'!datum.children'}]}],
 marks:[
  {name:'title_bubbles',type:'symbol',from:{data:'leaves'},encode:{enter:{shape:{value:'circle'},cursor:{value:'pointer'}},
   update:{x:{field:'x'},y:{field:'y'},size:{signal:'4 * datum.r * datum.r'},fill:[{test:'datum.premierships === 3',value:orange},{value:green}],
    stroke:{value:ink},strokeWidth:{value:0},tooltip:{signal:bubbleTip},aria:{value:true},description:{signal:"datum.team + ': ' + datum.premierships + ' premierships, won in ' + datum.title_years"}},
   hover:{strokeWidth:{value:2}}}},
  {type:'text',interactive:false,from:{data:'leaves'},encode:{enter:{font:{value:'Helvetica Neue, Arial, sans-serif'},fontWeight:{value:700},align:{value:'center'},baseline:{value:'middle'}},
   update:{x:{field:'x'},y:{field:'y'},dy:{signal:'datum.r < 50 ? -10 : -18'},fontSize:{signal:'max(22, min(52, datum.r * 0.55))'},fill:bubbleText,text:{field:'premierships'}}}},
  {type:'text',interactive:false,from:{data:'leaves'},encode:{enter:{font:{value:'Helvetica Neue, Arial, sans-serif'},fontWeight:{value:500},align:{value:'center'},baseline:{value:'middle'},lineHeight:{value:20}},
   update:{x:{field:'x'},y:{field:'y'},dy:{signal:'datum.r < 50 ? 14 : 18'},fontSize:{signal:'width < 500 ? 15 : 18'},fill:bubbleText,
    text:{signal:"datum.r < 50 ? datum.short_name : (datum.team === 'Brisbane Lions' || datum.team === 'Western Bulldogs') ? split(datum.team, ' ') : datum.team"}}}}
 ]};
fs.writeFileSync(path.join(root,'js/premiership_bubbles.json'),JSON.stringify(bubbles,null,2)+'\n');
console.log('Created 15 chart specs.');
