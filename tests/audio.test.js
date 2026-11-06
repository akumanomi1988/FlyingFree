import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveMusicProfile} from '../src/musicDirector.js';
import {Soundscape} from '../src/audio.js';

class FakeParam{
 constructor(value=0){this.value=value;this.events=[];}
 setTargetAtTime(value,time,constant){this.value=value;this.events.push(['target',value,time,constant]);}
 setValueAtTime(value,time){this.value=value;this.events.push(['value',value,time]);}
 exponentialRampToValueAtTime(value,time){this.value=value;this.events.push(['exponential',value,time]);}
 cancelScheduledValues(time){this.events.push(['cancel',time]);}
}
class FakeNode{
 constructor(){
  this.gain=new FakeParam();this.frequency=new FakeParam();
  this.Q=new FakeParam();this.pan=new FakeParam();
  for(const prop of ['threshold','knee','ratio','attack','release'])this[prop]=new FakeParam();
  this.started=[];this.stopped=[];
 }
 connect(node){return node;}
 disconnect(){}
 start(time=0){this.started.push(time);}
 stop(time=0){this.stopped.push(time);}
}
class FakeAudioContext{
 constructor(){
  this.currentTime=0;this.sampleRate=8000;this.state='suspended';
  this.destination=new FakeNode();this.oscillators=[];
 }
 createGain(){return new FakeNode();}
 createOscillator(){const o=new FakeNode();this.oscillators.push(o);return o;}
 createDynamicsCompressor(){return new FakeNode();}
 createBiquadFilter(){return new FakeNode();}
 createStereoPanner(){return new FakeNode();}
 createBufferSource(){return new FakeNode();}
 createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
 async resume(){this.state='running';}
 async close(){this.state='closed';}
}
const sun={daylight:1,golden:0,night:false};
const night={daylight:0,golden:0,night:true};

test('sunny weather sounds brighter than fog, rain and night',()=>{
 const clear=deriveMusicProfile({cloud:.1,rain:0,fog:0},sun,'sunny');
 const fog=deriveMusicProfile({cloud:.9,rain:0,fog:.8},sun,'fog');
 const rain=deriveMusicProfile({cloud:.9,rain:.8,fog:.4},sun,'rain');
 const dark=deriveMusicProfile({cloud:.1,rain:0,fog:0},night,'clear');
 assert.ok(clear.brightness>fog.brightness);
 assert.ok(clear.brightness>rain.brightness);
 assert.ok(clear.brightness>dark.brightness);
 assert.ok(clear.padCutoff>dark.padCutoff);
 assert.ok(clear.bellLevel>dark.bellLevel);
 assert.ok(clear.fullness>dark.fullness);
 assert.equal(clear.key,'clear');
});
test('all weather categories have valid and distinct musical harmonies',()=>{
 const ids=['clear','sunny','cloudy','drizzle','rain','storm','fog','snow'];
 for(const id of ids){
  const mood=deriveMusicProfile({cloud:.5,rain:.2,fog:.1},sun,id);
  assert.equal(mood.notes.length,5);
  assert.equal(mood.scale.length,6);
  assert.ok(mood.notes.every(n=>n>=40&&n<=400));
  assert.ok(Number.isFinite(mood.bellCutoff));
  assert.ok(mood.fullness>0&&mood.fullness<=1);
 }
 assert.notDeepEqual(deriveMusicProfile({},sun,'storm').notes,deriveMusicProfile({},sun,'clear').notes);
 assert.equal(deriveMusicProfile({},sun,'unrecognised').key,'clear');
});
test('music profile clamps invalid weather and light inputs',()=>{
 const mood=deriveMusicProfile({cloud:4,rain:-9,fog:NaN},{daylight:5,golden:4},'clear');
 assert.ok(mood.brightness>=.12&&mood.brightness<=.94);
 assert.ok(mood.windLevel>=0&&mood.windLevel<=.08);
 assert.ok(Number.isFinite(mood.padCutoff));
});
test('audio starts after a gesture, changes harmony, mutes and resumes',async()=>{
 const audio=new Soundscape({AudioContextClass:FakeAudioContext});
 audio.update({cloud:1,rain:1,fog:.3},sun,'storm');
 assert.equal(audio.ctx,null,'No autoplay before user gesture');
 await audio.toggle();
 assert.equal(audio.enabled,true);
 assert.equal(audio.ctx.state,'running');
 assert.equal(audio.harmonyId,'storm');
 assert.equal(audio.padBanks.length,2);
 audio.update({cloud:1,rain:1,fog:.3},sun,'storm');
 const before=audio.noteCount;
 assert.ok(before>0,'The score must schedule original melodic notes');
 audio.ctx.currentTime=.3;
 audio.update({cloud:.1,rain:0,fog:0},sun,'clear');
 assert.equal(audio.harmonyId,'clear');
 assert.equal(audio.activeBank,1,'Harmony must crossfade using another bank');
 await audio.toggle();
 assert.equal(audio.enabled,false);
 const paused=audio.noteCount;
 audio.ctx.currentTime=10;
 audio.update({cloud:.9,rain:0,fog:.8},night,'fog');
 assert.equal(audio.noteCount,paused,'No new notes may be scheduled while muted');
 await audio.toggle();
 assert.equal(audio.enabled,true);
 audio.update({cloud:.9,rain:0,fog:.8},night,'fog');
 assert.equal(audio.harmonyId,'fog');
 assert.ok(audio.ctx.oscillators.length>10);
 await audio.dispose();
 assert.equal(audio.ctx,null);
 assert.equal(audio.enabled,false);
});
test('frequent frame updates do not allocate a new set of pad voices',async()=>{
 const audio=new Soundscape({AudioContextClass:FakeAudioContext});
 await audio.start();
 const padVoices=audio.padBanks.flatMap(b=>b.voices).map(v=>v.oscillator);
 for(let i=0;i<900;i++){
  audio.ctx.currentTime=i/60;
  audio.update({cloud:.4,rain:0,fog:0},sun,'cloudy');
 }
 assert.equal(audio.padBanks.flatMap(b=>b.voices).length,10);
 assert.deepEqual(audio.padBanks.flatMap(b=>b.voices).map(v=>v.oscillator),padVoices);
 assert.ok(audio.noteCount<20,'Melody scheduling is bounded over a short session');
 await audio.dispose();
});

