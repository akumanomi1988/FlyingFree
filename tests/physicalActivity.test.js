import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS,terrainHeight} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createBirdRestVisuals} from '../src/birdRestVisuals.js';
import {createBirdForageVisuals} from '../src/birdForageVisuals.js';
import {createBirdRig,animateBirdRig} from '../src/flight.js';

const bird=id=>BIRDS.find(b=>b.id===id);

test('a bird really stops on its selected branch before recovering energy',()=>{
 const b=bird('eagle'),seed=1988,start=createBirdBrain(b,seed).snapshot;
 const tree={x:start.x+25,z:start.z+22,y:terrainHeight(start.x+25,start.z+22,seed),
   height:24,angle:Math.PI*.35,kind:'oak'};
 const brain=createBirdBrain(b,seed,{...start,energy:.12,hunger:.17},{perches:[tree]});
 let sawLanding=false,sawRest=false,site=null,restFrames=0;
 for(let i=0;i<2200;i++){
  const a=brain.update(i*.1,.1,.95,.30);
  if(a.state==='landing')sawLanding=true;
  if(a.restSite?.kind==='branch')site=a.restSite;
  if(a.state==='rest'){
   sawRest=true;restFrames++;
   assert.ok(a.grounded,'a perched bird must actually be stopped');
   assert.equal(a.roosting,true,'branch should support the body');
   assert.ok(a.speed<.85);
   assert.ok(Math.abs(a.y-site.y)<.85,'bird body does not touch its chosen branch');
   assert.ok(a.rests>=1);
   if(restFrames>=10)break;
  }
 }
 assert.ok(sawLanding&&sawRest,'bird never completed a perch touchdown');
 assert.ok(site&&site.anchorX===tree.x&&site.anchorZ===tree.z);
 assert.ok(Math.hypot(site.x-tree.x,site.z-tree.z)>1,
   'perch must sit on an outward branch, not through the trunk');
});

test('ground-resting wetland birds do not hover on imaginary forest canopy',()=>{
 const b=bird('heron'),brain=createBirdBrain(b,1988,{energy:.12,hunger:.13});
 let landed=false,site=null;
 for(let i=0;i<4000;i++){
  const a=brain.update(i*.1,.1,.90,.0);
  if(a.restSite)site=a.restSite;
  if(a.state==='rest'&&a.grounded){
   landed=true;
   assert.equal(a.restSite?.kind,'ground');
   const physical=terrainHeight(a.x,a.z,1988)+Math.max(.18,b.wingspan*.32);
   assert.ok(Math.abs(a.y-physical)<.85,
     'heron is floating over ground / the canopy');
   break;
  }
 }
 assert.equal(site?.kind,'ground');
 assert.ok(landed,'heron never achieved real ground rest');
});

test('ocean-roosting birds select water and continue floating',()=>{
 for(const id of ['gull','albatross']){
  const b=bird(id),brain=createBirdBrain(b,1988,{energy:.10,hunger:.20});
  let afloat=false;
  for(let i=0;i<6500;i++){
   const a=brain.update(i*.1,.1,.92,0);
   if(a.state==='rest'&&a.floating){
    assert.equal(a.restSite?.kind,'water');
    assert.equal(a.grounded,false);
    afloat=true;break;
   }
  }
  assert.ok(afloat,id+' never reached the sea to float');
 }
});

test('terrestrial prey is consumed only while really grounded',()=>{
 const b=bird('kestrel'),brain=createBirdBrain(b,1988,{energy:.96,hunger:.94});
 let seenFeed=false,completed=false;
 for(let i=0;i<9000;i++){
  const a=brain.update(i*.08,.08,.96,0);
  if(a.state==='feed'){
   seenFeed=true;
   assert.ok(a.grounded,'raptor feeds before landing');
   assert.ok(a.speed<.85);
   const physical=terrainHeight(a.x,a.z,1988)+Math.max(.18,b.wingspan*.32);
   assert.ok(Math.abs(a.y-physical)<.9,'raptor feeds in the air over prey');
  }
  if(a.feedings>0){completed=true;break;}
 }
 assert.ok(seenFeed&&completed,'the ground feeding sequence did not finish');
});

test('branch prop follows a real tree and never appears for ground/water rest',()=>{
 const scene=new THREE.Scene(),visual=createBirdRestVisuals(THREE,scene);
 const site={kind:'branch',x:22,y:13,z:17,branchY:12,anchorX:18,
   anchorY:8,anchorZ:16};
 const a={x:21,y:13,z:17,state:'landing',restSite:site};
 assert.equal(visual.update(a,{x:21,y:18,z:12}).visible,true);
 assert.equal(visual.root.visible,true);
 const noTree=visual.update({...a,restSite:{kind:'ground',x:22,y:1,z:17}});
 assert.equal(noTree.visible,false);
 const far=visual.update(a,{x:2000,y:90,z:2000});
 assert.equal(far.visible,false);
 visual.dispose();
 assert.equal(scene.children.length,0);
});

test('visible flower and fish capture effects respect animal scale and progress',()=>{
 const scene=new THREE.Scene(),visual=createBirdForageVisuals(THREE,scene,1988);
 const x=100,z=120,ground=terrainHeight(x,z,1988);
 const nectar={x,y:ground+2.2,z,kind:'nectar',biome:'forest',contactY:ground+2.2};
 const a={x,y:ground+2.2,z,foodTarget:nectar,wingspan:.11,state:'feed',
   feedingProgress:.20,rain:0};
 assert.equal(visual.update(a,2).kind,'nectar');
 assert.ok(visual.root.scale.x<.12,'flower is bigger than the hummingbird');
 const fish={x,y:ground,z,kind:'fish',biome:'wetland',contactY:ground+.35};
 assert.equal(visual.update({...a,foodTarget:fish,state:'feed',feedingProgress:.22,
   wingspan:1.6},3).visible,true);
 const ripple=visual.root.children.find(c=>c.isMesh);
 assert.equal(ripple.visible,true,'fish strike should displace water');
 visual.update({...a,foodTarget:fish,feedingProgress:.9,wingspan:1.6},4);
 assert.equal(ripple.visible,false);
 visual.dispose();
 assert.equal(scene.children.length,0);
});

test('resting eye animation uses existing mesh without increasing draw calls',()=>{
 const rig=createBirdRig(THREE,bird('owl'));
 const eyes=rig.userData.eyeMeshes;
 assert.equal(eyes.length,2);
 const open=eyes[0].userData.openEyeY;
 animateBirdRig(rig,1,{state:'rest',grounded:true,sleeping:true},.1);
 assert.ok(eyes[0].scale.y<open*.35);
 animateBirdRig(rig,2,{state:'patrol',grounded:false},.1);
 assert.ok(eyes[0].scale.y>0);
 assert.ok(Number.isFinite(rig.userData.torso.scale.y));
});
