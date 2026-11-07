import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainHeight} from '../src/core.js';
import {createRiverEcosystem} from '../src/riverEcosystem.js';
import {createRegionalBirds} from '../src/regionalBirds.js';
import {createTropicalRivers} from '../src/tropicalRivers.js';
import {createEcosystem} from '../src/ecosystem.js';

test('river banks have real, seeded instanced rocks, plants and fish',()=>{
 for(const seed of [1988,4721,20261107]){
  const scene=new THREE.Scene(),habitat=createRiverEcosystem(THREE,scene,seed,1);
  assert.equal(scene.children.length,1);
  const s=habitat.stats;
  assert.ok(s.rocks>150,'river banks lack rocks '+seed);
  assert.ok(s.reeds>200,'river banks lack reeds '+seed);
  assert.ok(s.shrubs>35,'river banks lack bushes '+seed);
  assert.ok(s.fish>20,'river channels lack swimming fish '+seed);
  assert.ok(s.drawCalls<=4);
  for(const m of [habitat.rocks,habitat.reeds,habitat.shrubs,habitat.fish]){
   assert.equal(m.isInstancedMesh,true);
   assert.ok(m.count<=m.instanceMatrix.count);
   assert.equal(m.geometry.attributes.position.count>0,true);
  }
  habitat.dispose();
  assert.equal(scene.children.length,0);
 }
});

test('repeated river habitats generate identical geometry and positions',()=>{
 const a=createRiverEcosystem(THREE,new THREE.Scene(),1988,.7);
 const b=createRiverEcosystem(THREE,new THREE.Scene(),1988,.7);
 assert.deepEqual(a.stats,b.stats);
 assert.deepEqual(
  [...a.rocks.instanceMatrix.array.slice(0,16)],
  [...b.rocks.instanceMatrix.array.slice(0,16)]
 );
 a.dispose();b.dispose();
});

test('river fish animate only near the observer, with bounded matrix budget',()=>{
 const habitat=createRiverEcosystem(THREE,new THREE.Scene(),1988,1);
 const before=habitat.fish.instanceMatrix.array.slice(0,16);
 habitat.update(1,{x:1e5,y:0,z:1e5});
 assert.equal(habitat.visibleFish,0);
 const p=new THREE.Vector3();
 habitat.fish.count=habitat.stats.fish;
 // Initial fish render matrices are derived from actual river water sites.
 habitat.update(1.5,null);
 assert.ok(habitat.visibleFish>20);
 assert.ok(habitat.visibleFish<=habitat.stats.fish);
 const after=habitat.fish.instanceMatrix.array.slice(0,16);
 assert.notDeepEqual([...before],[...after],'fish never swim');
 habitat.dispose();
});

test('river water current updates one shader uniform without geometry edits',()=>{
 const river=createTropicalRivers(THREE,new THREE.Scene(),1988);
 const attr=river.mesh.geometry.getAttribute('position');
 assert.ok(river.mesh.geometry.getAttribute('uv'));
 const count=attr.count;
 river.update(12.75);
 assert.equal(river.flowTime,12.75);
 assert.equal(river.mesh.geometry.getAttribute('position'),attr);
 assert.equal(attr.count,count);
 const shader={uniforms:{},
  vertexShader:'void main() {\n#include <begin_vertex>\n}',
  fragmentShader:'void main() {\n#include <color_fragment>\n}'};
 river.mesh.material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.uRiverFlowTime.value,12.75);
 assert.match(shader.fragmentShader,/bankFoam/);
 assert.match(shader.fragmentShader,/uRiverFlowTime/);
 river.dispose();
});

test('seeded regional birds retain a three draw-call flight budget',()=>{
 const scene=new THREE.Scene(),regional=createRegionalBirds(THREE,scene,1988,1);
 const hero={x:780,y:160,z:400};
 regional.update(0,hero,hero,1,0);
 assert.equal(regional.stats.drawCalls,3);
 assert.ok(regional.stats.population>30,'bird population is still empty');
 assert.ok(regional.stats.visible>4,'no nearby birds over habitat');
 assert.ok(regional.stats.visible<=regional.stats.population);
 for(const m of [regional.body,regional.head,regional.wings]){
  assert.ok(m.isInstancedMesh);
  assert.equal(m.count,regional.stats.visible);
 }
 const same=createRegionalBirds(THREE,new THREE.Scene(),1988,1);
 same.update(0,hero,hero,1,0);
 assert.deepEqual(regional.stats,same.stats);
 assert.deepEqual(
  [...regional.body.instanceMatrix.array.slice(0,16)],
  [...same.body.instanceMatrix.array.slice(0,16)]);
 regional.update(1.4,hero,hero,1,0);
 assert.ok(regional.stats.visible>4);
 same.dispose();regional.dispose();
 assert.equal(scene.children.length,0);
});

test('regional wing flaps are evaluated by GPU shader time, not mesh rebuilds',()=>{
 const regional=createRegionalBirds(THREE,new THREE.Scene(),1988,.7);
 const geometry=regional.wings.geometry;
 const shader={uniforms:{},
  vertexShader:'void main() {\n#include <begin_vertex>\n}',
  fragmentShader:'void main() {}'};
 regional.wings.material.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/uRegionalFlight/);
 assert.ok(shader.uniforms.uRegionalFlight);
 regional.update(4,{x:500,y:120,z:500},{x:500,y:120,z:500});
 assert.equal(geometry,regional.wings.geometry);
 assert.equal(shader.uniforms.uRegionalFlight.value,4);
 regional.dispose();
});

test('mammal groups can establish living populations near documentary subject',()=>{
 const s=1988;
 // A documentary observer should be placed in habitable forest/meadow,
 // not above an uninhabitable volcanic cliff.
 const previous=createEcosystem(THREE,new THREE.Scene(),s,1);
 const terrain=previous.actors[0].position.clone();
 const scene=new THREE.Scene();
 const world=createEcosystem(THREE,scene,s,1,terrain);
 assert.equal(world.actors.length,48);
 let near=world.actors.filter(a=>Math.hypot(a.position.x-terrain.x,
   a.position.z-terrain.z)<720);
 assert.ok(near.length>=4,'herds are still kilometers away from the viewer');
 const before=world.actors.map(a=>a.position.clone());
 world.update(.02,.9,.12,terrain,0,terrain);
 assert.ok(world.actors.every((a,i)=>a.position.distanceTo(before[i])<3));
});
