import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cameraShotAt,cameraPlanAt,CAMERA_SHOTS,createCameraDirector} from '../src/cameraDirector.js';
import {terrainHeight} from '../src/core.js';

test('cinematic shots remain attached to the bird with no fixed world-space coordinates',()=>{
 assert.equal(CAMERA_SHOTS.length,5);
 assert.equal(cameraShotAt(0),'chase');
 assert.equal(cameraShotAt(38),'chase','time alone cannot change shots');
 assert.equal(cameraShotAt(780),'chase','no blind periodic cuts');
 assert.equal(cameraShotAt(3,'patrol',{turnRate:.4}),'profile');
 assert.equal(cameraShotAt(3,'patrol',{relief:240,groundClearance:150}),'scenic');
 assert.equal(cameraShotAt(3,'patrol',{groundClearance:340,speed:60}),'high-reveal');
 assert.equal(cameraShotAt(3,'patrol',{groundClearance:105,speed:20,water:true}),'shoulder');
 assert.equal(cameraShotAt(3,'takeoff'),'shoulder');
 assert.equal(cameraShotAt(200,'landing'),'close');
 for(const shot of [...CAMERA_SHOTS,'close']){
  const plan=cameraPlanAt(.77,2.1,65,shot);
  assert.ok([plan.x,plan.y,plan.z,plan.leadX,plan.leadZ,plan.fov].every(Number.isFinite));
  assert.ok(plan.distance>1);
 }
});

test('camera smoothly follows a fast bird and stays above volcanic ridges',()=>{
 const camera=new THREE.PerspectiveCamera(56,16/9,.1,20000);
 const bird=new THREE.Vector3(700,terrainHeight(700,800,20261106)+180,800);
 camera.position.copy(bird).add(new THREE.Vector3(0,30,20));
 const director=createCameraDirector(THREE,terrainHeight,20261106);
 let previous=camera.position.clone();
 for(let i=0;i<90;i++){
  bird.x+=.85;bird.z-=.34;
  const result=director.update(camera,bird,.83,59,'patrol',2.1,i/30,1/30);
  assert.ok(camera.position.distanceTo(bird)<160,'camera lost tracked bird');
  assert.ok(camera.position.y>=terrainHeight(camera.position.x,camera.position.z,20261106)+2.59,
    'camera intersects the ground');
  assert.ok(camera.position.distanceTo(previous)<15,'camera jumped between frames');
  assert.ok(result.shot==='chase');
  previous.copy(camera.position);
 }
 assert.equal(director.shot,'chase');
});

test('shot transitions preserve compositional focus and world-space continuity',()=>{
 const seed=1988,director=createCameraDirector(THREE,terrainHeight,seed);
 const camera=new THREE.PerspectiveCamera(),bird=new THREE.Vector3(260,700,320);
 camera.position.set(255,704,325);
 for(let t=0;t<=150;t+=1/12){
  bird.x+=1.2;
  // The tracked bird itself must remain above the mountain terrain, as it
  // does in the flight simulation's ground-clearance controller.
  bird.y=Math.max(bird.y,terrainHeight(bird.x,bird.z,seed)+145);
  const result=director.update(camera,bird,1.0,60,'patrol',1.65,t,1/12);
  assert.ok(camera.position.distanceTo(bird)<250,'shot detached from tracked bird');
  assert.ok(result.target.distanceTo(bird)<20,'target moved away from protagonist');
 }
 assert.ok(['chase','shoulder','scenic','profile','high-reveal'].includes(director.shot));
});

