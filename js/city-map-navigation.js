/* Only the city map pans and zooms; its timeline remains available for brushing. */
function initialiseCityMapNavigation(view,element) {
  const map=element.querySelector('.city_map_group');
  const reset=document.querySelector('#reset-city-map');
  if(!map || !reset)return null;
  const events=new AbortController();
  let drag=null,zoom=view.signal('mapZoom'),closed=false;
  const clampPan=pan=>{
    const limit=(view.signal('mapZoom')-1)/2;
    return pan.map(value=>Math.max(-limit,Math.min(limit,value)));
  };
  const updatePan=pan=>view.signal('mapPan',clampPan(pan)).runAsync().catch(console.error);
  const sync=()=>{
    map.dataset.zoomed=String(view.signal('mapZoom')>1);
    reset.disabled=view.signal('mapZoom')===1;
  };
  const zoomChanged=(_name,value)=>{
    const ratio=value/zoom;zoom=value;
    const pan=clampPan(view.signal('mapPan').map(value=>value*ratio));
    // Wait for the slider's current Vega dataflow before updating the offset.
    Promise.resolve().then(()=>{if(!closed)return updatePan(pan);});
    sync();
  };
  const resetView=()=>view.signal('mapPan',[0,0]).signal('mapZoom',1).runAsync().catch(console.error);
  const point=event=>{
    const p=map.ownerSVGElement.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
    return p.matrixTransform(map.getScreenCTM().inverse());
  };
  map.setAttribute('tabindex','0');
  map.setAttribute('aria-label','City map. Zoom in, then drag or use arrow keys to move. Press Home to reset the view.');
  map.addEventListener('pointerdown',event=>{
    if(event.button!==0 || event.isPrimary===false || view.signal('mapZoom')===1)return;
    event.preventDefault();
    drag={id:event.pointerId,start:point(event),pan:[...view.signal('mapPan')]};
    map.setPointerCapture(event.pointerId);map.dataset.dragging='true';
  },{signal:events.signal});
  map.addEventListener('pointermove',event=>{
    if(!drag || drag.id!==event.pointerId)return;
    const p=point(event);
    updatePan([drag.pan[0]+(p.x-drag.start.x)/view.width(),
      drag.pan[1]+(p.y-drag.start.y)/view.signal('city_map_height')]);
  },{signal:events.signal});
  const release=event=>{
    if(!drag || drag.id!==event.pointerId)return;
    drag=null;delete map.dataset.dragging;
    if(map.hasPointerCapture(event.pointerId))map.releasePointerCapture(event.pointerId);
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])map.addEventListener(type,release,{signal:events.signal});
  map.addEventListener('keydown',event=>{
    if(event.key==='Home'){event.preventDefault();resetView();return;}
    if(view.signal('mapZoom')===1)return;
    const direction={ArrowLeft:[-0.08,0],ArrowRight:[0.08,0],ArrowUp:[0,-0.08],ArrowDown:[0,0.08]}[event.key];
    if(!direction)return;
    event.preventDefault();updatePan(view.signal('mapPan').map((value,i)=>value+direction[i]));
  },{signal:events.signal});
  reset.addEventListener('click',resetView,{signal:events.signal});
  view.addSignalListener('mapZoom',zoomChanged);sync();
  return {destroy(){closed=true;events.abort();view.removeSignalListener('mapZoom',zoomChanged);}};
}
if(typeof module!=='undefined')module.exports=initialiseCityMapNavigation;
