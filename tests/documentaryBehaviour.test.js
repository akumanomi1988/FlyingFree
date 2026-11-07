import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS,terrainHeight} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {birdSensation,flightAltitude} from '../src/birdEcology.js';
import {createGroundDetail} from '../src/vegetation.js';
import {treeDetailWeight,TREE_DETAIL_RADIUS,TREE_DETAIL_POOL} from '../src/treeDetail.js';

const profile=id=>BIRDS.find(b=>b.id===id);

test('urgent low energy interrupts travel and explicitly requests rest',()=>{
 for(const bird of BIRDS){
  const brain=createBirdBrain(bird,1988,{energy:.12,hunger:.94});
  const state=brain.update(0,.1,bird.id==='owl'?.25:.9,0);
  if(bird.id==='swift')assert.equal(state.state,'aerial_rest');
  else assert.equal(state.state,'return',bird.id+' is exhausted but did not return');
  assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.y));
 }
 assert.equal(birdSensation({energy:.12,hunger:.9,state:'patrol'}),'Agotada');
});

test('hummingbirds forage nectar while hovering and swifts/swallow feed in flight',()=>{
 for(const id of ['hummingbird','swift','swallow']){
  const bird=profile(id),brain=createBirdBrain(bird,1988);
  let observed=0;
  for(let frame=0;frame<12500;frame++){
    const action=brain.update(frame*.1,.1,.9,0);
    if(action.state!=='feed')continue;
    observed++;
    assert.equal(action.aerialFeeding,true,id+' must feed without standing on bare terrain');
    assert.equal(action.grounded,false,id+' cannot hover/feed and ground simultaneously');
    assert.equal(action.wingsFolded,false,id+' must keep flying while consuming food');
    assert.ok(action.speed>=0);
    if(id==='hummingbird'&&observed>8){
      const ground=terrainHeight(action.x,action.z,1988);
      assert.ok(action.y-ground<42,'hummingbird must descend toward plants, not hover above canopy');
    }
    if(observed>=15)break;
  }
  assert.ok(observed>=1,id+' never foraged in 20 simulated minutes');
 }
});

test('canopy fliers and high soarers have distinct altitude requirements',()=>{
 const forest={type:'forest'};
 const foot=100;
 const tiny=flightAltitude(profile('hummingbird'),forest,foot);
 const river=flightAltitude(profile('kingfisher'),forest,foot);
 const eagle=flightAltitude(profile('eagle'),forest,foot);
 assert.ok(tiny<foot+30);
 assert.ok(river<foot+32);
 assert.ok(eagle>foot+120);
});

test('stable tree canopies remain visible while medium distance detail fades gently',()=>{
 assert.ok(TREE_DETAIL_RADIUS>=650);
 assert.ok(TREE_DETAIL_POOL>=200);
 assert.equal(treeDetailWeight(300),1);
 assert.ok(treeDetailWeight(500)>treeDetailWeight(600));
 assert.ok(treeDetailWeight(600)>0);
 assert.equal(treeDetailWeight(720),0);
});

test('insects are unobtrusive and vanish well before far camera distances',()=>{
 const scene=new THREE.Scene(),detail=createGroundDetail(THREE,scene,1,null,1988);
 assert.ok(detail.insects.instanceMatrix.count<=40,
   'do not emit hundreds of unrelated point-shaped particles');
 assert.ok(detail.insects.material.opacity<=.35);
 const x=400,z=320,y=terrainHeight(x,z,1988);
 const camera={position:{x,y:y+120,z}},bird={x,y:y+95,z};
 detail.update(2,camera,bird,.9,0,23);
 assert.equal(detail.insectCount,0,'insects must not render high above vegetation');
});
