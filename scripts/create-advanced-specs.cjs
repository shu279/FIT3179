// Treemap and folded horizon views, derived from the same club-season records.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

module.exports=({root,seasons,ink,green,orange,sage})=>{
 const write=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
 const versioned=file=>file+'?v='+crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,12);
 const font='Helvetica Neue, Arial, sans-serif';
 const base={$schema:'https://vega.github.io/schema/vega/v5.json',background:'transparent',width:700,autosize:{type:'none',contains:'padding',resize:true}};

 const topFour=[...new Set(seasons.map(d=>d.team))].map(team=>{
  const rows=seasons.filter(d=>d.team===team&&d.rank<=4);
  return {id:team,parent:'all',team,abbreviation:seasons.find(d=>d.team===team).id,count:rows.length,years:rows.map(d=>d.season).join(', '),label:team.replaceAll(' ','\n'),longest_word:Math.max(...team.split(' ').map(word=>word.length))};
 }).filter(d=>d.count>0).sort((a,b)=>b.count-a.count||a.team.localeCompare(b.team));
 write('data/top_four_finishes.json',[{id:'all',parent:null,count:0},...topFour]);
 const treeTip="{'Club':datum.team,'Top-four finishes':datum.count + ' of 14 seasons','Share of all 56 top-four places':format(datum.count / 56,'.1%'),'Seasons':datum.years}";
 const shortTile='datum.y1-datum.y0 < 80 && datum.x1-datum.x0 >= 90';
 const labelWidth='datum.x1-datum.x0 - ('+shortTile+' ? 54 : datum.x1-datum.x0 < 64 ? 8 : 20)';
 write('js/top_four_treemap.json',{
  ...base,height:475,padding:4,
  description:'Treemap of the 56 top-four ladder places across 2012–2025. Rectangle area is proportional to each club’s count. Geelong, the largest contributor, is orange. Only the twelve clubs with a top-four finish are shown.',
  data:[
   {name:'tree',url:versioned('data/top_four_finishes.json'),transform:[
    {type:'stratify',key:'id',parentKey:'parent'},
    {type:'treemap',field:'count',sort:{field:'value',order:'descending'},method:'squarify',ratio:1.3,size:[{signal:'width'},{signal:'height'}],round:false,padding:0}
   ]},
   {name:'leaves',source:'tree',transform:[
    {type:'filter',expr:'datum.depth === 1'},
    {type:'formula',as:'display_label',expr:labelWidth+" >= length(datum.team)*8 ? datum.team : datum.y1-datum.y0 > 95 && "+labelWidth+" >= datum.longest_word*8 ? datum.label : datum.abbreviation"},
    {type:'formula',as:'label_lines',expr:"length(split(datum.display_label,'\\n'))"}
   ]}
  ],
  marks:[
   {name:'top_four_tiles',type:'rect',from:{data:'leaves'},encode:{update:{
    x:{field:'x0'},x2:{field:'x1'},y:{field:'y0'},y2:{field:'y1'},
    fill:{signal:"datum.team === 'Geelong' ? '"+orange+"' : '"+green+"'"},stroke:{value:'#f3f2e9'},strokeWidth:{value:3},tooltip:{signal:treeTip},
    description:{signal:"datum.team + ': ' + datum.count + ' top-four finishes, in ' + datum.years"}
   },hover:{fillOpacity:{value:0.85}}}},
   {name:'top_four_counts',type:'text',interactive:false,from:{data:'leaves'},encode:{update:{
    x:{signal:'datum.x0 + 10'},y:{signal:shortTile+' ? (datum.y0+datum.y1)/2 : datum.y0+8'},baseline:{signal:shortTile+" ? 'middle' : 'top'"},text:{field:'count'},font:{value:font},fontSize:{signal:shortTile+' ? 22 : 26'},fontWeight:{value:600},fill:{signal:"datum.team === 'Geelong' ? '"+ink+"' : '#ffffff'"}
   }}},
   {name:'top_four_clubs',type:'text',interactive:false,from:{data:'leaves'},encode:{update:{
    x:{signal:'datum.x1-datum.x0 < 64 ? (datum.x0+datum.x1)/2 : datum.x0 + ('+shortTile+' ? 44 : 10)'},align:{signal:"datum.x1-datum.x0 < 64 ? 'center' : 'left'"},y:{signal:shortTile+" ? (datum.y0+datum.y1)/2 : datum.y1 - 10 - (datum.label_lines-1)*18"},
    baseline:{signal:shortTile+" ? 'middle' : 'bottom'"},text:{field:'display_label'},
    lineBreak:{value:'\n'},lineHeight:{value:18},font:{value:font},fontSize:{value:15},fill:{signal:"datum.team === 'Geelong' ? '"+ink+"' : '#ffffff'"}
   }}},
   {name:'geelong_top_four_note',type:'text',interactive:false,from:{data:'leaves'},encode:{update:{
    x:{signal:'datum.x0 + 10'},y:{signal:'datum.y0 + 46'},text:{signal:"datum.team === 'Geelong' ? 'of 14\\nseasons' : ''"},
    lineBreak:{value:'\n'},lineHeight:{value:18},font:{value:font},fontSize:{value:15},fill:{value:ink}
   }}}
  ]
 });

 // Interpolate only the drawing at each fold boundary. Tooltips and values use
 // observed seasons, never these synthetic crossing points.
 const teams=['Geelong','Sydney','Hawthorn','Richmond','Brisbane Lions','West Coast'];
 const curves=[];
 for(const team of teams){
  const rows=seasons.filter(d=>d.team===team).sort((a,b)=>a.season-b.season);
  rows.forEach((d,index)=>{
   const rate=d.wins/d.played*100;
   if(index){
    const prev=rows[index-1],previous=prev.wins/prev.played*100;
    const crossings=[25,50,75].filter(c=>c>Math.min(previous,rate)&&c<Math.max(previous,rate))
     .map(c=>({team,season:prev.season+(c-previous)/(rate-previous),rate:c,observed:false})).sort((a,b)=>a.season-b.season);
    curves.push(...crossings);
   }
   curves.push({team,season:d.season,rate,observed:true});
  });
 }
 write('data/club_win_rate_horizon.json',curves);
 const folds=[
  {name:'band_0_25',expr:'clamp(datum.rate,0,25)',color:'#d6dace'},
  {name:'band_25_50',expr:'clamp(datum.rate-25,0,25)',color:sage},
  {name:'band_50_75',expr:'clamp(datum.rate-50,0,25)',color:green},
  {name:'band_75_100',expr:'clamp(datum.rate-75,0,25)',color:orange}
 ];
 const rowNotes=[
  ['Most finals appearances:','12 of 14 seasons.'],
  ['Second-most finals appearances:','11 of 14 seasons.'],
  ['Three consecutive titles:','2013, 2014 and 2015.'],
  ['Three titles:','2017, 2019 and 2020.'],
  ['Largest rise among title winners:','+41.8 percentage points.'],
  ['Largest fall among title winners:','−30.1 percentage points.']
 ];
 const horizonTip="{'Club':datum.team,'Season':datum.season,'Games won':format(datum.wins/datum.played,'.1%'),'Record':datum.wins + ' wins / ' + datum.played + ' games','Ladder position':datum.rank}";
 write('js/club_horizon.json',{
  ...base,height:944,padding:{top:12,left:4,right:4,bottom:38},
  description:'Six horizon strips show absolute annual win rates from 0 to 100%, folded into four consecutive 25-percentage-point bands. Higher bands overlay lower bands in pale green, sage, dark green and orange. A full band has a flat upper edge, inset from the row boundary. All six strips count as one chart. Interpolated fold crossings are for drawing only; hover reports real season records.',
  signals:[{name:'detailSeason',value:2025,on:[{events:'@season_targets:pointermove, @season_targets:click',update:'datum.season'}]}],
  data:[
   {name:'curves',url:versioned('data/club_win_rate_horizon.json'),transform:folds.map(f=>({type:'formula',expr:f.expr,as:f.name}))},
   {name:'records',url:'data/team_seasons.json',transform:[{type:'filter',expr:'indexof('+JSON.stringify(teams)+',datum.team) >= 0'}]},
   ...teams.flatMap((team,i)=>[
    {name:'curve_'+i,source:'curves',transform:[{type:'filter',expr:'datum.team === '+JSON.stringify(team)}]},
    {name:'records_'+i,source:'records',transform:[{type:'filter',expr:'datum.team === '+JSON.stringify(team)}]},
    {name:'detail_'+i,source:'records_'+i,transform:[{type:'filter',expr:'datum.season === detailSeason'}]}
   ])
  ],
  scales:[{name:'year',type:'linear',domain:[2012,2025],range:'width',zero:false,nice:false}],
  axes:[{scale:'year',orient:'bottom',values:{signal:'width >= 700 ? sequence(2012,2026) : [2012,2018,2025]'},format:'d',domain:false,tickColor:'#cdd2c2',labelPadding:9,labelFont:font,labelFontSize:15,labelColor:ink,
   encode:{labels:{update:{align:{signal:"datum.value === 2012 ? 'left' : datum.value === 2025 ? 'right' : 'center'"}}}}}],
  marks:teams.map((team,i)=>({
   name:'horizon_row_'+i,type:'group',encode:{update:{x:{value:0},y:{value:i*148+28},width:{signal:'width'},height:{value:64}}},
   scales:[{name:'band',type:'linear',domain:[0,25],range:[58,6],zero:true,nice:false}],
   marks:[
    {type:'text',interactive:false,encode:{update:{x:{value:0},y:{value:-8},text:{value:team},font:{value:font},fontSize:{value:15},fontWeight:{value:600},fill:{value:ink}}}},
    {name:'season_readout_'+i,type:'text',interactive:false,from:{data:'detail_'+i},encode:{update:{
     x:{signal:'width'},y:{value:-8},align:{value:'right'},text:{signal:"datum.season + ' · ' + format(datum.wins / datum.played,'.1%')"},font:{value:font},fontSize:{value:15},fill:{value:ink}
    }}},
    {type:'rect',interactive:false,encode:{update:{x:{value:0},y:{value:0},width:{signal:'width'},height:{value:64},fill:{value:'#eeeee3'}}}},
    ...folds.map(f=>({name:f.name+'_'+i,type:'area',interactive:false,from:{data:'curve_'+i},sort:{field:'datum.season'},encode:{update:{
     x:{scale:'year',field:'season'},y:{scale:'band',field:f.name},y2:{value:58},fill:{value:f.color},interpolate:{value:'linear'}
    }}})),
    {type:'rule',interactive:false,encode:{update:{x:{scale:'year',signal:'detailSeason'},y:{value:6},y2:{value:58},stroke:{value:ink},strokeDash:{value:[3,3]},strokeOpacity:{value:0.65}}}},
    {name:'club_story_note_'+i,type:'text',interactive:false,encode:{update:{
     x:{value:0},y:{value:72},baseline:{value:'top'},text:{signal:'width >= 560 ? '+JSON.stringify(rowNotes[i].join(' '))+' : '+JSON.stringify(rowNotes[i].join('\n'))},
     lineBreak:{value:'\n'},lineHeight:{value:18},font:{value:font},fontSize:{value:15},fill:{value:ink}
    }}},
    {name:'season_targets',type:'rect',from:{data:'records_'+i},encode:{update:{
     x:{scale:'year',signal:'max(2012,datum.season-0.5)'},x2:{scale:'year',signal:'min(2025,datum.season+0.5)'},y:{value:0},height:{value:64},fill:{value:'transparent'},tooltip:{signal:horizonTip},
     description:{signal:"datum.team + ', ' + datum.season + ': ' + format(datum.wins/datum.played,'.1%') + ' games won'"}
    }}}
   ]
  }))
 });
};
