import test from 'node:test';
import assert from 'node:assert/strict';
import {random,terrainHeight,noise,sunPosition,solarEventHour,solarPhaseHour,madridHour,withMadridHour,chooseBird,chooseWeather,birdPosition,readOptions,BIRDS,WEATHER} from '../src/core.js';
test('seeded random sequence is reproducible',()=>{const a=random(1988),b=random(1988);for(let i=0;i<100;i++)assert.equal(a(),b())});
test('noise deterministic and bounded',()=>{assert.equal(noise(1.4,5.7),noise(1.4,5.7));assert.ok(Math.abs(noise(1.4,5.7))<=1)});
test('terrain is deterministic with island and ocean',()=>{assert.equal(terrainHeight(100,200),terrainHeight(100,200));assert.ok(terrainHeight(0,0)>0);assert.ok(terrainHeight(3000,3000)<0)});
test('sun has daylight and darkness at known UTC hours',()=>{const midday=sunPosition(new Date('2026-06-20T12:00:00Z'));const night=sunPosition(new Date('2026-06-20T00:00:00Z'));assert.ok(midday.altitude>0.7);assert.ok(night.altitude<0);assert.ok(midday.daylight>night.daylight)});
test('Madrid civil hour respects winter/summer DST',()=>{assert.equal(Math.floor(madridHour(new Date('2026-01-01T12:00:00Z'))),13);assert.equal(Math.floor(madridHour(new Date('2026-07-01T12:00:00Z'))),14)});
test('hour override converges in normal times',()=>{const d=withMadridHour(new Date('2026-05-05T12:00:00Z'),6.4);assert.ok(Math.abs(madridHour(d)-6.4)<.005)});
test('daily choices reproducible',()=>{const d=new Date('2026-11-05T13:00:00Z');assert.deepEqual(chooseBird(d),chooseBird(d));assert.deepEqual(chooseWeather(d),chooseWeather(d))});
test('all bird paths are safely above the ground',()=>{for(const b of BIRDS)for(let t=0;t<100;t+=2){const p=birdPosition(t,b);assert.ok(p.y>terrainHeight(p.x,p.z)+15)}});
test('URL options validate enum and hours',()=>{assert.equal(readOptions('?h=99').hour,null);assert.equal(readOptions('?weather=bad').weather,undefined);assert.equal(readOptions('?bird=albatross').bird.id,'albatross');assert.equal(WEATHER.length,7)});

test('solar event shortcuts follow seasonal solar times',()=>{
  const summer=new Date('2026-06-21T12:00:00Z');
  const winter=new Date('2026-12-21T12:00:00Z');
  const summerSet=solarEventHour(summer,'sunset'),winterSet=solarEventHour(winter,'sunset');
  assert.ok(summerSet>winterSet+2);
  const sunset=withMadridHour(winter,solarPhaseHour(winter,'sunset'));
  const position=sunPosition(sunset);
  assert.ok(position.altitude>-.1&&position.altitude<.20);
});

test('albatross stays over open sea on its circular patrol',()=>{
 const albatross=BIRDS.find(b=>b.id==='albatross');
 for(let t=0;t<180;t+=5){
   const p=birdPosition(t,albatross);
   assert.ok(Math.hypot(p.x,p.z)>1800,'El albatros ha entrado en la isla');
 }
});
