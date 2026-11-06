import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createBirdRig,animateBirdRig} from '../src/flight.js';

test('tired swifts recover energy airborne, never landing on open terrain',()=>{
 const profile=BIRDS.find(b=>b.id==='swift');
 const brain=createBirdBrain(profile,1988,{energy:.18,hunger:.28});
 const first=brain.update(0,.1,.8,0);
 assert.equal(first.state,'aerial_rest');
 assert.equal(first.grounded,false);
 let recovered=false,minimum=.18;
 for(let i=1;i<440;i++){
   const state=brain.update(i*.1,.1,.8,0);
   assert.ok(!['landing','rest'].includes(state.state),
     'swift must rest on the wing rather than land during ordinary flight');
   assert.equal(state.grounded,false);
   if(state.energy>.62)recovered=true;
   minimum=Math.max(minimum,state.energy);
 }
 assert.ok(recovered&&minimum>.62,'gliding recovery was not effective');
});

test('feeding posture is animated rather than a completely static upright statue',()=>{
 const profile=BIRDS.find(b=>b.id==='eagle');
 const rig=createBirdRig(THREE,profile);
 const pitch=[];
 for(let i=0;i<60;i++){
   animateBirdRig(rig,i/24,{state:'feed',grounded:true,energy:.50},1/24);
   if(i>10)pitch.push(rig.rotation.x);
 }
 const spread=Math.max(...pitch)-Math.min(...pitch);
 assert.ok(spread>.13,'feeding bird must bend forward rhythmically');
 const left=rig.userData.legs[0],right=rig.userData.legs[1];
 assert.ok(Number.isFinite(left.rotation.x)&&Number.isFinite(right.rotation.x));
});
