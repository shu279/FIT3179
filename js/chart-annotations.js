/* Reading notes point to rendered marks, so resizing and filtering keep them attached. */
'use strict';
function initialiseReadingAnnotations(element, name) {
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
  const guides={
    ladder_bump:[],
    state_choropleth:[
      {text:'Darker green = higher finals share',at:target('.state_count_labels_marks text',d=>d?.state==='WA',.5,-1.2)},
      {text:d=>`${d.finals} finalist${d.finals===1?'':'s'} / ${d.clubs} clubs`,at:target('.state_count_labels_marks text',d=>d?.state==='WA',.5,1)},
      {text:'Grey = no clubs',at:target('.state_rates_marks path',d=>d?.state==='NT',.2,.3)}
    ],
    premiership_symbols:[
      {text:()=>find('.city_symbols_marks path',d=>d?.city==='Perth')?.__data__?.datum?.season_count>1?'Area = average finalists per season':'Area = finalists per season',at:target('.city_symbols_marks path',d=>d?.city==='Perth',.2,1)},
      {text:'Darker green = higher finals share',at:target('.city_symbols_marks path',d=>d?.city==='Perth',.8,1)}
    ],
    premiership_bars:[{text:'Bar length = titles',at:target('.title_bars_marks path',team('Hawthorn'),.95)}],
    season_boxplot:[
      {text:'Whiskers = lowest and highest',at:target('.layer_2_marks path',team('Geelong'),.5,0),also:target('.layer_3_marks path',team('Geelong'),.5,0)},
      {text:'Box = middle 50% of seasons',at:target('.layer_4_marks path',team('Geelong'),.25,0)},
      {text:'Line = median',at:target('.layer_5_marks path',team('Geelong'),.5,0)}
    ],
    era_change:[{text:'Length = change in percentage points',short:'Length = change (pp)',at:target('.layer_0_marks path',team('Brisbane Lions'),.8)}],
    rank_changes:[{text:'Bar height = yearly comparisons',at:target('.layer_0_marks path',d=>d?.change===-9,.5,0)}]
  };
  const map=['state_choropleth','premiership_symbols'].includes(name);
  if(!guides[name])return {destroy(){}};
  const overlay=svgElement('svg',{'class':'chart-reading-annotations',role:'group','aria-label':'How to read this chart'});
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
    const histogramInset=name==='rank_changes'&&width>=740;
    const top=map||histogramInset||name==='ladder_bump'?0:stacked?annotations.length*25+24:62;
    element.style.paddingTop=top+'px';
    const mapFooter=map&&width<650;
    const mapTimeline=name==='premiership_symbols'&&element.querySelector('.map_overview_group');
    element.style.paddingBottom=mapFooter&&!mapTimeline?(annotations.length*26+24)+'px':'0px';
    overlay.replaceChildren();
    const defs=svgElement('defs'),marker=svgElement('marker',{id:markerId,viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto',markerUnits:'userSpaceOnUse'});
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
      if(histogramInset){x=width*.2;y=130;}
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
      arrow(from,a.at,lane);
      if(a.also){const second=a.also();if(second)arrow(from,second,lane);}
    });
    nodes.forEach(({t})=>overlay.append(t));
    if(name==='ladder_bump'){
      const plot=element.querySelector('.journey_detail_group .background');
      const rank=target('.journey_detail_layer_1_marks path',(d,el)=>{
        const r=el.getBoundingClientRect(),p=plot.getBoundingClientRect();
        return d?.team==='Hawthorn'&&r.left>=p.left-4&&r.right<=p.right+4;
      })();
      if(rank){
        const y=plot.getBoundingClientRect().top-element.getBoundingClientRect().top-36;
        const text=label('Higher position = better rank',4,y);
        arrow({x:Math.min(rank.x,160),y:y+23},rank);
        overlay.append(text);
      }
      const bar=target('.journey_bars_marks path',team('Geelong'),.8,0)();
      if(bar){
        const text=label('Length = wins ÷ games',Math.max(4,bar.x-152),bar.y-36);
        const box=text.getBBox();
        arrow({x:box.x+box.width/2,y:box.y+box.height+6},bar);
        overlay.append(text);
      }
    }
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
  const source=element.querySelector('.vega-embed svg');
  const observer=new MutationObserver(schedule);observer.observe(source,{subtree:true,attributes:true,childList:true,characterData:true});
  const resize=new ResizeObserver(schedule);resize.observe(element);
  schedule();
  return {destroy(){closed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();overlay.remove();element.style.paddingTop='';element.style.paddingBottom='';}};
}
