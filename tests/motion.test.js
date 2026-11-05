import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS,terrainHeight} from '../src/core.js';
import {createWindField} from '../src/worldMotion.js';
import {createGroundDetail} from '../src/vegetation.js';
import {createAtmospherics} from '../src/atmospherics.js';
import {createBirdRig,animateBirdRig} from '../src/flight.js';
import {createEcosystem} from '../src/ecosystem.js';

test('GPU wind deforms instanced foliage without allocating new meshes',()=>{
 const wind=createWindField();
 const mat=new THREE.MeshStandardMaterial({color:0x87aa68});
 wind.apply(mat,{amplitude:.6,height:4,frequency:.9});
 const shader={uniforms:{},vertexShader:'#include <common>\nvoid main(){\n#include <begin_vertex>\n}'};
 assert.doesNotThrow(()=>mat.onBeforeCompile(shader,{}));
 assert.ok(shader.vertexShader.includes('forestOrigin'));
 assert.ok(shader.vertexShader.includes('windTip'));
 assert.ok(shader.uniforms.uWorldWindTime);
 wind.update(12,{cloud:.8,rain:.6});
 assert.equal(shader.uniforms.uWorldWindTime.value,12);
 assert.ok(wind.strength>.35);
});
test('ground vegetation and atmospheric LOD use bounded shared geometry',()=>{
 const scene=new THREE.Scene(),wind=createWindField();
 const detail=createGroundDetail(THREE,scene,.14,wind);
 const fx=createAtmospherics(THREE,scene,.15);
 const x=500,z=300,y=terrainHeight(x,z);
 detail.update(1,{position:{x,y:y+24,z}},{x,y:y+19,z},.9,0,20);
 fx.update(1,{position:{x,y:y+60,z}},{x,y:y+25,z},.9,{rain:0,cloud:0});
 assert.equal(detail.active,true);
 for(const object of scene.children){
   if(object.isInstancedMesh)assert.ok(object.geometry?.attributes.position,'Invalid instanced geometry');
 }
 assert.ok(wind.materials>=3);
 assert.ok(fx.activeCount>0);
 detail.update(4,{position:{x,y:y+900,z}},{x,y:y+900,z},.9,0,20);
 fx.update(4,{position:{x,y:y+900,z}},{x,y:y+900,z},.9,{rain:0,cloud:0});
 assert.equal(detail.active,false);
 assert.equal(fx.activeCount,0);
});
test('bird wings, tail and landing legs animate without rebuilding geometry',()=>{
 const bird=BIRDS.find(b=>b.id==='kestrel'),rig=createBirdRig(THREE,bird);
 const left=rig.userData.left.pivot;
 animateBirdRig(rig,2,{energy:.6,sleeping:false,bank:.22,pitch:.05,state:'patrol'},.06);
 const flying=left.rotation.z;
 animateBirdRig(rig,5,{energy:0,sleeping:true,grounded:true,state:'rest'},.1);
 const landed=left.rotation.z;
 assert.notEqual(flying,landed);
 assert.ok(Number.isFinite(rig.userData.tail.rotation.y));
 assert.ok(rig.userData.legs.length>=2);
 for(let i=0;i<20;i++)animateBirdRig(rig,6+i*.1,{sleeping:false,grounded:false,energy:.5,state:'patrol'},.08);
 assert.ok(rig.userData.legs.every(leg=>leg.scale.y<.43),'Patas sin retraer durante vuelo');
});
test('wildlife animates leg gait and dolphin tails deterministically',()=>{
 const scene=new THREE.Scene(),eco=createEcosystem(THREE,scene,1988,.45);
 const deer=eco.actors.find(a=>a.userData.state.type==='deer');
 assert.ok(deer.userData.legs.length>=4);
 const near=deer.position.clone().add(new THREE.Vector3(0,8,0));
 eco.update(1,.9,0,{x:100,y:160,z:100},.1,near);
 const first=deer.userData.legs[0].rotation.x;
 eco.update(2,.9,0,{x:100,y:160,z:100},.1,near);
 assert.notEqual(deer.userData.legs[0].rotation.x,first);
 assert.equal(deer.userData.motionDetailed,true);
 const far=new THREE.Vector3(10000,1000,10000);
 eco.update(3,.9,0,{x:100,y:160,z:100},.1,far);
 const frozen=deer.userData.legs[0].rotation.x;
 eco.update(4,.9,0,{x:100,y:160,z:100},.1,far);
 assert.equal(deer.userData.motionDetailed,false);
 assert.equal(deer.userData.legs[0].rotation.x,frozen,'Distant rig must not waste CPU on limb animation');
 assert.ok(eco.dolphins[0].group.userData.tail);
 assert.ok(Number.isFinite(eco.dolphins[0].group.userData.tail.rotation.x));
});