test('weather pad voicings never generate continuous sub-bass frequencies',()=>{
 const ids=['clear','sunny','cloudy','drizzle','rain','storm','fog','snow'];
 for(const id of ids){
  const profile=deriveMusicProfile({cloud:.6,rain:.4,fog:.2},sun,id);
  assert.ok(profile.notes.every(n=>n>=130&&n<=400),id+' includes a motor-like sub-bass oscillator');
  assert.ok(profile.windLevel<.04,id+' wind must stay under the former rumble level');
  assert.ok(profile.rainLevel<=.08,id+' ambient rain must remain subordinate to music');
 }
});

test('audio graph removes low rumble and keeps the melody audible',async()=>{
 const audio=new Soundscape({AudioContextClass:FakeAudioContext});
 await audio.start();
 assert.equal(audio.padHighpass.type,'highpass');
 assert.ok(audio.padHighpass.frequency.value>=125);
 assert.equal(audio.windHighpass.type,'highpass');
 assert.ok(audio.windHighpass.frequency.value>=220);
 assert.equal(audio.windLowpass.type,'lowpass');
 assert.equal(audio.rainHighpass.type,'highpass');
 const pads=audio.padBanks.flatMap(b=>b.voices);
 assert.equal(pads.length,10);
 assert.ok(pads.every(v=>v.oscillator.frequency.value>=130));
 assert.ok(pads.reduce((sum,v)=>sum+v.level.gain.value,0)<.14,
  'Ten standing voices must not overwhelm the melodic bells');
 assert.ok(audio.noise.buffer.getChannelData(0).length>=audio.ctx.sampleRate*10,
  'Short noise loops cause periodic engine-like ambience');
 const before=audio.noteCount;
 audio.update({cloud:.1,rain:0,fog:0},sun,'clear');
 assert.ok(audio.noteCount>before);
 await audio.dispose();
});

test('environment remains weather-reactive without bass rumble',()=>{
 const clear=deriveMusicProfile({cloud:0,rain:0,fog:0},sun,'clear');
 const storm=deriveMusicProfile({cloud:1,rain:1,fog:.4},sun,'storm');
 assert.ok(storm.windLevel>clear.windLevel);
 assert.ok(storm.rainLevel>clear.rainLevel);
 assert.ok(clear.brightness>storm.brightness);
 assert.ok(clear.bellLevel>storm.bellLevel);
});
