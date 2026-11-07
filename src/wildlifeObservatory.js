// Camera-space estimates distinguish generated animals from recognizable ones.
// Frustum tests do NOT prove absence of terrain, canopy or fog occlusion.
const BODY_HEIGHT={deer:1.65,fox:.72,rabbit:.38};
const ACTION_SCORE={hunt:9,flee:9,alert:5,foraging:3,travelling:1};

export function createWildlifeObservatory(THREE,{minPixels=9,terrainHeight=null,seed=1988}={}){
  // Screen-space visibility is not equivalent to line-of-sight. Sample only
  // nearby, recognizable candidates: the broad-phase remains GPU-independent.
  function occluded(eye,subject){
    if(!terrainHeight)return false;
    const dx=subject.x-eye.x,dz=subject.z-eye.z;
    const horizontal=Math.hypot(dx,dz);
    if(horizontal<8)return false;
    const steps=Math.min(12,Math.max(4,Math.ceil(horizontal/28)));
    for(let i=1;i<steps;i++){
      const t=i/steps;
      const ground=terrainHeight(eye.x+dx*t,eye.z+dz*t,seed);
      if(Number.isFinite(ground)&&ground+.45>eye.y+(subject.y-eye.y)*t)
        return true;
    }
    return false;
  }
  const point=new THREE.Vector3(),projected=new THREE.Vector3();
  let lastUpdate=-Infinity,focus=null,focusUntil=-Infinity;
  let stats={nearby:0,inFrustum:0,recognizableProjected:0,terrainOccluded:0,
    actionCandidates:0,focus:null,lastSampleAt:null};

  function update(time,actors,camera,hero,height=900){
    if(time-lastUpdate<.45)return {focus,stats};
    lastUpdate=time;
    let nearby=0,inFrustum=0,recognizableProjected=0,terrainOccluded=0,actionCandidates=0;
    const eligible=[];
    const focal=height/(2*Math.tan(camera.fov*Math.PI/360));
    for(const actor of actors){
      if(actor.visible===false)continue;
      const state=actor.userData.state;
      if(!state||!Object.hasOwn(BODY_HEIGHT,state.type))continue;
      const distance=camera.position.distanceTo(actor.position);
      if(distance>950||distance<.01)continue;
      nearby++;
      const elevation=BODY_HEIGHT[state.type]*.5;
      point.set(actor.position.x,actor.position.y+elevation,actor.position.z);
      projected.copy(point).project(camera);
      if(projected.z<=-1||projected.z>=1||
         Math.abs(projected.x)>.98||Math.abs(projected.y)>.98)continue;
      inFrustum++;
      const pixels=BODY_HEIGHT[state.type]*focal/distance;
      if(pixels<minPixels)continue;
      recognizableProjected++;
      if(occluded(camera.position,point)){terrainOccluded++;continue;}
      const horizontal=Math.hypot(actor.position.x-hero.x,
        actor.position.z-hero.z);
      if(horizontal>65||Math.abs(hero.y-point.y)>75)continue;
      actionCandidates++;
      const behaviour=actor.userData.behaviour||'travelling';
      const id=actor.userData.populationKey||String(actor.id);
      eligible.push({key:id,x:point.x,y:point.y,z:point.z,
        pixels,behaviour,type:state.type,
        score:(ACTION_SCORE[behaviour]||0)+Math.min(10,pixels/5)-horizontal*.035});
    }
    eligible.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
    const retained=focus&&eligible.find(candidate=>candidate.key===focus.key);
    if(retained&&time<focusUntil)focus=retained;
    else{
      focus=eligible[0]||null;
      focusUntil=time+7;
    }
    stats={nearby,inFrustum,recognizableProjected,terrainOccluded,actionCandidates,
      focus:focus?{type:focus.type,behaviour:focus.behaviour,
        pixels:Math.round(focus.pixels)}:null,
      lastSampleAt:+time.toFixed(1)};
    return {focus,stats};
  }
  return {update,get stats(){return stats;}};
}
