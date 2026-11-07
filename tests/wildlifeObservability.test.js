import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createEcosystem} from '../src/ecosystem.js';
import {terrainHeight} from '../src/core.js';
import {habitatAt} from '../src/ecology.js';
import {wildlifeCellCandidates,WILDLIFE_CELL_SIZE} from '../src/wildlifePopulation.js';
import {createWildlifeObservatory} from '../src/wildlifeObservatory.js';

test('wildlife cell candidates are deterministic and bounded by habitat',()=>{
 const a=wildlifeCellCandidates(1988,1,-2,'deer');
 const b=wildlifeCellCandidates(1988,1,-2,'deer');
 assert.deepEqual(a,b);
 assert.throws(()=>wildlifeCellCandidates(1988,0,0,'dragon'),RangeError);
 assert.equal(WILDLIFE_CELL_SIZE,360);
});

test('mammal rigs are reused as the observer travels across suitable habitats',()=>{
 const seed=1988,world=createEcosystem(THREE,new THREE.Scene(),seed,1);
 const first=world.actors[0].position.clone();
 const scene=new THREE.Scene();
 const active=createEcosystem(THREE,scene,seed,1,first);
 const rigs=[...active.actors],before=active.populationStats;
 assert.equal(rigs.length,48);
 assert.ok(before.cellUpdates>=1);
 assert.ok(before.cachedCells<=256);
 assert.ok(before.nearby>=4,'initial habitat has no local mammals');
 let destination=null;
 for(let x=-2800;x<=2800&&!destination;x+=300)for(let z=-2800;z<=2800;z+=300){
   const h=habitatAt(x,z,seed);
   if(h.type==='forest'&&h.height>=35&&h.height<170&&
     Math.hypot(x-first.x,z-first.z)>1750){destination={x,y:terrainHeight(x,z,seed)+25,z};break;}
 }
 assert.ok(destination,'test seed has no second habitable region');
 active.update(40,.9,0,destination,0,destination);
 const after=active.populationStats;
 assert.ok(after.cellUpdates>before.cellUpdates);
 assert.ok(after.relocated>before.relocated);
 assert.ok(after.nearby>=2,'travelling leaves the documentary in empty habitat');
 assert.ok(after.cachedCells<=256);
 assert.deepEqual(active.actors,rigs,'streaming must reuse rigs, not append objects');
 assert.equal(scene.children.length,1);
});

test('near animals are never recycled during population cell changes',()=>{
 const seed=1988,initial=createEcosystem(THREE,new THREE.Scene(),seed,1);
 const hero=initial.actors[0].position.clone();
 const active=createEcosystem(THREE,new THREE.Scene(),seed,1,hero);
 const protectedAnimals=active.actors.filter(g=>
   Math.hypot(g.position.x-hero.x,g.position.z-hero.z)<300)
   .map(actor=>({actor,key:actor.userData.populationKey,
     originX:actor.userData.state.originX,originZ:actor.userData.state.originZ}));
 assert.ok(protectedAnimals.length>0);
 const moved={x:hero.x+WILDLIFE_CELL_SIZE*1.2,y:hero.y,z:hero.z};
 active.update(55,.9,0,moved,0,hero);
 for(const a of protectedAnimals){
   assert.equal(a.actor.userData.populationKey,a.key);
   assert.equal(a.actor.userData.state.originX,a.originX);
   assert.equal(a.actor.userData.state.originZ,a.originZ);
 }
});

test('projected animals are measured without equating instances with visibility',()=>{
 const camera=new THREE.PerspectiveCamera(55,16/9,.1,1200);
 camera.position.set(0,5,14);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 const actor=new THREE.Group();actor.position.set(0,0,0);
 actor.userData={state:{type:'deer'},behaviour:'foraging',populationKey:'deer:test'};
 const obs=createWildlifeObservatory(THREE,{minPixels:10});
 const a=obs.update(1,[actor],camera,{x:0,y:7,z:0},900);
 assert.equal(a.stats.nearby,1);
 assert.equal(a.stats.inFrustum,1);
 assert.equal(a.stats.recognizableProjected,1);
 assert.equal(a.stats.actionCandidates,1);
 assert.equal(a.focus.type,'deer');
 const b=obs.update(1.1,[actor],camera,{x:0,y:7,z:0},900);
 assert.deepEqual(b.stats,a.stats,'sampling is throttled');
 actor.position.x=400;
 const c=obs.update(2,[actor],camera,{x:0,y:7,z:0},900);
 assert.equal(c.stats.recognizableProjected,0);
 assert.equal(c.focus,null);
});
