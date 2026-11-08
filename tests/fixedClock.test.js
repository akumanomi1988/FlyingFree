import test from 'node:test';
import * as THREE from 'three';
import {createEcosystem} from '../src/ecosystem.js';
import assert from 'node:assert/strict';
import {createFixedStepClock,FIXED_SIMULATION_DT} from '../src/runtime/fixedClock.js';
import {captureSimulationSnapshot} from '../src/runtime/simulationSnapshot.js';
import {createBirdBrain} from '../src/behaviour.js';
import {BIRDS} from '../src/core.js';

function replay(fps){
  const clock=createFixedStepClock(),bird=createBirdBrain(BIRDS.find(b=>b.id==='kestrel'),1988);
  const states=new Map();
  clock.resync(0);
  for(let frame=1;frame<=fps*12;frame++){
    clock.advance(frame*1000/fps,(dt,tick,time)=>{
      const action=bird.update(time,dt,.72,.12);
      if(tick%30===0)states.set(tick,captureSimulationSnapshot({
        seed:1988,clock:{ticks:tick,seconds:time},birdId:'kestrel',bird:action,
        weather:{id:'clear',cloud:.1,rain:.12,fog:0}
      }));
    });
  }
  return {clock:clock.snapshot(),states:[...states.values()]};
}
test('VE-02: identical seeded ecological trajectories at 15/30/60/120 render FPS',()=>{
  const baseline=replay(30);
  assert.equal(baseline.clock.ticks,360);
  for(const fps of [15,60,120]){
    const result=replay(fps);
    assert.equal(result.clock.ticks,360,'Unexpected tick count at '+fps+' FPS');
    assert.deepEqual(result.states,baseline.states,'Divergent flight at '+fps+' FPS');
  }
});
test('VE-02: pause/resume discards hidden wall time without double decisions',()=>{
  const clock=createFixedStepClock({maxSubsteps:4,maxFrameDt:.1});
  let decisions=0;
  clock.resync(0);clock.advance(100,()=>decisions++);
  assert.equal(decisions,3);
  clock.setPaused(true,100);clock.advance(610100,()=>decisions++);
  assert.equal(decisions,3);assert.equal(clock.snapshot().paused,true);
  clock.setPaused(false,610100);clock.advance(610133.333333333,()=>decisions++);
  assert.equal(decisions,4);assert.equal(clock.snapshot().ticks,4);
  assert.ok(clock.snapshot().droppedSeconds<.000001);
});
test('VE-02: large render stalls bounded by substeps and no catch-up burst',()=>{
  const clock=createFixedStepClock({maxSubsteps:4,maxFrameDt:.12});
  let steps=0;clock.resync(0);
  clock.advance(8000,()=>steps++);
  assert.equal(steps,3);assert.ok(clock.snapshot().droppedSeconds>7.8);
  clock.advance(8016.666,()=>steps++);
  assert.ok(steps<=4);assert.ok(clock.snapshot().accumulator<FIXED_SIMULATION_DT);
});
test('VE-02: portable snapshots reject non-finite values and contain no scene objects',()=>{
  const input={seed:1988,clock:{ticks:3,seconds:.1},birdId:'owl',
    bird:{x:1.123456789,y:22,z:3,heading:.32,velocity:4,energy:.5,hunger:.4,state:'patrol'},
    weather:{id:'clear',cloud:0,rain:0,fog:0},
    animals:[{species:'deer',state:'foraging',x:3,y:1,z:5,heading:.1,velocity:0}]};
  const result=captureSimulationSnapshot(input);
  assert.equal(result.schema,1);assert.equal(result.bird.x,1.123457);
  assert.equal(result.fauna[0].species,'deer');
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  assert.throws(()=>captureSimulationSnapshot({...input,bird:{...input.bird,x:NaN}}),/Non-finite/);
});

test('VE-02: wildlife assignments are invariant to render-camera placement',()=>{
  const hero={x:650,y:180,z:510};
  const one=createEcosystem(THREE,new THREE.Scene(),1988,.25,{x:220,y:150,z:180});
  const two=createEcosystem(THREE,new THREE.Scene(),1988,.25,{x:220,y:150,z:180});
  one.update(3,.8,.1,hero,0,{x:-1400,y:300,z:-1100},hero);
  two.update(3,.8,.1,hero,0,{x:1400,y:500,z:900},hero);
  const snap=world=>world.actors.map(actor=>({
    type:actor.userData.state.type,
    x:actor.position.x,y:actor.position.y,z:actor.position.z,
    phase:actor.userData.state.phase,behaviour:actor.userData.behaviour
  }));
  assert.deepEqual(snap(one),snap(two));
});
