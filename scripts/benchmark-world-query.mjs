import * as THREE from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createWorldQuery} from '../src/worldQuery.js';
import {tropicalTerrainSample,TROPICAL_WORLD} from '../src/tropicalTerrain.js';
import {createTropicalRivers} from '../src/tropicalRivers.js';

// Repeatable CPU benchmark, not a claim about real GPU/TV performance.
// Baselines: old heightfield (cheap, geometrically inaccurate), brute-force
// triangle raycast (accurate, expensive), new BVH (accurate, accelerated).
const all=[];
for(const seed of [1988,20261106,12345]){
  const geometry=new THREE.PlaneGeometry(TROPICAL_WORLD.extent,TROPICAL_WORLD.extent,250,250);
  geometry.rotateX(-Math.PI/2);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)
    positions.setY(i,tropicalTerrainSample(positions.getX(i),positions.getZ(i),seed).height);
  positions.needsUpdate=true;
  geometry.computeVertexNormals();
  const terrain=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const scene=new THREE.Scene(),rivers=createTropicalRivers(THREE,scene,seed);
  const heapBefore=process.memoryUsage().heapUsed;
  const query=createWorldQuery({terrain,riverbed:rivers.bed,riverWater:rivers.mesh,seed});
  const heapAfter=process.memoryUsage().heapUsed;
  const points=[];
  for(let i=0;i<48;i++){
    const x=-5150+(i*1931%10200),z=-5020+(i*2797%10100);
    points.push([x,z]);
  }
  const raycaster=new THREE.Raycaster();
  raycaster.ray.direction.set(0,-1,0);
  const brute=()=>{
    const heights=[];
    for(const [x,z] of points){
      raycaster.ray.origin.set(x,2500,z);
      heights.push(raycaster.intersectObjects([terrain,rivers.bed],false)[0]?.point.y??null);
    }
    return heights;
  };
  const fast=()=>points.map(([x,z])=>query.heightAt(x,z));
  // Warm up both code paths and avoid treating one cold iteration as timing.
  brute();fast();
  const before=performance.now(),native=brute(),nativeMs=performance.now()-before;
  const next=performance.now(),accelerated=fast(),bvhMs=performance.now()-next;
  const differences=[],analyticErrors=[];
  for(let i=0;i<points.length;i++){
    if(native[i]===null||accelerated[i]===null)continue;
    differences.push(Math.abs(native[i]-accelerated[i]));
    const [x,z]=points[i];
    analyticErrors.push(Math.abs(tropicalTerrainSample(x,z,seed).height-native[i]));
  }
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const p95=a=>[...a].sort((x,y)=>x-y)[Math.floor(.95*(a.length-1))]??0;
  const result={seed,points:points.length,validHits:differences.length,
    geometry:{triangles:geometry.index.count/3+riverSums(rivers),maxErrorMeters:Math.max(...differences),
      p95AnalyticErrorMeters:p95(analyticErrors),meanAnalyticErrorMeters:sum(analyticErrors)/analyticErrors.length},
    performance:{bruteForceMsTotal:+nativeMs.toFixed(3),bvhMsTotal:+bvhMs.toFixed(3),
      bruteForceMsPerQuery:+(nativeMs/points.length).toFixed(5),
      bvhMsPerQuery:+(bvhMs/points.length).toFixed(5),
      speedup: +(nativeMs/Math.max(.0001,bvhMs)).toFixed(2),
      bvhBuildMs:query.stats.buildMs},
    memory:{estimatedBVHBytes:query.stats.bvhBytes,
      heapDeltaBytes:heapAfter-heapBefore,measurement:'process.heapUsed, GC not forced'}};
  all.push(result);
  console.log(JSON.stringify(result));
  query.dispose();rivers.dispose();terrain.material.dispose();geometry.dispose();
}
function riverSums(rivers){return rivers.stats.waterTriangles+rivers.stats.bankTriangles;}
mkdirSync('artifacts/world-query',{recursive:true});
writeFileSync('artifacts/world-query/benchmark.json',JSON.stringify({
  note:'GitHub Actions CPU results: not physical GPU timings. Geometry precision vs native Three.js brute-force raycast.',
  results:all
},null,2)+'\n');
if(all.some(r=>r.geometry.maxErrorMeters>.0005||r.geometry.maxErrorMeters===null))
  process.exitCode=1;
