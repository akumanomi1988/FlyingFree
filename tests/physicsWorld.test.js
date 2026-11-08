import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WorldQuery} from '../src/worldQuery.js';
import {createPhysicsWorld,extractLocalTriangles,PHYSICS_LIMITS} from '../src/physics/PhysicsWorld.js';
const DT=1/30;
function fixture(seed=1988,slope=.2){
  const g=new THREE.PlaneGeometry(160,160,24,24).rotateX(-Math.PI/2);
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setY(i,(p.getX(i)*slope+p.getZ(i)*.11)+(seed%7)*.01);
  g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const query=new WorldQuery({terrain:mesh,seed});
  return {mesh,query,dispose(){query.dispose();g.dispose();mesh.material.dispose();}};
}
const actor=(type,x,y,z)=>({position:{x,y,z},userData:{state:{type}}});
test('Rapier WASM initializes; contact geometry copies exact WorldQuery triangles',async()=>{
  const scene=fixture();
  const physics=await createPhysicsWorld({query:scene.query,limits:{patchRadius:44,patchShift:20}});
  try{
    assert.equal(physics.stats.activeBodies,0);
    const expected=scene.query.heightAt(3,4),fauna=actor('fox',3,expected-.5,4);
    const result=physics.step([fauna],{x:3,y:15,z:4},DT);
    assert.equal(result.activeBodies,1);
    assert.ok(result.staticColliders>=1);
    assert.ok(result.patchTriangles>0);
    assert.ok(fauna.position.y>=scene.query.heightAt(fauna.position.x,fauna.position.z)-1e-6);
    assert.ok(fauna.position.y-scene.query.heightAt(fauna.position.x,fauna.position.z)<=.151);
    assert.throws(()=>physics.step([fauna],{x:3,y:15,z:4},1/60),/30 Hz/);
  }finally{physics.dispose();scene.dispose();}
});
test('Distance hysteresis caps bodies and deletes remote colliders',async()=>{
  const f=fixture(12345),physics=await createPhysicsWorld({query:f.query,limits:{
    activateDistance:18,deactivateDistance:25,patchRadius:45,maxBodies:3
  }});
  try{
    const a=Array.from({length:16},(_,i)=>actor('rabbit',i*2,f.query.heightAt(i*2,0)??0,0));
    physics.step(a,{x:0,y:15,z:0},DT);
    assert.equal(physics.stats.activeBodies,3);
    physics.step(a,{x:300,y:15,z:300},DT);
    assert.equal(physics.stats.activeBodies,0);
    assert.ok(physics.stats.maxBodies===3);
  }finally{physics.dispose();f.dispose();}
});
test('Three seeded landscapes, slopes and repeated deterministic fixed steps',async()=>{
  for(const seed of [1988,20261106,12345]){
    const f=fixture(seed,seed===12345?.38:.2);
    const physics=await createPhysicsWorld({query:f.query,limits:{patchRadius:58,patchShift:20}});
    try{
      const fauna=actor('deer',-20,f.query.heightAt(-20,-3),-3);
      for(let tick=0;tick<72;tick++){
        const x=-20+tick*.32,z=-3+Math.sin(tick*.05);
        fauna.position.x=x;fauna.position.y=f.query.heightAt(x,z);fauna.position.z=z;
        physics.step([fauna],{x,y:25,z},DT);
        assert.ok(Number.isFinite(fauna.position.y));
        assert.ok(fauna.position.y>=f.query.heightAt(fauna.position.x,fauna.position.z)-.001);
      }
      assert.equal(physics.stats.ticks,72);
      assert.ok(physics.stats.activeBodies<=PHYSICS_LIMITS.maxBodies);
    }finally{physics.dispose();f.dispose();}
  }
});
test('World regeneration replaces static topology and frees resources',async()=>{
  const f=fixture(),next=fixture(999,.47),physics=await createPhysicsWorld({query:f.query});
  try{
    const a=actor('fox',0,f.query.heightAt(0,0),0);
    physics.step([a],{x:0,y:10,z:0},DT);
    physics.replaceSurfaces(next.query);
    a.position.y=next.query.heightAt(0,0);
    physics.step([a],{x:0,y:10,z:0},DT);
    assert.equal(physics.stats.activeBodies,1);
    assert.ok(a.position.y>=next.query.heightAt(0,0)-.001);
    physics.dispose();assert.equal(physics.stats.enabled,false);
    assert.throws(()=>physics.step([a],{x:0,y:10,z:0},DT),/disposed/);
    physics.dispose();
  }finally{physics.dispose();f.dispose();next.dispose();}
});
test('Water is queried, never manufactured as a static solid collider',async()=>{
  const f=fixture(),physics=await createPhysicsWorld({query:f.query});
  try{
    const b={x:0,y:f.query.heightAt(0,0),z:0,grounded:true,
      floating:false,restSite:{kind:'ground'}};
    physics.step([],{x:0,y:10,z:0},DT,{bird:b,profile:{wingspan:.5}});
    assert.equal(physics.stats.activeBodies,1);
    b.floating=true;
    physics.step([],{x:0,y:10,z:0},DT,{bird:b,profile:{wingspan:.5}});
    assert.equal(physics.stats.activeBodies,0);
  }finally{physics.dispose();f.dispose();}
});
