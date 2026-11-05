import {terrainHeight,fbm,random,clamp,TAU} from './core.js';

// Coarse habitat classification is only evaluated at population/LOD refresh, never per draw call.
export function habitatAt(x,z){
 const height=terrainHeight(x,z),slope=Math.hypot(terrainHeight(x+7,z)-terrainHeight(x-7,z),terrainHeight(x,z+7)-terrainHeight(x,z-7))/14;
 const humidity=clamp(.54+fbm(x*.0011+14,z*.0011-3)*.44);
 if(height< -8)return {type:'ocean',height,slope,humidity};
 if(height<24)return {type:'shore',height,slope,humidity};
 if(height>310||slope>.9)return {type:'rock',height,slope,humidity};
 if(height>225)return {type:'highland',height,slope,humidity};
 if(humidity>.51&&height>55)return {type:'forest',height,slope,humidity};
 return {type:'meadow',height,slope,humidity};
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
export function resourcePoint(profile,originX,originZ,rng){
 const kind=foodType(profile);
 const marine=profile.flight==='marine';
 let best=null;
 for(let i=0;i<55;i++){
  const angle=rng()*TAU,radius=80+rng()*(marine?350:280);
  let x=originX+Math.cos(angle)*radius,z=originZ+Math.sin(angle)*radius;
  if(marine){const a=Math.atan2(z,x),r=Math.max(1750,Math.min(2250,Math.hypot(x,z)));x=Math.cos(a)*r;z=Math.sin(a)*r;}
  const h=habitatAt(x,z);
  let good=marine?h.height< -8:
    kind==='fish'?h.type==='shore'||h.type==='ocean':
    kind==='nectar'?h.type==='meadow'||h.type==='forest':
    kind==='carrion'?h.type==='highland'||h.type==='rock':
    h.type==='forest'||h.type==='meadow'||h.type==='highland';
  if(good){best={x,y:h.height,z,kind,biome:h.type};break;}
 }
 if(best)return best;
 const h=habitatAt(originX,originZ);
 return {x:originX,y:h.height,z:originZ,kind,biome:h.type};
}
export function insectActivity(day,rain,temperature=18){
 return clamp((day-.1)*1.25)*clamp((30-Math.abs(temperature-20))/30)*clamp(1-rain*1.5);
}
export function foliageDensity(habitat,kind){
 if(habitat.type==='ocean'||habitat.type==='rock')return 0;
 if(kind==='grass')return habitat.type==='meadow'?1:habitat.type==='forest'?.65:habitat.type==='shore'?.25:.18;
 if(kind==='flower'||kind==='flowers')return habitat.type==='meadow'?.8:habitat.type==='forest'?.3:habitat.type==='shore'?.25:0;
 if(kind==='shrub'||kind==='shrubs')return habitat.type==='forest'?.9:habitat.type==='highland'?.55:habitat.type==='meadow'?.35:.15;
 return 0;
}
export function stableCellSeed(x,z,kind=0){return (Math.imul(Math.floor(x),104729)^Math.imul(Math.floor(z),130363)^Math.imul(kind+3,991))>>>0;}
export function makeCellRandom(x,z,kind){return random(stableCellSeed(x,z,kind))}
