import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameLoop} from '../src/runtime/frameLoop.js';
import {createEventScope} from '../src/runtime/eventScope.js';
import {createBrowserEnvironment} from '../src/runtime/browserEnvironment.js';

function scheduler(){
  let next=1;const pending=new Map();
  return {
    pending,request:fn=>{const id=next++;pending.set(id,fn);return id;},
    cancel:id=>pending.delete(id),
    advance(time){const callbacks=[...pending.values()];pending.clear();for(const callback of callbacks)callback(time);}
  };
}
test('VE-01: a single frame-loop owner with idempotent start',()=>{
  const raf=scheduler(),ticks=[];
  const loop=createFrameLoop({...raf,frame:now=>ticks.push(now)});
  assert.equal(loop.start(),true);assert.equal(loop.start(),false);
  assert.equal(raf.pending.size,1);
  raf.advance(100);raf.advance(116);
  assert.deepEqual(ticks,[100,116]);
  assert.equal(loop.snapshot().starts,1);
  assert.equal(loop.snapshot().frames,2);
  loop.dispose();
  assert.equal(raf.pending.size,0);assert.equal(loop.snapshot().running,false);
  assert.equal(loop.snapshot().disposed,true);
  assert.throws(()=>loop.start(),/disposed/);
});
test('VE-01: stop cancels pending callback and restart resumes once',()=>{
  const raf=scheduler();let count=0;
  const loop=createFrameLoop({...raf,frame:()=>count++});
  loop.start();const previous=[...raf.pending.values()][0];
  assert.equal(loop.stop(),true);assert.equal(loop.stop(),false);
  previous(1);assert.equal(count,0);
  loop.start();raf.advance(2);assert.equal(count,1);
  assert.equal(loop.snapshot().starts,2);
  loop.dispose();loop.dispose();
});
test('VE-01: frame exception halts scheduling and reports once',()=>{
  const raf=scheduler(),errors=[];
  const loop=createFrameLoop({...raf,frame:()=>{throw Error('boom')},onError:e=>errors.push(e.message)});
  loop.start();raf.advance(1);
  assert.deepEqual(errors,['boom']);
  assert.equal(raf.pending.size,0);
  assert.equal(loop.snapshot().running,false);
});
test('VE-01: listener registry releases all browser bindings',()=>{
  const target=new EventTarget(),scope=createEventScope();let events=0;
  scope.on(target,'click',()=>events++);
  scope.on(target,'click',()=>events++);
  target.dispatchEvent(new Event('click'));assert.equal(events,2);
  assert.equal(scope.size,2);
  scope.dispose();scope.dispose();
  target.dispatchEvent(new Event('click'));assert.equal(events,2);
  assert.equal(scope.size,0);assert.equal(scope.disposed,true);
  assert.throws(()=>scope.on(target,'click',()=>{}),/disposed/);
});
test('VE-01: injected browser clock, viewport and frame scheduler',()=>{
  let tick=20,epoch=1988000;
  const host={
    innerWidth:390,innerHeight:844,document:{},location:{search:'?seed=1988'},
    navigator:{},performance:{now:()=>tick},
    requestAnimationFrame:fn=>{tick+=16;return fn},
    cancelAnimationFrame:()=>{},
    setTimeout:(fn)=>fn,clearTimeout:()=>{}
  };
  const env=createBrowserEnvironment(host);
  assert.equal(env.width(),390);assert.equal(env.height(),844);
  assert.equal(env.now(),20);assert.equal(typeof env.raf(()=>{}),'function');
  assert.equal(env.now(),36);
  host.innerWidth=1440;assert.equal(env.width(),1440);
  assert.ok(Number.isFinite(env.epoch()));
});
