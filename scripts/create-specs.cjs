// Generates the standalone, human-readable Vega-Lite/Vega specifications.
// These files can be opened independently in the Vega Editor with local data URLs replaced.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const summary = require('../data/team_summary.json');
const seasons = require('../data/team_seasons.json');
const order=summary.map(d=>d.team);
const ink='#21372b',green='#31553b',sage='#a8bd9c',orange='#c96636',muted=ink,grid='#dedfd4';
const config={background:'transparent',font:'Helvetica Neue, Arial, sans-serif',view:{stroke:null},axis:{domain:false,tickColor:grid,gridColor:grid,labelColor:muted,titleColor:muted,titleFontWeight:'normal',labelFontSize:15,titleFontSize:15,labelPadding:9,titlePadding:14,labelOverlap:true,labelLimit:150},legend:{labelColor:ink,titleColor:muted,labelFontSize:15,titleFontSize:15,orient:'bottom',titleFontWeight:'normal',padding:8},range:{category:[green,orange,'#aa9148','#838c76','#637963']}};
const base={ '$schema':'https://vega.github.io/schema/vega-lite/v5.json',width:'container',height:360,autosize:{type:'fit',contains:'padding',resize:true},padding:5,config};
const data=url=>({url:'data/'+url+'.json'});
const field=(field,type='quantitative',extra={})=>({field,type,...extra});
const tip=(field,title,format)=>({field,title,...(format?{format}:{}),type:['team','city','band'].includes(field)?'nominal':'quantitative'});
const save=(name,spec)=>fs.writeFileSync(path.join(root,'js',name+'.json'),JSON.stringify({...base,...spec},null,2)+'\n');
const focus=[{name:'focusTeam',value:'All clubs'}];
const focused={condition:{test:"focusTeam === 'All clubs' || datum.team === focusTeam",value:1},value:0.22};
const years=[2012,2015,2018,2021,2025];
// Explanatory notes match the 15px body copy at every width.
// Shorten narrow-screen wording instead of shrinking or wrapping the text.
const note=(name,lines,x,y,extra={})=>({
 name,data:{values:[{}]},
 mark:{type:'text',align:'left',baseline:'top',lineHeight:19,lineBreak:'\n',color:ink,...extra,fontSize:15,fontWeight:'normal'},
 encoding:{x:{value:{expr:x}},y:{value:{expr:y}},text:{value:Array.isArray(lines)?lines.join('\n'):lines},
  tooltip:{value:null},opacity:{value:1},color:{value:ink}}
});
const leader=(name,x,y,x2,y2)=>({name,data:{values:[{}]},mark:{type:'rule',color:ink,strokeWidth:1},encoding:{x:{value:{expr:x}},y:{value:{expr:y}},x2:{value:{expr:x2}},y2:{value:{expr:y2}},tooltip:{value:null},opacity:{value:1},color:{value:ink}}});
const arrow=(name,x,y,shape)=>({name,data:{values:[{}]},mark:{type:'point',shape,filled:true,color:ink,size:35,opacity:1},encoding:{x:{value:{expr:x}},y:{value:{expr:y}},tooltip:{value:null},color:{value:ink}}});

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

