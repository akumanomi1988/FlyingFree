import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainHeight} from '../src/core.js';
import {createForestVisibility,forestDensity} from '../src/forestVisibility.js';
import {createAdaptiveResolution} from '../src/adaptiveResolution.js';

function makeForest(){
 const records=[
  {kind:'pine',x:0,z:0},{kind:'oak',x:10,z:0},
  {kind:'palm',x:20,z:0},{kind:'birch',x:50,z:0},
  {kind:'cypress',x:1200,z:0},{kind:'olive',x:2200,z:0},
  {kind:'mangrove',x:4800,z:0},{kind:'pine',x:5100,z:0}
 ];
 const count={trunk:8,lower:2,upper:2,broad:2,cypress:1,
  olive:1,birch:1,palmLeaves:7};
 const g=new THREE.BoxGeometry(1,1,1),m=new THREE.MeshBasicMaterial();
 const meshes={},o=new THREE.Object3D();
 for(const [name,n] of Object.entries(count)){
  const mesh=new THREE.InstancedMesh(g,m,n);mesh.count=n;
  for(let i=0;i<n;i++){
   o.position.set(i*1000+name.length,0,0);o.updateMatrix();
   mesh.setMatrixAt(i,o.matrix);
   if(name==='broad'||name==='lower'||name==='palmLeaves')
    mesh.setColorAt(i,new THREE.Color(i===0?0xffffff:0x334455));
  }
  meshes[name]=mesh;
 }
 return {records,meshes};
}

test('near forest is retained while unseen world trees stop consuming GPU triangles',()=>{
 const {records,meshes}=makeForest();
 const original=meshes.trunk.instanceMatrix.array.slice(0,16);
 const controller=createForestVisibility(meshes,records,1988,{radius:2600});
 assert.equal(controller.update({x:0,y:terrainHeight(0,0,1988)+100,z:0},0),true);
 const data=controller.stats;
 assert.ok(data.visible>=4&&data.visible<records.length);
 assert.equal(meshes.trunk.count,data.visible);
 assert.equal(meshes.palmLeaves.count,7,'all palm fronds must survive together');
 assert.equal(meshes.lower.count,meshes.upper.count,'pine crown LOD must stay symmetrical');
 assert.deepEqual([...meshes.trunk.instanceMatrix.array.slice(0,16)],[...original],
  'nearest tree must not shift during compaction');
 assert.equal(controller.update({x:0,y:terrainHeight(0,0,1988)+100,z:0},.1),false);
});

test('visibility streaming retains source materials and works after crossing the island',()=>{
 const {records,meshes}=makeForest();
 const controller=createForestVisibility(meshes,records,1988,{radius:2600});
 const camera={x:0,y:terrainHeight(0,0,1988)+200,z:0};
 controller.update(camera,0);
 const before=controller.stats.visible;
 controller.update({x:5100,y:100,z:0},1);
 assert.ok(meshes.trunk.count>=1,'new habitat trees disappeared after the camera moved');
 assert.ok(controller.stats.refreshes>=2);
 assert.ok(controller.stats.visible<=records.length);
 controller.setQuality(.48);
 controller.update({x:0,y:terrainHeight(0,0,1988)+200,z:0},1.1);
 assert.ok(controller.stats.visible<=before);
 assert.ok(controller.stats.quality<1);
 assert.ok(controller.stats.drawCalls<=8);
});

test('distance density is deterministic, preserves near trees, and degrades distant LOD',()=>{
 assert.equal(forestDensity(10,.5),1);
 assert.equal(forestDensity(339,.5),1);
 assert.ok(forestDensity(1600,.5)<forestDensity(1600,1));
 assert.ok(forestDensity(1600,1)<forestDensity(500,1));
});

test('30fps frame budget reacts to p95 stutter before apparent average drops',()=>{
 const quality=createAdaptiveResolution({
  maxScale:1,minScale:.48,downFps:29,downP95Ms:44,upFps:38,
  upP95Ms:29,downHold:3,upHold:8,cooldownSeconds:0
 });
 for(let i=0;i<2;i++)
  assert.equal(quality.observe({fps:32,p95Ms:52,seconds:1}).changed,false);
 const degrade=quality.observe({fps:32,p95Ms:52,seconds:1});
 assert.equal(degrade.reason,'degrade');
 assert.ok(degrade.scale<1);
 const reduced=degrade.scale;
 for(let i=0;i<8;i++)quality.observe({fps:30,p95Ms:39,seconds:1});
 assert.equal(quality.snapshot().scale,reduced);
 for(let i=0;i<8;i++)quality.observe({fps:50,p95Ms:22,seconds:1});
 assert.ok(quality.snapshot().scale>reduced);
});

import {createCloudField} from '../src/cloudField.js';

test('entire animated tropical cloud field uses one GPU draw call',()=>{
 const scene=new THREE.Scene();
 const c=createCloudField(THREE,scene);
 assert.equal(c.stats.clouds,27);
 assert.ok(c.stats.lobes>=27*5);
 assert.equal(c.stats.drawCalls,1);
 assert.equal(scene.children.length,1);
 assert.ok(c.mesh.isInstancedMesh);
 assert.equal(c.mesh.count,c.stats.lobes);
 const old=c.mesh.instanceMatrix.array.slice(0,16);
 c.update(1.3,.8,.9);
 const newer=c.mesh.instanceMatrix.array.slice(0,16);
 assert.notDeepEqual([...old],[...newer],'clouds stopped drifting');
 assert.equal(c.mesh.material.opacity>.6,true);
 c.update(1.5,0,.8);
 assert.equal(c.mesh.visible,false);
 c.dispose();
 assert.equal(scene.children.length,0);
});

test('mobile retains the same cloud shape complexity with a lower fixed budget',()=>{
 const c=createCloudField(THREE,new THREE.Scene(),{mobile:true});
 assert.equal(c.stats.clouds,17);
 assert.equal(c.stats.drawCalls,1);
 c.dispose();
});
