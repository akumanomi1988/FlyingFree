// A cinematographer that stays attached to the bird rather than cutting to
// fixed coordinates. Predictive framing, damped transitions and terrain clearance.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CAMERA_SHOTS=Object.freeze(['chase','shoulder','scenic','profile','high-reveal']);

// Choose the hillside side of an animal when a close chase would film uphill
// into a single featureless mountainside. Camera on uphill side looks down
// into the valley; the correction is applied smoothly by the director.
export function terrainAwareOffset(x,z,gradientX,gradientZ,aboveGround){
  const slope=Math.hypot(gradientX,gradientZ);
  const distance=Math.hypot(x,z);
  if(slope<.26||distance<.2||aboveGround>130)return {x,z,corrected:false};
  const alignment=(x*gradientX+z*gradientZ)/(distance*slope);
  if(alignment>=.1)return {x,z,corrected:false};
  const weight=clamp((.1-alignment)*.90,0,.95);
  return {x:x*(1-weight)+gradientX/slope*distance*weight,
    z:z*(1-weight)+gradientZ/slope*distance*weight,corrected:true};
}

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
export function createCameraDirector(THREE,terrainHeight,seed=1988,{qaShot=null,worldQuery=null}={}){
  const surfaceHeight=(x,z)=>worldQuery?.heightAt(x,z)??terrainHeight(x,z,seed);
  // Read-only deterministic visual inspection mode. Only supplied by main.js
  // with ?selftest=1; normal viewers always get the event-based director.
  const inspectionShot=CAMERA_SHOTS.includes(qaShot)||qaShot==='close'?qaShot:null;
  const desired=new THREE.Vector3(),target=new THREE.Vector3(),foodFocus=new THREE.Vector3(),
    birdMotion=new THREE.Vector3();
  const lookMatrix=new THREE.Matrix4(),lookRotation=new THREE.Quaternion();
  const lastBird=new THREE.Vector3(),smoothedTarget=new THREE.Vector3();
  let hasPrevious=false,currentShot=inspectionShot??'chase',shotSince=0,transitions=0;
  let smoothYaw=0,yawVelocity=0,hasSmoothYaw=false,hasLookRotation=false;
  let lastAngularStep=0;
  let candidateShot=null,candidateSince=0;
  let lastTime=-Infinity,lastYaw=0,turnRate=0,contextAt=-Infinity;
  const context={groundClearance:100,relief:0,speed:0,turnRate:0,water:false,slopeX:0,slopeZ:0};
  let lastReason='initial';

  function update(camera,bird,yaw,speed,behaviour,wingspan,time,dt,focus=null,wildlife=null){
    // Allow up to 250ms of camera catch-up for slow WebGL; simulation remains at 30Hz.
    const delta=clamp(dt,0,.25),clock=Number.isFinite(time)?time:0;
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
      const ground=surfaceHeight(bird.x,bird.z,seed);
      const horizon=160;
      const heights=[
        surfaceHeight(bird.x+horizon,bird.z,seed),
        surfaceHeight(bird.x-horizon,bird.z,seed),
        surfaceHeight(bird.x,bird.z+horizon,seed),
        surfaceHeight(bird.x,bird.z-horizon,seed)
      ];
      context.groundClearance=Math.max(0,bird.y-Math.max(-9,ground));
      context.relief=Math.max(0,Math.max(...heights)-Math.min(...heights));
      context.slopeX=(heights[0]-heights[1])/(2*horizon);
      context.slopeZ=(heights[2]-heights[3])/(2*horizon);
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
    const initializingShot=!hasPrevious;
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
        // Ordinary continuous climbs/descents are real subject travel; do
        // not convert them into permanent lag (especially at 1–3 m camera
        // distance for small birds). Only damp discontinuous vertical jumps.
        const smoothVertical=Math.abs(birdMotion.y)<=Math.max(.5,30*delta);
        const verticalRide=smoothVertical?1:.55;
        camera.position.x+=birdMotion.x;
        camera.position.z+=birdMotion.z;
        camera.position.y+=birdMotion.y*verticalRide;
        smoothedTarget.x+=birdMotion.x;
        smoothedTarget.z+=birdMotion.z;
        smoothedTarget.y+=birdMotion.y*verticalRide;
      }else{
        smoothedTarget.copy(bird);
      }
    }else{smoothedTarget.copy(bird);}
    lastBird.copy(bird);hasPrevious=true;
    // A small forest bird may fly close to a steep mountain wall. A fixed
    // chase offset then films only green terrain. Prefer the uphill side of
    // the protagonist, preserving distance, while the usual follower eases
    // the change in world space.
    const terrainOffset=(camera.aspect<.72&&wingspan<.5)?
      terrainAwareOffset(plan.x,plan.z,context.slopeX,context.slopeZ,
        context.groundClearance):
      {x:plan.x,z:plan.z,corrected:false};
    desired.set(bird.x+terrainOffset.x,bird.y+plan.y,bird.z+terrainOffset.z);
    const clearance=currentShot==='close'?.85:2.6;
    let needed=0;
    for(let i=1;i<=8;i++){
      const f=i/8;
      const sx=bird.x+(desired.x-bird.x)*f,sz=bird.z+(desired.z-bird.z)*f;
      const sightY=bird.y+(desired.y-bird.y)*f;
      const ground=Math.max(-9,surfaceHeight(sx,sz,seed));
      const buffer=clearance+(currentShot==='scenic'?6:2);
      needed=Math.max(needed,(ground+buffer-sightY)/f);
    }
    desired.y+=Math.min(140,Math.max(0,needed));
    desired.y=Math.max(desired.y,Math.max(-9,surfaceHeight(desired.x,desired.z,seed))+clearance);
    // The eight coarse altitude samples can miss a narrow ridge. Cast the
    // complete bird-to-camera sight line against the rendered triangles.
    if(worldQuery){
      for(let attempt=0;attempt<8;attempt++){
        if(worldQuery.lineOfSight(
          {x:bird.x,y:bird.y+Math.max(.06,wingspan*.08),z:bird.z},
          {x:desired.x,y:desired.y,z:desired.z}
        ))break;
        desired.y+=Math.min(16,2+attempt*2);
      }
    }
    target.set(bird.x+plan.leadX,bird.y+Math.max(.08,wingspan*.10),bird.z+plan.leadZ);
    // During foraging, keep food and beak in the same view instead of looking
    // down the flight trajectory and cropping the action. Avoid pulling the
    // subject outside the frame for tiny species by limiting focus distance.
    if(close&&focus&&['approach','landing','feed'].includes(behaviour)&&
       Number.isFinite(focus.x)&&Number.isFinite(focus.contactY)&&Number.isFinite(focus.z)){
      foodFocus.set(focus.x,focus.contactY,focus.z);
      const distance=foodFocus.distanceTo(bird);
      const maxDistance=Math.max(.45,wingspan*1.55);
      if(distance>maxDistance)foodFocus.lerp(bird,1-maxDistance/distance);
      target.lerp(foodFocus,.24);
    }
    // Blend nearby wildlife into the look target without discontinuous cuts.
    if(!close&&!inspectionShot&&wildlife&&Number.isFinite(wildlife.x)&&
       Number.isFinite(wildlife.y)&&Number.isFinite(wildlife.z)&&
       Math.hypot(wildlife.x-bird.x,wildlife.z-bird.z)<45&&
       Math.abs(wildlife.y-bird.y)<60){
      foodFocus.set(wildlife.x,wildlife.y,wildlife.z);
      target.lerp(foodFocus,.17);
    }
    const k=1-Math.exp(-delta*(currentShot==='scenic'||currentShot==='high-reveal'?1.35:2.6));
    // Establish a new small-bird documentary shot on its viable hillside
    // vantage from the very first frame. Otherwise, moving the orbit across
    // the subject for seconds while angle speed is capped loses the bird.
    // Never snap a running shot or a landscape-to-landscape transition.
    const establishTerrainShot=initializingShot&&terrainOffset.corrected&&
      camera.aspect<.72&&wingspan<.5;
    if(establishTerrainShot)camera.position.copy(desired);
    else camera.position.lerp(desired,k);
    camera.position.y=Math.max(camera.position.y,
      Math.max(-9,surfaceHeight(camera.position.x,camera.position.z,seed))+clearance);
    if(establishTerrainShot)smoothedTarget.copy(target);
    else smoothedTarget.lerp(target,1-Math.exp(-delta*3.1));
    camera.up.set(0,1,0);
    lookMatrix.lookAt(camera.position,smoothedTarget,camera.up);
    lookRotation.setFromRotationMatrix(lookMatrix);
    if(!hasLookRotation||establishTerrainShot){
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
      cameraHeading:smoothYaw,turnSpeed:lastAngularStep,
      uphillFraming:terrainOffset.corrected};
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
