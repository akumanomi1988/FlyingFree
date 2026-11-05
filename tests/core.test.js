import test from 'node:test';
import assert from 'node:assert/strict';
import {random,terrainHeight,noise,sunPosition,chooseBird,chooseWeather,readOptions,BIRDS,WEATHER} from '../src/core.js';
test('seeded random is reproducible',()=>{const a=random(1988),b=random(1988);for(let i=0;i<100;i++)assert.equal(a(),b())});
test('noise deterministic and bounded',()=>{assert.equal(noise(1.4,5.7),noise(1.4,5.7));assert.ok(Math.abs(noise(1.4,5.7))<=1)});
test('terrain deterministic with island and ocean',()=>{assert.equal(terrainHeight(100,200),terrainHeight(100,200));assert.ok(terrainHeight(0,0)>0);assert.ok(terrainHeight(3000,3000)<0)});
test('solar position changes from day to night with observer coordinates',()=>{
 const day=sunPosition(new Date('2026-06-20T12:00:00Z'),40,0),night=sunPosition(new Date('2026-06-20T00:00:00Z'),40,0);
 assert.ok(day.altitude>.7);assert.ok(night.altitude<0);assert.ok(day.daylight>night.daylight);
});
test('bird and weather choices repeat for same date',()=>{
 const d=new Date('2026-11-05T13:00:00Z');assert.deepEqual(chooseBird(d),chooseBird(d));assert.deepEqual(chooseWeather(d),chooseWeather(d));
});
test('bird profiles and weather enums have full coverage',()=>{
 assert.equal(BIRDS.length,12);assert.equal(WEATHER.length,7);
 for(const bird of BIRDS)assert.ok(bird.id&&bird.flight&&bird.wingspan>=.1&&bird.wingspan<=3.5);
});
test('URL query validates hours and TV mode',()=>{
 assert.equal(readOptions('?h=99').hour,null);assert.equal(readOptions('?weather=bad').weather,undefined);
 assert.equal(readOptions('?bird=albatross').bird.id,'albatross');
 assert.equal(readOptions('?tv=1').tv,true);assert.equal(readOptions('?screensaver=1').tv,true);
});
