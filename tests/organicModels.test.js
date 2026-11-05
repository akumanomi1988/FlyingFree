import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS} from '../src/core.js';
import {createBirdRig,createWingSurfaceGeometry,wingPlanform,animateBirdRig} from '../src/flight.js';
import {createEcosystem} from '../src/ecosystem.js';
import {createTreeDetail,treeDetailWeight,TREE_DETAIL_POOL} from '../src/treeDetail.js';

test('all twelve bird species have curved indexed wings, articulated feathers and realistic spans',()=>{
  for(const bird of BIRDS){
    const plan=wingPlanform(bird);
    const wing=createWingSurfaceGeometry(THREE,bird.wings,plan);
    assert.ok(wing.index.count>=18*4*6, bird.id+' wing segmentation');
    assert.ok(wing.attributes.normal.count>80, bird.id+' smooth vertex normals');
    const group=createBirdRig(THREE,bird);
    assert.equal(group.userData.geometryVersion,2);
    assert.ok(group.userData.left.tip&&group.userData.right.tip);
    const bounds=new THREE.Box3().setFromObject(group);
    const span=bounds.max.x-bounds.min.x;
    assert.ok(span>bird.wingspan*.75&&span<bird.wingspan*1.15,
      bird.id+' world-scale wingspan '+span+' vs '+bird.wingspan);
    let pieces=0,vertices=0;
    group.traverse(o=>{if(o.isMesh){pieces++;vertices+=o.geometry.attributes.position.count;}});
    assert.ok(pieces>45,bird.id+' should have layered anatomy');
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
  assert.equal(treeDetailWeight(150),0);
  assert.ok(treeDetailWeight(120)>0&&treeDetailWeight(120)<1);
  const scene=new THREE.Scene();
  const trees=[
    {x:0,y:0,z:0,height:30,kind:'pine',angle:0},
    {x:60,y:0,z:0,height:22,kind:'oak',angle:.1},
    {x:300,y:0,z:0,height:30,kind:'birch',angle:0}
  ];
  const layer=createTreeDetail(THREE,scene,trees,1);
  layer.update({x:0,y:0,z:0},0);
  assert.equal(layer.active,2);
  assert.equal(layer.poolCapacity,TREE_DETAIL_POOL);
  assert.equal(scene.children.length,3);
  for(const mesh of scene.children){
    assert.ok(mesh.count<=layer.poolCapacity*7);
    assert.ok(mesh.instanceMatrix.version>0);
  }
  layer.update({x:1000,y:0,z:0},2);
  assert.equal(layer.active,0);
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
  assert.ok(eco.actors.some(g=>g.userData.state.type==='deer'&&g.children.length>20));
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
