import {terrainHeight} from './core.js';
import {TROPICAL_WORLD} from './tropicalTerrain.js';
import {birdStatus,BIRD_ETHOLOGY} from './speciesEthology.js';

export function createBirdHud(doc,seed){
 const stamina=doc.getElementById('bird-stamina'),hunger=doc.getElementById('bird-hunger');
 const state=doc.getElementById('bird-state'),condition=doc.getElementById('bird-condition');
 const canvas=doc.getElementById('bird-minimap'),ctx=canvas?.getContext('2d');
 if(!ctx)return {update(){}};
 const size=canvas.width,terrain=doc.createElement('canvas');
 terrain.width=terrain.height=size;
 const tctx=terrain.getContext('2d'),pixels=tctx.createImageData(size,size);
 const extent=TROPICAL_WORLD.extent;
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
   const x=(col/(size-1)-.5)*extent,z=(row/(size-1)-.5)*extent;
   const y=terrainHeight(x,z,seed),i=(row*size+col)*4;
   const color=y< -9?[17,52,69]:y<28?[140,143,100]:
     y<330?[44,93,68]:y<620?[87,116,91]:[113,113,106];
   pixels.data[i]=color[0];pixels.data[i+1]=color[1];
   pixels.data[i+2]=color[2];pixels.data[i+3]=235;
 }
 tctx.putImageData(pixels,0,0);
 function update(info){
   const report=birdStatus(info.energy,info.hunger,info.state,info.rain);
   stamina.style.width=Math.round(report.stamina*100)+'%';
   hunger.style.width=Math.round(report.appetite*100)+'%';
   stamina.parentElement.setAttribute('aria-valuenow',String(Math.round(report.stamina*100)));
   hunger.parentElement.setAttribute('aria-valuenow',String(Math.round(report.appetite*100)));
   state.textContent=report.state;condition.textContent=report.condition;
   ctx.clearRect(0,0,size,size);ctx.drawImage(terrain,0,0);
   const px=Math.max(3,Math.min(size-3,(info.x/extent+.5)*size));
   const py=Math.max(3,Math.min(size-3,(info.z/extent+.5)*size));
   ctx.save();ctx.translate(px,py);ctx.rotate(-info.heading);
   ctx.fillStyle='#edfaf3';ctx.strokeStyle='#102b34';ctx.lineWidth=1.3;
   ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4.1,5);ctx.lineTo(0,3);
   ctx.lineTo(-4.1,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
   return report;
 }
 return {update,seed,profiles:BIRD_ETHOLOGY};
}
