import test from 'node:test';
import assert from 'node:assert/strict';
import {starOpacityAt} from '../src/atmospherics.js';

test('stars are visible under a clear night and disappear in daylight',()=>{
 assert.ok(starOpacityAt(-.36,0,0)>.95);
 assert.equal(starOpacityAt(.1,0,0),0);
 assert.ok(starOpacityAt(-.12,0,0)>0&&starOpacityAt(-.12,0,0)<.97);
});

test('overcast and rainy skies hide stars even at midnight',()=>{
 assert.equal(starOpacityAt(-.4,.95,.7),0,'overcast rain must occlude stars');
 assert.equal(starOpacityAt(-.4,1,1),0,'storm must fully occlude stars');
 assert.equal(starOpacityAt(-.4,0,1),0,'heavy rain blocks the clear-sky layer');
 const partly=starOpacityAt(-.4,.45,.1);
 assert.ok(partly>0&&partly<starOpacityAt(-.4,.1,0));
 assert.ok(starOpacityAt(-.4,.7,.6)<partly,'more cloud and rain cannot brighten stars');
});

test('star opacity is clamped, finite and monotonic with cloud coverage',()=>{
 for(const alt of [-1,-.1,0,.8,NaN]){
  let last=1;
  for(const cloud of [0,.1,.25,.4,.55,.7,.9,1,2]){
   const value=starOpacityAt(alt,cloud,0);
   assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
   assert.ok(value<=last+1e-9,'clouds should not reveal more stars');
   last=value;
  }
 }
 assert.equal(starOpacityAt(-.4,Number.NaN,Number.NaN),starOpacityAt(-.4,0,0));
});
