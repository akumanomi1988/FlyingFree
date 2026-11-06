import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCoastHeightData,decodeCoastHeight,encodeCoastHeight,
  sampleCoastData,coastWaterFactors,COAST_HEIGHT_MIN,COAST_HEIGHT_MAX} from '../src/coastalBathymetry.js';
import {TROPICAL_WORLD,tropicalTerrainHeight} from '../src/tropicalTerrain.js';
import {createOcean} from '../src/renderfx.js';

test('coast bathymetry is bounded, deterministic, seed-sensitive and matches the actual terrain',()=>{
  assert.ok(Math.abs(decodeCoastHeight(encodeCoastHeight(0)))<.5);
  const s=160,seed=1988;
  const a=createCoastHeightData(seed,s),b=createCoastHeightData(seed,s);
  assert.deepEqual(a.data,b.data,'same seed must reproduce identical coast');
  assert.equal(a.extent,TROPICAL_WORLD.extent);
  assert.equal(a.data.length,s*s*4);
  assert.equal(COAST_HEIGHT_MIN,-96);assert.equal(COAST_HEIGHT_MAX,96);
  assert.throws(()=>createCoastHeightData(seed,3),RangeError);
  const sea=sampleCoastData(a,5900,5900);
  assert.ok(sea< -15,'outer ocean should remain deep');
  const summit=sampleCoastData(a,0,0);
  assert.ok(summit>88,'highlands are saturated outside coastal precision range');
  for(const [ix,iz] of [[3,5],[20,90],[80,130],[113,88],[158,79],[143,104]]){
    const x=(ix+.5)/s*a.extent-a.extent/2,z=(iz+.5)/s*a.extent-a.extent/2;
    const expected=tropicalTerrainHeight(x,z,seed);
    const actual=sampleCoastData(a,x,z);
    assert.ok(Math.abs(actual-Math.max(-96,Math.min(96,expected)))<.9,
      'texture must match ground height at exact pixel '+ix+','+iz);
  }
  const c=createCoastHeightData(741291,s);
  assert.notDeepEqual(a.data,c.data,'coastline must change with seed');
});

test('tropical water transitions are anchored in real depth, not a radial coast outline',()=>{
  const foam=coastWaterFactors(-9),deep=coastWaterFactors(-100);
  const lagoon=coastWaterFactors(-20),land=coastWaterFactors(30);
  assert.ok(foam.foam>.6,'shoreline foam missing');
  assert.equal(deep.foam,0);
  assert.equal(deep.shallow,0);
  assert.ok(lagoon.shallow>.5);
  assert.ok(lagoon.reef>.5);
  assert.equal(deep.reef,0);
  assert.equal(land.reef,0);
  assert.ok(land.shallow>=0,'shore color is controlled by terrain occlusion');
});

test('ocean shader exposes texture sourced from the same seed and disposes GPU resources',()=>{
  const scene=new THREE.Scene();
  const ocean=createOcean(THREE,scene,20261106);
  assert.equal(ocean.bathymetry.seed,20261106);
  assert.ok(ocean.bathymetry.resolution>=256);
  assert.equal(ocean.uniforms.coastExtent.value,TROPICAL_WORLD.extent);
  assert.equal(ocean.uniforms.coastSeaLevel.value,TROPICAL_WORLD.seaLevel);
  assert.ok(ocean.uniforms.coastHeightmap.value.isDataTexture);
  assert.equal(scene.children.includes(ocean.mesh),true);
  assert.equal(ocean.mesh.material.fragmentShader.includes('coastHeightmap'),true);
  ocean.dispose();
  assert.equal(scene.children.includes(ocean.mesh),false);
});
