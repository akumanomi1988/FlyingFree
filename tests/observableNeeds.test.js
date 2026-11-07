import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS,terrainHeight} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createBirdRig,animateBirdRig} from '../src/flight.js';
import {createBirdForageVisuals} from '../src/birdForageVisuals.js';

const bird=id=>BIRDS.find(b=>b.id===id);

test('returning to a refuge does not generate fictitious energy',()=>{
 for(const id of ['eagle','owl','heron','gull']){
  const brain=createBirdBrain(bird(id),1988,{energy:.13,hunger:.23});
  let previous=.13,sawApproach=false;
  for(let i=0;i<700;i++){
   const s=brain.update(i*.1,.1,id==='owl'?.20:.90,.78);
   if(['return','landing','shelter'].includes(s.state)){
    sawApproach=true;
    assert.ok(s.energy<=previous+1e-9,
      id+' gained energy while still airborne: '+previous+' -> '+s.energy);
   }
   previous=s.energy;
  }
  assert.ok(sawApproach,id+' never tried to reach rest');
 }
});

test('food search never restores satiety and feedings count only completed events',()=>{
 const b=bird('hummingbird');
 const brain=createBirdBrain(b,1988,{energy:.82,hunger:.95});
 let lastHunger=.95,lastFeedings=0,feedingFrames=0,finished=false,visualContact=false;
 for(let i=0;i<14000;i++){
  const s=brain.update(i*.1,.1,.90,0);
  // The final feeding tick can transition straight to takeoff. It still
  // belongs to the completed feeding action, reflected in the counter.
  if(s.state!=='feed'&&s.feedings===lastFeedings)
   assert.ok(s.hunger>=lastHunger-1e-8,
    'hunger fell before a successful food action');
  if(s.state==='feed'){
   feedingFrames++;
   assert.equal(s.aerialFeeding,true);
   assert.equal(s.foodTarget?.kind,'nectar');
   assert.ok(s.feedingProgress>=0&&s.feedingProgress<=1);
   assert.equal(s.feedings,lastFeedings,'feeding counted before it finished');
   if(s.feedingProgress<.14){
    assert.ok(Math.abs(s.y-s.foodTarget.contactY)<5,
      'feeding starts before reaching flower height');
    visualContact=true;
   }
  }
  if(s.feedings>lastFeedings){
   assert.ok(feedingFrames>0,'feeding counter advanced without feeding sequence');
   finished=true;break;
  }
  lastHunger=s.hunger;lastFeedings=s.feedings;
 }
 assert.ok(visualContact,'no visual flower approach happened');
 assert.ok(finished,'no completed feeding event after 23 simulated minutes');
});

test('feeding has an articulated pecking head and folded ground wings',()=>{
 const rig=createBirdRig(THREE,bird('kestrel'));
 assert.ok(rig.userData.head?.children.length>4,'eyes and beak need a shared head joint');
 const angles=[];
 for(let i=0;i<110;i++){
  animateBirdRig(rig,i/25,{state:'feed',food:'small-prey',grounded:true,
    sleeping:true,energy:.6,bank:0},1/25);
  if(i>20)angles.push(rig.userData.head.rotation.x);
 }
 assert.ok(Math.max(...angles)-Math.min(...angles)>.19,'head does not visibly peck');
 assert.ok(rig.userData.fold>.93,'wings do not fold when feeding on the ground');
});

test('the exact food target is rendered during the action and hidden on departure',()=>{
 const scene=new THREE.Scene();
 const food=createBirdForageVisuals(THREE,scene,1988);
 assert.equal(scene.children.includes(food.root),true);
 const x=100,z=120,y=terrainHeight(x,z,1988);
 const base={x:x+4,z:z+3,y:y+8,wingspan:.8,foodTarget:{
  x,y,z,kind:'nectar',biome:'forest',contactY:y+2.2}};
 const searching=food.update({...base,state:'seek_food'},0);
 assert.equal(searching.visible,false,'food cue must not be visible during a distant search');
 const approach=food.update({...base,state:'approach'},1);
 assert.equal(approach.visible,true);
 assert.equal(approach.kind,'nectar');
 assert.ok(Math.abs(food.root.position.x-x)<.00001);
 assert.ok(food.root.visible);
 const consumed=food.update({...base,state:'feed',feedingProgress:.95},2);
 assert.equal(consumed.visible,false,'already consumed resource should disappear');
 const departing=food.update({...base,state:'takeoff'},3);
 assert.equal(departing.visible,false);
 food.dispose();
 assert.equal(scene.children.includes(food.root),false);
});