save('rank_changes',{
 description:'Distribution of 234 year-to-year ladder changes across 18 clubs and 13 consecutive-season pairs. Positive values indicate improvement.',height:340,
 data:data('season_transitions'),
 layer:[{mark:{type:'bar',stroke:'#f3f2e9',strokeWidth:1}},
  note('rank_change_note',{expr:"width >= 500 ? '55% of yearly changes were within ±3 places (129 of 234).' : '55% stayed within ±3 places.'"},'width / 2','6',{align:'center'}),
  leader('rank_change_leader','width / 2','30',"scale('x',0) + bandwidth('x')/2", "scale('y',26) - 4"),
  arrow('rank_change_arrow',"scale('x',0) + bandwidth('x')/2","scale('y',26) - 4",'triangle-down'),
  leader('rank_change_bracket',"scale('x',-3)","scale('y',26)","scale('x',3) + bandwidth('x')","scale('y',26)"),
  leader('rank_change_bracket_left',"scale('x',-3)","scale('y',26)","scale('x',-3)","scale('y',25)"),
  leader('rank_change_bracket_right',"scale('x',3) + bandwidth('x')","scale('y',26)","scale('x',3) + bandwidth('x')","scale('y',25)")],
 encoding:{
  x:field('change','ordinal',{sort:'ascending',scale:{domain:Array.from({length:31},(_,i)=>i-15)},axis:{title:'Change in ladder places',labelAngle:0,labelExpr:"datum.value % 5 === 0 ? (datum.value > 0 ? '+' + datum.value : datum.value) : ''"}}),
  y:{aggregate:'count',type:'quantitative',scale:{domain:[0,36]},axis:{title:'Club-season changes',values:[0,5,10,15,20,25,30]}},
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
   color:field('band','nominal',{scale:{domain:['Top four','5th–8th','9th–18th'],range:[green,sage,'#e4e6da']},legend:null}),
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

const finalsNoteElbowY="(scale('y','Geelong') + scale('y','Sydney') + bandwidth('y')) / 2";
save('finals_frequency',{
 description:'Finals seasons out of fourteen. A single-line annotation points to Geelong and identifies its two missed seasons.',
 height:475,data:data('team_summary'),params:focus,
 encoding:{y:field('team','nominal',{sort:order,scale:{range:[0,{expr:'width < 300 ? height - 90 : height'}]},axis:{title:null,ticks:false}}),x:field('finals','quantitative',{scale:{domain:[0,18]},axis:{title:'Finals seasons',values:[0,4,8,12,14]}}),opacity:focused,tooltip:[tip('team','Club'),tip('finals','Finals seasons'),tip('finals_rate','Share of seasons (%)','.1f')]},
 layer:[
  {mark:{type:'rule',strokeWidth:2,color:'#b8c4af'},encoding:{x2:{datum:0}}},
  {mark:{type:'point',filled:true,size:95,color:green}},
  {transform:[{calculate:"datum.finals >= 11 ? datum.finals + '/14' : '' + datum.finals",as:'finals_label'}],mark:{type:'text',align:'left',dx:9,fontSize:15,color:ink},encoding:{text:field('finals_label','nominal')}},
  // Keep the leader outside the value labels, then approach Geelong from below.
  leader('finals_note_leader','width - 2','width < 300 ? height - 43 : height * .68 - 8','width - 2',finalsNoteElbowY),
  leader('finals_note_elbow','width - 2',finalsNoteElbowY,"scale('x',12)",finalsNoteElbowY),
  leader('finals_note_tip',"scale('x',12)",finalsNoteElbowY,"scale('x',12)","scale('y','Geelong') + bandwidth('y')/2 + 8"),
  {name:'finals_note_arrow',data:{values:[{}]},mark:{type:'point',shape:'triangle-up',filled:true,color:ink,size:35},encoding:{x:{value:{expr:"scale('x',12)"}},y:{value:{expr:"scale('y','Geelong') + bandwidth('y')/2 + 8"}},opacity:{value:1},tooltip:{value:null}}},
  note('finals_note','Missed finals in 2015 and 2023.','width - 6','width < 300 ? height - 35 : height * .68',{align:'right',fontSize:15})
 ]
});

// Week 10: overview brush controls the detail domain and a separate aggregate view.
const journeyTeams=['Geelong','Hawthorn','Richmond','Brisbane Lions'];
const journeyColors=[green,'#ad8b42','#777f76',orange];
const multiConfig={...config,title:{fontSize:15,fontWeight:600,anchor:'start',color:ink,offset:14},header:{labelFontSize:15,labelColor:ink,labelFontWeight:600,titleFontSize:15}};
const saveMultiple=(name,spec)=>fs.writeFileSync(path.join(root,'js',name+'.json'),JSON.stringify({
 '$schema':base.$schema,padding:5,autosize:{type:'pad',resize:true},config:multiConfig,...spec
},null,2)+'\n');
const journeyColor={field:'team',type:'nominal',scale:{domain:journeyTeams,range:journeyColors},legend:{title:null,orient:'right',columns:1,offset:16,padding:0,rowPadding:4,symbolType:'stroke',symbolStrokeWidth:3,labelLimit:180}};
const rankAxis={field:'rank',type:'quantitative',scale:{domain:[18.5,0.5],nice:false},axis:{title:'Ladder position',values:[1,4,8,12,18]}};
const journeyOpacity={condition:{param:'journeyClub',value:1},value:0.15};
// Wrap long panel titles on narrow screens to avoid scaling the SVG and its brush.
const journeyTitle=(text,lines)=>({text:{expr:'width < 200 ? '+JSON.stringify(lines)+' : '+JSON.stringify(text)}});
saveMultiple('ladder_bump',{
 description:'Drag a season range in the overview to zoom the rank detail and compare pooled win rates for the same seasons. Legend selection highlights clubs across views.',
 usermeta:{layout:'journey'},
 data:data('team_seasons'),transform:[{filter:{field:'team',oneOf:journeyTeams}}],spacing:24,
 params:[{name:'journeyClub',select:{type:'point',fields:['team']},bind:'legend',views:['journey_lines','journey_overview','journey_bars']},
  {name:'seasonBrush',select:{type:'interval',encodings:['x'],mark:{fill:green,fillOpacity:0.12,stroke:green}},views:['journey_overview']}],
 // Repeat the shared colour key beside every view, keeping selection linked.
 resolve:{scale:{x:'independent',y:'independent',color:'shared'},legend:{color:'independent'}},
 vconcat:[
  {name:'journey_detail',title:journeyTitle('Ladder positions in the selected period',['Ladder positions in','the selected period']),width:900,height:260,
   encoding:{x:field('season','quantitative',{scale:{domain:{param:'seasonBrush'},nice:false,zero:false},axis:{title:null,format:'d',tickMinStep:1,tickCount:6,grid:false}}),y:rankAxis,color:journeyColor,opacity:journeyOpacity,tooltip:[tip('team','Club'),tip('season','Season','d'),tip('rank','Ladder position')]},
   layer:[
    {name:'journey_lines',mark:{type:'line',clip:true,strokeWidth:2.8}},
    {mark:{type:'point',clip:true,filled:true,size:42}}
   ]},
  {name:'journey_summary',title:journeyTitle('Games won in the selected seasons',['Games won in the','selected seasons']),width:900,height:145,
   transform:[{filter:{param:'seasonBrush'}},{aggregate:[{op:'sum',field:'wins',as:'wins'},{op:'sum',field:'played',as:'games'},{op:'count',as:'seasons'},{op:'min',field:'season',as:'first'},{op:'max',field:'season',as:'last'}],groupby:['team']},{calculate:'datum.wins / datum.games * 100',as:'period_win_rate'},{window:[{op:'rank',as:'period_rank'}],sort:[{field:'period_win_rate',order:'descending'}]}],
   encoding:{y:field('team','nominal',{scale:{domain:journeyTeams},axis:{title:null,ticks:false,labelLimit:150}}),x:field('period_win_rate','quantitative',{scale:{domain:[0,100]},axis:{title:'Games won (%)',values:[0,25,50,75,100]}}),color:{...journeyColor,legend:{...journeyColor.legend,symbolType:'square',symbolSize:80}},opacity:journeyOpacity,tooltip:[tip('team','Club'),tip('first','First season','d'),tip('last','Last season','d'),tip('seasons','Seasons'),tip('wins','Wins'),tip('games','Games played'),tip('period_win_rate','Win rate (%)','.1f')]},
   layer:[{name:'journey_bars',mark:{type:'bar',size:19}},{transform:[{filter:'datum.period_rank === 1'}],mark:{type:'text',align:'right',dx:-7,fontSize:15,fontWeight:600,color:'#ffffff'},encoding:{text:{value:'Best'},color:{value:'#ffffff'}}}]},
  {name:'journey_overview',title:journeyTitle('Drag to select a season range',['Drag to select','a season range']),width:900,height:90,
   mark:{type:'line',strokeWidth:1.8},
   encoding:{x:field('season','quantitative',{scale:{domain:[2012,2025],nice:false,zero:false},axis:{title:null,format:'d',values:years,grid:false}}),y:{...rankAxis,axis:{title:null,values:[1,18]}},color:journeyColor,opacity:journeyOpacity}}
 ]
});

// Two distinct advanced idioms replace stacked bars and repeated line panels.
require('./create-advanced-specs.cjs')({root,seasons,ink,green,orange,sage});

// Week 8/10 map layers and coordinated time controls.
require('./create-map-specs.cjs')({base,config,multiConfig,ink,green,orange});

save('season_boxplot',{description:'Distribution of regular-season win rates for each club over 14 seasons. Box covers the middle half; line is median; whiskers cover the full range.',height:490,data:data('team_seasons'),encoding:{y:field('team','nominal',{sort:order,axis:{title:null,ticks:false}}),x:field('win_rate','quantitative',{scale:{domain:[0,100]},axis:{title:'Games won (%)',tickCount:6}})},mark:{type:'boxplot',extent:'min-max',size:13,color:sage,median:{color:green,strokeWidth:2},rule:{color:'#8f9f84'},ticks:{color:'#8f9f84'}}});

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
  color:field('length','quantitative',{scale:{domain:[1,7],range:['#b5c6a7',green]},legend:{title:'Consecutive finals seasons',titleLimit:260,titleFontWeight:600,titleOrient:'right',titleAngle:270,titleAnchor:'middle',titlePadding:10,orient:'right',direction:'vertical',gradientLength:220,gradientThickness:12,values:[1,3,5,7],offset:12}}),
  tooltip:[tip('team','Club'),tip('first','First season','d'),tip('last','Last season','d'),tip('length','Consecutive finals seasons')]
 },
 layer:[{mark:{type:'bar',size:18,cornerRadius:2}},{name:'longest_run_labels',transform:[{filter:'datum.length === 7'}],mark:{type:'text',fontSize:15,fontWeight:600,align:'center',baseline:'middle',color:'#ffffff'},encoding:{x2:null,x:{value:{expr:"(scale('x', datum.start) + scale('x', datum.end)) / 2"}},text:{value:{expr:"width >= 260 ? '7 seasons' : '7'"}},color:{value:'#ffffff'}}}]
});

