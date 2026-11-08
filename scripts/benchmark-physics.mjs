import * as THREE from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {WorldQuery} from '../src/worldQuery.js';
import {createPhysicsWorld} from '../src/physics/PhysicsWorld.js';
import {tropicalTerrainSample,TROPICAL_WORLD} from '../src/tropicalTerrain.js';
import {createTropicalRivers} from '../src/tropicalRivers.js';
const samples=[];
for(const seed of [1988,20261106,12345]){
  const geometry=new THREE.PlaneGeometry(TROPICAL_WORLD.extent,TROPICAL_WORLD.extent,250,250)
    .rotateX(-Math.PI/2);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)positions.setY(i,
    tropicalTerrainSample(positions.getX(i),positions.getZ(i),seed).height);
  positions.needsUpdate=true;geometry.computeVertexNormals();
  const terrain=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const scene=new THREE.Scene(),rivers=createTropicalRivers(THREE,scene,seed);
  const query=new WorldQuery({terrain,riverbed:rivers.bed,riverWater:rivers.mesh,seed});
  const before=process.memoryUsage(),initStart=performance.now();
  const physics=await createPhysicsWorld({query});
  const initMs=performance.now()-initStart;
  const observer={x:200,y:50,z:200},actors=[];
  for(let i=0;i<32;i++){
    const x=observer.x+(i%8-4)*25,z=observer.z+(Math.floor(i/8)-2)*25;
    actors.push({position:{x,z,y:query.heightAt(x,z)},userData:{state:{type:i%2?'fox':'deer'}}});
  }
  let baseline=0;
  for(let i=0;i<60;i++){
    const t=performance.now();
    for(const a of actors){
      a.position.x+=.07;a.position.z+=.05;
      a.position.y=query.heightAt(a.position.x,a.position.z);
    }
    baseline+=performance.now()-t;
  }
  let physicsTotal=0;
  for(let i=0;i<60;i++){
    const t=performance.now();
    for(const a of actors){
      a.position.x+=.07;a.position.z+=.05;
      a.position.y=query.heightAt(a.position.x,a.position.z);
    }
    physics.step(actors,observer,1/30);
    physicsTotal+=performance.now()-t;
  }
  const result={seed,wasmAndWorldInitMs:+initMs.toFixed(3),
    withoutRapierTrajectoryMsPerTick:+(baseline/60).toFixed(3),
    withRapierContactMsPerTick:+(physicsTotal/60).toFixed(3),
    rapierExtraMsPerTick:+((physicsTotal-baseline)/60).toFixed(3),
    activeCostPerAnimalMs:+(physicsTotal/60/Math.max(1,physics.stats.activeBodies)).toFixed(4),
    physics:physics.stats,
    memory:{rssDeltaBytes:process.memoryUsage().rss-before.rss,
      heapDeltaBytes:process.memoryUsage().heapUsed-before.heapUsed,
      note:'RSS includes WASM and V8; snapshots not isolated, GC not controlled'}};
  samples.push(result);console.log(JSON.stringify(result));
  physics.dispose();query.dispose();rivers.dispose();geometry.dispose();terrain.material.dispose();
}
mkdirSync('artifacts/physics',{recursive:true});
writeFileSync('artifacts/physics/benchmark.json',JSON.stringify({
  interpretation:'Node GitHub runner CPU only. No GPU/TV timings. Baseline includes WorldQuery sampling; measured Rapier case includes contact solver and world.step.',
  samples},null,2)+'\n');
if(samples.some(s=>s.physics.activeBodies>12||s.physics.staticColliders===0||
  !Number.isFinite(s.withRapierContactMsPerTick)))process.exitCode=1;
