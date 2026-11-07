// Seeded tropical volcanic island in metres. Pure functions: repeatable across
// the terrain mesh, wildlife navigation, vegetation and rivers.
const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
function hash(x,z,seed) {
  let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(seed,1442695041);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}
function valueNoise(x,z,seed){
  const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);
  const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);
  return ((a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v)*2-1;
}
function layered(x,z,seed){
  return valueNoise(x,z,seed)*.57+valueNoise(x*2.03+4.7,z*2.03-3.2,seed+27)*.29+
    valueNoise(x*4.12-9,z*4.12+5,seed+59)*.14;
}
const directions=[-.17,2.94,1.61];
export const TROPICAL_WORLD=Object.freeze({extent:12000,halfExtent:6000,seaLevel:-9,riverCount:3});

function islandShape(x,z,seed){
  const phase=((Math.imul(seed|0,1103515245)>>>0)/4294967296)*TAU;
  const cx=x-140-Math.sin(phase)*220,cz=z+110-Math.cos(phase)*160;
  const theta=Math.atan2(cz,cx);
  const radial=Math.hypot(cx/4050,cz/3200);
  const coastline=1+.13*Math.sin(3*theta+phase)+.095*Math.sin(5*theta-2*phase)+
    .07*Math.sin(9*theta+.4+phase)+valueNoise(cx*.00052+8,cz*.00052-6,seed+71)*.11;
  return {radial:radial/coastline,cx,cz};
}
const lengthCache=new Map();
function riverLengths(seed){
  let lengths=lengthCache.get(seed);
  if(lengths)return lengths;
  const phase=(seed%811)*.008;
  lengths=directions.map((bearing,channel)=>{
    const angle=bearing+Math.sin(phase+channel)*.085;
    // Trace the actual irregular seeded shoreline outward, rather than using
    // three hardcoded radii (which left inland rivers ending inside forest).
    for(let along=2100;along<=6100;along+=70){
      const x=Math.cos(angle)*along+140,z=Math.sin(angle)*along-110;
      if(islandShape(x,z,seed).radial>=1.105)return along;
    }
    return 6250; // world beyond the last coastal sample is deep open ocean.
  });
  if(lengthCache.size>=16)lengthCache.delete(lengthCache.keys().next().value);
  lengthCache.set(seed,lengths);
  return lengths;
}
export function tropicalRiverLength(channel,seed=1988){
  if(!Number.isInteger(channel)||channel<0||channel>=directions.length)
    throw new RangeError('Unknown river channel');
  return riverLengths(seed)[channel];
}
// Several seed-shifted wavelengths form a non-periodic-looking course.
// The same expression drives terrain valley carving and water geometry.
function riverMeander(t,phase,channel){
 return Math.sin(Math.PI*t)*(
  Math.sin(t*8.7+phase+channel*1.7)*89+
  Math.sin(t*19.3+phase*1.46+channel*2.4)*31+
  Math.sin(t*35.9+phase*.73-channel*1.19)*12);
}
export function tropicalRiverPoint(channel,t,seed=1988,out={}){
  const bearing=directions[channel];
  if(bearing===undefined)throw new RangeError('Unknown river channel');
  const phase=(seed%811)*.008,length=tropicalRiverLength(channel,seed);
  const angle=bearing+Math.sin(phase+channel)*.085;
  const along=length*clamp(t,0,1.05),bend=riverMeander(t,phase,channel);
  out.x=Math.cos(angle)*along-Math.sin(angle)*bend+140;
  out.z=Math.sin(angle)*along+Math.cos(angle)*bend-110;
  return out;
}
function riverField(x,z,seed){
  let influence=0,water=0,riverIndex=-1,riverT=0,riverLateral=Infinity;
  const phase=(seed%811)*.008;
  for(let i=0;i<3;i++){
    const length=riverLengths(seed)[i],angle=directions[i]+Math.sin(phase+i)*.085;
    const px=x-140,pz=z+110;
    const along=px*Math.cos(angle)+pz*Math.sin(angle);
    const t=along/length;
    if(t<.08||t>1.035)continue;
    const lateral=-px*Math.sin(angle)+pz*Math.cos(angle)-
      riverMeander(t,phase,i);
    const valleyWidth=80+(1-t)*72;
    const valley=Math.exp(-Math.pow(lateral/valleyWidth,2))*smooth(.08,.19,t)*(1-smooth(.94,1.035,t));
    if(valley>influence){influence=valley;riverIndex=i;riverT=t;riverLateral=lateral;}
    const flowWidth=tropicalRiverWidth(i,t,seed);
    const channelInfluence=1-smooth(flowWidth,flowWidth+7,Math.abs(lateral));
    if(channelInfluence>water)water=channelInfluence;
  }
  return {valley:influence,river:water,channel:riverIndex,
    t:riverT,lateral:riverLateral};
}
// Unmodified volcanic surface: profiles are derived from this, avoiding
// recursive terrain -> profile -> terrain calls.
function baselineTerrainSample(x,z,seed=1988){
  const shape=islandShape(x,z,seed);
  const inland=1-smooth(.78,1.10,shape.radial);
  const coastal=smooth(.91,.66,shape.radial); // 1 inland, 0 outside coast
  const large=layered(x*.00032,z*.00032,seed+97);
  const ridges=1-Math.abs(layered(x*.00145,z*.00145,seed+137));
  const ridgeSharp=ridges*ridges*ridges;
  const highland=Math.pow(Math.max(0,1-shape.radial),1.33);
  // Rotate volcanic massifs independently of coast shape so a new seed
  // genuinely changes mountain/valley geography, not just surface noise.
  const spin=(seed%1499)*.00419,cs=Math.cos(spin),sn=Math.sin(spin);
  const mx=shape.cx*cs-shape.cz*sn,mz=shape.cx*sn+shape.cz*cs;
  const mountainSpine=Math.exp(-Math.pow((mz*.79+mx*.40+170)/1350,2));
  const peaks=Math.exp(-((mx+800)**2/(980*980)+(mz-260)**2/(930*930))) * 540+
    Math.exp(-((mx-1050)**2/(1050*1050)+(mz+680)**2/(900*900)))*510+
    Math.exp(-((mx-100)**2/(1300*1300)+(mz-1350)**2/(840*840)))*280;
  const relief=160+large*90+highland*(430*mountainSpine+360*ridgeSharp)+peaks;
  const slopes=layered(x*.0029,z*.0029,seed+207)*24*inland;
  // Cliff sectors rise sharply near the sea rather than making the whole
  // coastline a uniform ring of sand. Soft masks keep bays and beaches.
  const cliffSector=smooth(.06,.31,layered(x*.00048+3,z*.00048-7,seed+399));
  const cliffRim=smooth(.73,.85,shape.radial)*
    (1-smooth(.96,1.055,shape.radial));
  const cliffHeight=cliffSector*cliffRim*(42+31*ridgeSharp);
  let height=-38+inland*relief+slopes+cliffHeight;
  const river=riverField(x,z,seed);
  // Broad eroded valleys with a narrower wet channel, cut into the same height
  // field used by physics and ecology (no decorative floating river-only lines).
  height-=river.valley*(20+52*highland+highland*ridgeSharp*30);
  return {height,river:river.river,valley:river.valley,channel:river.channel,
    riverT:river.t,riverLateral:river.lateral,
    coast:shape.radial,land:height>TROPICAL_WORLD.seaLevel,
    mountain:highland,humidity:clamp(.69+.21*large+river.valley*.24)};
}
// A hydrologically ordered longitudinal water surface. River elevation can
// never rise along its journey to sea; terrain is carved from the exact same
// surface subsequently used for both visible water and fish habitat.
const profileCache=new Map();
export function tropicalRiverWidth(channel,t,seed=1988){
  return Math.max(5.5,9.2+17.5*t+Math.sin(t*24+channel*2.37+seed*.001)*2.5+
    Math.sin(t*58+channel*1.8)*.95);
}
function riverProfile(channel,seed){
  const key=seed+':'+channel;
  if(profileCache.has(key))return profileCache.get(key);
  const n=252,first=.10,last=1.035,length=tropicalRiverLength(channel,seed),raw=[];
  const p={};
  for(let i=0;i<=n;i++){
    const t=first+(last-first)*i/n;
    tropicalRiverPoint(channel,t,seed,p);
    raw.push(baselineTerrainSample(p.x,p.z,seed).height);
  }
  const surface=new Float64Array(n+1);
  let previous=Infinity;
  for(let i=0;i<=n;i++){
    // Five samples suppress visual waterfalls caused by sub-mesh terrain
    // noise; genuine steep drops remain where the valley actually descends.
    let avg=0,weight=0;
    for(let j=-2;j<=2;j++){
      const ix=clamp(i+j,0,n),w=3-Math.abs(j);
      avg+=raw[ix]*w;weight+=w;
    }
    const smoothed=avg/weight-.45;
    const fall=length*(last-first)/n*.0021;
    surface[i]=Math.max(TROPICAL_WORLD.seaLevel+.16,
      Math.min(smoothed,i===0?smoothed:previous-fall));
    previous=surface[i];
  }
  // A running minimum alone creates abrupt, artificial ramps whenever the
  // noisy volcanic surface dips. Smooth that *monotone* course with a compact
  // triangular low-pass kernel (~500 m of river) to distribute relief into
  // natural reaches without introducing any uphill water.
  const shaped=new Float64Array(n+1),radius=13;
  for(let i=0;i<=n;i++){
    let sum=0,weights=0;
    for(let d=-radius;d<=radius;d++){
      const index=clamp(i+d,0,n),w=radius+1-Math.abs(d);
      sum+=surface[index]*w;weights+=w;
    }
    shaped[i]=sum/weights;
  }
  const profile={surface:shaped,first,last,n,length};
  if(profileCache.size>=48)profileCache.delete(profileCache.keys().next().value);
  profileCache.set(key,profile);
  return profile;
}
function profileLevel(channel,t,seed){
  const p=riverProfile(channel,seed);
  const u=clamp((t-p.first)/(p.last-p.first),0,1)*p.n;
  const i=Math.min(p.n-1,Math.floor(u));
  return p.surface[i]+(p.surface[i+1]-p.surface[i])*(u-i);
}
export function tropicalRiverFrame(channel,t,seed=1988,out={}){
  if(!Number.isInteger(channel)||channel<0||channel>=TROPICAL_WORLD.riverCount)
    throw new RangeError('Unknown river channel');
  const p={},before={},after={};
  const tc=clamp(t,.10,1.035);
  tropicalRiverPoint(channel,tc,seed,p);
  tropicalRiverPoint(channel,tc-.001,seed,before);
  tropicalRiverPoint(channel,tc+.001,seed,after);
  const dx=after.x-before.x,dz=after.z-before.z,length=Math.hypot(dx,dz)||1;
  out.x=p.x;out.z=p.z;out.t=tc;
  out.dx=dx/length;out.dz=dz/length;
  out.nx=-out.dz;out.nz=out.dx;
  out.halfWidth=tropicalRiverWidth(channel,tc,seed);
  out.waterY=profileLevel(channel,tc,seed);
  out.bedDepth=1.6+1.4*tc;
  const step=.003,up=profileLevel(channel,Math.max(.10,tc-step),seed),
    down=profileLevel(channel,Math.min(1.035,tc+step),seed);
  out.slope=clamp((up-down)/(2*step*tropicalRiverLength(channel,seed)),0,2);
  return out;
}
export function tropicalTerrainSample(x,z,seed=1988){
  const result=baselineTerrainSample(x,z,seed);
  if(result.channel<0||result.riverT<.10||result.riverT>1.035)return result;
  const d=Math.abs(result.riverLateral),w=tropicalRiverWidth(result.channel,result.riverT,seed);
  if(d>w+32||result.height<TROPICAL_WORLD.seaLevel-2)return result;
  const waterY=profileLevel(result.channel,result.riverT,seed);
  const depth=1.6+1.4*result.riverT;
  const channelWeight=1-smooth(w+1,w+25,d);
  const bedShape=1-smooth(0,w+2,d);
  const desired=waterY-depth*bedShape;
  // This depression is part of the actual terrain height field, not a
  // cosmetic river texture floating above an unmodified mountain mesh.
  const carve=Math.max(0,result.height-desired)*channelWeight;
  result.height-=carve;
  result.land=result.height>TROPICAL_WORLD.seaLevel;
  result.river=Math.max(result.river,1-smooth(w-1,w+6,d));
  return result;
}
export function tropicalTerrainHeight(x,z,seed=1988){
  return tropicalTerrainSample(x,z,seed).height;
}
export function tropicalLandscapeSeed(date=new Date()){
  const utc=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
  const days=Math.floor(utc/86400000);
  return ((Math.imul(days,1103515245)+12345)>>>0)&0x7fffffff||1;
}
