import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cameraShotAt,cameraPlanAt,CAMERA_SHOTS,createCameraDirector} from '../src/cameraDirector.js';
import {terrainHeight} from '../src/core.js';

test('cinematic shots remain attached to the bird with no fixed world-space coordinates',()=>{
 assert.equal(CAMERA_SHOTS.length,5);
 assert.equal(cameraShotAt(0),'chase');
 assert.equal(cameraShotAt(38),'shoulder');
 assert.equal(cameraShotAt(78),'scenic');
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
  const result=director.update(camera,bird,1.0,60,'patrol',1.65,t,1/12);
  assert.ok(camera.position.distanceTo(bird)<250,'shot detached from tracked bird');
  assert.ok(result.target.distanceTo(bird)<20,'target moved away from protagonist');
 }
 assert.ok(['chase','shoulder','scenic','profile','high-reveal'].includes(director.shot));
});
