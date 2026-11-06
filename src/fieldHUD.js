import {birdCondition} from './birdEthology.js';
import {TROPICAL_WORLD,tropicalTerrainHeight,tropicalRiverPoint} from './tropicalTerrain.js';

export const MINIMAP_SIZE=128;
export function mapCoordinates(x,z,size=MINIMAP_SIZE,extent=TROPICAL_WORLD.extent){
  const half=extent*.5;
  return {x:Math.max(0,Math.min(size,(x+half)/extent*size)),
    y:Math.max(0,Math.min(size,(z+half)/extent*size))};
}
export function mapColor(height){
  if(height< -9)return [16,66,86];
  if(height<16)return [198,190,140];
  if(height<250)return [48,107,67];
  if(height<540)return [70,106,78];
  return [115,122,110];
}
export function createFieldHUD({document:doc=globalThis.document,seed,storage=null}){
  const $=id=>doc.getElementById(id);
  const vitals=$('bird-vitals'),map=$('minimap'),mapCanvas=$('minimap-canvas');
  const vitalsToggle=$('state-btn'),mapToggle=$('map-btn');
  if(!vitals||!map||!mapCanvas)throw Error('Field HUD elements not found');
  const context=mapCanvas.getContext('2d'),size=MINIMAP_SIZE;
  const saved=key=>{try{return storage?.getItem(key)}catch{return null}};
  const persist=(key,value)=>{try{storage?.setItem(key,value?'1':'0')}catch{}};
  let showVitals=saved('vuelo.showVitals')!=='0',showMap=saved('vuelo.showMap')!=='0';
  const background=doc.createElement('canvas');background.width=background.height=size;
  const bctx=background.getContext('2d'),image=bctx.createImageData(size,size);
  const half=TROPICAL_WORLD.extent/2;
  for(let py=0;py<size;py++){
    const z=(py+.5)/size*TROPICAL_WORLD.extent-half;
    for(let px=0;px<size;px++){
      const x=(px+.5)/size*TROPICAL_WORLD.extent-half;
      const h=tropicalTerrainHeight(x,z,seed);
      const [r,g,b]=mapColor(h);
      const idx=(py*size+px)*4;
      image.data[idx]=r;image.data[idx+1]=g;image.data[idx+2]=b;image.data[idx+3]=255;
    }
  }
  bctx.putImageData(image,0,0);
  bctx.strokeStyle='rgba(92,164,164,.72)';
  bctx.lineWidth=.85;
  for(let channel=0;channel<3;channel++){
    bctx.beginPath();
    for(let i=0;i<=72;i++){
      const p=tropicalRiverPoint(channel,.07+i/72*.91,seed);
      const v=mapCoordinates(p.x,p.z);
      if(i===0)bctx.moveTo(v.x,v.y);else bctx.lineTo(v.x,v.y);
    }
    bctx.stroke();
  }
  function renderMap(x,z,heading){
    if(!showMap)return;
    context.clearRect(0,0,size,size);
    context.drawImage(background,0,0);
    const p=mapCoordinates(x,z);
    context.save();
    context.strokeStyle='rgba(245,251,232,.92)';
    context.fillStyle='#ffffff';
    context.lineWidth=1.4;
    context.beginPath();context.arc(p.x,p.y,5.5,0,Math.PI*2);context.stroke();
    context.beginPath();
    context.moveTo(p.x-Math.sin(heading)*8,p.y-Math.cos(heading)*8);
    context.lineTo(p.x+Math.cos(heading)*3.5,p.y-Math.sin(heading)*3.5);
    context.lineTo(p.x-Math.cos(heading)*3.5,p.y+Math.sin(heading)*3.5);
    context.closePath();context.fill();
    context.restore();
  }
  function sync(){
    vitals.classList.toggle('hidden',!showVitals);
    map.classList.toggle('hidden',!showMap);
    for(const [button,visible] of [[vitalsToggle,showVitals],[mapToggle,showMap]]){
      button?.setAttribute('aria-pressed',String(visible));
      button?.classList.toggle('active',visible);
    }
  }
  function toggleVitals(){
    showVitals=!showVitals;persist('vuelo.showVitals',showVitals);sync();
  }
  function toggleMap(){
    showMap=!showMap;persist('vuelo.showMap',showMap);sync();
  }
  function update({x,z,heading,energy,hunger,state,rain}){
    const condition=birdCondition(energy,hunger,state,rain);
    $('bird-activity').textContent=condition.action;
    $('bird-feeling').textContent=condition.feeling;
    $('bird-fatigue').style.width=Math.round(condition.tiredness*100)+'%';
    $('bird-hunger').style.width=Math.round(condition.hunger*100)+'%';
    $('bird-fatigue-val').textContent=Math.round(condition.tiredness*100)+' %';
    $('bird-hunger-val').textContent=Math.round(condition.hunger*100)+' %';
    renderMap(x,z,heading);
    return condition;
  }
  sync();
  return {update,toggleVitals,toggleMap,
    get vitalsVisible(){return showVitals},get mapVisible(){return showMap},
    get seed(){return seed},get canvas(){return mapCanvas}};
}
