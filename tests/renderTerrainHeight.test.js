import test from 'node:test';
import assert from 'node:assert/strict';
import {tropicalRenderHeight,tropicalTerrainHeight,TROPICAL_WORLD} from '../src/tropicalTerrain.js';

test('the physics safety surface matches both diagonals of the 250x250 rendered mesh',()=>{
 const step=TROPICAL_WORLD.extent/250,half=TROPICAL_WORLD.halfExtent;
 for(const seed of [1988,43,90210])for(const [ix,iz] of [[40,80],[115,127],[180,90]]){
  const x=-half+ix*step,z=-half+iz*step;
  const a=tropicalTerrainHeight(x,z,seed),b=tropicalTerrainHeight(x,z+step,seed);
  const c=tropicalTerrainHeight(x+step,z+step,seed),d=tropicalTerrainHeight(x+step,z,seed);
  assert.ok(Math.abs(tropicalRenderHeight(x,z,seed)-a)<1e-7);
  assert.ok(Math.abs(tropicalRenderHeight(x+step,z+step,seed)-c)<1e-7);
  for(const [u,v] of [[.16,.23],[.8,.1],[.75,.65],[.2,.93]]){
    const expected=u+v<=1?a+(d-a)*u+(b-a)*v:
      c+(b-c)*(1-u)+(d-c)*(1-v);
    const actual=tropicalRenderHeight(x+u*step,z+v*step,seed);
    assert.ok(Math.abs(actual-expected)<1e-6,JSON.stringify({seed,ix,iz,u,v,actual,expected}));
  }
 }
});

test('rendered-height safety samples remain bounded and deterministic outside island mesh',()=>{
 const seed=1988;
 for(const [x,z] of [[0,0],[800,1200],[-4500,3000],[6001,0]]){
  const a=tropicalRenderHeight(x,z,seed);
  assert.ok(Number.isFinite(a));
  assert.equal(a,tropicalRenderHeight(x,z,seed));
 }
});
