// A cinematographer that stays attached to the bird rather than cutting to
// fixed coordinates. Predictive framing, damped transitions and terrain clearance.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CAMERA_SHOTS=Object.freeze(['chase','shoulder','scenic','profile','high-reveal']);

export function cameraShotAt(seconds,behaviour='patrol'){
  if(['approach','landing','feed','rest','shelter'].includes(behaviour))return 'close';
  return CAMERA_SHOTS[Math.floor(Math.max(0,seconds)/37)%CAMERA_SHOTS.length];
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
  let hasPrevious=false,currentShot=null;
  function update(camera,bird,yaw,speed,behaviour,wingspan,time,dt){
    const shot=cameraShotAt(time,behaviour);
    const plan=cameraPlanAt(yaw,wingspan,speed,shot);
    const delta=clamp(dt,0,.1);
    if(hasPrevious){
      birdMotion.subVectors(bird,lastBird);
      if(birdMotion.lengthSq()<2500){
        camera.position.add(birdMotion);
        smoothedTarget.add(birdMotion);
      }
    }else{smoothedTarget.copy(bird);}
    lastBird.copy(bird);hasPrevious=true;
    currentShot=shot;
    desired.set(bird.x+plan.x,bird.y+plan.y,bird.z+plan.z);
    const clearance=shot==='close'?.85:2.6;
    // Prevent obstruction by sampling the entire line of sight. The camera
    // rises above ridges rather than penetrating cliffs or under the forest.
    let needed=0;
    for(let i=1;i<=8;i++){
      const f=i/8;
      const sx=bird.x+(desired.x-bird.x)*f,sz=bird.z+(desired.z-bird.z)*f;
      const sightY=bird.y+(desired.y-bird.y)*f;
      const ground=Math.max(-9,terrainHeight(sx,sz,seed));
      const buffer=clearance+(shot==='scenic'?6:2);
      needed=Math.max(needed,(ground+buffer-sightY)/f);
    }
    desired.y+=Math.min(140,Math.max(0,needed));
    desired.y=Math.max(desired.y,Math.max(-9,terrainHeight(desired.x,desired.z,seed))+clearance);
    target.set(bird.x+plan.leadX,bird.y+Math.max(.08,wingspan*.10),
      bird.z+plan.leadZ);
    const k=1-Math.exp(-delta*(shot==='scenic'||shot==='high-reveal'?1.35:2.6));
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
    return {shot,target:smoothedTarget,clearance};
  }
  return {update,get shot(){return currentShot;},reset(){hasPrevious=false;}};
}
