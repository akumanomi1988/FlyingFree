import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BirdAssetLibrary,canUseBirdAssets,bridgeProceduralPose} from '../src/assets/BirdAssetLibrary.js';
import {BIRDS} from '../src/core.js';
import {createBirdRig,animateBirdRig} from '../src/flight.js';

function fakeScene(){
  const root=new THREE.Group();
  const bones=new THREE.Group();bones.name='Armature';root.add(bones);
  for(const name of ['Wing_L','Wing_R','WingTip_L','WingTip_R','Head','Tail']){
    const bone=new THREE.Bone();bone.name=name;bones.add(bone);
  }
  const material=new THREE.MeshStandardMaterial();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.1,0,0,0,.1,0],3));
  geometry.setIndex([0,1,2]);
  root.add(new THREE.Mesh(geometry,material));
  return {scene:root,geometry,material};
}
test('VE-05: concurrent loads use a single loader request per LOD, cloned rig per acquire',async()=>{
  const files=[],models=[];
  const loader={loadAsync:async url=>{
    files.push(url);const value=fakeScene();models.push(value);return value;
  }};
  const library=new BirdAssetLibrary({loader,basePath:'/FlyingFree/assets/birds/',maxIdle:2});
  const [a,b]=await Promise.all([library.acquire('kingfisher'),library.acquire('kingfisher')]);
  assert.equal(files.length,2,'concurrent consumers must share network/cache');
  assert.notEqual(a.model,b.model,'each bird gets an independent animated skeleton');
  assert.equal(a.model.levels.length,2);
  assert.equal(library.stats.active,2);
  assert.equal(library.stats.cached,2);
  assert.ok(a.model.levels[0].object.getObjectByName('Wing_L')?.isBone);
  a.release();a.release();
  assert.equal(library.stats.active,2,'second consumer still holds both LODs');
  b.release();assert.equal(library.stats.active,0);
  library.clearUnused();assert.equal(library.stats.cached,0);
  assert.ok(models.every(m=>m.geometry.attributes.position.count===3));
  library.dispose();
  assert.equal(library.stats.disposed,true);
  await assert.rejects(()=>library.acquire('kingfisher'),/disposed/);
});
test('VE-05: broken GLB rejects cleanly without poisoning cached requests',async()=>{
  let fail=true,calls=0;
  const manager=new BirdAssetLibrary({loader:{loadAsync:async()=>{
    calls++;if(fail)throw Error('404 GLB');return fakeScene();
  }}});
  await assert.rejects(manager.acquire('kingfisher'),/404 GLB/);
  assert.equal(manager.stats.cached,0,'failed loading cannot leave broken cache entries');
  fail=false;
  const handle=await manager.acquire('kingfisher');
  assert.equal(handle.model.levels.length,2);
  handle.release();manager.dispose();
  assert.equal(calls,4);
});
test('VE-05: low-memory / explicit opt-out use the original procedural model',()=>{
  const gpu={capabilities:{isWebGL2:true}};
  assert.equal(canUseBirdAssets({renderer:gpu,navigator:{deviceMemory:1}}),false);
  assert.equal(canUseBirdAssets({renderer:gpu,navigator:{},search:'?assets=procedural'}),false);
  assert.equal(canUseBirdAssets({renderer:{capabilities:{isWebGL2:false}},navigator:{}}),false);
  assert.equal(canUseBirdAssets({renderer:gpu,navigator:{deviceMemory:8}}),true);
});
test('VE-05: only the two physical wings receive the existing pose bridge',()=>{
  const bird=createBirdRig(THREE,BIRDS.find(b=>b.id==='kingfisher'));
  animateBirdRig(bird,1.5,{bank:.22,energy:.8,state:'patrol'},1/30);
  const near=fakeScene(),far=fakeScene();
  const lod=new THREE.LOD();lod.addLevel(near.scene,0);lod.addLevel(far.scene,8);
  bridgeProceduralPose(lod,bird);
  for(const rig of [near.scene,far.scene]){
    assert.equal(rig.getObjectByName('Wing_L').rotation.z,bird.userData.left.pivot.rotation.z);
    assert.equal(rig.getObjectByName('Wing_R').rotation.z,bird.userData.right.pivot.rotation.z);
    assert.equal(rig.getObjectByName('Head').rotation.x,bird.userData.head.rotation.x);
  }
  const geos=new Set(),mats=new Set();
  bird.traverse(node=>{if(node.isMesh){geos.add(node.geometry);mats.add(node.material);}});
  for(const g of geos)g.dispose();for(const m of mats)m.dispose();
});
test('VE-05: switching from pending GLB to another species does not leak an abandoned template',async()=>{
  let complete;
  const pending=new Promise(resolve=>{complete=resolve;});
  const library=new BirdAssetLibrary({loader:{loadAsync:()=>pending},maxIdle:0});
  const request=library.acquire('kingfisher');
  // Resolve after unmount without replacing any live procedural birds.
  library.dispose();
  complete(fakeScene());
  await assert.rejects(request,/disposed/);
  assert.equal(library.stats.cached,0);
});
