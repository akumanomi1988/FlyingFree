import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainHeight,BIRDS,readOptions} from '../src/core.js';
import {tropicalTerrainSample,tropicalRiverPoint,TROPICAL_WORLD} from '../src/tropicalTerrain.js';
import {createTropicalRivers} from '../src/tropicalRivers.js';
import {birdHabitatScore,habitatAt,resourcePoint} from '../src/ecology.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createEcosystem} from '../src/ecosystem.js';
const bird=id=>BIRDS.find(b=>b.id===id);

test('different seeds yield deterministic large volcanic relief instead of a fixed small radial island',()=>{
 const seeds=[1988,20261106,777713];
 for(const seed of seeds){
  assert.equal(terrainHeight(230,160,seed),terrainHeight(230,160,seed));
  assert.ok(terrainHeight(0,0,seed)>80,'island central highland missing');
  assert.ok(terrainHeight(5700,5700,seed)<TROPICAL_WORLD.seaLevel,'open sea must remain');
  const heights=[];
  for(const x of [-1300,-550,200,1050])for(const z of [-650,0,770,1300])
    heights.push(terrainHeight(x,z,seed));
  assert.ok(Math.max(...heights)>450,'mountain summits missing: '+seed);
  assert.ok(Math.max(...heights)-Math.min(...heights)>150,'flat world: '+seed);
 }
 assert.notEqual(terrainHeight(740,360,1988),terrainHeight(740,360,20261106));
 assert.equal(TROPICAL_WORLD.extent,12000);
 assert.equal(readOptions('?seed=2519').seed,2519);
 assert.equal(readOptions('?seed=-3').seed,null);
 assert.equal(readOptions('?seed=not-a-seed').seed,null);
});

test('three seeded rivers cut continuous valleys into the same terrain heightfield',()=>{
 for(const seed of [1988,21002]){
  for(let i=0;i<3;i++){
   const p=tropicalRiverPoint(i,.49,seed);
   const sample=tropicalTerrainSample(p.x,p.z,seed);
   assert.ok(sample.river>.78,'river must lie inside channel '+i);
   assert.ok(sample.valley>.40,'river corridor must carve valley '+i);
   const other=tropicalRiverPoint(i,.51,seed);
   assert.ok(Math.hypot(p.x-other.x,p.z-other.z)<130,'river has abrupt jump');
  }
 }
 const scene=new THREE.Scene(),rivers=createTropicalRivers(THREE,scene,1988);
 assert.equal(rivers.channels,3);
 assert.ok(rivers.segments>130,'rivers are too short to see from flight');
 assert.equal(scene.children.length,1);
 assert.ok(rivers.mesh.geometry.index.count>300);
 rivers.dispose();assert.equal(scene.children.length,0);
});

test('species habitat weights prefer ocean only for marine/coastal birds',()=>{
 const sample=type=>({type,height:type==='ocean'?-38:180,slope:.2,humidity:.7});
 for(const id of ['eagle','vulture','kestrel','owl','hummingbird','swift','swallow']){
  const profile=bird(id);
  assert.ok(birdHabitatScore(profile,sample('forest'))>birdHabitatScore(profile,sample('ocean'))*6,
    id+' should favor land over open sea');
 }
 for(const id of ['albatross','gull'])
  assert.ok(birdHabitatScore(bird(id),sample('ocean'))>=.8);
 for(const id of ['kingfisher','heron','osprey'])
  assert.ok(birdHabitatScore(bird(id),sample('wetland'))>birdHabitatScore(bird(id),sample('ocean')));
});

test('species brains spawn in their ecological range and preserve habitat-based patrols',()=>{
 for(const id of ['eagle','vulture','kestrel','hummingbird','owl','albatross','gull','kingfisher']){
  const profile=bird(id);
  const brain=createBirdBrain(profile,20261106);
  const home=brain.snapshot;
  const biome=habitatAt(home.x,home.z,20261106);
  assert.ok(birdHabitatScore(profile,biome)>.12,id+' spawned in incompatible '+biome.type);
  const action=brain.update(0,0,1,0);
  assert.ok(Number.isFinite(action.x)&&Number.isFinite(action.z));
  assert.ok(['ocean','forest','wetland','shore','meadow','highland','rock'].includes(biome.type));
 }
});

test('foraging destinations favor freshwater for kingfishers and terrestrial sites for eagles',()=>{
 let state=91;const rng=()=>{state=Math.imul(state+12345,1103515245)>>>0;return state/4294967296;};
 const eagle=resourcePoint(bird('eagle'),500,300,rng,20261106);
 const kingfisher=resourcePoint(bird('kingfisher'),500,300,rng,20261106);
 assert.ok(eagle.kind==='small-prey');
 assert.ok(kingfisher.kind==='fish');
 assert.notEqual(eagle.biome,'ocean');
});

test('secondary seabirds and dolphins now occupy real ocean off the enlarged tropical coastline',()=>{
 const seed=20261106,scene=new THREE.Scene(),eco=createEcosystem(THREE,scene,seed,.7);
 eco.update(0,1,0,null,0,null);
 assert.ok(eco.dolphins.every(d=>terrainHeight(d.group.position.x,d.group.position.z,seed)<-9),
   'dolphins must not surface in the tropical forest');
 const oceanGulls=eco.birds.filter(b=>terrainHeight(b.g.position.x,b.g.position.z,seed)<-9).length;
 assert.ok(oceanGulls>=eco.birds.length*.45,'coastal gulls should not circle the volcanic summit');
 const landMammals=eco.actors.filter(a=>terrainHeight(a.position.x,a.position.z,seed)>0).length;
 assert.equal(landMammals,eco.actors.length,'terrestrial fauna must spawn on dry land');
});