save('era_change',{
 description:'Change in aggregate regular-season win rate from 2012–2018 to 2019–2025, in percentage points. Positive values indicate improvement.',
 height:475,data:data('team_summary'),layer:[
  {mark:{type:'bar',size:17},encoding:{
   y:field('team','nominal',{sort:{field:'change',order:'descending'},axis:{title:null,ticks:false}}),
   x:field('change','quantitative',{scale:{domain:[-45,45],nice:false},axis:{title:'Change (pp)',values:[-40,-20,0,20,40],format:'+d'}}),
   color:{condition:{test:'datum.change >= 0',value:orange},value:green},
   tooltip:[tip('team','Club'),tip('early_rate','2012–2018 win rate (%)','.1f'),tip('recent_rate','2019–2025 win rate (%)','.1f'),tip('change','Change (percentage points)','+.1f')]
  }},
  {data:{values:[{}]},mark:{type:'rule',color:ink,strokeWidth:1.2},encoding:{x:{datum:0}}},
  note('rise_note',{expr:"width >= 400 ? 'Brisbane +41.8 pp' : '+41.8 pp'"},'width * .24',"height * .16",{align:'center'}),
  leader('rise_leader','width * .24',"height * .16 - 8","scale('x',0) - 5","scale('y','Brisbane Lions') + bandwidth('y')/2"),
  note('fall_note',{expr:"width >= 400 ? 'West Coast −30.1 pp' : '−30.1 pp'"},'width * .76',"height * .72",{align:'center'}),
  leader('fall_leader','width * .76',"height * .72 + 25","scale('x',0) + 5","scale('y','West Coast') + bandwidth('y')/2"),
  {name:'rise_arrow',data:{values:[{}]},mark:{type:'point',shape:'triangle-right',filled:true,color:ink,size:35},encoding:{x:{value:{expr:"scale('x',0)-5"}},y:{value:{expr:"scale('y','Brisbane Lions') + bandwidth('y')/2"}}}},
  {name:'fall_arrow',data:{values:[{}]},mark:{type:'point',shape:'triangle-left',filled:true,color:ink,size:35},encoding:{x:{value:{expr:"scale('x',0)+5"}},y:{value:{expr:"scale('y','West Coast') + bandwidth('y')/2"}}}}
 ]
});

