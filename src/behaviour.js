import {terrainHeight,random,clamp,TAU} from './core.js';
import {resourcePoint,foodType,habitatAt} from './ecology.js';

// Deterministic, species-aware utility AI. The bird has physiological drives and
// explicit take-off, approach, landing, foraging, resting and sheltered states.
export function createBirdBrain(profile,seed=1988){
 const rng=random(seed ^ profile.id.split('').reduce((n,c)=>n*31+c.charCodeAt(0),7));
 const flight=profile.flight,marine=flight==='marine',owl=flight==='nocturnal',swift=profile.id==='swift';
 const cruise={dash:80,soar:57,marine:62,hover:36,nocturnal:40,wade:30}[flight]||45;
 const maxTurn=flight==='dash'?1.55:flight==='soar'||marine?.68:1.18;
 const startA=rng()*TAU,startR=marine?1930:Math.max(140,profile.radius*.65);
 let x=Math.cos(startA)*startR,z=Math.sin(startA)*startR,
 y=marine?65:Math.max(terrainHeight(x,z)+95,profile.alt),heading=startA,velocity=cruise*.55;
 let state='patrol',until=0,tx=x,tz=z,ty=y,energy=.76,hunger=.79;
 let food=null,activityChangedAt=0,landings=0,feedings=0,landingRest=false;
 function clearance(px,pz,kind){
  const ground=terrainHeight(px,pz);
  if(marine)return kind==='land'?-5:kind==='hunt'?12:38;
  if(swift)return Math.max(ground+70,95);
  if(kind==='land')return ground+Math.max(.18,profile.wingspan*.32);
  if(kind==='hunt')return ground+(profile.id==='hummingbird'?11:profile.id==='kingfisher'?10:profile.id==='heron'?8:14);
  return ground+(flight==='soar'?112:flight==='dash'?90:58);
 }
 function target(px,pz,height){
  tx=px;tz=pz;ty=height;
 }
 function selectPatrol(){
  const angle=rng()*TAU,dist=150+rng()*Math.min(profile.radius,720);
  if(marine){
   const phi=Math.atan2(z,x)+(rng()-.5)*.7;
   const r=1800+rng()*360;target(Math.cos(phi)*r,Math.sin(phi)*r,clearance(x,z,'cruise'));
  }else{
   const px=x+Math.cos(angle)*dist,pz=z+Math.sin(angle)*dist;
   target(px,pz,clearance(px,pz,'cruise')+rng()*32);
  }
 }
 function transition(next,t){state=next;activityChangedAt=t;}
 function chooseAction(t,day,rain){
  const shouldSleep=owl?day>.67:day<.1;
  if(shouldSleep&&!swift&&state!=='rest'&&state!=='landing'){
   transition('shelter',t);const px=marine?x:140,pz=marine?z:155;
   target(px,pz,clearance(px,pz,'land'));until=t+34;return;
  }
  if(rain>.70&&!marine&&state!=='shelter'&&state!=='rest'){
   transition('shelter',t);target(145,155,clearance(145,155,'land'));until=t+25;return;
  }
  if((energy<.27||shouldSleep)&&!swift){
   transition('return',t);
   const px=marine?Math.cos(Math.atan2(z,x))*1850:170,pz=marine?Math.sin(Math.atan2(z,x))*1850:150;
   target(px,pz,clearance(px,pz,'land'));until=t+40;return;
  }
  if(hunger>.56){
   transition('seek_food',t);
   food=resourcePoint(profile,x,z,rng);
   target(food.x,food.z,clearance(food.x,food.z,'cruise'));until=t+26;return;
  }
  transition('patrol',t);selectPatrol();until=t+9+rng()*11;
 }
 return {
 update(t,dt,day=1,rain=0){
  dt=clamp(dt,0,.10);day=clamp(day);rain=clamp(rain);
  const resting=['rest','shelter'].includes(state),feeding=state==='feed';
  energy=clamp(energy+(resting?.022:feeding?.008:-.0029)*dt);
  hunger=clamp(hunger+(feeding?-.105:.0017)*dt);
  if(state==='patrol'&&(t>=until||Math.hypot(tx-x,tz-z)<30))chooseAction(t,day,rain);
  else if(state==='seek_food'&&t-activityChangedAt>0){
   const distance=Math.hypot(tx-x,tz-z);
   if(distance<85){transition('approach',t);target(food.x,food.z,clearance(food.x,food.z,'hunt'));}
   else if(t>=until)chooseAction(t,day,rain);
  }
  else if(state==='approach'){
   if(Math.hypot(tx-x,tz-z)<21){landingRest=false;transition('landing',t);target(tx,tz,clearance(tx,tz,'land'));}
  }
  else if(state==='landing'){
   if(Math.hypot(tx-x,tz-z)<10&&Math.abs(y-ty)<3.4){
    transition(landingRest?'rest':'feed',t);until=t+(landingRest?20+rng()*14:5+rng()*6);landings++;if(!landingRest)feedings++;
   }
  }
  else if(state==='feed'&&t>=until){transition('takeoff',t);selectPatrol();until=t+3;}
  else if(state==='return'&&Math.hypot(tx-x,tz-z)<15){
   landingRest=true;transition('landing',t);target(tx,tz,clearance(tx,tz,'land'));
  }
  else if(state==='shelter'&&Math.hypot(tx-x,tz-z)<15&&Math.abs(y-ty)<4){transition('rest',t);until=t+28+rng()*13;}
  else if(state==='rest'&&t>=until){
   const mustSleep=owl?day>.68:day<.1;
   if(!mustSleep&&rain<.65){transition('takeoff',t);selectPatrol();until=t+4;}
   else until=t+15;
  }
  else if(state==='takeoff'&&t>=until){chooseAction(t,day,rain);}
  if(t>=until&&state==='approach'&&Math.hypot(tx-x,tz-z)>350){chooseAction(t,day,rain);}
  const dx=tx-x,dz=tz-z,dist=Math.hypot(dx,dz);
  const destinationAngle=Math.atan2(-dx,-dz);
  const diff=dist<2?0:Math.atan2(Math.sin(destinationAngle-heading),Math.cos(destinationAngle-heading));
  heading+=clamp(diff,-maxTurn*dt,maxTurn*dt);
  const onGround=state==='feed'||state==='rest';
  const slowing=state==='approach'||state==='landing'||state==='return'||state==='shelter';
  let wanted=onGround?0:cruise*(state==='seek_food'?1.08:state==='patrol'?1:state==='takeoff'?.9:slowing?.62:.78);
  if(slowing&&dist<80)wanted*=clamp(dist/80,.12,1);
  const acceleration=onGround?65:profile.flight==='dash'?38:29;
  velocity+=clamp(wanted-velocity,-acceleration*dt,acceleration*dt);
  const step=Math.min(dist,Math.max(0,velocity)*dt);
  x-=Math.sin(heading)*step;z-=Math.cos(heading)*step;
  const floor=clearance(x,z,onGround||state==='landing'||state==='rest'?'land':'hunt');
  let goal=Math.max(floor,ty);
  if(state==='patrol'||state==='takeoff'||state==='seek_food'){
   goal=Math.max(goal,clearance(x,z,'cruise'));
  }
  const dy=clamp(goal-y,-(state==='landing'?22:15)*dt,20*dt);
  y+=dy;y=Math.max(y,floor);
  const grounded=onGround&&velocity<.8;
  return {x,y,z,heading,bank:clamp(diff*.22,-.48,.48),pitch:clamp(dy*1.4,-.30,.30),
   state,mode:state,speed:velocity,velocity,resting:grounded,grounded,
   wingsFolded:grounded||state==='landing',flapping:state==='takeoff'||flight==='hover',
   hunger,energy,food:food?.kind||null,landings,feedings};
 },
 get state(){return state;},
 get diagnostics(){return {state,energy,hunger,landings,feedings};}
 };
}
