/* Plain JavaScript: load standalone specs, render Vega charts, and link one club selector. */
'use strict';
const chartViews = new Map();
const chartNames = {
  hero_finals:'Geelong finals record',ladder_heatmap:'Ladder heatmap',finals_frequency:'Finals appearances',
  finals_streaks:'Finals streaks',ladder_bump:'Ladder journeys',state_choropleth:'State choropleth',
  premiership_symbols:'Premiership symbols',grand_final_flows:'Grand Final connections',
  premiership_treemap:'Premiership share',success_scatter:'Winning and finals',season_boxplot:'Season spread',era_dumbbell:'Changing eras',
  rank_profiles:'Ladder groups',finals_return:'Returning to finals',rank_changes:'Year-to-year ladder changes'
};

async function renderChart(element) {
  const name = element.dataset.spec;
  element.setAttribute('aria-busy','true');
  element.innerHTML = '<p class="chart-loading">Loading visualisation…</p>';
  try {
    const response = await fetch(`specs/${name}.json`);
    if (!response.ok) throw new Error(`Specification request failed (${response.status})`);
    const spec = await response.json();
    const isVega = spec.$schema.includes('/vega/');
    if (isVega) spec.width = element.clientWidth;
    element.replaceChildren();
    const result = await vegaEmbed(element, spec, {
      actions:false,renderer:'svg',tooltip:{theme:'custom'},defaultStyle:false,
      mode:isVega?'vega':'vega-lite'
    });
    chartViews.set(name,{view:result.view,element,isVega,width:element.clientWidth});
    element.dataset.rendered='true';
  } catch(error) {
    console.error(`Could not render ${name}:`,error);
    const message=document.createElement('p');
    message.className='chart-error';
    message.textContent='This chart could not load. Please reload the page. The source data and chart files are available below.';
    element.replaceChildren(message);
    element.dataset.rendered='error';
  } finally { element.setAttribute('aria-busy','false'); }
}

async function initialiseClubControl() {
  const control=document.querySelector('#club-select');
  const status=document.querySelector('#club-summary');
  try {
    const response=await fetch('data/team_summary.json');
    if(!response.ok)throw new Error('Club summary unavailable');
    const clubs=await response.json();
    [...clubs].sort((a,b)=>a.team.localeCompare(b.team)).forEach(club=>{
      const option=document.createElement('option');option.value=club.team;option.textContent=club.team;control.append(option);
    });
    control.disabled=false;
    control.addEventListener('change',async()=>{
      const value=control.value;
      const club=clubs.find(d=>d.team===value);
      status.textContent=club?`${club.team}: ${club.finals} of 14 seasons in finals · ${club.win_rate.toFixed(1)}% of regular-season games won · ${club.premierships} premiership${club.premierships===1?'':'s'}.`:'Geelong and Sydney set the standard for returning to finals.';
      await Promise.all(['ladder_heatmap','finals_frequency'].map(name=>{
        const entry=chartViews.get(name);
        return entry?entry.view.signal('focusTeam',value).runAsync():Promise.resolve();
      }));
    });
  } catch(error) {console.error(error);status.textContent='Club highlighting is unavailable. The charts show all clubs.';}
}

function initialiseResize() {
  let timer;
  const observer=new ResizeObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      for(const entry of chartViews.values()){
        const width=Math.floor(entry.element.clientWidth);
        if(width>0&&Math.abs(width-entry.width)>2){
          entry.width=width;
          entry.view.width(width).resize().runAsync().catch(error=>console.error('Chart resize:',error));
        }
      }
    },160);
  });
  chartViews.forEach(entry=>observer.observe(entry.element));
  window.addEventListener('pagehide',()=>{observer.disconnect();chartViews.forEach(entry=>entry.view.finalize());},{once:true});
}

async function initialise() {
  const figures=[...document.querySelectorAll('[data-spec]')];
  const links=document.querySelector('#spec-links');
  figures.filter(el=>el.dataset.spec!=='hero_finals').forEach(el=>{
    const a=document.createElement('a');a.href=`specs/${el.dataset.spec}.json`;a.textContent=chartNames[el.dataset.spec];a.className='spec-link';links.append(a);
  });
  // Render the opening charts first, then the rest in bounded groups.
  for(let i=0;i<figures.length;i+=3)await Promise.all(figures.slice(i,i+3).map(renderChart));
  await initialiseClubControl();
  initialiseResize();
  document.documentElement.dataset.chartsReady=String(chartViews.size);
}
initialise();
