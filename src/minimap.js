import {tropicalTerrainSample,TROPICAL_WORLD} from './tropicalTerrain.js';
export function sessionIslandSeed(cryptoSource=globalThis.crypto){
 const a=new Uint32Array(1);
 if(cryptoSource?.getRandomValues)cryptoSource.getRandomValues(a);
 else a[0]=(Math.random()*0x7fffffff)>>>0;
 return (a[0]&0x7fffffff)||1;
}
export function mapCoordinate(x,z,extent=TROPICAL_WORLD.extent){
 return {x:Math.max(0,Math.min(1,x/extent+.5)),
   y:Math.max(0,Math.min(1,z/extent+.5))};
}
export function createMinimap(canvas,seed,extent=TROPICAL_WORLD.extent){
 const ctx=canvas.getContext('2d');
 if(!ctx)return {update(){},seed,available:false};
 const side=canvas.width||112;
 const image=ctx.createImageData(side,side);
 for(let py=0;py<side;py++)for(let px=0;px<side;px++){
  const x=((px+.5)/side-.5)*extent,z=((py+.5)/side-.5)*extent;
  const sample=tropicalTerrainSample(x,z,seed),h=sample.height;
  const rgb=h< -9?[18,51,65]:h<30?[170,162,122]:
   h<300?[47,95,70]:h<570?[77,112,82]:[117,125,115];
  const o=(py*side+px)*4;
  image.data[o]=rgb[0];image.data[o+1]=rgb[1];image.data[o+2]=rgb[2];image.data[o+3]=255;
 }
 // Cache the background: only the player marker repaints each second.
 const off=document.createElement('canvas');off.width=off.height=side;
 off.getContext('2d').putImageData(image,0,0);
 return {seed,available:true,update(x,z,heading=0){
  const pos=mapCoordinate(x,z,extent);
  ctx.clearRect(0,0,side,side);
  ctx.drawImage(off,0,0);
  const cx=pos.x*side,cy=pos.y*side;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-heading);
  ctx.fillStyle='#f7f8ef';ctx.strokeStyle='#193136';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,2);
  ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }};
}
