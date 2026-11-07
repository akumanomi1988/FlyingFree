import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';

const species=id=>BIRDS.find(b=>b.id===id);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('species selection preserves world position, heading, velocity and physiological drives',()=>{
  const first=createBirdBrain(species('eagle'),1988);
  first.update(0,0,1,0);
  const old=first.update(12,.016,1,0);
  const saved=first.snapshot;
  const second=createBirdBrain(species('gull'),1988,saved);
  const next=second.update(12,0,1,0);
  assert.ok(distance(old,next)<1e-6,'new species must not teleport at a zero time step');
  assert.ok(Math.abs(saved.heading-next.heading)<1e-8,'heading must remain continuous');
  assert.equal(saved.velocity,next.velocity);
  assert.equal(saved.energy,next.energy);
  assert.equal(saved.hunger,next.hunger);
  const future=second.update(12.016,.016,1,0);
  assert.ok(distance(next,future)<2,'first forward frame must remain physically bounded');
  assert.equal(second.snapshot.x,future.x);
});

test('switching among all bird species keeps continuous in-air movement',()=>{
  let brain=createBirdBrain(species('eagle'));
  brain.update(0,0,1,0);
  let previous=brain.update(3,.016,1,0);
  for(const target of BIRDS){
    const nextBrain=createBirdBrain(target,1988,brain.snapshot);
    const next=nextBrain.update(3,0,1,0);
    assert.ok(distance(previous,next)<1e-5,target.id+' teleport');
    previous=nextBrain.update(3.016,.016,1,0);
    assert.ok(distance(next,previous)<2,target.id+' unrealistic velocity jump');
    brain=nextBrain;
  }
});

test('invalid incoming state falls back to deterministic finite values',()=>{
  const p=species('owl');
  const brain=createBirdBrain(p,1988,{x:NaN,y:Infinity,z:-Infinity,heading:NaN,velocity:9999,energy:-5,hunger:2});
  const action=brain.update(0,0,1,0);
  assert.ok([action.x,action.y,action.z,action.heading,action.velocity].every(Number.isFinite));
  assert.ok(action.velocity<=110);
  assert.equal(action.hunger,1);
  assert.equal(action.energy,0);
});

test('canopy-feeding birds spawn at viable forest flight height instead of raptor altitude',async()=>{
 const {terrainHeight}=await import('../src/core.js');
 const {habitatAt}=await import('../src/ecology.js');
 const {flightAltitude}=await import('../src/birdEcology.js');
 for(const id of ['hummingbird','kingfisher']){
  const bird=species(id),brain=createBirdBrain(bird,1988);
  const point=brain.update(0,0,1,0);
  const ground=terrainHeight(point.x,point.z,1988);
  const ideal=flightAltitude(bird,habitatAt(point.x,point.z,1988),ground);
  assert.ok(point.y>=ideal,'starts below habitat clearance: '+id);
  assert.ok(point.y-ground<75,'canopy bird starts above the canopy: '+id);
 }
});
