import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS,terrainHeight} from '../src/core.js';
import {birdEcology,flightAltitude,birdSensation} from '../src/birdEcology.js';
import {sessionIslandSeed,mapCoordinate} from '../src/minimap.js';
import {createBirdBrain} from '../src/behaviour.js';
import {habitatAt} from '../src/ecology.js';
import {tropicalTerrainSample} from '../src/tropicalTerrain.js';
import {localHour,localTimeLabel,seasonLocal} from '../src/localTime.js';
import {parseWeather} from '../src/localClimate.js';

test('every bird has coherent biological needs and contrasting canopy flight levels',()=>{
 assert.equal(BIRDS.length,12);
 for(const b of BIRDS){
  const t=birdEcology(b);
  assert.ok(t.wingBeatHz>0&&t.wingBeatHz<=60,b.id);
  assert.ok(t.nest&&t.rest&&t.feedingStyle,b.id);
  assert.ok(t.fatigueDrain>0,b.id);
 }
 const forest={type:'forest'};
 const humming=flightAltitude(BIRDS.find(b=>b.id==='hummingbird'),forest,100);
 const eagle=flightAltitude(BIRDS.find(b=>b.id==='eagle'),forest,100);
 assert.ok(humming<135,'hummingbirds must fly through or around the canopy');
 assert.ok(eagle>200,'raptors must fly over the canopy');
 assert.equal(birdEcology(BIRDS.find(b=>b.id==='swift')).canPerch,false);
 assert.equal(birdEcology(BIRDS.find(b=>b.id==='albatross')).rest,'water');
 assert.equal(birdSensation({energy:.3,hunger:.8,state:'patrol'}),'Buscando alimento');
 assert.equal(birdSensation({energy:.18,hunger:.2,state:'patrol'}),'Cansada');
});

test('a new browser visit gets a random seed; URL-supplied seeds stay reproducible',()=>{
 const fixed={getRandomValues(a){a[0]=9876543;}};
 assert.equal(sessionIslandSeed(fixed),9876543);
 assert.equal(sessionIslandSeed({getRandomValues(a){a[0]=0;}}),1);
 assert.equal(sessionIslandSeed({getRandomValues(a){a[0]=2147483653;}}),5);
 const a=sessionIslandSeed({getRandomValues(b){b[0]=42;}}),b=sessionIslandSeed({getRandomValues(c){c[0]=43;}});
 assert.notEqual(a,b);
 assert.deepEqual(mapCoordinate(0,0),{x:.5,y:.5});
 assert.deepEqual(mapCoordinate(6000,-6000),{x:1,y:0});
});

test('different species start in different valid places rather than inheriting the previous bird',()=>{
 const seen=new Set();
 for(const b of BIRDS){
  const brain=createBirdBrain(b,1988),pos=brain.snapshot;
  assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.z));
  assert.ok(Number.isFinite(terrainHeight(pos.x,pos.z,1988)));
  const token=Math.round(pos.x/90)+':'+Math.round(pos.z/90);
  assert.ok(!seen.has(token),'species spawn duplicated: '+b.id);
  seen.add(token);
 }
});

test('rest destinations may target an actual tree branch without changing fallback behavior',()=>{
 const bird=BIRDS.find(b=>b.id==='eagle');
 const initial=createBirdBrain(bird,1988).snapshot;
 const tree={x:initial.x+21,z:initial.z+18,y:terrainHeight(initial.x+21,initial.z+18,1988),height:22,kind:'oak'};
 const brain=createBirdBrain(bird,1988,{...initial,energy:.08,hunger:.25},{perches:[tree]});
 let landed=false;
 for(let frame=0;frame<1500;frame++){
  const state=brain.update(frame*.1,.1,.12,.8);
  if(state.roosting){landed=true;break;}
  assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.y));
 }
 assert.ok(landed,'tired bird did not reach its available branch roost');
});

test('location-based clock uses weather-provider IANA zone, without returning coordinates to UI',()=>{
 const date=new Date('2026-11-06T16:30:00Z');
 assert.equal(Math.floor(localHour(date,'Europe/Madrid')),17);
 assert.equal(Math.floor(localHour(date,'America/New_York')),11);
 assert.notEqual(localTimeLabel(date,'Europe/Madrid'),localTimeLabel(date,'America/New_York'));
 assert.equal(seasonLocal(new Date('2026-07-15T12:00:00Z'),-33),'Invierno');
 const observation=parseWeather({timezone:'Europe/Madrid',current:{
  temperature_2m:21,weather_code:2,cloud_cover:45,precipitation:0,
  wind_speed_10m:12,relative_humidity_2m:70
 }});
 assert.equal(observation.timeZone,'Europe/Madrid');
 assert.equal('latitude' in observation,false);
});
