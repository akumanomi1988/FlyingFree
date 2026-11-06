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
  const phase=(seed%997)*.0071;
  const cx=x-140-Math.sin(phase)*220,cz=z+110-Math.cos(phase)*160;
  const theta=Math.atan2(cz,cx);
  const radial=Math.hypot(cx/4050,cz/3200);
  const coastline=1+.13*Math.sin(3*theta+phase)+.095*Math.sin(5*theta-2*phase)+
    .07*Math.sin(9*theta+.4+phase)+valueNoise(cx*.00052+8,cz*.00052-6,seed+71)*.11;
  return {radial:radial/coastline,cx,cz};
}
export function tropicalRiverPoint(channel,t,seed=1988,out={}){
  const bearing=directions[channel];
  if(bearing===undefined)throw new RangeError('Unknown river channel');
  const phase=(seed%811)*.008;
  const length=channel===2?3050:4100;
  const angle=bearing+Math.sin(phase+channel)*.085;
  const along=length*clamp(t),bend=Math.sin(t*9+phase+channel*1.7)*125*Math.sin(Math.PI*t);
  out.x=Math.cos(angle)*along-Math.sin(angle)*bend+140;
  out.z=Math.sin(angle)*along+Math.cos(angle)*bend-110;
  return out;
}
function riverField(x,z,seed){
  let influence=0,water=0,riverIndex=-1;
  const phase=(seed%811)*.008;
  for(let i=0;i<3;i++){
    const length=i===2?3050:4100,angle=directions[i]+Math.sin(phase+i)*.085;
    const px=x-140,pz=z+110;
    const along=px*Math.cos(angle)+pz*Math.sin(angle);
    const t=along/length;
    if(t<.08||t>.97)continue;
    const lateral=-px*Math.sin(angle)+pz*Math.cos(angle)-
      Math.sin(t*9+phase+i*1.7)*125*Math.sin(Math.PI*t);
    const valleyWidth=80+(1-t)*72;
    const valley=Math.exp(-Math.pow(lateral/valleyWidth,2))*smooth(.08,.19,t)* (1-smooth(.87,.97,t));
    if(valley>influence){influence=valley;riverIndex=i;}
    const flowWidth=15+13*t;
    const channelInfluence=1-smooth(flowWidth,flowWidth+7,Math.abs(lateral));
    if(channelInfluence>water)water=channelInfluence;
  }
  return {valley:influence,river:water,channel:riverIndex};
}
export function tropicalTerrainSample(x,z,seed=1988){
  const shape=islandShape(x,z,seed);
  const inland=1-smooth(.78,1.10,shape.radial);
  const coastal=smooth(.91,.66,shape.radial); // 1 inland, 0 outside coast
  const large=layered(x*.00032,z*.00032,seed+97);
  const ridges=1-Math.abs(layered(x*.00145,z*.00145,seed+137));
  const ridgeSharp=ridges*ridges*ridges;
  const highland=Math.pow(Math.max(0,1-shape.radial),1.33);
  const mountainSpine=Math.exp(-Math.pow((shape.cz*.79+shape.cx*.40+170)/1350,2));
  const peaks=Math.exp(-((shape.cx+800)**2/(980*980)+(shape.cz-260)**2/(930*930))) * 540+
    Math.exp(-((shape.cx-1050)**2/(1050*1050)+(shape.cz+680)**2/(900*900)))*510+
    Math.exp(-((shape.cx-100)**2/(1300*1300)+(shape.cz-1350)**2/(840*840)))*280;
  const relief=160+large*90+highland*(430*mountainSpine+360*ridgeSharp)+peaks;
  const slopes=layered(x*.0029,z*.0029,seed+207)*24*inland;
  let height=-38+inland*relief+slopes;
  const river=riverField(x,z,seed);
  // Broad eroded valleys with a narrower wet channel, cut into the same height
  // field used by physics and ecology (no decorative floating river-only lines).
  height-=river.valley*(20+52*highland+highland*ridgeSharp*30);
  return {height,river:river.river,valley:river.valley,channel:river.channel,
    coast:shape.radial,land:height>TROPICAL_WORLD.seaLevel,
    mountain:highland,humidity:clamp(.69+.21*large+river.valley*.24)};
}
export function tropicalTerrainHeight(x,z,seed=1988){
  return tropicalTerrainSample(x,z,seed).height;
}
export function tropicalLandscapeSeed(date=new Date()){
  const utc=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
  return Math.max(1,Math.floor(utc/86400000));
}
