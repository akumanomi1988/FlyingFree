import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createEcosystem} from '../src/ecosystem.js';
import {habitatAt} from '../src/ecology.js';
import {marineCellCandidates,MARINE_CELL_SIZE} from '../src/marineWildlife.js';
import {TROPICAL_WORLD} from '../src/tropicalTerrain.js';
import {createWildlifeObservatory} from '../src/wildlifeObservatory.js';

test('marine sites are seeded and swim orbits never cross onto land',()=>{
 assert.deepEqual(marineCellCandidates(1988,8,3,'dolphin'),
   marineCellCandidates(1988,8,3,'dolphin'));
 assert.throws(()=>marineCellCandidates(1988,0,0,'shark'),RangeError);
 assert.equal(MARINE_CELL_SIZE,480);
 for(let cx=-8;cx<=8;cx+=2)for(let cz=-8;cz<=8;cz+=2)
   for(const site of marineCellCandidates(1988,cx,cz,'dolphin')){
     assert.equal(habitatAt(site.x,site.z,1988).type,'ocean');
     assert.ok(site.radius<=40&&site.speed<=4.4);
   }
});

test('dolphin and gull pools populate ocean cells without new meshes',()=>{
 const seed=1988,scene=new THREE.Scene();
 let sea=null;
 for(let x=-5300;x<=5300&&!sea;x+=350)for(let z=-5300;z<=5300;z+=350){
   if(habitatAt(x,z,seed).type!=='ocean')continue;
   const cx=Math.floor(x/MARINE_CELL_SIZE),cz=Math.floor(z/MARINE_CELL_SIZE);
   if(marineCellCandidates(seed,cx,cz,'dolphin').length>=1)
     sea={x,y:18,z};
 }
 assert.ok(sea,'seed did not generate a marine habitat');
 const ecosystem=createEcosystem(THREE,scene,seed,1,sea);
 const dolphinRefs=[...ecosystem.dolphins],gullRefs=[...ecosystem.birds];
 ecosystem.update(1,.95,0,sea,0,sea);
 const initial=ecosystem.marinePopulationStats;
 assert.ok(initial.dolphinsLocal>=1,'dolphins do not follow marine habitats');
 assert.ok(initial.gullsLocal>=1,'gulls do not occupy marine habitats');
 assert.equal(ecosystem.dolphins.length,7);
 assert.equal(ecosystem.birds.length,34);
 assert.deepEqual(ecosystem.dolphins,dolphinRefs);
 assert.deepEqual(ecosystem.birds,gullRefs);
 for(const d of ecosystem.dolphins.filter(r=>r.siteKey)){
   assert.ok(d.group.position.y<=TROPICAL_WORLD.seaLevel+2,
      'dolphin breaches far above the ocean surface');
 }
 const initialRefs=ecosystem.observableAnimals;
 assert.equal(initialRefs.length,ecosystem.actors.length+ecosystem.dolphins.length);
 const observer=createWildlifeObservatory(THREE);
 assert.ok(observer.update(1,initialRefs,new THREE.PerspectiveCamera(),sea,900).stats.nearby>=0);
});

test('marine actors keep anchors when they are near the existing observer',()=>{
 const seed=1988,point={x:5000,y:20,z:5000};
 const world=createEcosystem(THREE,new THREE.Scene(),seed,1,point);
 world.update(2,.95,0,point,0,point);
 const near=world.dolphins.filter(d=>d.siteKey&&
   Math.hypot(d.group.position.x-point.x,d.group.position.z-point.z)<560);
 const old=near.map(d=>({d,key:d.siteKey,x:d.anchorX,z:d.anchorZ}));
 const moved={x:point.x+MARINE_CELL_SIZE*1.2,y:point.y,z:point.z};
 world.update(50,.95,0,moved,0,point);
 for(const {d,key,x,z} of old){
   assert.equal(d.siteKey,key);
   assert.equal(d.anchorX,x);
   assert.equal(d.anchorZ,z);
 }
});
