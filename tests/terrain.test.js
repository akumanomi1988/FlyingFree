import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainHeight,readOptions,setWorldSeed} from '../src/core.js';
import {createTerrainSampler} from '../src/terrain.js';

test('the same seed always generates the same heightfield and another seed changes it',()=>{
 const a=createTerrainSampler(1988),b=createTerrainSampler(1988),c=createTerrainSampler(1999);
 const samples=[[0,0],[300,400],[-540,-390],[980,280],[-800,740]];
 assert.deepEqual(samples.map(([x,z])=>a(x,z)),samples.map(([x,z])=>b(x,z)));
 assert.ok(samples.some(([x,z])=>Math.abs(a(x,z)-c(x,z))>1));
});
test('island has inland mountains, beaches and a submerged exterior',()=>{
 const f=createTerrainSampler(2026);
 assert.ok(f(0,0)>0);
 assert.ok(f(3500,3500)<-8);
 const elevations=[];
 for(let x=-1100;x<=1100;x+=220)for(let z=-1100;z<=1100;z+=220)elevations.push(f(x,z));
 assert.ok(Math.max(...elevations)-Math.min(...elevations)>170,'island needs visible relief');
 assert.ok(elevations.every(Number.isFinite));
});
test('shared global terrain sampler keeps the renderer and ecology seed consistent',()=>{
 try{
  setWorldSeed(2026);
  const a=terrainHeight(390,480),b=terrainHeight(390,480,2026),c=terrainHeight(390,480,1988);
  assert.equal(a,b);assert.notEqual(a,c);
 }finally{setWorldSeed(1988);}
});
test('seed URL parameter validates int32, allowing replayable worlds',()=>{
 assert.equal(readOptions('?seed=12345').seed,12345);
 assert.equal(readOptions('?seed=-12').seed,-12);
 assert.equal(readOptions('?seed=invalid').seed,null);
 assert.equal(readOptions('?seed=2147483648').seed,null);
 assert.equal(readOptions('').seed,null);
});
