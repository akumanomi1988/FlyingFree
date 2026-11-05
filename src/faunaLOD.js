import {batchStaticMeshes} from './meshBatch.js';

// World-space distances. Near actors use their complete animated hierarchy,
// while far actors use a baked silhouette with a fixed draw-call budget.
export const FAUNA_LOD_DISTANCE=Object.freeze({deer:190,fox:145,rabbit:95});
export const FAUNA_MOTION_DISTANCE=Object.freeze({deer:235,fox:185,rabbit:135});

export function faunaPathAngle(t,state){
  const cycle=Math.max(.1,state.cycle);
  const u=(t+state.seed)/cycle;
  const whole=Math.floor(u),phase=u-whole;
  const progress=phase<=.63?0:(phase-.63)/.37;
  const eased=progress*progress*(3-2*progress);
  // Ends at the exact angle where the next cycle begins.
  return state.phase+(whole+eased)*.62;
}

export function faunaPathOffset(t,state,radius){
  const theta=faunaPathAngle(t,state);
  return {
    x:(Math.sin(theta)-state.anchorSin)*radius,
    z:(Math.cos(theta*.83)-state.anchorCos)*radius
  };
}

export function shouldAnimateFauna(distance,type) {
  return !Number.isFinite(distance)||distance<=FAUNA_MOTION_DISTANCE[type];
}

// The far representation is constructed once per type and shares GPU buffers
// and materials among every clone. The original rig remains fully articulated.
export function createFaunaLODFactory(THREE,materials) {
  const sphere=new THREE.SphereGeometry(1,10,7);
  const cylinder=new THREE.CylinderGeometry(.10,.12,1,7);
  const cone=new THREE.ConeGeometry(1,1,8);
  const prototypes=new Map();
  const add=(group,geo,mat,x,y,z,sx,sy,sz,rotationZ=0)=>{
    const m=new THREE.Mesh(geo,mat);
    m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rotationZ;
    group.add(m);
  };
  function prototype(type,antlered=false) {
    const key=type+(antlered?'-antlered':'');
    if(prototypes.has(key))return prototypes.get(key);
    const group=new THREE.Group();
    if(type==='deer'){
      add(group,sphere,materials.brown,0,1.50,0,.53,.52,1.08);
      add(group,sphere,materials.cream,0,1.63,-.78,.31,.48,.38);
      add(group,sphere,materials.brown,0,2.13,-.95,.30,.31,.37);
      for(const side of [-1,1]){
        for(const z of [-.63,.70])add(group,cylinder,materials.brown,side*.30,.66,z,.75,1.20,.75);
        if(antlered)add(group,cone,materials.cream,side*.37,2.94,-1.04,.11,.95,.11,side*.18);
      }
    }else if(type==='fox'){
      add(group,sphere,materials.foxCoat,0,.65,0,.36,.35,.85);
      add(group,sphere,materials.foxCoat,0,.79,-.67,.34,.34,.40);
      add(group,sphere,materials.white,0,.57,-.99,.23,.17,.32);
      add(group,sphere,materials.foxCoat,0,.68,1.07,.25,.22,.70);
      add(group,sphere,materials.white,0,.63,1.62,.20,.17,.18);
      for(const side of [-1,1]){
        add(group,cone,materials.foxCoat,side*.24,1.14,-.80,.15,.37,.15);
        for(const z of [-.52,.57])add(group,cylinder,materials.dark,side*.25,.25,z,.51,.52,.51);
      }
    }else if(type==='rabbit'){
      add(group,sphere,materials.cream,0,.37,0,.36,.33,.52);
      add(group,sphere,materials.brown,0,.55,-.42,.27,.26,.28);
      add(group,sphere,materials.cream,0,.39,.54,.18,.17,.16);
      for(const side of [-1,1])add(group,sphere,materials.cream,side*.14,1.02,-.44,.11,.43,.15,side*.17);
    }else throw new RangeError('Unknown fauna LOD '+type);
    const summary=batchStaticMeshes(THREE,group);
    group.userData={type,originalMeshes:summary.before,drawCalls:group.children.length};
    prototypes.set(key,group);
    return group;
  }
  function attach(actor,type,antlered=false) {
    const near=new THREE.Group();
    // Moving nodes into a child group preserves local transforms and joint references.
    for(const child of [...actor.children])near.add(child);
    const far=prototype(type,antlered).clone(true);
    const lod=new THREE.LOD();
    lod.name='fauna-'+type+'-lod';
    lod.addLevel(near,0,0.12);
    lod.addLevel(far,FAUNA_LOD_DISTANCE[type],0.12);
    actor.add(lod);
    actor.userData.lod=lod;
    actor.userData.nearModel=near;
    actor.userData.farModel=far;
    return lod;
  }
  return {
    attach,
    get prototypes(){return prototypes.size;},
    get farDrawCalls(){return Object.fromEntries([...prototypes].map(([key,g])=>[key,g.children.length]));}
  };
}
