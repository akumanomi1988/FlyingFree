import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaptiveResolution} from '../src/adaptiveResolution.js';

function forSeconds(controller,n,observation) {
  let result;
  for(let i=0;i<n;i++)result=controller.observe({...observation,seconds:1});
  return result;
}

test('temporary frame-rate drops do not permanently degrade render resolution',()=>{
  const quality=createAdaptiveResolution({maxScale:1.4,minScale:.48});
  let result=forSeconds(quality,7,{fps:14,p95Ms:65});
  assert.equal(result.changed,false);
  assert.equal(result.scale,1.4);
  result=quality.observe({fps:14,p95Ms:65,seconds:1});
  assert.equal(result.reason,'degrade');
  assert.equal(result.scale,1.204);
  result=forSeconds(quality,28,{fps:60,p95Ms:17});
  assert.equal(result.reason,'recover');
  assert.ok(result.scale>1.204);
  assert.ok(result.scale<=1.4);
  result=forSeconds(quality,300,{fps:60,p95Ms:17});
  assert.ok(result.restorations>0);
  assert.equal(result.scale,1.4);
});

test('hysteresis blocks oscillations around the FPS thresholds',()=>{
  const quality=createAdaptiveResolution({maxScale:1});
  for(let i=0;i<120;i++){
    quality.observe({fps:i%2?50:20,p95Ms:i%2?18:55});
  }
  assert.equal(quality.snapshot().scale,1);
  assert.equal(quality.snapshot().reductions,0);
});

test('high FPS with pathological P95 does not prematurely restore quality',()=>{
  const quality=createAdaptiveResolution({maxScale:1,minScale:.5,downHold:2,upHold:3,cooldownSeconds:0});
  forSeconds(quality,2,{fps:12,p95Ms:75});
  assert.ok(quality.snapshot().scale<1);
  const reduced=quality.snapshot().scale;
  forSeconds(quality,20,{fps:60,p95Ms:90});
  assert.equal(quality.snapshot().scale,reduced);
  forSeconds(quality,3,{fps:60,p95Ms:16});
  assert.ok(quality.snapshot().scale>reduced);
});

test('hidden-tab pauses reset confidence without changing current scale',()=>{
  const quality=createAdaptiveResolution({maxScale:1,minScale:.48,downHold:3});
  forSeconds(quality,2,{fps:4,p95Ms:90});
  quality.observe({fps:0,hidden:true,seconds:1});
  assert.equal(quality.snapshot().lowFpsSeconds,0);
  forSeconds(quality,2,{fps:4,p95Ms:90});
  assert.equal(quality.snapshot().scale,1);
});

test('never exceed per-device pixel ratio or dip below configured floor',()=>{
  const quality=createAdaptiveResolution({maxScale:.72,minScale:.48,downHold:1,cooldownSeconds:0});
  forSeconds(quality,50,{fps:10,p95Ms:120});
  assert.equal(quality.snapshot().scale,.48);
  forSeconds(quality,500,{fps:120,p95Ms:9});
  assert.equal(quality.snapshot().scale,.72);
  assert.throws(()=>createAdaptiveResolution({maxScale:0}),RangeError);
  assert.throws(()=>createAdaptiveResolution({maxScale:1,minScale:2}),RangeError);
});
