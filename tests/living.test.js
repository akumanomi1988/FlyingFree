import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS,random,terrainHeight} from '../src/core.js';
import {classifyWeather,parseWeather,buildWeatherURL,createLiveClimate,WEATHER_STALE_MS} from '../src/localClimate.js';
import {localHour,withLocalHour,seasonLocal,astronomicalPhase} from '../src/localTime.js';
import {sunPosition} from '../src/core.js';
import {habitatAt,resourcePoint,foliageDensity,insectActivity,makeCellRandom} from '../src/ecology.js';
import {createBirdBrain} from '../src/behaviour.js';

test('weather descriptions map WMO codes safely',()=>{
 assert.equal(classifyWeather(0).id,'clear');
 assert.equal(classifyWeather(45).id,'fog');
 assert.equal(classifyWeather(61,87,1).id,'rain');
 assert.equal(classifyWeather(71).id,'snow');
 assert.equal(classifyWeather(99).id,'storm');
 assert.equal(classifyWeather(2,40,0).name,'Intervalos nubosos');
 assert.equal(classifyWeather(null).id,'clear'); // null is WMO zero
});
test('weather parser validates payloads and excludes coordinates',()=>{
 assert.throws(()=>parseWeather({current:{}}),/incompletos/);
 const v=parseWeather({current:{temperature_2m:13.6,apparent_temperature:10.3,relative_humidity_2m:67,wind_speed_10m:26.9,cloud_cover:84,precipitation:1.4,weather_code:61}},1234);
 assert.equal(v.temperature,14);assert.equal(v.windKmh,27);assert.equal(v.descriptor.id,'rain');
 assert.equal(JSON.stringify(v).includes('latitude'),false);
});
test('geolocation is permission-gated and rounded before Open-Meteo request',async()=>{
 let url='',calls=0;
 const client=createLiveClimate({
  permissions:{query:async()=>({state:'granted'})},
  geo:{getCurrentPosition:(ok)=>ok({coords:{latitude:40.42837,longitude:-3.71252}})},
  fetcher:async request=>{url=request;calls++;return {ok:true,json:async()=>({current:{temperature_2m:17,weather_code:2,cloud_cover:45,wind_speed_10m:7}})}},
  clock:()=>5_000_000
 });
 assert.equal(await client.requestLocation({onlyPreviouslyGranted:true}),true);
 assert.equal(client.coordinates.latitude,40.4);
 const result=await client.refresh(true);
 assert.equal(result.temperature,17);
 assert.ok(url.includes('latitude=40.4')&&url.includes('longitude=-3.7'));
 assert.equal(url.includes('40.42837'),false);
 await client.refresh();assert.equal(calls,1);
});
test('permission denied: climate never performs network access',async()=>{
 let calls=0;
 const client=createLiveClimate({
  permissions:{query:async()=>({state:'denied'})},
  geo:{getCurrentPosition:()=>{throw Error('must not be called')}},
  fetcher:async()=>{calls++;return {ok:true}}
 });
 assert.equal(await client.requestLocation({onlyPreviouslyGranted:true}),false);
 assert.equal(await client.refresh(),null);assert.equal(calls,0);
});
test('local civil hour and calendar work without hardcoded timezone',()=>{
 const date=new Date('2026-07-02T12:00:00Z');
 const d=withLocalHour(date,6.75);assert.ok(Math.abs(localHour(d)-6.75)<.01);
 assert.equal(seasonLocal(new Date(2026,11,1)),'Invierno');
 assert.equal(seasonLocal(new Date(2026,5,1)),'Verano');
});
test('solar phase is seasonal and set by actual geo parameters',()=>{
 const summer=new Date('2026-06-20T12:00:00Z'),winter=new Date('2026-12-20T12:00:00Z');
 const summerHour=astronomicalPhase(summer,'sunset',40,-3),winterHour=astronomicalPhase(winter,'sunset',40,-3);
 assert.ok(summerHour>winterHour+2.0);
 assert.ok(sunPosition(withLocalHour(summer,summerHour),40,-3).altitude>0);
});
test('habitats, food targets and natural insect activity depend on biome',()=>{
 assert.equal(habitatAt(5000,5000).type,'ocean');
 assert.equal(foliageDensity(habitatAt(5000,5000),'flowers'),0);
 assert.ok(insectActivity(.95,.05,21)>insectActivity(.12,.85,21));
 const r1=makeCellRandom(140,280,11),r2=makeCellRandom(140,280,11);assert.equal(r1(),r2());
 for(const id of ['hummingbird','swallow','heron','albatross','eagle']){
  const p=BIRDS.find(x=>x.id===id),node=resourcePoint(p,600,200,random(33));
  assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y)&&Number.isFinite(node.z));
 }
});
test('bird AI moves without teleportation and transitions between meaningful states',()=>{
 for(const id of ['kestrel','swallow','owl','albatross','heron']){
  const p=BIRDS.find(x=>x.id===id),brain=createBirdBrain(p,1988);let last=null;const states=new Set();
  for(let i=0;i<2000;i++){
   const t=i*.09,point=brain.update(t,.09,id==='owl'?.05:.88,0);
   states.add(point.state);
   assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z));
   assert.ok(point.speed>=0&&point.speed<=100);
   if(last)assert.ok(Math.hypot(point.x-last.x,point.y-last.y,point.z-last.z)<22,'Jump in '+id);
   if(p.flight!=='marine')assert.ok(point.y>=terrainHeight(point.x,point.z)+4);
   last=point;
  }
  assert.ok(states.has('seek_food')||states.has('rest')||states.has('shelter'),id+' never used its AI');
 }
});

import * as THREE from 'three';
import {createEcosystem} from '../src/ecosystem.js';
test('ecosystem interaction loop never throws and exposes fauna states',()=>{
 const scene=new THREE.Scene(),world=createEcosystem(THREE,scene,1988,.5);
 assert.doesNotThrow(()=>world.update(2,.8,.25,{x:230,y:150,z:200},.1,{x:240,y:210,z:180}));
 assert.ok(world.actors.some(g=>g.userData.behaviour));
});

test('a bird eventually lands and feeds at a procedural habitat target',()=>{
 const kestrel=BIRDS.find(b=>b.id==='kestrel'),brain=createBirdBrain(kestrel,1988);
 let hadDescent=false,hadLanding=false,hadFeeding=false;
 for(let i=0;i<5600;i++){
  const point=brain.update(i*.08,.08,.96,0);
  if(point.state==='approach'||point.state==='landing')hadDescent=true;
  if(point.landings>0)hadLanding=true;
  if(point.feedings>0)hadFeeding=true;
 }
 assert.equal(hadDescent,true,'La IA no se aproxima a recursos');
 assert.equal(hadLanding,true,'La IA no aterriza');
 assert.equal(hadFeeding,true,'La IA no se alimenta');
});
test('vegetation detail is culled by observer altitude',async()=>{
 const THREE=await import('three');
 const {createGroundDetail}=await import('../src/vegetation.js');
 const scene=new THREE.Scene(),ground=createGroundDetail(THREE,scene,.22);
 const x=1000,z=100,y=terrainHeight(x,z);
 const observer={position:{x,y:y+24,z}},bird={x,y:y+23,z};
 ground.update(1,observer,bird,.95,0,21);
 assert.equal(ground.active,true);
 ground.update(3,{position:{x,y:y+750,z}},{x,y:y+750,z},.95,0,21);
 assert.equal(ground.active,false);
});
