import {terrainHeight,random,clamp,TAU} from './core.js';
export function createBirdBrain(bird,seed=1988){
 const rand=random(seed),marine=bird.flight==='marine',nocturnal=bird.flight==='nocturnal';
 const speed={dash:85,soar:56,marine:62,hover:34,nocturnal:39,wade:27}[bird.flight]||45;
 let x=marine?1900:200,z=marine?900:180,y=marine?70:terrainHeight(200,180)+125,heading=0,mode='cruise',tx=x,tz=z,ty=y,next=0,energy=.8;
 function plan(t,day,rain){
  const r=rand(),sleep=nocturnal?day>.7:day<.12;
  mode=sleep||energy<.2?'rest':rain>.72?'shelter':r<.30?'forage':r<.47?'survey':'cruise';
  next=t+(mode==='rest'?16:mode==='forage'?9:12)+rand()*12;
  const a=rand()*TAU,rad=marine?1850+rand()*400:mode==='rest'?90+rand()*120:180+rand()*Math.min(bird.radius,950);
  tx=Math.cos(a)*rad;tz=Math.sin(a)*rad;
  if(mode==='rest'||mode==='shelter'){tx=marine?1900:230;tz=marine?950:160;}
  const floor=marine?-3:terrainHeight(tx,tz);
  ty=floor+(mode==='rest'||mode==='shelter'?marine?8:8:mode==='forage'?marine?24:16:mode==='survey'?170:marine?52:100);
 }
 return {update(t,dt,day,rain){
  dt=clamp(dt,0,.1);if(t>=next||((mode==='cruise'||mode==='survey'||mode==='forage')&&Math.hypot(tx-x,tz-z)<20))plan(t,day,rain);
  const dx=tx-x,dz=tz-z,desired=Math.atan2(-dx,-dz);
  const diff=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
  heading+=clamp(diff,-dt*1.35,dt*1.35);
  const dist=Math.hypot(dx,dz),rest=mode==='rest'||mode==='shelter';
  const velocity=rest&&dist<32?0:speed*(mode==='forage'?.42:mode==='survey'?.8:1);
  const step=Math.min(dist,velocity*dt);
  x-=Math.sin(heading)*step;z-=Math.cos(heading)*step;
  const floor=marine?-3:terrainHeight(x,z)+5;
  y+=(Math.max(floor,ty)-y)*Math.min(1,dt*.85);
  energy=clamp(energy+(rest?.025:-.003)*dt);
  return {x,y,z,heading,bank:clamp(diff*.19,-.4,.4),pitch:clamp((ty-y)*.006,-.2,.2),resting:rest&&velocity===0,mode,velocity};
 }};
}
