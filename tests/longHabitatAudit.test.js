import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createHabitatMonitor} from '../src/habitatMonitor.js';

// CI must test outcomes observed along the actual trajectories. This is a
// simulated 15-minute unattended flight per species and seed, not a real-time
// GPU benchmark. Sample counts/ratios are not derived from preference tables.
test('two tropical islands support ecological 15-minute flights for all 12 species',()=>{
 const minutes=15,seconds=minutes*60,dt=.1;
 const coastal=new Set(['albatross','gull']),freshwater=new Set(['kingfisher','heron']);
 for(const seed of [1988,20261106]){
   for(const bird of BIRDS){
     const brain=createBirdBrain(bird,seed),monitor=createHabitatMonitor(seed,4);
     const day=bird.id==='owl'?.25:.9;
     let feedEvents=0;
     for(let i=0;i<seconds/dt;i++){
       const t=i*dt,state=brain.update(t,dt,day,0);
       assert.ok([state.x,state.y,state.z,state.energy,state.hunger].every(Number.isFinite),
         'invalid trajectory '+bird.id+' seed '+seed);
       if(state.state==='feed'&&state.landings===0&&state.food==='fish')
         assert.equal(state.grounded,false,'fishers cannot ground themselves at sea');
       monitor.observe(t,bird.id,state.x,state.z,state.state);
       feedEvents=Math.max(feedEvents,state.feedings);
     }
     const report=monitor.snapshot();
     assert.ok(report.samples>=minutes*13,'insufficient habitat observations '+bird.id);
     assert.ok(report.flightSamples>0,'no actual flight '+bird.id);
     assert.ok(report.oceanFlightPct!==null);
     if(!coastal.has(bird.id)&&bird.id!=='osprey')
       assert.ok(report.oceanFlightPct<32,
         bird.id+' flew too often over open sea ('+report.oceanFlightPct+'%, seed '+seed+')');
     if(coastal.has(bird.id))
       assert.ok(report.oceanFlightPct>20,
         'marine bird stopped visiting open ocean '+bird.id+', seed '+seed);
     if(freshwater.has(bird.id))
       assert.ok(feedEvents>=1,'freshwater bird never managed to fish '+bird.id+', seed '+seed);
   }
 }
});
