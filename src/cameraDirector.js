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
export function createCameraDirector(THREE,terrainHeight,seed=1988,{qaShot=null}={}){
  // Read-only deterministic visual inspection mode. Only supplied by main.js
  // with ?selftest=1; normal viewers always get the event-based director.
  const inspectionShot=CAMERA_SHOTS.includes(qaShot)||qaShot==='close'?qaShot:null;
  const desired=new THREE.Vector3(),target=new THREE.Vector3(),birdMotion=new THREE.Vector3();
  const lookMatrix=new THREE.Matrix4(),lookRotation=new THREE.Quaternion();
  const lastBird=new THREE.Vector3(),smoothedTarget=new THREE.Vector3();
  let hasPrevious=false,currentShot=inspectionShot??'chase',shotSince=0,transitions=0;
  let smoothYaw=0,yawVelocity=0,hasSmoothYaw=false,hasLookRotation=false;
  let lastAngularStep=0;
  let candidateShot=null,candidateSince=0;
  let lastTime=-Infinity,lastYaw=0,turnRate=0,contextAt=-Infinity;
  const context={groundClearance:100,relief:0,speed:0,turnRate:0,water:false};
  let lastReason='initial';

  function update(camera,bird,yaw,speed,behaviour,wingspan,time,dt){
    const delta=clamp(dt,0,.1),clock=Number.isFinite(time)?time:0;
    if(clock<lastTime){
      shotSince=clock;contextAt=-Infinity;turnRate=0;
      candidateShot=null;candidateSince=clock;
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
    const proposed=inspectionShot??cameraShotAt(clock,behaviour,context);
    const close=['approach','landing','feed','rest','shelter','return'].includes(behaviour);
    const leavingClose=currentShot==='close'&&!close;
    // Active behaviours get priority, but ordinary scenery/turn changes must
    // persist before the director changes the shot (no distracting flicker).
    const hold=close?2.5:leavingClose?8:22;
    const stable=close?2.0:leavingClose?3.5:2.5;
    if(proposed===currentShot||inspectionShot){
      candidateShot=null;
    }else{
      if(candidateShot!==proposed){candidateShot=proposed;candidateSince=clock;}
      if(clock-shotSince>=hold&&clock-candidateSince>=stable){
        currentShot=proposed;shotSince=clock;transitions++;
        lastReason=close?'behaviour':proposed==='profile'?'turn':
          proposed==='scenic'?'terrain':proposed==='high-reveal'?'altitude':
          proposed==='shoulder'?'flight':'recovery';
        candidateShot=null;
      }
    }
    // Bird heading can change by >90 degrees in a moment; using it directly
    // to construct the offset or lookAt used to whip the TV camera around.
    // Apply a velocity- and acceleration-limited follower to the heading.
    if(!hasSmoothYaw){smoothYaw=yaw;yawVelocity=0;hasSmoothYaw=true;}
    else{
      const difference=Math.atan2(Math.sin(yaw-smoothYaw),Math.cos(yaw-smoothYaw));
      const desiredRate=clamp(difference*1.15,-.72,.72);
      yawVelocity+=clamp(desiredRate-yawVelocity,-1.4*delta,1.4*delta);
      smoothYaw+=yawVelocity*delta;
    }
    const plan=cameraPlanAt(smoothYaw,wingspan,speed,currentShot);
    if(hasPrevious){
      birdMotion.subVectors(bird,lastBird);
      if(birdMotion.lengthSq()<2500){
        // Riding every centimetre of the bird's instantaneous displacement
        // transfers wing bob, terrain corrections and landing impulses
        // straight into the TV camera. Carry part of its travel, then let
        // the damped follower absorb the rest without losing the subject.
        // Preserve the full translational displacement of the subject.
        // A partial ride accumulates metres of lag at 30–60 fps, enough to
        // lose a small bird outside a narrow TV/mobile field of view.
        // Damping below still smooths the *relative camera offset* and the
        // quaternion; movement of the subject is never discarded.
        // Keep horizontal travel in lockstep but reject the high-frequency
        // vertical impulse of landing or ocean buoyancy. Relative position
        // easing below catches up smoothly without losing the animal.
        camera.position.x+=birdMotion.x;
        camera.position.z+=birdMotion.z;
        camera.position.y+=birdMotion.y*.55;
        smoothedTarget.x+=birdMotion.x;
        smoothedTarget.z+=birdMotion.z;
        smoothedTarget.y+=birdMotion.y*.55;
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
    lookMatrix.lookAt(camera.position,smoothedTarget,camera.up);
    lookRotation.setFromRotationMatrix(lookMatrix);
    if(!hasLookRotation){
      camera.quaternion.copy(lookRotation);
      hasLookRotation=true;
      lastAngularStep=0;
    }else{
      // Orientation damping is independent of the camera target. Immediate
      // lookAt cancelled all positional easing on fast avian heading changes.
      const difference=camera.quaternion.angleTo(lookRotation);
      const maxRotation=.76*delta; // <=43.5 degrees/sec at any frame rate.
      const eased=difference*(1-Math.exp(-delta*2.3));
      const angularStep=Math.min(maxRotation,eased);
      camera.quaternion.rotateTowards(lookRotation,angularStep);
      lastAngularStep=delta>0?angularStep/delta:0;
    }
    // Portrait devices have a much narrower physical screen. A 55° vertical
    // cinematic FOV cut the protagonist out of frame during steep descents.
    // Keep the original lens on landscape, widen the vertical field on phones.
    const portrait=clamp((.82-camera.aspect)/.35,0,1);
    const framingFov=plan.fov+(80-plan.fov)*portrait;
    const newFov=camera.fov+(framingFov-camera.fov)*(1-Math.exp(-delta*2.8));
    if(Math.abs(newFov-camera.fov)>.0001){
      camera.fov=newFov;camera.updateProjectionMatrix();
    }
    return {shot:currentShot,target:smoothedTarget,clearance,reason:lastReason,transitions,
      groundClearance:context.groundClearance,relief:context.relief,
      cameraHeading:smoothYaw,turnSpeed:lastAngularStep};
  }
  return {
    update,
    get shot(){return currentShot;},
    get transitions(){return transitions;},
    get reason(){return lastReason;},
    reset(){
      // Preserve the last orientation through bird selection. Snapping the
      // quaternion on reset produced one-frame whip cuts between species.
      hasPrevious=false;hasSmoothYaw=false;
      yawVelocity=0;lastAngularStep=0;
      contextAt=-Infinity;turnRate=0;shotSince=lastTime;candidateShot=null;
    }
  };
}