// Paired bars compare clubs within each metric, without joining unrelated measures.
const successMetrics=[
 {metric:'wins',label:'Games won (%)',side_label:'Games won (%)',small_label:'Games won\n(%)'},
 {metric:'finals',label:'Finals appearances (%)',side_label:'Finals\nappearances (%)',small_label:'Finals\nappearances\n(%)'},
 {metric:'top_four',label:'Top-four finishes (%)',side_label:'Top-four finishes\n(%)',small_label:'Top-four\nfinishes (%)'},
 {metric:'grand_finals',label:'Grand Final appearances (%)',side_label:'Grand Final\nappearances (%)',small_label:'Grand Final\nappearances\n(%)'},
 {metric:'premierships',label:'Premierships (%)',side_label:'Premierships (%)',small_label:'Premierships\n(%)'}
].map((d,order)=>({...d,order}));
const comparisonY="datum.order * 64 + (datum.team === 'Geelong' ? (compact ? 4 : 5) : (compact ? 34 : 29))";
const comparisonTip="{'Club':datum.team,'Measure':datum.label,'Percentage':format(datum.rate / 100,'.1%'),'Count':datum.numerator + ' / ' + datum.denominator,'Denominator':datum.metric === 'wins' ? 'Regular-season games played' : 'Completed seasons (2012–2025)'}";
const successComparison={
 '$schema':'https://vega.github.io/schema/vega/v5.json',
 description:'Paired horizontal bars compare Geelong and Hawthorn on five separate measures in 2012–2025. All bars share a fixed 0–100% scale, with percentages and counts directly labelled. Top-four finishes means regular-season ladder ranks 1–4 out of 14 seasons. Games won uses games played; all other measures use seasons.',
 width:700,height:360,padding:{top:4,left:4,right:4,bottom:36},autosize:{type:'none',contains:'padding',resize:true},background:'transparent',
 signals:[
  {name:'compact',update:'width < 600'},
  {name:'plotStart',update:'compact ? (width < 440 ? 110 : 160) : 240'},
  {name:'plotEnd',update:'compact ? width : width - 142'},
  {name:'plotWidth',update:'plotEnd - plotStart'},
  {name:'barHeight',update:'compact ? 10 : 18'}
 ],
 data:[
  {name:'metrics',values:successMetrics,transform:[{type:'formula',expr:'compact ? (width < 440 ? datum.small_label : datum.side_label) : datum.label',as:'display_label'}]},
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
  {name:'percentage',type:'linear',domain:[0,100],range:[{signal:'plotStart'},{signal:'plotEnd'}],zero:true,nice:false},
  {name:'clubColor',type:'ordinal',domain:['Geelong','Hawthorn'],range:[green,orange]}
 ],
 axes:[{scale:'percentage',orient:'bottom',values:{signal:'plotWidth < 210 ? [0,50,100] : [0,25,50,75,100]'},domain:false,grid:false,tickColor:grid,labelPadding:9,
  labelFont:'Helvetica Neue, Arial, sans-serif',labelFontSize:15,labelColor:ink,encode:{labels:{update:{text:{signal:"datum.value + '%'"},align:{signal:"datum.value === 0 ? 'left' : datum.value === 100 ? 'right' : 'center'"}}}}}],
 marks:[
  {name:'metric_labels',type:'text',interactive:false,from:{data:'metrics'},encode:{update:{
   x:{signal:'plotStart - 14'},y:{signal:"datum.order * 64 + (compact ? 32 : 26) - (length(split(datum.display_label,'\\n')) - 1) * 9"},text:{field:'display_label'},baseline:{value:'middle'},align:{value:'right'},lineBreak:{value:'\n'},lineHeight:{value:18},
   font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fontWeight:{value:600},fill:{value:ink}
  }}},
  {type:'rect',interactive:false,from:{data:'profiles'},encode:{update:{
   x:{signal:'plotStart'},x2:{signal:'plotEnd'},y:{signal:comparisonY},height:{signal:'barHeight'},fill:{value:'#e4e6da'},fillOpacity:{value:0.5}
  }}},
  {name:'profile_bars',type:'rect',from:{data:'profiles'},encode:{update:{
   x:{signal:'plotStart'},x2:{scale:'percentage',field:'rate'},y:{signal:comparisonY},height:{signal:'barHeight'},fill:{scale:'clubColor',field:'team'},
   fillOpacity:{value:1},tooltip:{signal:comparisonTip},aria:{value:true},
   description:{signal:"datum.team + ', ' + datum.label + ': ' + datum.value_label"}
  },hover:{fillOpacity:{value:0.8}}}},
  {name:'profile_values',type:'text',from:{data:'profiles'},encode:{update:{
   x:{signal:"compact ? plotStart : scale('percentage',datum.rate) + 8"},y:{signal:comparisonY+' + (compact ? 19 : 9)'},text:{field:'value_label'},baseline:{value:'middle'},
   font:{value:'Helvetica Neue, Arial, sans-serif'},fontSize:{value:15},fill:{value:ink},tooltip:{signal:comparisonTip}
  }}}
 ]
};
fs.writeFileSync(path.join(root,'js/success_comparison.json'),JSON.stringify(successComparison,null,2)+'\n');

