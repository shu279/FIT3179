/* Reading notes point to rendered marks, so resizing and filtering keep them attached. */
'use strict';
function initialiseReadingAnnotations(element, name) {
  if(element.closest('.chart-story')?.querySelector('[data-story-point]'))return initialiseStoryAnnotations(element,name);
  const ns='http://www.w3.org/2000/svg';
  const ink='#21372b',paper='#f3f2e9';
  const svgElement=(tag,attributes={},text)=>{
    const node=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const find=(selector,test=()=>true)=>[...element.querySelectorAll('.vega-embed '+selector)].find(el=>test(el.__data__?.datum,el));
  const team=club=>d=>d?.team===club;
  const inView=p=>{
    const viewport=element.querySelector(map?'.water_backdrop_marks path':'.vega-embed svg');
    if(!viewport)return true;
    const r=viewport.getBoundingClientRect(),o=element.getBoundingClientRect();
    return p.x>=r.left-o.left-1&&p.x<=r.right-o.left+1&&p.y>=r.top-o.top-1&&p.y<=r.bottom-o.top+1;
  };
  const target=(selector,test,x=.5,y=0)=>()=>{
    const node=find(selector,test);
    if(!node)return null;
    const r=node.getBoundingClientRect(),o=element.getBoundingClientRect();
    const p={x:r.left-o.left+r.width*x,y:r.top-o.top+r.height*y,node};
    return inView(p)?p:null;
  };
  function coastlineTarget(from,to){
    const state=to.node.__data__?.datum?.state;
    const coast=find('.state_rates_marks path',d=>d?.state===state);
    const matrix=coast?.getScreenCTM();
    if(!matrix||!coast.isPointInFill)return to;
    const inverse=matrix.inverse(),origin=element.getBoundingClientRect();
    const dx=to.x-from.x,dy=to.y-from.y;
    const point=t=>new DOMPoint(origin.left+from.x+dx*t,origin.top+from.y+dy*t).matrixTransform(inverse);
    const inside=t=>coast.isPointInFill(point(t));
    if(inside(0)||!inside(1))return to;
    // Stop at the first coastline crossing, using the rendered projection.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));
    for(let step=1;step<=steps;step++){
      if(!inside(step/steps))continue;
      let low=(step-1)/steps,high=step/steps;
      for(let i=0;i<10;i++){
        const middle=(low+high)/2;
        if(inside(middle))high=middle;else low=middle;
      }
      return {...to,x:from.x+dx*high,y:from.y+dy*high};
    }
    return to;
  }
  const guides={
    state_choropleth:[
      {text:d=>`${d.finals} finalist${d.finals===1?'':'s'} / ${d.clubs} clubs`,at:target('.state_count_labels_marks text',d=>d?.state==='WA',.5,1)}
    ],
    season_boxplot:[
      {text:'Geelong: tightest middle 50% (66–76%).',short:'Geelong: tightest middle 50%.',at:target('.layer_4_marks path',team('Geelong'),.25,0)},
      {text:'Line = median',at:target('.layer_5_marks path',team('Geelong'),.5,0)}
    ],
    era_change:[{text:'Length = change in percentage points',short:'Length = change (pp)',at:target('.layer_0_marks path',team('Brisbane Lions'),.8)}],
    rank_changes:[{text:'Bar height = yearly comparisons',at:target('.layer_0_marks path',d=>d?.change===-9,.5,0)}]
  };
  const map=name==='state_choropleth';
  if(!guides[name])return {destroy(){}};
  const overlay=svgElement('svg',{'class':'chart-reading-annotations',role:'group','aria-label':name==='season_boxplot'?'Chart insight and reading guide':'How to read this chart'});
  element.append(overlay);
  const markerId='reading-arrow-'+name;
  function arrow(from,to,elbow){
    const path=elbow===undefined?`M${from.x},${from.y} L${to.x},${to.y}`:
      `M${from.x},${from.y} H${elbow} V${to.y-12} L${to.x},${to.y-3}`;
    overlay.append(svgElement('path',{d:path,fill:'none',stroke:ink,'stroke-width':1,'marker-end':`url(#${markerId})`,'aria-hidden':'true'}));
  }
  function label(text,x,y,halo=false){
    const node=svgElement('text',{x,y,fill:ink,'font-size':15,'font-weight':'normal','dominant-baseline':'hanging',...(halo?{stroke:paper,'stroke-width':4,'paint-order':'stroke'}:{})},text);
    overlay.append(node);return node;
  }
  let frame,closed=false;
  function draw(){
    if(closed)return;
    const width=element.clientWidth;
    const annotations=(guides[name]||[]).map(g=>{
      const at=g.at();if(!at)return null;
      return {...g,getTarget:g.at,at,text:typeof g.text==='function'?g.text(at.node.__data__?.datum):width<400&&g.short?g.short:g.text};
    }).filter(Boolean);
    const context=document.createElement('canvas').getContext('2d');
    context.font='15px "Helvetica Neue", Arial, sans-serif';
    const lengths=annotations.map(a=>context.measureText(a.text).width);
    const stacked=lengths.reduce((a,b)=>a+b,0)+annotations.length*20>width;
    if(!stacked&&!map)annotations.sort((a,b)=>a.at.x-b.at.x);
    const histogramInset=name==='rank_changes'&&width>=600;
    const top=map||histogramInset?0:stacked?annotations.length*25+24:62;
    element.style.paddingTop=top+'px';
    const mapFooter=map&&width<650;
    element.style.paddingBottom=mapFooter?(annotations.length*26+24)+'px':'0px';
    overlay.replaceChildren();
    const defs=svgElement('defs'),marker=svgElement('marker',{id:markerId,viewBox:'0 0 8 8',refX:map?8:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto',markerUnits:'userSpaceOnUse'});
    marker.append(svgElement('path',{d:'M0 0 L8 4 L0 8 Z',fill:ink}));defs.append(marker);overlay.append(defs);
    overlay.setAttribute('width',width);overlay.setAttribute('height',element.offsetHeight);
    overlay.setAttribute('viewBox',`0 0 ${width} ${element.offsetHeight}`);
    // Re-read the targets after reserving the note row. No stale pixel offsets.
    const nodes=annotations.map((a,i)=>{
      a.at=a.getTarget();
      let x=stacked?4:a.at.x;
      let y=stacked?6+i*25:6;
      if(map){
        const water=(element.querySelector('.water_backdrop_marks path')||element.querySelector('.vega-embed svg')).getBoundingClientRect(),o=element.getBoundingClientRect();
        x=12;y=water.bottom-o.top+(mapFooter?14:-annotations.length*26-8)+i*26;
      }
      if(histogramInset){x=Math.max(170,width*.2);y=130;}
      const t=label(a.text,x,y,map);
      if(!stacked&&!map)t.setAttribute('text-anchor','middle');
      return {a,t,x,y};
    });
    if(!stacked&&!map){
      let edge=4;
      nodes.forEach(n=>{const half=n.t.getComputedTextLength()/2;n.x=Math.max(n.x,edge+half);n.t.setAttribute('x',n.x);edge=n.x+half+20;});
      edge=width-4;
      [...nodes].reverse().forEach(n=>{const half=n.t.getComputedTextLength()/2;n.x=Math.min(n.x,edge-half);n.t.setAttribute('x',n.x);edge=n.x-half-20;});
    }
    const maxText=Math.max(0,...nodes.map(n=>n.t.getComputedTextLength()));
    nodes.forEach(({a,t,x,y},i)=>{
      const length=t.getComputedTextLength();
      let from={x:stacked?x+length+6:x,y:y+22};
      let lane=stacked?Math.min(width-8,maxText+18+i*7):undefined;
      if(stacked)from.y=y+8;
      if(map){from={x:x+Math.min(length-8,40+i*80),y:y-7};lane=undefined;}
      if(name==='rank_changes'&&!histogramInset)lane=width-5;
      // Put the arrow below the label layer to keep text legible at intersections.
      arrow(from,map?coastlineTarget(from,a.at):a.at,lane);
      if(a.also){const second=a.also();if(second)arrow(from,second,lane);}
    });
    nodes.forEach(({t})=>overlay.append(t));
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
  const source=element.querySelector('.vega-embed svg');
  const observer=new MutationObserver(schedule);observer.observe(source,{subtree:true,attributes:true,childList:true,characterData:true});
  const resize=new ResizeObserver(schedule);resize.observe(element);
  schedule();
  return {destroy(){closed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();overlay.remove();element.style.paddingTop='';element.style.paddingBottom='';}};
}

// Connect narrative paragraphs to rendered evidence, keeping leaders out of the
// text columns and routing branches through the gaps between chart rows.
function initialiseStoryAnnotations(element,name){
  const story=element.closest('.chart-story');
  const points=[...story.querySelectorAll('[data-story-point]')];
  const ns='http://www.w3.org/2000/svg',ink='#21372b';
  const make=(tag,attributes={})=>{
    const node=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
    return node;
  };
  const overlay=make('svg',{'class':'story-annotations',...(name==='club_horizon'?{role:'group','aria-label':'Highlighted seasons'}:{'aria-hidden':'true'})});
  story.append(overlay);
  const markerId='story-arrow-'+name;
  const find=(selector,test=()=>true)=>[...element.querySelectorAll(selector)].find(node=>test(node.__data__?.datum));
  const horizonTargets={
    finals:[['Geelong',0,2022,'peak'],['Sydney',1,2014,'peak']],
    titles:[['Hawthorn',2,2014,'title'],['Richmond',3,2019,'title']],
    turnarounds:[['Brisbane Lions',4,2024,'title'],['West Coast',5,2023,'win rate']]
  };
  let frame,closed=false;
  function draw(){
    if(closed)return;
    const origin=story.getBoundingClientRect();
    const rect=node=>{
      const r=node.getBoundingClientRect();
      return {left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top,width:r.width,height:r.height};
    };
    const chart=rect(element),copy=rect(points[0].parentElement);
    const stacked=copy.bottom<=chart.top;
    const fromLeft=!stacked&&copy.right<=chart.left;
    overlay.setAttribute('viewBox',`0 0 ${origin.width} ${origin.height}`);
    overlay.replaceChildren();
    const defs=make('defs'),marker=make('marker',{id:markerId,viewBox:'0 0 8 8',refX:8,refY:4,markerWidth:6,markerHeight:6,orient:'auto',markerUnits:'userSpaceOnUse'});
    marker.append(make('path',{d:'M0 0 L8 4 L0 8 Z',fill:ink}));defs.append(marker);overlay.append(defs);
    const line=(d,point,target,kind='leader')=>overlay.append(make('path',{
      d,fill:'none',stroke:ink,'stroke-width':1,'stroke-linejoin':'round','stroke-linecap':'round','aria-hidden':'true',
      'data-story-point':point,'data-annotation-kind':kind,...(target?{'data-target':target,'marker-end':`url(#${markerId})`}:{})
    }));
    points.forEach((point,index)=>{
      const key=point.dataset.storyPoint,p=rect(point);
      const targets=name==='success_comparison'?
        [...element.querySelectorAll('.profile_bars path')].filter(node=>{
          const d=node.__data__.datum;
          return key==='geelong'?d.team==='Geelong'&&d.order<3:d.team==='Hawthorn'&&d.order>=3;
        }).map(node=>{
          const r=rect(node),d=node.__data__.datum;
          return {x:r.right-Math.min(8,r.width/4),y:r.top,routeY:r.top-3,label:`${d.team}: ${d.label}`};
        }):horizonTargets[key].map(([team,row,season,meaning])=>{
          const node=find('.season_targets path',d=>d?.team===team&&d.season===season);
          const background=find(`.win_rate_background_${row} path`);
          if(!node||!background)return null;
          const r=rect(node),b=rect(background),d=node.__data__.datum;
          const rate=Math.round(100*d.wins/d.played);
          const note=meaning==='title'?`${season} title`:meaning==='peak'?`${season} peak: ${rate}%`:`${season}: ${rate}% won`;
          return {x:(r.left+r.right)/2,y:b.bottom-b.height*d.wins/d.played,rowTop:b.top,rowBottom:b.bottom,label:`${team}: ${season}`,note};
        }).filter(Boolean);
      if(!targets.length)return;
      const from={x:fromLeft||stacked?p.right+6:p.left-6,y:(p.top+p.bottom)/2};
      if(name==='club_horizon'){
        const top=targets[0].rowTop-4,bottom=targets.at(-1).rowBottom+4;
        const bracketX=stacked?chart.right+7:chart.left-14;
        const cap=stacked?-10:12;
        line(`M${bracketX+cap},${top} H${bracketX} V${bottom} H${bracketX+cap}`,key,null,'group-bracket');
        if(stacked){
          const rail=origin.width-8-index*7;
          line(`M${from.x},${from.y} H${rail} V${(top+bottom)/2} H${bracketX}`,key,null,'description-connector');
        }else{
          const joinY=Math.max(top+8,Math.min(bottom-8,from.y));
          line(`M${from.x},${from.y} H${bracketX-6} V${joinY} H${bracketX}`,key,null,'description-connector');
        }
        // Keep each explanation in the gap above its strip, beside a local arrow.
        targets.forEach(t=>{
          const label=make('text',{x:t.x,y:t.rowTop-8,fill:ink,'font-family':'Helvetica Neue, Arial, sans-serif','font-size':15,'text-anchor':'middle','data-annotation-kind':'focus-label','data-target':t.label,'aria-label':`${t.label}: ${t.note}`});
          label.textContent=t.note;
          overlay.append(label);
          const half=label.getComputedTextLength()/2;
          label.setAttribute('x',Math.max(chart.left+half+4,Math.min(chart.right-half-4,t.x)));
          line(`M${t.x},${t.rowTop-3} V${t.y}`,key,t.label,'focus-arrow');
        });
        return;
      }
      const rail=stacked?origin.width-8-index*7:fromLeft?chart.left-14:chart.right+10;
      const ys=[from.y,...targets.map(t=>t.routeY)];
      line(`M${from.x},${from.y} H${rail} M${rail},${Math.min(...ys)} V${Math.max(...ys)}`,key);
      targets.forEach(t=>line(`M${rail},${t.routeY} H${t.x} V${t.y}`,key,t.label));
    });
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
  const source=element.querySelector('.vega-embed svg');
  const observer=new MutationObserver(schedule);observer.observe(source,{subtree:true,attributes:true,childList:true,characterData:true});
  const resize=new ResizeObserver(schedule);resize.observe(story);points.forEach(point=>resize.observe(point));
  schedule();
  return {destroy(){closed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();overlay.remove();}};
}
