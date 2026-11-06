import {terrainHeight,fbm,random,clamp,TAU} from './core.js';
import {tropicalTerrainSample,TROPICAL_WORLD} from './tropicalTerrain.js';

// Coarse habitat classification is only evaluated at population/LOD refresh, never per draw call.
export function habitatAt(x,z,seed=1988){
 const data=tropicalTerrainSample(x,z,seed);
 const height=data.height;
 const slope=Math.hypot(terrainHeight(x+9,z,seed)-terrainHeight(x-9,z,seed),
   terrainHeight(x,z+9,seed)-terrainHeight(x,z-9,seed))/18;
 const humidity=clamp(data.humidity+fbm(x*.0013+14,z*.0013-3,seed)*.12);
 if(height<TROPICAL_WORLD.seaLevel)return {type:'ocean',height,slope,humidity,river:0,coast:data.coast};
 if(data.river>.40||data.valley>.42&&height<230)
   return {type:'wetland',height,slope,humidity,river:data.river,coast:data.coast};
 if(height<25)return {type:'shore',height,slope,humidity,river:0,coast:data.coast};
 if(height>625||slope>1.15)return {type:'rock',height,slope,humidity,river:0,coast:data.coast};
 if(height>370)return {type:'highland',height,slope,humidity,river:0,coast:data.coast};
 if(humidity>.43)return {type:'forest',height,slope,humidity,river:0,coast:data.coast};
 return {type:'meadow',height,slope,humidity,river:0,coast:data.coast};
}

// Relative attractiveness determines navigation AND feeding. It is never a
// binary prohibition: a land bird can cross the coast, but won't patrol at sea.
const HABITAT_AFFINITIES=Object.freeze({
 albatross:{ocean:1,shore:.45,wetland:.17,forest:.005,meadow:.006,highland:.005,rock:.005},
 gull:{ocean:.9,shore:1,wetland:.65,forest:.025,meadow:.1,highland:.025,rock:.2},
 osprey:{ocean:.13,shore:1,wetland:.95,forest:.32,meadow:.36,highland:.29,rock:.28},
 kingfisher:{ocean:.015,shore:.29,wetland:1,forest:.72,meadow:.50,highland:.015,rock:.005},
 heron:{ocean:.02,shore:.78,wetland:1,forest:.17,meadow:.49,highland:.005,rock:.005},
 eagle:{ocean:.005,shore:.17,wetland:.18,forest:.59,meadow:.71,highland:1,rock:.88},
 vulture:{ocean:.005,shore:.08,wetland:.10,forest:.34,meadow:.66,highland:1,rock:.95},
 kestrel:{ocean:.005,shore:.19,wetland:.39,forest:.68,meadow:1,highland:.73,rock:.40},
 hummingbird:{ocean:.002,shore:.18,wetland:.44,forest:1,meadow:.88,highland:.06,rock:.005},
 owl:{ocean:.002,shore:.18,wetland:.4,forest:1,meadow:.6,highland:.28,rock:.04},
 swift:{ocean:.02,shore:.35,wetland:.48,forest:.68,meadow:.92,highland:.71,rock:.15},
 swallow:{ocean:.015,shore:.37,wetland:.76,forest:.72,meadow:1,highland:.24,rock:.05}
});
export function birdHabitatScore(profile,habitat){
 return HABITAT_AFFINITIES[profile.id]?.[habitat.type]??.25;
}
export function foodType(profile){
 if(['swift','swallow','hummingbird'].includes(profile.id))return profile.id==='hummingbird'?'nectar':'insect';
 if(['osprey','kingfisher','heron','albatross','gull'].includes(profile.id))return 'fish';
 if(profile.id==='vulture')return 'carrion';
 return 'small-prey';
}
export function animalPreferredHabitat(profile){
 const f=foodType(profile);
 return f==='fish'?'shore':f==='nectar'?'meadow':f==='carrion'?'highland':'meadow';
}
export function resourcePoint(profile,originX,originZ,rng,seed=1988){
 const kind=foodType(profile);
 let best=null,bestScore=-Infinity;
 for(let i=0;i<44;i++){
  const angle=rng()*TAU,radius=65+rng()*(profile.flight==='marine'?550:530);
  const x=originX+Math.cos(angle)*radius,z=originZ+Math.sin(angle)*radius;
  const h=habitatAt(x,z,seed);
  let preference=birdHabitatScore(profile,h);
  // Food and habitat agree: fish-eaters use coast, streams and near-shore water.
  if(kind==='fish'&&['wetland','shore','ocean'].includes(h.type))preference+=.22;
  if(kind==='nectar'&&['forest','meadow'].includes(h.type))preference+=.17;
  if(kind==='carrion'&&['highland','rock','meadow'].includes(h.type))preference+=.14;
  // Favor plausible targets without making the path overly deterministic.
  const score=preference+rng()*.20;
  if(score>bestScore){bestScore=score;best={x,y:h.height,z,kind,biome:h.type};}
 }
 if(best&&bestScore>.28)return best;
 const h=habitatAt(originX,originZ,seed);
 return {x:originX,y:h.height,z:originZ,kind,biome:h.type};
}
export function insectActivity(day,rain,temperature=18){
 return clamp((day-.1)*1.25)*clamp((30-Math.abs(temperature-20))/30)*clamp(1-rain*1.5);
}
export function foliageDensity(habitat,kind){
 if(habitat.type==='ocean'||habitat.type==='rock')return 0;
 if(kind==='grass')return habitat.type==='meadow'?1:habitat.type==='forest'?.65:habitat.type==='wetland'?.7:habitat.type==='shore'?.25:.18;
 if(kind==='flower'||kind==='flowers')return habitat.type==='meadow'?.8:habitat.type==='forest'?.3:habitat.type==='wetland'?.40:habitat.type==='shore'?.25:0;
 if(kind==='shrub'||kind==='shrubs')return habitat.type==='forest'?.95:habitat.type==='wetland'?.85:habitat.type==='highland'?.55:habitat.type==='meadow'?.35:.15;
 return 0;
}
export function stableCellSeed(x,z,kind=0){return (Math.imul(Math.floor(x),104729)^Math.imul(Math.floor(z),130363)^Math.imul(kind+3,991))>>>0;}
export function makeCellRandom(x,z,kind){return random(stableCellSeed(x,z,kind))}