const titleTotals=summary.filter(d=>d.premierships>0).map(d=>({team:d.team,premierships:d.premierships,
 title_years:seasons.filter(row=>row.team===d.team&&row.premier).map(row=>row.season).join(', ')}))
 .sort((a,b)=>b.premierships-a.premierships || a.team.localeCompare(b.team));
const totalsJSON=JSON.stringify(titleTotals,null,2)+'\n';
fs.writeFileSync(path.join(root,'data/premiership_totals.json'),totalsJSON);
const totalsVersion=crypto.createHash('sha256').update(totalsJSON).digest('hex').slice(0,12);
save('premiership_bars',{
 description:'Horizontal bars show the nine premiership-winning clubs in 2012–2025, ordered by title count. Hawthorn and Richmond each won three titles and are highlighted in orange. Bar lengths start at zero; direct labels show the count and tooltips list winning years.',
 height:380,data:{url:'data/premiership_totals.json?v='+totalsVersion},
 encoding:{
  y:field('team','nominal',{sort:titleTotals.map(d=>d.team),scale:{range:[0,{expr:'width < 500 ? height - 70 : height'}]},axis:{title:null,ticks:false,labelLimit:180}}),
  x:field('premierships','quantitative',{scale:{domain:[0,3],range:[0,{expr:'width - 24'}],nice:false},axis:{title:'Premierships',values:[0,1,2,3],format:'d',grid:false}}),
  tooltip:[tip('team','Club'),tip('premierships','Premierships'),{field:'title_years',type:'nominal',title:'Winning years'}]
 },
 layer:[
  {name:'title_bars',mark:{type:'bar',size:{expr:"min(26, bandwidth('y') * .8)"}},encoding:{color:{condition:{test:'datum.premierships === 3',value:orange},value:green}}},
  {name:'title_counts',mark:{type:'text',align:'left',dx:8,fontSize:15,fontWeight:500,color:ink},encoding:{text:field('premierships')}},
  {name:'winning_years',transform:[{filter:'datum.premierships >= 2 && width >= 400'}],mark:{type:'text',align:'left',fontSize:15,color:'#ffffff'},encoding:{x:{value:10},text:field('title_years','nominal')}},
  note('titles_note',{expr:"width >= 500 ? 'Hawthorn and Richmond won 6 of 14 titles.' : 'Together: 6 of 14 titles.'"},'width < 500 ? width - 8 : width * .68','width < 500 ? height - 35 : height * .6',{align:{expr:"width < 500 ? 'right' : 'center'"}}),
  leader('titles_note_elbow','width < 500 ? width - 4 : width * .68','width < 500 ? height - 43 : height * .6 - 8','width - 4','width < 500 ? height - 43 : height * .6 - 8'),
  leader('titles_leader','width - 4','width < 500 ? height - 43 : height * .6 - 8','width - 4',"scale('y','Hawthorn') + bandwidth('y') + 4"),
  ...['Hawthorn','Richmond'].flatMap((team,i)=>{
   const centre="scale('y','"+team+"') + bandwidth('y') / 2";
   const gap="scale('y','"+team+"') + bandwidth('y') + 4";
   const tip=centre+" + min(26, bandwidth('y') * .8) / 2 + 3";
   return [leader('titles_branch_'+i,'width - 4',gap,"scale('x',3) - 12",gap),
    leader('titles_stem_'+i,"scale('x',3) - 12",gap,"scale('x',3) - 12",tip),
    arrow('titles_arrow_'+i,"scale('x',3) - 12",tip,'triangle-up')];
  })
 ]
});
console.log('Created 15 chart specs.');
