import {terrainHeight,random,clamp,TAU} from './core.js';
import {resourcePoint,foodType,habitatAt,birdHabitatScore} from './ecology.js';
import {oceanSurfaceHeight,oceanFloatPose} from './oceanMotion.js';

// Deterministic, species-aware utility AI. The bird has physiological drives and
// explicit take-off, approach, landing, foraging, resting and sheltered states.
export function createBirdBrain(profile,seed=1988,initial=null){
 const rng=random(seed ^ profile.id.split('').reduce((n,c)=>n*31+c.charCodeAt(0),7));
 const flight=profile.flight,marine=flight==='marine',owl=flight==='nocturnal',swift=profile.id==='swift';
 const cruise={dash:80,soar:57,marine:62,hover:36,nocturnal:40,wade:30}[flight]||45;
 const maxTurn=flight==='dash'?1.55:flight==='soar'||marine?.68:1.18;
 const startA=rng()*TAU;
 // Each newly spawned species starts in a compatible biome, not on an
 // arbitrary fixed-radius orbit which may lie over open sea.
 let spawnX=0,spawnZ=0,spawnScore=-1;
 for(let i=0;i<42;i++){
  const angle=i===0?startA:rng()*TAU;
  const dist=marine?3850+rng()*1250:330+rng()*2400;
  const px=Math.cos(angle)*dist,pz=Math.sin(angle)*dist;
  const score=birdHabitatScore(profile,habitatAt(px,pz,seed))+rng()*.12;
  if(score>spawnScore){spawnScore=score;spawnX=px;spawnZ=pz;}
 }
 const homeX=spawnX,homeZ=spawnZ;
 // Species changes retain continuous world-space motion rather than respawning.
 // The new species still chooses fresh habitat-specific targets and flight dynamics.
 const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
 let x=finite(initial?.x,spawnX),
 z=finite(initial?.z,spawnZ),
 y=finite(initial?.y,marine?Math.max(25,terrainHeight(x,z,seed)+46):
   Math.max(terrainHeight(x,z,seed)+95,profile.alt)),
 heading=finite(initial?.heading,startA),
 velocity=clamp(finite(initial?.velocity,cruise*.55),0,110);
 let state='patrol',until=0,tx=x,tz=z,ty=y,
 energy=clamp(finite(initial?.energy,.76)),hunger=clamp(finite(initial?.hunger,.79));
 let food=null,activityChangedAt=0,landings=0,feedings=0,landingRest=false;
 let currentTime=0,currentRain=0;
 const buoyancy={};
 function clearance(px,pz,kind){
  const ground=terrainHeight(px,pz,seed);
  if(marine){
   if(ground>-7)return ground+45;
   return kind==='land'?oceanSurfaceHeight(px,pz,currentTime,currentRain)+
     Math.max(.045,profile.wingspan*.042):kind==='hunt'?10:40;
  }
  if(swift)return Math.max(ground+70,95);
  if(kind==='land')return ground+Math.max(.18,profile.wingspan*.32);
  if(kind==='hunt')return ground+(profile.id==='hummingbird'?11:profile.id==='kingfisher'?10:profile.id==='heron'?8:14);
  return ground+(flight==='soar'?112:flight==='dash'?90:58);
 }
 function target(px,pz,height){
  tx=px;tz=pz;ty=height;
 }
 let lastPatrolBiome=null;
 function selectPatrol(){
  let bestX=x,bestZ=z,best=-Infinity;
  // Marine birds may circle coastal bays or open water, but raptors and forest
  // birds strongly favor terrestrial habitat at every waypoint.
  for(let i=0;i<23;i++){
   const angle=rng()*TAU,dist=120+rng()*(marine?690:Math.max(200,Math.min(profile.radius,840)));
   const px=x+Math.cos(angle)*dist,pz=z+Math.sin(angle)*dist;
   const habitat=habitatAt(px,pz,seed);
   const preference=birdHabitatScore(profile,habitat);
   // Keep regional routes bounded. Marine birds circle the island, not infinity.
   const outside=Math.max(0,Math.hypot(px/5100,pz/4400)-1);
   const score=preference+rng()*.13-outside*1.2;
   if(score>best){best=score;bestX=px;bestZ=pz;lastPatrolBiome=habitat.type;}
  }
  // Land birds that have crossed the sea seek a definite inland target.
  if(!marine&&best<.18){
   bestX=homeX;bestZ=homeZ;lastPatrolBiome=habitatAt(homeX,homeZ,seed).type;
  }
  target(bestX,bestZ,clearance(bestX,bestZ,'cruise')+rng()*32);
 }
 function transition(next,t){state=next;activityChangedAt=t;}
 function chooseAction(t,day,rain){
  const shouldSleep=owl?day>.67:day<.1;
  if(shouldSleep&&!swift&&state!=='rest'&&state!=='landing'){
   transition('shelter',t);const px=marine?x:homeX,pz=marine?z:homeZ;
   target(px,pz,clearance(px,pz,'land'));until=t+34;return;
  }
  if(rain>.70&&!marine&&state!=='shelter'&&state!=='rest'){
   transition('shelter',t);target(homeX,homeZ,clearance(homeX,homeZ,'land'));until=t+25;return;
  }
  if((energy<.27||shouldSleep)&&!swift){
   transition('return',t);
   const px=marine?x:homeX,pz=marine?z:homeZ;
   target(px,pz,clearance(px,pz,'land'));until=t+40;return;
  }
  if(hunger>.56){
   food=resourcePoint(profile,x,z,rng,seed);
   if(!food.unavailable){
     transition('seek_food',t);
     target(food.x,food.z,clearance(food.x,food.z,'cruise'));
     const trip=Math.hypot(food.x-x,food.z-z)/Math.max(14,cruise*.65);
     until=t+Math.min(450,Math.max(26,trip*1.55+12));
     return;
   }
   // An absent feeding site is not an invisible food source. Continue
   // ecological search, then retry from a different patrol location.
  }
  transition('patrol',t);selectPatrol();until=t+9+rng()*11;
 }
 return {
 update(t,dt,day=1,rain=0){
  dt=clamp(dt,0,.10);day=clamp(day);rain=clamp(rain);
  currentTime=t;currentRain=rain;
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
   if(Math.hypot(tx-x,tz-z)<21){
     landingRest=false;
     if(food?.kind==='fish'){
       // Fishers skim/dive above the actual river or sea surface: unlike
       // ground feeders, they must not land on the dry riverbed to "eat".
       transition('feed',t);until=t+3+rng()*3;feedings++;
       target(tx,tz,clearance(tx,tz,'hunt'));
     }else{
       transition('landing',t);target(tx,tz,clearance(tx,tz,'land'));
     }
   }
  }
  else if(state==='landing'){
   if(Math.hypot(tx-x,tz-z)<10&&Math.abs(y-clearance(x,z,'land'))<3.4){
    transition(landingRest?'rest':'feed',t);until=t+(landingRest?20+rng()*14:5+rng()*6);landings++;if(!landingRest)feedings++;
   }
  }
  else if(state==='feed'&&t>=until){transition('takeoff',t);selectPatrol();until=t+3;}
  else if(state==='return'&&Math.hypot(tx-x,tz-z)<15){
   landingRest=true;transition('landing',t);target(tx,tz,clearance(tx,tz,'land'));
  }
  else if(state==='shelter'&&Math.hypot(tx-x,tz-z)<15&&Math.abs(y-clearance(x,z,'land'))<4){
   landingRest=true;transition('landing',t);
  }
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
  const onGround=state==='rest'||(state==='feed'&&food?.kind!=='fish');
  const overOcean=marine&&terrainHeight(x,z,seed)<-12;
  const floating=overOcean&&state==='rest';
  const slowing=state==='approach'||state==='landing'||state==='return'||state==='shelter';
  let wanted=onGround?0:cruise*(state==='seek_food'?1.08:state==='patrol'?1:state==='takeoff'?.9:slowing?.62:.78);
  if(slowing&&dist<80)wanted*=clamp(dist/80,.12,1);
  const acceleration=onGround?65:profile.flight==='dash'?38:29;
  velocity+=clamp(wanted-velocity,-acceleration*dt,acceleration*dt);
  const step=Math.min(dist,Math.max(0,velocity)*dt);
  x-=Math.sin(heading)*step;z-=Math.cos(heading)*step;
  const floor=clearance(x,z,onGround||state==='landing'||state==='rest'||state==='shelter'?'land':'hunt');
  let goal=Math.max(floor,ty);
  if(overOcean&&(state==='landing'||state==='rest'||state==='shelter')){
    // A marine bird must track the *rendered* wave height rather than a
    // constant -7 m rest altitude or an earlier crest from another frame.
    goal=floor;
  }
  if(state==='patrol'||state==='takeoff'||state==='seek_food'){
   goal=Math.max(goal,clearance(x,z,'cruise'));
  }
  const dy=clamp(goal-y,-(state==='landing'?22:15)*dt,20*dt);
  y+=dy;y=Math.max(y,floor);
  let waterPitch=0,waterRoll=0;
  if(floating){
    // Slow drifting gives life to resting seabirds. It does not move the
    // destination or consume an extra AI navigation step.
    x+=Math.sin(t*.17+seed*.001)*dt*.055;
    z+=Math.cos(t*.13+seed*.002)*dt*.045;
    const wave=oceanFloatPose(x,z,t,rain,profile.wingspan,buoyancy);
    y=Math.max(wave.y,y-2.6*dt);
    waterPitch=wave.pitch;waterRoll=wave.roll;
  }
  const grounded=onGround&&velocity<.8&&!floating;
  return {x,y,z,heading,bank:clamp(diff*.22,-.48,.48),pitch:clamp(dy*1.4,-.30,.30),
   floating,waterPitch,waterRoll,
   state,mode:state,speed:velocity,velocity,resting:grounded||floating,grounded,
   wingsFolded:grounded||floating||state==='rest'||state==='landing',flapping:state==='takeoff'||flight==='hover',
   hunger,energy,food:food?.kind||null,feedingHabitat:food?.biome||null,landings,feedings};
 },
 get state(){return state;},
 get snapshot(){return {x,y,z,heading,velocity,energy,hunger};},
 get diagnostics(){return {state,energy,hunger,landings,feedings,lastPatrolBiome,home:{x:homeX,z:homeZ}};}
 };
}