test('event-based direction holds shots through noise and responds to landing',()=>{
 const director=createCameraDirector(THREE,()=>50,1988);
 const camera=new THREE.PerspectiveCamera(56,16/9,.1,20000);
 camera.position.set(1,330,5);
 const bird=new THREE.Vector3(0,335,0);
 let result;
 for(let i=0;i<260;i++){
   bird.z-=.35;
   result=director.update(camera,bird,0,60,'patrol',1.5,i*.1,.1);
 }
 assert.equal(result.shot,'high-reveal','high-altitude view should be earned after the hold');
 const before=result.transitions;
 for(let i=260;i<278;i++){
   result=director.update(camera,bird,0,60,i%2?'patrol':'landing',1.5,i*.1,.1);
 }
 assert.equal(result.shot,'high-reveal','brief behaviour oscillation must not whip the camera');
 assert.equal(result.transitions,before);
 for(let i=278;i<325;i++){
   result=director.update(camera,bird,0,18,'landing',1.5,i*.1,.1);
 }
 assert.equal(result.shot,'close','sustained landing should select a close shot');
 assert.equal(result.reason,'behaviour');
 assert.ok(result.transitions<=before+1);
 assert.ok(camera.position.y>=50,'camera remains above the ground');
});

test('director suppresses forced shot cuts on long static scenic sessions',()=>{
 const director=createCameraDirector(THREE,()=>100,1988);
 const camera=new THREE.PerspectiveCamera();
 camera.position.set(0,250,10);
 const bird=new THREE.Vector3(0,210,0);
 for(let i=0;i<2000;i++)
   director.update(camera,bird,0,30,'patrol',1.7,i*.1,.1);
 assert.equal(director.shot,'chase');
 assert.equal(director.transitions,0);
});

test('camera QA angles are deterministic and cannot be requested accidentally',()=>{
 const forced=createCameraDirector(THREE,()=>0,1988,{qaShot:'profile'});
 const camera=new THREE.PerspectiveCamera(),bird=new THREE.Vector3(0,140,0);
 for(let i=0;i<350;i++){
   const result=forced.update(camera,bird,0,42,i>70?'landing':'patrol',1.5,i*.1,.1);
   assert.equal(result.shot,'profile');
 }
 assert.equal(forced.transitions,0);
 const invalid=createCameraDirector(THREE,()=>0,1988,{qaShot:'not-a-shot'});
 assert.equal(invalid.update(camera,bird,0,42,'patrol',1.5,0,.1).shot,'chase');
});


test('small and fast birds remain inside the visible camera frame at 15, 30 and 60 fps',()=>{
 for(const fps of [15,30,60]){
   const dt=1/fps;
   const director=createCameraDirector(THREE,()=>0,1988);
   const camera=new THREE.PerspectiveCamera(55,390/844,.15,5000);
   const bird=new THREE.Vector3(0,100,0);
   camera.position.set(0,101,3);
   for(let i=0;i<fps*12;i++){
     // 13 m/s is a representative stylized hummingbird cruise speed.
     // The old .58 camera ride loses >2 m and focuses empty scenery.
     bird.z-=13*dt;
     director.update(camera,bird,0,13,'patrol',.11,i*dt,dt);
     if(i>fps*3){
       camera.updateMatrixWorld(true);
       const screen=bird.clone().project(camera);
       assert.ok(Number.isFinite(screen.x)&&Number.isFinite(screen.y),
         'Non-finite projection at '+fps+' fps');
       assert.ok(Math.abs(screen.x)<.72&&Math.abs(screen.y)<.72&&screen.z<1,
         'Tracked hummingbird escaped frame at '+fps+' fps: '+JSON.stringify(screen.toArray()));
     }
   }
 }
});

test('continuous descending flight does not leave small portrait subject below the frame',()=>{
 for(const fps of [15,30,60]){
  const dt=1/fps,seed=1988,camera=new THREE.PerspectiveCamera(55,390/844,.15,5000);
  const bird=new THREE.Vector3(0,125,0),director=createCameraDirector(THREE,()=>0,seed);
  camera.position.set(0,129,4);
  for(let i=0;i<fps*4;i++){
   bird.z-=13*dt;
   bird.y-=12*dt;
   director.update(camera,bird,0,13,'patrol',.11,i*dt,dt);
   if(i>=fps*3){
    camera.updateMatrixWorld(true);
    const projection=bird.clone().project(camera);
    assert.ok(Math.abs(projection.y)<.92&&Math.abs(projection.x)<.92,
      'Continuous descent lost portrait bird at '+fps+'fps: '+projection.toArray());
   }
  }
 }
});
