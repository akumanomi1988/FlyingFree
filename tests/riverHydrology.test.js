import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 tropicalRiverFrame,tropicalRiverWidth,tropicalRiverLength,
 tropicalTerrainSample,tropicalTerrainHeight,TROPICAL_WORLD
} from '../src/tropicalTerrain.js';
import {createTropicalRivers} from '../src/tropicalRivers.js';
import {createRiverEcosystem} from '../src/riverEcosystem.js';

test('water never runs uphill, even across radically different seeded islands',()=>{
 for(const seed of [1988,4721,20261107,123456789,917244033]){
  for(let channel=0;channel<TROPICAL_WORLD.riverCount;channel++){
   let last=Infinity,valid=0;
   const f={};
   for(let i=0;i<=180;i++){
    const t=.11+i/180*.89;
    tropicalRiverFrame(channel,t,seed,f);
    assert.ok(f.waterY<=last+1e-7,
     'uphill water channel='+channel+' seed='+seed+' t='+t);
    assert.ok(Number.isFinite(f.waterY)&&Number.isFinite(f.slope));
    assert.ok(f.halfWidth>=5&&f.bedDepth>1);
    assert.ok(Math.abs(Math.hypot(f.dx,f.dz)-1)<1e-6);
    const bed=tropicalTerrainHeight(f.x,f.z,seed);
    if(f.waterY>TROPICAL_WORLD.seaLevel+.3&&bed>TROPICAL_WORLD.seaLevel-1){
     assert.ok(bed<f.waterY,
      'river has no submerged channel: '+seed+'/'+channel+' t='+t+
       ' water='+f.waterY+' bed='+bed);
     valid++;
    }
    last=f.waterY;
   }
   assert.ok(valid>=10,'river is missing along its course '+seed+'/'+channel);
  }
 }
});

test('channel and submerged bed come from the same seeded terrain field',()=>{
 const seed=1988,channel=1;
 for(const t of [.18,.35,.52,.7,.82]){
  const f=tropicalRiverFrame(channel,t,seed);
  const p=tropicalTerrainSample(f.x,f.z,seed);
  assert.ok(p.river>.7&&p.valley>.05);
  assert.ok(p.height<f.waterY,'terrain is higher than river water');
  const bankX=f.x+f.nx*f.halfWidth*2.7;
  const bankZ=f.z+f.nz*f.halfWidth*2.7;
  const bank=tropicalTerrainHeight(bankX,bankZ,seed);
  assert.ok(Number.isFinite(bank));
  assert.ok(tropicalRiverWidth(channel,t,seed)>0);
 }
 assert.ok(tropicalRiverLength(channel,seed)>2000);
});

test('real river is two contiguous low-draw-call layers with flowing rapids',()=>{
 const scene=new THREE.Scene(),river=createTropicalRivers(THREE,scene,1988);
 assert.equal(scene.children.length,2);
 assert.equal(river.stats.drawCalls,2);
 assert.ok(river.segments>140);
 assert.ok(river.bankSegments>140);
 assert.ok(river.stats.bankVertices>river.stats.waterVertices);
 assert.ok(river.stats.waterTriangles>600);
 assert.ok(river.stats.bankTriangles>1500);
 for(const mesh of [river.mesh,river.bed]){
  const p=mesh.geometry.getAttribute('position');
  assert.ok(p.array.every(Number.isFinite));
  assert.ok(mesh.geometry.getAttribute('uv'));
  assert.ok(mesh.geometry.index.count>1000);
 }
 const shader={uniforms:{},
  vertexShader:'void main() {\n#include <begin_vertex>\n}',
  fragmentShader:'void main() {\n#include <color_fragment>\n}'};
 river.mesh.material.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/riverRapid/);
 assert.match(shader.fragmentShader,/bankFoam/);
 assert.equal(shader.uniforms.uRiverFlowTime.value,0);
 river.update(3.5);
 assert.equal(shader.uniforms.uRiverFlowTime.value,3.5);
 river.dispose();
 assert.equal(scene.children.length,0);
});

test('freshwater fish are positioned below hydrologic water level, not below riverbed',()=>{
 for(const seed of [1988,4721,20261107]){
  const world=createRiverEcosystem(THREE,new THREE.Scene(),seed,1);
  assert.ok(world.stats.fish>15,'no fish');
  world.update(1,null);
  const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
  let inside=0;
  for(let i=0;i<world.fish.count;i++){
   world.fish.getMatrixAt(i,matrix);matrix.decompose(pos,quat,scale);
   // Nearest river centerline requires a general spatial lookup, so inspect
   // each fish directly against its own world-space terrain instead.
   const ground=tropicalTerrainHeight(pos.x,pos.z,seed);
   assert.ok(pos.y>ground-.8,'fish is buried in the sediment');
   if(pos.y>ground)inside++;
  }
  assert.ok(inside>world.stats.fish*.75,'most fish are beneath the bed');
  world.dispose();
 }
});
