import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS,terrainHeight} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createBirdRig,animateBirdRig} from '../src/flight.js';
import {birdSensation} from '../src/birdEcology.js';

test('exhausted swifts recover energy in the air rather than landing, including during rain',()=>{
 const profile=BIRDS.find(b=>b.id==='swift');
 for(const rain of [0,.92]){
  const brain=createBirdBrain(profile,1988,{energy:.18,hunger:.28});
  let aerialTicks=0,recovered=false;
  for(let i=0;i<450;i++){
   const state=brain.update(i*.1,.1,.9,rain);
   assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.y)&&Number.isFinite(state.z));
   assert.equal(state.grounded,false,'a swift cannot land on open ground for rest');
   assert.ok(!['landing','rest','shelter'].includes(state.state),
     'swift must not enter ground/shelter rest when exhausted');
   assert.ok(state.y>terrainHeight(state.x,state.z,1988),
     'swift must remain physically above terrain');
   if(state.state==='aerial_rest'){
    aerialTicks++;
    assert.equal(state.wingsFolded,false);
    assert.equal(birdSensation(state),'Planeando para recuperar energía');
   }
   if(state.energy>.62)recovered=true;
  }
  assert.ok(aerialTicks>50,'aerial recovery never took place');
  assert.ok(recovered,'flight rest must actually replenish energy');
 }
});

test('swift gliding removes powered wingbeat without folding flight wings',()=>{
 const profile=BIRDS.find(b=>b.id==='swift');
 const rig=createBirdRig(THREE,profile);
 for(let i=0;i<60;i++)
  animateBirdRig(rig,i/60,{state:'aerial_rest',energy:.3,grounded:false},1/60);
 assert.ok(Math.abs(rig.userData.flap)<.015,'gliding must have no rhythmic powered flap');
 assert.ok(rig.userData.fold<.05,'gliding wings must remain extended');
});

test('grounded feeding has visible posture movement but no forced effect on marine feeding',()=>{
 const profile=BIRDS.find(b=>b.id==='kestrel');
 const rig=createBirdRig(THREE,profile),samples=[];
 for(let i=0;i<90;i++){
  animateBirdRig(rig,i/30,{state:'feed',grounded:true,energy:.5},1/30);
  if(i>15)samples.push(rig.rotation.x);
 }
 const extent=Math.max(...samples)-Math.min(...samples);
 assert.ok(extent>.1,'feeding posture remains a rigid statue');
 animateBirdRig(rig,5,{state:'feed',grounded:false,floating:true,waterPitch:.02},1/30);
 assert.ok(Math.abs(rig.rotation.x-.02)<.001,
   'floating marine bird should not peck at solid terrain');
});
