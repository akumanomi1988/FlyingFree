import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainHeight} from '../src/core.js';
import {createEcosystem} from '../src/ecosystem.js';
import {solveGroundedLeg,quadrupedGait,shouldReplantFoot} from '../src/groundedLimb.js';

const nearly=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} vs ${b}`);

test('two bone leg inverse kinematics preserves both bone lengths',()=>{
  for(const bend of [-1,1])for(const [footY,footZ] of [[0,0],[.15,-.16],[-.05,.13]]) {
    const hipY=1.02,hipZ=.4,upper=.59,lower=.55;
    const result=solveGroundedLeg(hipY,hipZ,footY,footZ,upper,lower,bend);
    const first=Math.hypot(result.kneeY-hipY,result.kneeZ-hipZ);
    const second=Math.hypot(result.ankleY-result.kneeY,result.ankleZ-result.kneeZ);
    nearly(first,upper);nearly(second,lower);
    assert.ok(Number.isFinite(result.kneeY)&&Number.isFinite(result.kneeZ));
    assert.equal(result.clamped,false);
  }
});

test('IK clamps unreachable contact targets without NaNs or broken bones',()=>{
  const far=solveGroundedLeg(1,0,-10,0,.5,.6,-1);
  assert.equal(far.clamped,true);
  nearly(Math.hypot(far.ankleY-1,far.ankleZ),1.09999,1e-4);
  const near=solveGroundedLeg(0,0,0,0,.5,.6,1);
  assert.equal(near.clamped,true);
  assert.ok(Number.isFinite(near.kneeY)&&Number.isFinite(near.kneeZ));
  assert.throws(()=>solveGroundedLeg(1,0,0,0,0,.7),RangeError);
  assert.throws(()=>solveGroundedLeg(1,0,NaN,0,.5,.5),RangeError);
});

test('gait phases are deterministic and hooves replant only if required',()=>{
  const a=quadrupedGait(12.4,7,.45);
  const b=quadrupedGait(12.4,7,.45);
  assert.deepEqual(a,b);
  assert.ok(a.lift>=0&&a.lift<=1);
  assert.equal(shouldReplantFoot(true,.05,.2),false);
  assert.equal(shouldReplantFoot(false,.05,.2),true);
  assert.equal(shouldReplantFoot(true,.25,.2),true);
});

test('deer and foxes have articulated knee and hoof meshes without GPU allocations per frame',()=>{
  const scene=new THREE.Scene(),eco=createEcosystem(THREE,scene,1988,.8);
  const animals=eco.actors.filter(a=>['deer','fox'].includes(a.userData.state.type));
  const geometryRefs=animals.map(actor=>actor.userData.limbs.map(l=>[l.upper.geometry,l.lower.geometry,l.hoof.geometry]));
  for(const actor of animals){
    assert.equal(actor.userData.limbs.length,4);
    assert.equal(actor.userData.legs.length,4);
    assert.ok(actor.userData.limbs.every(l=>l.upper.parent&&l.lower.parent&&l.hoof.parent));
  }
  const observer=animals[0].position.clone().add(new THREE.Vector3(0,5,0));
  eco.update(0,.9,0,null,0,observer);
  const deer=animals[0];
  assert.equal(deer.userData.motionDetailed,true);
  assert.ok(deer.userData.groundedFeet>=2);
  deer.updateMatrixWorld(true);
  for(const chain of deer.userData.limbs.filter(l=>l.planted)){
    const world=chain.hoof.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(world.y-terrainHeight(world.x,world.z,1988))<.09,
      'planted hoof must touch terrain, error '+(world.y-terrainHeight(world.x,world.z,1988)));
    assert.ok(chain.footError<.18,'IK chain must nearly reach terrain contact');
  }
  eco.update(.1,.9,0,null,0,observer);
  animals.forEach((actor,i)=>actor.userData.limbs.forEach((leg,j)=>{
    assert.equal(leg.upper.geometry,geometryRefs[i][j][0]);
    assert.equal(leg.lower.geometry,geometryRefs[i][j][1]);
    assert.equal(leg.hoof.geometry,geometryRefs[i][j][2]);
  }));
});

test('planted hooves retain their world coordinates during a walking stance',()=>{
  const world=createEcosystem(THREE,new THREE.Scene(),1988,.8);
  const deer=world.actors.find(a=>a.userData.state.type==='deer');
  const state=deer.userData.state;
  const base=((state.seed/state.cycle)%1+1)%1;
  const t=((.8-base+1)%1)*state.cycle;
  const observer=deer.position.clone().add(new THREE.Vector3(0,4,0));
  world.update(t,1,0,null,0,observer);
  const previous=deer.userData.limbs.map(chain=>({
    planted:chain.planted,worldFoot:chain.worldFoot.clone()
  }));
  world.update(t+.016,1,0,null,0,observer);
  let stable=0;
  for(let i=0;i<previous.length;i++){
    const contact=deer.userData.limbs[i];
    if(previous[i].planted&&contact.planted){
      assert.ok(previous[i].worldFoot.distanceTo(contact.worldFoot)<1e-6,
        'hoof slides through the terrain during stance');
      stable++;
    }
  }
  assert.ok(stable>0,'walking gait must have supporting hooves');
});

test('non-default terrain seed does not snap fauna vertically on first update',()=>{
  const scene=new THREE.Scene(),seed=417;
  const eco=createEcosystem(THREE,scene,seed,.6);
  const before=eco.actors.map(g=>g.position.clone());
  eco.update(0,.9,0,null,0,null);
  for(let i=0;i<before.length;i++){
    const actual=eco.actors[i].position;
    nearly(actual.y,before[i].y,.0001);
  }
});
