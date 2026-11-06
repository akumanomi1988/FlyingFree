import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS} from '../src/core.js';
import {createBirdRig,createWingSurfaceGeometry,wingPlanform,animateBirdRig} from '../src/flight.js';
import {createEcosystem} from '../src/ecosystem.js';
import {createTreeDetail,treeDetailWeight,TREE_DETAIL_POOL} from '../src/treeDetail.js';
import {birdPlumage,BIRD_PLUMAGE} from '../src/speciesAppearance.js';
import {batchStaticMeshes} from '../src/meshBatch.js';

test('all supported species have visibly distinct anatomy palettes',()=>{
  assert.equal(Object.keys(BIRD_PLUMAGE).length,BIRDS.length);
  for(const bird of BIRDS){
    const colors=birdPlumage(bird.id);
    for(const region of ['chest','wing','tip','crown','iris','bill'])
      assert.ok(Number.isInteger(colors[region]),bird.id+' missing '+region);
    assert.notEqual(colors.chest,colors.tip,bird.id+' chest and primaries must contrast');
  }
  assert.throws(()=>birdPlumage('unknown'),RangeError);
});

test('all twelve bird species have curved indexed wings, articulated feathers and realistic spans',()=>{
  for(const bird of BIRDS){
    const plan=wingPlanform(bird);
    const wing=createWingSurfaceGeometry(THREE,bird.wings,plan);
    assert.ok(wing.index.count>=18*4*6, bird.id+' wing segmentation');
    assert.ok(wing.attributes.normal.count>80, bird.id+' smooth vertex normals');
    const group=createBirdRig(THREE,bird);
    assert.equal(group.userData.geometryVersion,4);
    assert.equal(group.userData.wingSilhouette,'single-continuous');
    assert.equal(group.userData.left.pivot.children.length,1,'one wing root per side');
    assert.equal(group.userData.right.pivot.children.length,1,'one wing root per side');
    assert.ok(group.userData.plumageDrawCallsSaved>=40,bird.id+' should batch rigid feathers');
    assert.ok(group.userData.left.tip&&group.userData.right.tip);
    const bounds=new THREE.Box3().setFromObject(group);
    const span=bounds.max.x-bounds.min.x;
    assert.ok(span>bird.wingspan*.75&&span<bird.wingspan*1.15,
      bird.id+' world-scale wingspan '+span+' vs '+bird.wingspan);
    let pieces=0,vertices=0;
    group.traverse(o=>{if(o.isMesh){pieces++;vertices+=o.geometry.attributes.position.count;}});
    assert.ok(pieces>=20&&pieces<=65,bird.id+' should retain anatomy with batched draw calls');
    assert.ok(vertices>900,bird.id+' near camera has additional geometry');
    animateBirdRig(group,4.5,{energy:.8,bank:.22,state:'landing'},1/60);
    for(const leg of group.userData.legs)assert.ok(Number.isFinite(leg.rotation.x));
    wing.dispose();
    const geom=new Set(),mat=new Set();
    group.traverse(o=>{if(o.isMesh){geom.add(o.geometry);mat.add(o.material)}});
    for(const g of geom)g.dispose();
    for(const m of mat)m.dispose();
  }
});

test('near-tree geometry is pooled, distance bounded and can be disposed',()=>{
  assert.equal(treeDetailWeight(0),1);
  assert.equal(treeDetailWeight(310),0);
  assert.ok(treeDetailWeight(240)>0&&treeDetailWeight(240)<1);
  const scene=new THREE.Scene();
  const trees=[
    {x:0,y:0,z:0,height:30,kind:'pine',angle:0},
    {x:60,y:0,z:0,height:22,kind:'oak',angle:.1},
    {x:300,y:0,z:0,height:30,kind:'birch',angle:0}
  ];
  const layer=createTreeDetail(THREE,scene,trees,1);
  layer.update({x:0,y:0,z:0},0);
  assert.equal(layer.active,3);
  assert.equal(layer.poolCapacity,TREE_DETAIL_POOL);
  assert.equal(scene.children.length,3);
  for(const mesh of scene.children){
    assert.ok(mesh.count<=layer.poolCapacity*7);
    assert.ok(mesh.instanceMatrix.version>0);
  }
  layer.update({x:1000,y:0,z:0},2);
  assert.equal(layer.active,0);
  assert.equal(layer.updateCount,2);
  layer.update({x:1000,y:0,z:0},2.5);
  assert.equal(layer.updateCount,2,'stationary camera must not rebuild every frame');
  layer.update({x:1000,y:0,z:0},5.5);
  assert.equal(layer.updateCount,3,'periodic refresh stays available');
  layer.dispose();
  assert.equal(scene.children.length,0);
});

