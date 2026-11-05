import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createEcosystem} from '../src/ecosystem.js';
import {faunaPathAngle,faunaPathOffset,FAUNA_LOD_DISTANCE,shouldAnimateFauna,terrainSlopeAngles} from '../src/faunaLOD.js';

test('animal procedural routes do not jump at grazing and cycle boundaries',()=>{
  const s={cycle:19.5,phase:1.7,seed:7.2};
  const start=faunaPathAngle(0,s);
  s.anchorSin=Math.sin(start);s.anchorCos=Math.cos(start*.83);
  const origin=faunaPathOffset(0,s,53);
  assert.ok(Math.abs(origin.x)<1e-10&&Math.abs(origin.z)<1e-10);
  for(let n=1;n<=6;n++)for(const fraction of [.63,1]){
    const boundary=(n+fraction)*s.cycle-s.seed;
    const before=faunaPathOffset(boundary-.0001,s,53);
    const after=faunaPathOffset(boundary+.0001,s,53);
    assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.02,
      'animal must not teleport at cycle '+n+' phase '+fraction);
  }
});

test('fauna LOD uses cached 3D silhouettes and keeps animated heads',()=>{
  const scene=new THREE.Scene();
  const world=createEcosystem(THREE,scene,1988,1);
  const stats=world.lodStats;
  assert.equal(stats.totalActors,24);
  assert.ok(stats.prototypes>=3&&stats.prototypes<=4);
  for(const [type,drawCalls] of Object.entries(stats.farDrawCalls)){
    assert.ok(drawCalls>=1&&drawCalls<=3,type+' low LOD should be batched');
  }
  for(const actor of world.actors){
    const lod=actor.userData.lod;
    assert.ok(lod.isLOD);
    assert.equal(lod.levels.length,2);
    assert.ok(lod.levels[0].object.isGroup);
    assert.ok(lod.levels[1].object.isGroup);
    assert.ok(lod.levels[0].object.children.length>lod.levels[1].object.children.length);
    assert.equal(lod.levels[1].distance,FAUNA_LOD_DISTANCE[actor.userData.state.type]);
    assert.ok(actor.userData.legs.length>=2);
    if(actor.userData.head){
      assert.ok(actor.userData.head.parent);
      assert.equal(actor.userData.head.getObjectById(actor.userData.head.id),actor.userData.head);
    }
  }
});

test('LOD transitions hide expensive rigs but keep the same animal position',()=>{
  const scene=new THREE.Scene(),world=createEcosystem(THREE,scene,1988,.7);
  const animal=world.actors.find(a=>a.userData.state.type==='fox');
  const lod=animal.userData.lod;
  scene.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera();
  camera.position.copy(animal.position).add(new THREE.Vector3(1,3,2));
  camera.updateMatrixWorld(true);
  lod.update(camera);
  assert.equal(lod.levels[0].object.visible,true);
  const original=animal.position.clone();
  camera.position.copy(animal.position).add(new THREE.Vector3(450,20,0));
  camera.updateMatrixWorld(true);
  lod.update(camera);
  assert.equal(lod.levels[0].object.visible,false);
  assert.equal(lod.levels[1].object.visible,true);
  assert.ok(animal.position.equals(original),'LOD must not teleport the actor');
  assert.equal(shouldAnimateFauna(1000,'fox'),false);
  assert.equal(shouldAnimateFauna(20,'fox'),true);
});

test('first update preserves generated spawn location and predation reactions are bounded',()=>{
  const scene=new THREE.Scene(),world=createEcosystem(THREE,scene,1988,1);
  const before=world.actors.map(actor=>actor.position.clone());
  world.update(0,1,0,null,0,new THREE.Vector3(0,100,0));
  for(let i=0;i<world.actors.length;i++){
    const delta=world.actors[i].position.distanceTo(before[i]);
    assert.ok(delta<.001,'initial spawn jump '+world.actors[i].userData.state.type+': '+delta);
  }
  const initial=world.actors.map(actor=>actor.position.clone());
  const hero=world.actors[0].position.clone();
  world.update(.016,1,0,hero,0,hero.clone().add(new THREE.Vector3(0,8,0)));
  for(let i=0;i<world.actors.length;i++){
    const delta=world.actors[i].position.distanceTo(initial[i]);
    assert.ok(delta<2,'reaction jump '+world.actors[i].userData.state.type+': '+delta);
  }
  const after=world.lodStats;
  assert.ok(after.nearAnimated>=1&&after.nearAnimated<=world.actors.length);
});

test('deer antlers remain bilaterally symmetric at generation',()=>{
  const world=createEcosystem(THREE,new THREE.Scene(),1988,1);
  const deer=world.actors.filter(a=>a.userData.state.type==='deer');
  for(const actor of deer){
    const head=actor.userData.head;
    const antlers=head.children.filter(o=>o.isMesh&&o.geometry.type==='CylinderGeometry');
    assert.equal(antlers.length,actor.userData.antlered?10:0);
  }
});

test('terrain normal aligns animal bodies without unsafe rotations',()=>{
  const level=terrainSlopeAngles(0,0,0);
  assert.ok(Math.abs(level.pitch)<1e-8&&Math.abs(level.roll)<1e-8);
  const roll=terrainSlopeAngles(.2,0,0);
  assert.ok(roll.roll>.15&&Math.abs(roll.pitch)<1e-8);
  const pitch=terrainSlopeAngles(.2,0,Math.PI/2);
  assert.ok(pitch.pitch<-.15&&Math.abs(pitch.roll)<1e-8);
  const steep=terrainSlopeAngles(10,-10,0);
  assert.ok(Math.abs(steep.pitch)<=.22&&Math.abs(steep.roll)<=.22);
  const unknown=terrainSlopeAngles(NaN,Infinity,NaN);
  assert.ok(Number.isFinite(unknown.pitch)&&Number.isFinite(unknown.roll));
});
