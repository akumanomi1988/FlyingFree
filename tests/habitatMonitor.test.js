import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createHabitatMonitor} from '../src/habitatMonitor.js';

test('habitat monitor samples real bird positions and resets on species changes',()=>{
  const monitor=createHabitatMonitor(1988,4);
  const sea=monitor.observe(0,'eagle',5600,5600,'patrol');
  assert.equal(sea.samples,1);
  assert.equal(sea.oceanFlightPct,100);
  assert.equal(monitor.observe(1,'eagle',5600,5600,'patrol'),null,'sample interval respected');
  const land=monitor.observe(4,'eagle',0,0,'patrol');
  assert.equal(land.samples,2);
  assert.equal(land.oceanPct,50);
  assert.ok(land.transitions>=1);
  const rest=monitor.observe(8,'eagle',5600,5600,'rest');
  assert.equal(rest.samples,3);
  assert.equal(rest.flightSamples,2,'grounded/resting does not distort flight ratio');
  assert.equal(rest.oceanFlightPct,50);
  const changed=monitor.observe(9,'gull',5600,5600,'patrol');
  assert.equal(changed.samples,1);
  assert.equal(changed.species,'gull');
  assert.equal(changed.oceanPct,100);
  assert.equal(monitor.snapshot().counts.ocean,1);
});

test('habitat monitoring never changes the bird brain or random trajectories',()=>{
  const profile=BIRDS.find(b=>b.id==='kestrel'),seed=1988;
  const a=createBirdBrain(profile,seed),b=createBirdBrain(profile,seed),monitor=createHabitatMonitor(seed,4);
  for(let i=0;i<600;i++){
    const t=i*.1,first=a.update(t,.1,1,0);
    monitor.observe(t,profile.id,first.x,first.z,first.state);
    const second=b.update(t,.1,1,0);
    assert.deepEqual(first,second,'diagnostics must not steer or perturb the simulation');
  }
  assert.ok(monitor.snapshot().samples>=10);
});

test('short deterministic flight replay exposes ocean allocation for key species',()=>{
  for(const id of ['eagle','owl','hummingbird','kingfisher','albatross','gull']){
    const profile=BIRDS.find(b=>b.id===id),brain=createBirdBrain(profile,1988);
    const monitor=createHabitatMonitor(1988,4);
    for(let frame=0;frame<1800;frame++){
      const t=frame*.1,day=id==='owl'?.25:1;
      const a=brain.update(t,.1,day,0);
      monitor.observe(t,id,a.x,a.z,a.state);
    }
    const report=monitor.snapshot();
    assert.ok(report.samples>30,id+' is missing flight samples');
    assert.ok(report.oceanFlightPct!==null,id+' has no active flight observations');
    if(['eagle','owl','hummingbird','kingfisher'].includes(id))
      assert.ok(report.oceanFlightPct<25,
        id+' spends too long over open sea ('+report.oceanFlightPct+'%)');
  }
});
