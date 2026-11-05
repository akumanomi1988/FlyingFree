import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameTelemetry} from '../src/frameTelemetry.js';

test('percentiles and budget share are calculated from valid frames',()=>{
  const t=createFrameTelemetry(5);
  [10,12,16,20,30].forEach(x=>t.record(x));
  assert.deepEqual(t.snapshot(),{samples:5,p50:16,p95:30,p99:30,mean:17.6,overBudgetPct:40,discarded:0});
});
test('ring buffer retains the latest frames',()=>{
  const t=createFrameTelemetry(3);
  [10,20,30,40].forEach(x=>t.record(x));
  assert.equal(t.snapshot().p50,30);
  assert.equal(t.snapshot().samples,3);
});
test('invalid and resumed-tab frames do not poison metrics',()=>{
  const t=createFrameTelemetry();
  for(const v of [0,-1,NaN,Infinity,500])assert.equal(t.record(v),false);
  assert.equal(t.snapshot().discarded,1);
  assert.equal(t.snapshot().p95,null);
  t.record(15);t.reset();
  assert.equal(t.snapshot().samples,0);
});
test('rejects invalid capacity',()=>assert.throws(()=>createFrameTelemetry(1),RangeError));