test('fauna retains behaviour and receives smooth anatomical meshes',()=>{
  const scene=new THREE.Scene();
  const eco=createEcosystem(THREE,scene,1988,.6);
  assert.ok(eco.stats.deer>=4);
  assert.ok(eco.stats.fox>=2);
  assert.ok(eco.stats.dolphins>=4);
  assert.ok(eco.actors.every(g=>g.scale.x>0));
  const meshCount=g=>{let count=0;g.traverse(child=>{if(child.isMesh)count++});return count;};
  assert.ok(eco.actors.some(g=>g.userData.state.type==='deer'&&meshCount(g)>20));
  for(const animal of eco.actors.filter(g=>['deer','fox'].includes(g.userData.state.type))){
    assert.equal(animal.userData.head?.isGroup,true,'head must be an articulated hierarchy');
    assert.ok(animal.userData.head.children.length>=6,'muzzle/eyes/ears must follow head');
  }
  assert.ok(eco.dolphins.every(d=>d.group.children.length>=7));
  assert.ok(eco.birds.every(b=>b.g.isLOD&&b.g.levels.length===2),
    'secondary gulls must have near 3D and far minimal LOD');
  const deer=eco.actors.find(g=>g.userData.state.type==='deer');
  assert.ok(deer.userData.details.length>2);
  eco.update(7,.8,.2,null,.1,deer.position.clone().add(new THREE.Vector3(0,10,0)));
  assert.ok(deer.userData.details.every(mesh=>mesh.visible));
  eco.update(8,.8,.2,null,.1,new THREE.Vector3(10000,300,10000));
  assert.ok(deer.userData.details.every(mesh=>!mesh.visible));
  assert.ok(eco.actors.every(g=>typeof g.userData.behaviour==='string'));
});

test('rigid mesh batching reduces draw calls without changing visible bounds',()=>{
  const parent=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0xffffff});
  const geometry=new THREE.BoxGeometry(1,1,1);
  for(const x of [-2,0,2]){
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,.5,x*.3);mesh.rotation.y=x*.09;
    parent.add(mesh);
  }
  const before=new THREE.Box3().setFromObject(parent);
  const summary=batchStaticMeshes(THREE,parent);
  const after=new THREE.Box3().setFromObject(parent);
  assert.deepEqual(summary,{before:3,after:1,drawCallsSaved:2});
  assert.equal(parent.children.length,1);
  for(const axis of ['x','y','z']){
    assert.ok(Math.abs(before.min[axis]-after.min[axis])<1e-5);
    assert.ok(Math.abs(before.max[axis]-after.max[axis])<1e-5);
  }
  parent.children[0].geometry.dispose();geometry.dispose();material.dispose();
});

test('dense tree patches fade before the fixed instance-pool boundary',()=>{
  const scene=new THREE.Scene();
  const records=Array.from({length:80},(_,i)=>({
    x:25+i*1.25,y:0,z:0,height:22,kind:i%2?'pine':'oak',angle:i*.17
  }));
  const layer=createTreeDetail(THREE,scene,records,1);
  layer.update({x:0,y:10,z:0},0);
  assert.ok(layer.fadeDistance<=310);
  assert.ok(layer.fadeDistance>0);
  assert.ok(layer.active<=TREE_DETAIL_POOL);
  assert.ok(scene.children.every(mesh=>mesh.count<=TREE_DETAIL_POOL*7));
  layer.dispose();
});
