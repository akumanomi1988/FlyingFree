import test from 'node:test';
import assert from 'node:assert/strict';
import {starOpacityAt} from '../src/atmospherics.js';

test('clear night reveals stars and daylight hides them',()=>{
 assert.ok(starOpacityAt(-.36,0,0)>.95);
 assert.equal(starOpacityAt(.1,0,0),0);
});

test('clouds and rain block stars consistently',()=>{
 assert.equal(starOpacityAt(-.4,.95,.7),0);
 assert.equal(starOpacityAt(-.4,1,1),0);
 assert.equal(starOpacityAt(-.4,0,1),0);
 assert.ok(starOpacityAt(-.4,.7,.6)<starOpacityAt(-.4,.45,.1));
});

test('star opacity remains finite and decreases with cloud cover',()=>{
 for(const altitude of [-1,-.1,0,.8,NaN]){
  let previous=1;
  for(const cloud of [0,.1,.25,.4,.55,.7,.9,1,2]){
   const value=starOpacityAt(altitude,cloud,0);
   assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
   assert.ok(value<=previous+1e-9);
   previous=value;
  }
 }
});
