import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS,terrainHeight} from '../src/core.js';
import {BIRD_ETHOLOGY,birdFlightClearance,birdStatus} from '../src/speciesEthology.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createCoastalCliffs} from '../src/coastalCliffs.js';
import {createOcean} from '../src/renderfx.js';
import {OCEAN_SEGMENTS,oceanSurfaceHeight} from '../src/oceanMotion.js';
import {parseWeather} from '../src/localClimate.js';
import {localTimeLabel} from '../src/localTime.js';
import {createTreeDetail,TREE_DETAIL_RADIUS,TREE_DETAIL_POOL,treeDetailWeight} from '../src/treeDetail.js';

test('every species has biological metadata and small canopy birds fly lower than eagles',()=>{
 assert.equal(Object.keys(BIRD_ETHOLOGY).length,BIRDS.length);
 for(const bird of BIRDS){
   const meta=BIRD_ETHOLOGY[bird.id];
   assert.ok(meta&&meta.food&&meta.nest&&meta.rest);
   assert.ok(meta.wingHz>0);
 }
 assert.ok(birdFlightClearance('hummingbird')<birdFlightClearance('eagle')*.25);
 assert.ok(birdFlightClearance('owl')<birdFlightClearance('vulture')*.4);
 assert.ok(birdFlightClearance('kingfisher')<birdFlightClearance('osprey')*.4);
 assert.equal(BIRD_ETHOLOGY.swift.zone,'sky');
});

test('status presents physiology as measurable state, not invented emotional narrative',()=>{
 let report=birdStatus(.16,.83,'seek_food');
 assert.equal(report.condition,'Agotado');
 assert.equal(report.needsRest,true);
 assert.equal(report.needsFood,true);
 assert.equal(report.state,'Buscando alimento');
 report=birdStatus(.8,.9,'feed');
 assert.equal(report.condition,'Hambriento');
 assert.equal(report.state,'Alimentándose');
 assert.equal(birdStatus(.9,.1,'patrol').condition,'Activo');
});

test('each selected bird is seeded independently in its own suitable habitat',()=>{
 const seed=1988;
 const sites=new Set();
 for(const bird of BIRDS){
   const brain=createBirdBrain(bird,seed);
   const state=brain.snapshot;
   assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.z));
   const site=Math.round(state.x/50)+','+Math.round(state.z/50);
   sites.add(site);
 }
 assert.ok(sites.size>=10,'species must not all start in the same world coordinates');
});

test('coastal rocks are seeded, persist as static instancing and can be disposed',()=>{
 const scene=new THREE.Scene(),cliffs=createCoastalCliffs(THREE,scene,1988);
 assert.ok(cliffs.count>0,'expected visible coastal cliffs for this island');
 assert.equal(cliffs.mesh.isInstancedMesh,true);
 assert.ok(cliffs.clusters>=1);
 assert.equal(cliffs.mesh.count,cliffs.count);
 const first=cliffs.mesh.instanceMatrix.array.slice(0,16);
 const scene2=new THREE.Scene(),second=createCoastalCliffs(THREE,scene2,1988);
 assert.deepEqual(first,second.mesh.instanceMatrix.array.slice(0,16));
 assert.equal(cliffs.mesh.frustumCulled,false,'coast structures should not pop by distance');
 cliffs.dispose();second.dispose();
 assert.equal(scene.children.length,0);
});

test('ocean CPU surface uses precisely the upgraded mesh tessellation',()=>{
 assert.ok(OCEAN_SEGMENTS>=250);
 const scene=new THREE.Scene(),ocean=createOcean(THREE,scene,1988);
 assert.equal(ocean.mesh.geometry.parameters.widthSegments,OCEAN_SEGMENTS);
 assert.ok(Number.isFinite(oceanSurfaceHeight(1600,-1300,10,.3)));
 ocean.dispose();
});

test('expanded tree LOD retains near shape and distant full crowns',()=>{
 assert.equal(TREE_DETAIL_RADIUS,310);
 assert.ok(TREE_DETAIL_POOL>=80);
 assert.ok(treeDetailWeight(210)>0&&treeDetailWeight(210)<1);
 assert.ok(treeDetailWeight(300)>0);
 assert.equal(treeDetailWeight(310),0);
});

test('consented weather timezone formats its local time independently from device timezone',()=>{
 const value=parseWeather({
  timezone:'Pacific/Auckland',
  current:{temperature_2m:19,weather_code:0,cloud_cover:1,precipitation:0}
 },1700000000000);
 assert.equal(value.timezone,'Pacific/Auckland');
 const date=new Date('2026-01-01T00:00:00Z');
 assert.equal(localTimeLabel(date,'Pacific/Auckland'),'13:00');
 assert.equal(localTimeLabel(date,'Europe/Madrid'),'01:00');
});
