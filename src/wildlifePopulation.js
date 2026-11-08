import {random,terrainHeight,TAU} from './core.js';
import {habitatAt} from './ecology.js';
import {faunaPathAngle} from './faunaLOD.js';

// Detailed animals are a fixed rig pool; world-space habitats are deterministic.
export const WILDLIFE_CELL_SIZE=360;
const MAX_CACHE_CELLS=256;
const TYPE_SALT={deer:0x51a5,fox:0x81b7,rabbit:0x13e7};
const TYPES=['deer','fox','rabbit'];
const RANGES={deer:[28,180],fox:[28,235],rabbit:[13,180]};

export function wildlifeCellCandidates(seed,cx,cz,type){
  if(!Object.hasOwn(TYPE_SALT,type))throw new RangeError('Unknown wildlife '+type);
  const rng=random((Math.imul(cx+401,73856093)^Math.imul(cz-517,19349663)^
    seed^TYPE_SALT[type])>>>0);
  const result=[],slots=type==='rabbit'?3:2;
  for(let slot=0;slot<slots;slot++){
    const x=(cx+.12+rng()*.76)*WILDLIFE_CELL_SIZE;
    const z=(cz+.12+rng()*.76)*WILDLIFE_CELL_SIZE;
    const habitat=habitatAt(x,z,seed),[min,max]=RANGES[type];
    const allowed=habitat.type==='forest'||habitat.type==='meadow'||
      habitat.type==='wetland'||(type==='fox'&&habitat.type==='shore');
    const density=habitat.type==='forest'?.94:habitat.type==='meadow'?.88:.70;
    if(!allowed||habitat.height<min||habitat.height>max||
       habitat.slope>1.12||rng()>density)continue;
    result.push({
      key:type+':'+cx+':'+cz+':'+slot,type,x,z,
      phase:rng()*TAU,cycle:13+rng()*19,seedOffset:rng()*100
    });
  }
  return result;
}

export function createWildlifePopulation(actors,{seed=1988,initialObserver=null}={}){
  const groups=new Map(TYPES.map(type=>[type,actors.filter(
    actor=>actor.userData.state.type===type)]));
  const cache=new Map();
  let lastCell=null,lastHero={x:0,z:0},lastRefreshX=NaN,lastRefreshZ=NaN,
    cellUpdates=0,relocated=0,activeAnchors=0;

  function cached(type,cx,cz){
    const key=type+':'+cx+':'+cz;
    if(cache.has(key))return cache.get(key);
    const records=wildlifeCellCandidates(seed,cx,cz,type);
    cache.set(key,records);
    if(cache.size>MAX_CACHE_CELLS)cache.delete(cache.keys().next().value);
    return records;
  }

  function update(time,hero=null,observer=null,initial=false){
    if(!hero||!Number.isFinite(hero.x)||!Number.isFinite(hero.z))return;
    const cx=Math.floor(hero.x/WILDLIFE_CELL_SIZE);
    const cz=Math.floor(hero.z/WILDLIFE_CELL_SIZE);
    const cell=cx+':'+cz;
    lastHero.x=hero.x;lastHero.z=hero.z;
    // A world created without a known observer keeps its existing seeded
    // residents on first contact; relocating then would look like teleportation.
    if(lastCell===null&&!initialObserver&&!initial){
      lastCell=cell;lastRefreshX=hero.x;lastRefreshZ=hero.z;return;
    }
    // The observer can traverse almost an entire 360 m cell without
    // crossing its boundary. Refresh the local rig assignment after 150 m
    // so the nearby habitat does not empty while the camera is travelling.
    if(cell===lastCell&&!initial&&
       Math.hypot(hero.x-lastRefreshX,hero.z-lastRefreshZ)<150)return;
    lastCell=cell;lastRefreshX=hero.x;lastRefreshZ=hero.z;cellUpdates++;
    const eye=observer||hero;
    activeAnchors=0;
    for(const type of TYPES){
      const pool=groups.get(type),candidates=[];
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
        for(const anchor of cached(type,cx+dx,cz+dz)){
          const dist2=(anchor.x-hero.x)**2+(anchor.z-hero.z)**2;
          if(dist2>1000*1000||dist2<50*50)continue;
          candidates.push({...anchor,dist2});
        }
      }
      candidates.sort((a,b)=>a.dist2-b.dist2||a.key.localeCompare(b.key));
      const chosen=candidates.slice(0,pool.length);
      activeAnchors+=chosen.length;
      const wanted=new Map(chosen.map(a=>[a.key,a]));
      for(const actor of pool){
        const key=actor.userData.populationKey;
        if(key&&wanted.has(key))wanted.delete(key);
      }
      const desiredKeys=new Set(chosen.map(a=>a.key));
      const donors=pool.filter(actor=>{
        if(desiredKeys.has(actor.userData.populationKey))return false;
        if(initial)return true;
        // Never recycle an animal the observer could already distinguish.
        return Math.hypot(actor.position.x-eye.x,actor.position.z-eye.z)>480;
      }).sort((a,b)=>
        Math.hypot(b.position.x-eye.x,b.position.z-eye.z)-
        Math.hypot(a.position.x-eye.x,a.position.z-eye.z));
      for(const anchor of wanted.values()){
        if(!donors.length)break;
        if(!initial&&Math.hypot(anchor.x-eye.x,anchor.z-eye.z)<240)continue;
        const actor=donors.shift(),state=actor.userData.state;
        actor.userData.populationKey=anchor.key;
        state.originX=anchor.x;state.originZ=anchor.z;
        state.phase=anchor.phase;state.seed=anchor.seedOffset;state.cycle=anchor.cycle;
        state.reactionX=0;state.reactionZ=0;state.lastTime=null;
        state.lastSlopeAt=-Infinity;state.tiltPitch=0;state.tiltRoll=0;
        const angle=faunaPathAngle(time,state);
        state.anchorSin=Math.sin(angle);
        state.anchorCos=Math.cos(angle*.83);
        actor.position.set(anchor.x,terrainHeight(anchor.x,anchor.z,seed),anchor.z);
        actor.rotation.set(0,anchor.phase,0);
        relocated++;
      }
    }
  }

  if(initialObserver)update(0,initialObserver,initialObserver,true);
  return {
    update,
    get stats(){
      const nearby=lastCell!==null?actors.filter(actor=>
        Math.hypot(actor.position.x-lastHero.x,actor.position.z-lastHero.z)<900).length:0;
      return {totalActors:actors.length,nearby,activeAnchors,cellUpdates,
        relocated,cachedCells:cache.size,cell:lastCell};
    }
  };
}
