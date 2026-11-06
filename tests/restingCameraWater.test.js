import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS} from '../src/core.js';
import {createCameraDirector} from '../src/cameraDirector.js';
import {createBirdRig,animateBirdRig} from '../src/flight.js';
import {createBirdBrain} from '../src/behaviour.js';
import {OCEAN_BASE_HEIGHT,OCEAN_PLANE_SIZE,OCEAN_SEGMENTS,oceanWave,
  oceanSurfaceHeight,oceanFloatPose} from '../src/oceanMotion.js';

const profile=id=>BIRDS.find(b=>b.id===id);

test('camera handles instantaneous 160 degree bird turns with a bounded gentle orientation rate',()=>{
 const camera=new THREE.PerspectiveCamera(56,16/9,.1,20000);
 const bird=new THREE.Vector3(0,260,0);
 camera.position.set(0,268,10);
 const director=createCameraDirector(THREE,()=>40,1988);
 const dt=1/60;
 director.update(camera,bird,0,60,'patrol',1.65,0,dt);
 let previous=camera.quaternion.clone(),previousHeading=0;
 let changed=false;
 for(let i=1;i<=300;i++){
   bird.z-=.55;
   const yaw=i===1?Math.PI*.89:Math.PI*.89;
   const result=director.update(camera,bird,yaw,60,'patrol',1.65,i*dt,dt);
   const step=camera.quaternion.angleTo(previous);
   assert.ok(step<.76*dt+.001,'camera instantly whipped around: '+step+' radians');
   const dyaw=Math.abs(result.cameraHeading-previousHeading);
   assert.ok(dyaw<.72*dt+.001,'camera heading snaps too fast '+dyaw);
   assert.ok(result.turnSpeed<=.761,'camera angular rate over its limit');
   if(result.cameraHeading>.15)changed=true;
   previous.copy(camera.quaternion);previousHeading=result.cameraHeading;
 }
 assert.ok(changed,'camera should eventually follow the new direction');
});

test('heading wrap across plus/minus PI does not rotate camera a full circle',()=>{
 const camera=new THREE.PerspectiveCamera(58,16/9,.1,20000);
 camera.position.set(0,120,10);
 const director=createCameraDirector(THREE,()=>10,1988);
 const bird=new THREE.Vector3(0,110,0),initial=Math.PI-.025,dt=1/60;
 director.update(camera,bird,initial,44,'patrol',1.4,0,dt);
 const result=director.update(camera,bird,-Math.PI+.025,44,'patrol',1.4,dt,dt);
 assert.ok(Math.abs(result.cameraHeading-initial)<.01,
  'heading wrap should be a small continuous turn');
 assert.ok(result.turnSpeed<=.761);
});

test('perched wings fold along the sides instead of pointing skyward',()=>{
 for(const id of ['gull','albatross','eagle','owl','heron']){
   const rig=createBirdRig(THREE,profile(id));
   animateBirdRig(rig,0,{state:'patrol',energy:.65},.1);
   for(let i=1;i<=35;i++)
     animateBirdRig(rig,i*.1,{state:'rest',sleeping:true,grounded:true,energy:0},.1);
   const {left,right,fold,tail}=rig.userData;
   assert.ok(fold>.99,id+' should reach a folded wing pose');
   assert.ok(left.pivot.rotation.y>1.30&&right.pivot.rotation.y< -1.30,
     id+' wings must point back along the torso');
   assert.ok(left.pivot.rotation.z>0&&right.pivot.rotation.z<0,
     id+' wings should lower rather than angle upwards');
   assert.ok(Math.abs(left.pivot.rotation.z)<.25,'resting wings must not point skyward');
   const before=tail.rotation.y;
   animateBirdRig(rig,5,{state:'rest',sleeping:true,grounded:true},.1);
   assert.notEqual(tail.rotation.y,before,'resting tail must not freeze forever');
 }
});

test('ocean surface interpolation matches the actual triangular GPU ocean mesh',()=>{
 const size=OCEAN_PLANE_SIZE,seg=OCEAN_SEGMENTS,cell=size/seg,half=size*.5;
 const ix=100,iz=110,time=53,storm=.38;
 const x0=ix*cell-half,z0=iz*cell-half;
 for(const [u,v] of [[0,0],[1,0],[0,1],[1,1],[.1,.2],[.9,.7]]){
   const actual=oceanSurfaceHeight(x0+cell*u,z0+cell*v,time,storm);
   const wave=(x,z)=>oceanWave(x,z,time,storm);
   const h00=wave(x0,z0),h10=wave(x0+cell,z0);
   const h01=wave(x0,z0+cell),h11=wave(x0+cell,z0+cell);
   const expected=OCEAN_BASE_HEIGHT+(u+v<=1?
     h00*(1-u-v)+h10*u+h01*v:
     h01*(1-u)+h10*(1-v)+h11*(u+v-1));
   assert.ok(Math.abs(actual-expected)<1e-8,'buoyancy deviates from rendered water surface');
 }
 const pose=oceanFloatPose(1000,2000,time,storm,3.2);
 assert.ok(pose.y>oceanSurfaceHeight(1000,2000,time,storm));
 assert.ok(Math.abs(pose.roll)<=.085&&Math.abs(pose.pitch)<=.085);
});

test('seabirds genuinely float with folded wings and gentle wave response',()=>{
 for(const id of ['gull','albatross']){
   const brain=createBirdBrain(profile(id),1988);
   let afloat=0,changedHeight=false,previous=null;
   for(let i=0;i<9000;i++){
     const time=i*.1,action=brain.update(time,.1,.9,0);
     if(!action.floating)continue;
     afloat++;
     assert.equal(action.grounded,false,id+' cannot stand on ocean');
     assert.equal(action.wingsFolded,true,'floating bird should fold wings');
     const surface=oceanSurfaceHeight(action.x,action.z,time,0);
     assert.ok(action.y>=surface+.04-1e-5,
       id+' sunk below water '+action.y+' vs '+surface);
     assert.ok(action.y<=surface+5.5,
       id+' is hovering far above ocean '+action.y+' vs '+surface);
     assert.ok(Math.abs(action.waterPitch)<=.09&&Math.abs(action.waterRoll)<=.09);
     if(previous!==null&&Math.abs(action.y-previous)>.001)changedHeight=true;
     previous=action.y;
   }
   assert.ok(afloat>=15,id+' never rested afloat in 15 simulated minutes');
   assert.ok(changedHeight,'floating bird must react to changing water surface');
 }
});

test('camera softens sudden vertical landing and ocean-bob impulses',()=>{
 const camera=new THREE.PerspectiveCamera(56,16/9,.1,20000);
 const bird=new THREE.Vector3(0,190,0);
 camera.position.set(0,199,11);
 const director=createCameraDirector(THREE,()=>20,1988);
 const dt=1/60;
 director.update(camera,bird,0,50,'patrol',1.3,0,dt);
 const initialY=camera.position.y;
 bird.y+=12; // simulate a strong 12 metre impulse in one world tick
 director.update(camera,bird,0,50,'patrol',1.3,dt,dt);
 assert.ok(camera.position.y-initialY<9,
   'camera must not mirror full bird bob/teleport: '+(camera.position.y-initialY));
 assert.ok(camera.position.y>initialY,'camera must continue following the subject');
});
