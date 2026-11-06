// A cinematographer that stays attached to the bird rather than cutting to
// fixed coordinates. Predictive framing, damped transitions and terrain clearance.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CAMERA_SHOTS=Object.freeze(['chase','shoulder','scenic','profile','high-reveal']);

// Documentary framing is driven by the SUBJECT and the landscape, not by
// blind clock-based cuts. "seconds" is retained for the public API.
export function cameraShotAt(seconds,behaviour='patrol',context={}){
  if(['approach','landing','feed','rest','shelter','return'].includes(behaviour))return 'close';
  if(behaviour==='takeoff')return 'shoulder';
  if(context.turnRate>.27)return 'profile';
  if(context.relief>150&&context.groundClearance>105)return 'scenic';
  if(context.groundClearance>280&&context.speed>35)return 'high-reveal';
  if(context.water&&context.groundClearance>80)return 'shoulder';
  return 'chase';
}
export function cameraPlanAt(yaw,wingspan,speed,shot='chase'){
  const distance=Math.max(1.55,wingspan*3.65),forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw);
  const sideX=Math.cos(yaw),sideZ=-Math.sin(yaw);
  const configs={
    chase:[-1.18,.26,.27,57],shoulder:[-.94,-.92,.33,55],
    scenic:[-2.9,1.1,1.38,65],profile:[-.22,1.45,.39,56],
    'high-reveal':[-3.25,-1.1,1.9,67],close:[-1.25,.64,.36,52]
  };
  const [back,lateral,elevation,fov]=configs[shot]||configs.chase;
  const d=shot==='scenic'||shot==='high-reveal'?Math.max(7,distance):distance;
  const lead=clamp(speed*.036,0,d*.32);
  return {x:forwardX*back*d+sideX*lateral*d,
    y:elevation*d,z:forwardZ*back*d+sideZ*lateral*d,
    leadX:forwardX*lead,leadZ:forwardZ*lead,fov,distance:d};
}
export function createCameraDirector(THREE,terrainHeight,seed=1988){
  const desired=new THREE.Vector3(),target=new THREE.Vector3(),birdMotion=new THREE.Vector3();
  const lastBird=new THREE.Vector3(),smoothedTarget=new THREE.Vector3();
  let hasPrevious=false,currentShot='chase',shotSince=0,transitions=0;
  let lastTime=-Infinity,lastYaw=0,turnRate=0,contextAt=-Infinity;
  const context={groundClearance:100,relief:0,speed:0,turnRate:0,water:false};
  let lastReason='initial';

  function update(camera,bird,yaw,speed,behaviour,wingspan,time,dt){
    const delta=clamp(dt,0,.1),clock=Number.isFinite(time)?time:0;
    if(clock<lastTime){
      shotSince=clock;contextAt=-Infinity;turnRate=0;
    }
    lastTime=clock;
    const change=hasPrevious?Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw)):0;
    const angularSpeed=delta>.001?Math.abs(change)/delta:0;
    turnRate+=clamp(delta*3,0,1)*(clamp(angularSpeed,0,3)-turnRate);
    lastYaw=yaw;
    // Terrain context is inexpensive at ~1 Hz, but the anti-clipping ray is
    // still evaluated each frame for safety at low flight altitude.
    if(clock-contextAt>=1.2||contextAt===-Infinity){
      const ground=terrainHeight(bird.x,bird.z,seed);
      const horizon=160;
      const heights=[
        terrainHeight(bird.x+horizon,bird.z,seed),
        terrainHeight(bird.x-horizon,bird.z,seed),
        terrainHeight(bird.x,bird.z+horizon,seed),
        terrainHeight(bird.x,bird.z-horizon,seed)
      ];
      context.groundClearance=Math.max(0,bird.y-Math.max(-9,ground));
      context.relief=Math.max(0,Math.max(...heights)-Math.min(...heights));
      context.water=ground< -9;
      contextAt=clock;
    }
    context.speed=speed;context.turnRate=turnRate;
    const proposed=cameraShotAt(clock,behaviour,context);
    const close=['approach','landing','feed','rest','shelter','return'].includes(behaviour);
    const leavingClose=currentShot==='close'&&!close;
    // Active behaviours get priority, but ordinary scenery/turn changes must
    // persist before the director changes the shot (no distracting flicker).
    const hold=close?2.5:leavingClose?8:22;
    if(proposed!==currentShot&&clock-shotSince>=hold){
      currentShot=proposed;shotSince=clock;transitions++;
      lastReason=close?'behaviour':proposed==='profile'?'turn':
        proposed==='scenic'?'terrain':proposed==='high-reveal'?'altitude':
        proposed==='shoulder'?'flight':'recovery';
    }
    const plan=cameraPlanAt(yaw,wingspan,speed,currentShot);
    if(hasPrevious){
      birdMotion.subVectors(bird,lastBird);
      if(birdMotion.lengthSq()<2500){
        camera.position.add(birdMotion);
        smoothedTarget.add(birdMotion);
      }else{
        smoothedTarget.copy(bird);
      }
    }else{smoothedTarget.copy(bird);}
    lastBird.copy(bird);hasPrevious=true;
    desired.set(bird.x+plan.x,bird.y+plan.y,bird.z+plan.z);
    const clearance=currentShot==='close'?.85:2.6;
    let needed=0;
    for(let i=1;i<=8;i++){
      const f=i/8;
      const sx=bird.x+(desired.x-bird.x)*f,sz=bird.z+(desired.z-bird.z)*f;
      const sightY=bird.y+(desired.y-bird.y)*f;
      const ground=Math.max(-9,terrainHeight(sx,sz,seed));
      const buffer=clearance+(currentShot==='scenic'?6:2);
      needed=Math.max(needed,(ground+buffer-sightY)/f);
    }
    desired.y+=Math.min(140,Math.max(0,needed));
    desired.y=Math.max(desired.y,Math.max(-9,terrainHeight(desired.x,desired.z,seed))+clearance);
    target.set(bird.x+plan.leadX,bird.y+Math.max(.08,wingspan*.10),bird.z+plan.leadZ);
    const k=1-Math.exp(-delta*(currentShot==='scenic'||currentShot==='high-reveal'?1.35:2.6));
    camera.position.lerp(desired,k);
    camera.position.y=Math.max(camera.position.y,
      Math.max(-9,terrainHeight(camera.position.x,camera.position.z,seed))+clearance);
    smoothedTarget.lerp(target,1-Math.exp(-delta*3.1));
    camera.up.set(0,1,0);
    camera.lookAt(smoothedTarget);
    const newFov=camera.fov+(plan.fov-camera.fov)*(1-Math.exp(-delta*.95));
    if(Math.abs(newFov-camera.fov)>.0001){
      camera.fov=newFov;camera.updateProjectionMatrix();
    }
    return {shot:currentShot,target:smoothedTarget,clearance,reason:lastReason,transitions,
      groundClearance:context.groundClearance,relief:context.relief};
  }
  return {
    update,
    get shot(){return currentShot;},
    get transitions(){return transitions;},
    get reason(){return lastReason;},
    reset(){hasPrevious=false;contextAt=-Infinity;turnRate=0;shotSince=lastTime;}
  };
}
