// Deterministic tropical-island heightfield. This module deliberately has no Three.js
// dependency so every system (collision, habitat, animals, renderer) samples one surface.
// Domain-warped coastline + ridge noise + localized massifs + fluvial valleys.
import {createNoise2D} from 'simplex-noise';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

function seededRandom(seed){
 let state=(seed|0)||1;
 return ()=>{
  state^=state<<13;state^=state>>>17;state^=state<<5;
  return (state>>>0)/4294967296;
 };
}

/** A pure, reproducible sampler: the same integer seed always produces the same island. */
export function createTerrainSampler(seed=1988){
 const rng=seededRandom(seed^0x5f3759df);
 const n=createNoise2D(rng);
 const phase=rng()*Math.PI*2;
 const yaw=(rng()-.5)*1.18,cos=Math.cos(yaw),sin=Math.sin(yaw);
 const peaks=[
  {x:-540+(rng()-.5)*420,z:-390+(rng()-.5)*430,rx:450,rz:560,h:270+rng()*145},
  {x:450+(rng()-.5)*420,z:470+(rng()-.5)*450,rx:530,rz:480,h:240+rng()*150},
  {x:(rng()-.5)*400,z:(rng()-.5)*250,rx:390,rz:660,h:140+rng()*120}
 ];
 function octave(x,z,frequency,count=4){
  let sum=0,amplitude=1,total=0;
  for(let i=0;i<count;i++){
   sum+=amplitude*n(x*frequency,z*frequency);
   total+=amplitude;amplitude*=.52;frequency*=2.07;
  }
  return sum/total;
 }
 function valleyAxis(z){
  return 160+Math.sin(z*.00165+phase)*300+n(z*.0013+10,7.37)*105;
 }
 function height(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return -40;
  const warpX=n(x*.0012+8,z*.0012-11)*145;
  const warpZ=n(x*.0012-17,z*.0012+4)*145;
  const radial=Math.hypot((x+warpX)/1850,(z+warpZ)/1670);
  const outline=1+octave(x,z,.0021,3)*.19;
  const shore=1-smooth(.69,1.05,radial/outline);
  if(shore<=0)return -36-Math.min(35,Math.max(0,radial-1)*28);
  const u=x*cos-z*sin,v=x*sin+z*cos;
  const spine=Math.exp(-Math.pow((v-Math.sin(u*.0019+phase)*190)/450,2));
  const sharpRidge=Math.pow(1-Math.abs(n(x*.0031+3,z*.0031-5)),3);
  const highlands=spine*(70+sharpRidge*155)*(0.75+0.25*smooth(.2,.8,shore));
  let massifs=0;
  for(const peak of peaks){
   const d2=((x-peak.x)/peak.rx)**2+((z-peak.z)/peak.rz)**2;
   massifs+=peak.h*Math.exp(-d2*1.5);
  }
  const hills=octave(x+270,z-340,.0018,5)*79+
   octave(x-180,z+510,.0072,3)*20;
  const valleyWidth=125+Math.max(0,octave(x,z,.0022,2))*75;
  const streamDistance=(x-valleyAxis(z))/valleyWidth;
  const valley=Math.exp(-streamDistance*streamDistance)*55*
   smooth(-1450,-650,z)*(1-smooth(850,1650,z));
  const elevation=-32+shore*(91+hills+highlands+massifs-valley);
  return Math.max(-55,elevation);
 }
 return height;
}
