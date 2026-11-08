import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorldQuery} from '../src/worldQuery.js';
import {tropicalTerrainSample,TROPICAL_WORLD} from '../src/tropicalTerrain.js';
import {createTropicalRivers} from '../src/tropicalRivers.js';
import {oceanSurfaceHeight} from '../src/oceanMotion.js';

function fixture(seed) {
  // Exactly the same PlaneGeometry grid, winding, rotation and vertex
  // positions as the visible worldBuilder terrain (without GPU materials).
  const g=new THREE.PlaneGeometry(TROPICAL_WORLD.extent,TROPICAL_WORLD.extent,250,250);
  g.rotateX(-Math.PI/2);
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setY(i,tropicalTerrainSample(p.getX(i),p.getZ(i),seed).height);
  p.needsUpdate=true;g.computeVertexNormals();
  const terrain=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const scene=new THREE.Scene();
  const rivers=createTropicalRivers(THREE,scene,seed);
  const query=createWorldQuery({terrain,riverbed:rivers.bed,riverWater:rivers.mesh,seed});
  return {terrain,rivers,query,dispose(){query.dispose();rivers.dispose();g.dispose();terrain.material.dispose();}};
}

function nativeSurface(world,x,z) {
  // No BVH patch: Three's original Mesh.raycast traverses the full triangles.
  const caster=new THREE.Raycaster(new THREE.Vector3(x,2500,z),new THREE.Vector3(0,-1,0));
  const hit=caster.intersectObjects([world.terrain,world.rivers.bed],false)[0];
  return hit?.point.y??null;
}

for(const seed of [1988,20261106,12345]){
  test('VE-03: visible surface, normals and banks match brute-force triangles for seed '+seed,()=>{
    const world=fixture(seed);
    try {
      const positions=[
        [0,0],[240,380],[-950,1150],[1900,500],[2700,1700],
        [3650,-450],[4550,300],[5100,800],[-3800,1700],[5300,-1500],
        [-1000,-1700],[3800,2600],[100,-3500],[-4500,-900]
      ];
      for(const [x,z] of positions){
        const sample=world.query.sampleSurface(x,z);
        const reference=nativeSurface(world,x,z);
        assert.ok(sample&&reference!==null,'No rendered hit at '+x+','+z);
        assert.ok(Math.abs(sample.y-reference)<.0005,
          'Mismatch seed '+seed+' at '+x+','+z+': BVH '+sample.y+' vs mesh '+reference);
        assert.ok(Math.abs(Math.hypot(sample.normal.x,sample.normal.y,sample.normal.z)-1)<.0005);
        assert.ok(sample.normal.y>=0);
        assert.ok(Number.isFinite(sample.habitat.slope));
        assert.ok(['terrain','sediment'].includes(sample.material));
        assert.ok(Math.abs(world.query.heightAt(x,z)-reference)<.0005);
      }
      assert.equal(world.query.sampleSurface(7000,7000),null,
        'Do not invent a ground collider outside the mesh');
      assert.deepEqual(world.query.stats.sources,['terrain','riverbed','river-water']);
      assert.ok(world.query.stats.bvhBytes>0);
      assert.ok(world.query.stats.buildMs>=0);
    }finally{world.dispose();}
  });

  test('VE-03: sea, river and mountain lines of sight for seed '+seed,()=>{
    const world=fixture(seed);
    try {
      const ocean=world.query.sampleSurface(5700,5700,{includeWater:true,time:21,rain:.3});
      const seaFloor=world.query.sampleSurface(5700,5700);
      assert.ok(ocean.y>=seaFloor.y&&ocean.water);
      assert.equal(ocean.material,'ocean-water');
      assert.ok(Math.abs(ocean.y-oceanSurfaceHeight(5700,5700,21,.3))<.00001);
      const riverWater=world.rivers.mesh;
      const p=riverWater.geometry.getAttribute('position');
      const water=world.query.sampleSurface(p.getX(20),p.getZ(20),{includeWater:true});
      assert.ok(water&&Number.isFinite(water.y));
      assert.equal(world.query.lineOfSight(
        {x:-5900,y:100,z:0},{x:5900,y:100,z:0}),false,'Mountain should occlude');
      assert.equal(world.query.lineOfSight(
        {x:-5900,y:2600,z:0},{x:5900,y:2600,z:0}),true,'Clear sky should not occlude');
      const mountain=world.query.raycast({x:0,y:2500,z:0},{x:0,y:-1,z:0});
      assert.ok(mountain&&mountain.distance>0&&Number.isFinite(mountain.faceIndex));
      assert.equal(world.query.raycast({x:9000,y:100,z:9000},{x:0,y:-1,z:0}),null);
    }finally{world.dispose();}
  });
}

test('VE-03: replaceSurfaces removes stale indexes and disposal is idempotent',()=>{
  const w=fixture(1988);
  const old=w.query.heightAt(1600,1550);
  const replacement=w.terrain.clone();
  replacement.geometry=w.terrain.geometry.clone();
  const p=replacement.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+13);
  p.needsUpdate=true;replacement.geometry.computeVertexNormals();
  try{
    w.query.replaceSurfaces({terrain:replacement});
    const next=w.query.heightAt(1600,1550);
    assert.ok(Math.abs(next-old-13)<.0005,'Index should describe new mesh only');
    assert.deepEqual(w.query.stats.sources,['terrain']);
  }finally{
    w.dispose();
    replacement.geometry.dispose();
  }
  assert.throws(()=>w.query.heightAt(0,0),/disposed/);
  w.query.dispose();
});
