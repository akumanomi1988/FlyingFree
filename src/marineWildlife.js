import {random,terrainHeight} from './core.js';
import {habitatAt} from './ecology.js';
import {TROPICAL_WORLD} from './tropicalTerrain.js';

// Marine residents belong to seeded regions, not kilometre-wide circular
// tracks around (0,0). Their detailed meshes remain a fixed-size pool.
export const MARINE_CELL_SIZE=480;
const TYPES=['dolphin','gull'];

export function marineCellCandidates(seed,cx,cz,type){
  if(!TYPES.includes(type))throw new RangeError('Unknown marine species '+type);
  const salt=type==='dolphin'?0x7b8b:0x48ca;
  const rng=random((Math.imul(cx+127,73856093)^Math.imul(cz-513,19349663)^seed^salt)>>>0);
  const candidates=[];
  for(let slot=0;slot<4;slot++){
    const x=(cx+.10+rng()*.80)*MARINE_CELL_SIZE;
    const z=(cz+.10+rng()*.80)*MARINE_CELL_SIZE;
    const h=habitatAt(x,z,seed);
    const radius=type==='dolphin'?16+rng()*23:22+rng()*58;
    if(type==='dolphin'){
      if(h.type!=='ocean'||h.height>TROPICAL_WORLD.seaLevel-11)continue;
      // The whole swim circle must remain in water, not across a beach.
      if([[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dz])=>
        terrainHeight(x+dx,z+dz,seed)>TROPICAL_WORLD.seaLevel-3))continue;
    }else if(h.type!=='ocean'&&h.type!=='shore'&&h.type!=='wetland')continue;
    const speed=type==='dolphin'?2+rng()*2.4:5+rng()*4;
    candidates.push({key:type+':'+cx+':'+cz+':'+slot,x,z,radius,
      speed,phase:rng()*Math.PI*2,flyY:Math.max(TROPICAL_WORLD.seaLevel,h.height)+
        22+rng()*34,period:21+rng()*13});
  }
  return candidates;
}

export function createMarinePopulation(gulls,dolphins,{seed=1988,initialObserver=null}={}){
  const pools={gull:gulls,dolphin:dolphins};
  let lastCell=null,lastHero=null,cellUpdates=0,relocated=0,eligibleSites=0;
  const recordPosition=record=>record.g?.position||record.group?.position;

  function update(time,hero=null,observer=null,initial=false){
    if(!hero||!Number.isFinite(hero.x)||!Number.isFinite(hero.z))return;
    lastHero={x:hero.x,z:hero.z};
    const cx=Math.floor(hero.x/MARINE_CELL_SIZE);
    const cz=Math.floor(hero.z/MARINE_CELL_SIZE);
    const cell=cx+':'+cz;
    if(lastCell===null&&!initialObserver&&!initial){lastCell=cell;return;}
    if(cell===lastCell&&!initial)return;
    lastCell=cell;cellUpdates++;eligibleSites=0;
    const eye=observer||hero;
    for(const type of TYPES){
      const pool=pools[type],candidates=[];
      for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
        for(const site of marineCellCandidates(seed,cx+dx,cz+dz,type)){
          const distance2=(site.x-hero.x)**2+(site.z-hero.z)**2;
          if(distance2>980*980||distance2<65*65)continue;
          candidates.push({...site,distance2});
        }
      }
      candidates.sort((a,b)=>a.distance2-b.distance2||a.key.localeCompare(b.key));
      const chosen=candidates.slice(0,pool.length);
      eligibleSites+=chosen.length;
      const wanted=new Map(chosen.map(s=>[s.key,s]));
      for(const r of pool)if(r.siteKey&&wanted.has(r.siteKey))wanted.delete(r.siteKey);
      const keepKeys=new Set(chosen.map(s=>s.key));
      const donors=pool.filter(r=>{
        if(keepKeys.has(r.siteKey))return false;
        if(initial)return true;
        const p=recordPosition(r);
        return Math.hypot(p.x-eye.x,p.z-eye.z)>560;
      }).sort((a,b)=>{
        const pa=recordPosition(a),pb=recordPosition(b);
        return Math.hypot(pb.x-eye.x,pb.z-eye.z)-
          Math.hypot(pa.x-eye.x,pa.z-eye.z);
      });
      for(const site of wanted.values()){
        if(!donors.length)break;
        if(!initial&&Math.hypot(site.x-eye.x,site.z-eye.z)<220)continue;
        const r=donors.shift();
        r.siteKey=site.key;r.anchorX=site.x;r.anchorZ=site.z;
        r.radius=site.radius;r.angularSpeed=site.speed/site.radius;
        r.phase=site.phase;
        if(type==='dolphin')r.period=site.period;
        else r.alt=site.flyY;
        relocated++;
      }
    }
  }
  if(initialObserver)update(0,initialObserver,initialObserver,true);
  return {
    update,
    get stats(){
      const local=type=>lastHero?pools[type].filter(r=>r.siteKey&&
        Math.hypot(r.anchorX-lastHero.x,r.anchorZ-lastHero.z)<950).length:0;
      return {dolphinsLocal:local('dolphin'),gullsLocal:local('gull'),
        cellUpdates,eligibleSites,relocated};
    }
  };
}
