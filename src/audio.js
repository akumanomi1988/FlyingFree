import {random} from './core.js';
import {deriveMusicProfile} from './musicDirector.js';

// Procedural weather-aware soundtrack: two crossfading chord banks, sparse bell
// phrases and filtered environmental noise. Nothing is fetched or recorded.
// Make the sparse melody audible without an organ-like continuous chord.
const VOICE_LEVELS=[.015,.017,.013,.010,.007];
const MELODY_PATTERN=[0,2,4,1,3,5,4,2,1,0,3,2,5,1,4,0];

function createPadBank(ctx,notes,destination){
 const bus=ctx.createGain();
 bus.gain.value=0;
 bus.connect(destination);
 const voices=notes.map((frequency,i)=>{
  const oscillator=ctx.createOscillator();
  oscillator.type=i<2?'sine':'triangle';
  oscillator.frequency.value=frequency;
  const level=ctx.createGain();
  level.gain.value=VOICE_LEVELS[i];
  oscillator.connect(level).connect(bus);
  oscillator.start();
  return {oscillator,level};
 });
 return {bus,voices};
}

export class Soundscape {
 constructor({AudioContextClass=null}={}){
  this.AudioContextClass=AudioContextClass;
  this.ctx=null;this.master=null;this.music=null;
  this.wind=null;this.rain=null;this.noise=null;
  this.padTone=null;this.padHighpass=null;this.bellTone=null;
  this.windHighpass=null;this.windLowpass=null;this.rainHighpass=null;
  this.padBanks=[];this.activeBank=0;this.harmonyId=null;
  this.enabled=false;this.mood=deriveMusicProfile();
  this.lastAutomation=-Infinity;this.nextNoteAt=0;this.noteCount=0;
  this.noteRandom=random(41827);
 }
 async start(){
  if(this.ctx){
   await this.ctx.resume();
   this.enabled=true;
   const t=this.ctx.currentTime;
   this.master.gain.cancelScheduledValues(t);
   this.master.gain.setTargetAtTime(.80,t,.5);
   this.nextNoteAt=t+.65;
   this.lastAutomation=-Infinity;
   this._applyMood(this.mood,t);
   return;
  }
  const AudioContextClass=this.AudioContextClass||globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioContextClass)throw new Error('Web Audio no disponible');
  const ctx=new AudioContextClass();
  this.ctx=ctx;

  const master=this.master=ctx.createGain();
  master.gain.value=0;
  const compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-19;
  compressor.knee.value=20;
  compressor.ratio.value=3;
  compressor.attack.value=.008;
  compressor.release.value=.32;
  master.connect(compressor).connect(ctx.destination);

  const music=this.music=ctx.createGain();
  music.gain.value=this.mood.fullness;
  music.connect(master);
  const padTone=this.padTone=ctx.createBiquadFilter();
  padTone.type='lowpass';
  padTone.frequency.value=this.mood.padCutoff;
  padTone.Q.value=.55;
  // High-pass the pad to prevent a persistent sub-bass rumble on televisions.
  const padHighpass=this.padHighpass=ctx.createBiquadFilter();
  padHighpass.type='highpass';
  padHighpass.frequency.value=130;
  padHighpass.Q.value=.71;
  padTone.connect(padHighpass).connect(music);
  const bellTone=this.bellTone=ctx.createBiquadFilter();
  bellTone.type='lowpass';
  bellTone.frequency.value=this.mood.bellCutoff;
  bellTone.Q.value=.55;
  bellTone.connect(music);

  this.padBanks=[
   createPadBank(ctx,this.mood.notes,padTone),
   createPadBank(ctx,this.mood.notes,padTone)
  ];
  this.padBanks[0].bus.gain.value=1;
  this.activeBank=0;
  this.harmonyId=this.mood.key;

  // Wideband noise avoids the previous repetitive 4-second bass-heavy loop.
  const buffer=ctx.createBuffer(1,ctx.sampleRate*11,ctx.sampleRate);
  const samples=buffer.getChannelData(0),rng=random(6821);
  let slow=0;
  for(let i=0;i<samples.length;i++){
   const white=rng()*2-1;
   slow=slow*.994+white*.006;
   samples[i]=white*.14+slow*.016;
  }
  const noise=this.noise=ctx.createBufferSource();
  noise.buffer=buffer;
  noise.loop=true;
  const windHighpass=this.windHighpass=ctx.createBiquadFilter();
  windHighpass.type='highpass';
  windHighpass.frequency.value=250;
  windHighpass.Q.value=.70;
  const windLowpass=this.windLowpass=ctx.createBiquadFilter();
  windLowpass.type='lowpass';
  windLowpass.frequency.value=1600;
  windLowpass.Q.value=.70;
  const wind=this.wind=ctx.createGain();
  wind.gain.value=0;
  noise.connect(windHighpass).connect(windLowpass).connect(wind).connect(master);
  const rainHighpass=this.rainHighpass=ctx.createBiquadFilter();
  rainHighpass.type='highpass';
  rainHighpass.frequency.value=1100;
  rainHighpass.Q.value=.7;
  const rain=this.rain=ctx.createGain();
  rain.gain.value=0;
  noise.connect(rainHighpass).connect(rain).connect(master);
  noise.start();

  await ctx.resume();
  this.enabled=true;
  this.nextNoteAt=ctx.currentTime+.8;
  this.lastAutomation=-Infinity;
  this._applyMood(this.mood,ctx.currentTime);
  master.gain.setTargetAtTime(.80,ctx.currentTime,.65);
 }
 async toggle(){
  if(!this.ctx||!this.enabled){await this.start();return;}
  const t=this.ctx.currentTime;
  this.master.gain.cancelScheduledValues(t);
  this.master.gain.setTargetAtTime(0,t,.22);
  this.enabled=false;
 }
 update(weather={},solar={},weatherId=weather?.id){
  this.mood=deriveMusicProfile(weather,solar,weatherId);
  if(!this.ctx||!this.enabled)return;
  const t=this.ctx.currentTime;
  if(t-this.lastAutomation>=.20){
   this._applyMood(this.mood,t);
   this.lastAutomation=t;
  }
  // Resynchronise after throttled/background tabs; do not queue hundreds of notes.
  if(this.nextNoteAt<t-.5)this.nextNoteAt=t+.25;
  let scheduled=0;
  while(this.nextNoteAt<t+2.3&&scheduled<3){
   this._scheduleBell(this.nextNoteAt,this.mood);
   this.nextNoteAt+=2.4+(1-this.mood.pace)*3.3+this.noteRandom()*.85;
   scheduled++;
  }
 }
 _applyMood(mood,t){
  if(mood.key!==this.harmonyId)this._crossfadeHarmony(mood,t);
  this.music.gain.setTargetAtTime(mood.fullness,t,3.5);
  this.padTone.frequency.setTargetAtTime(mood.padCutoff,t,4);
  this.bellTone.frequency.setTargetAtTime(mood.bellCutoff,t,4);
  this.wind.gain.setTargetAtTime(mood.windLevel,t,2);
  this.rain.gain.setTargetAtTime(mood.rainLevel,t,2);
 }
 _crossfadeHarmony(mood,t){
  const old=this.padBanks[this.activeBank];
  const index=1-this.activeBank;
  const next=this.padBanks[index];
  next.bus.gain.cancelScheduledValues(t);
  // Silence the standby bank before retuning; avoids audible oscillator glissandi.
  next.bus.gain.setTargetAtTime(0,t,.3);
  next.voices.forEach(({oscillator},i)=>{
   oscillator.frequency.cancelScheduledValues(t);
   oscillator.frequency.setValueAtTime(mood.notes[i],t+1.4);
  });
  next.bus.gain.setValueAtTime(0,t+1.39);
  next.bus.gain.setTargetAtTime(1,t+1.4,3.2);
  old.bus.gain.cancelScheduledValues(t);
  old.bus.gain.setTargetAtTime(0,t,3.2);
  this.activeBank=index;
  this.harmonyId=mood.key;
 }
 _scheduleBell(when,mood){
  const degree=MELODY_PATTERN[this.noteCount%MELODY_PATTERN.length];
  this.noteCount++;
  if(this.noteRandom()<.16)return; // Natural pauses in the score.
  const ctx=this.ctx;
  const frequency=mood.root*2**(mood.scale[degree]/12);
  const length=2.8+(1-mood.brightness)*1.35;
  const envelope=ctx.createGain();
  envelope.gain.setValueAtTime(.0001,when);
  envelope.gain.exponentialRampToValueAtTime(mood.bellLevel,when+.045);
  envelope.gain.exponentialRampToValueAtTime(.0001,when+length);
  const pan=ctx.createStereoPanner?.();
  if(pan){
   pan.pan.value=(this.noteRandom()-.5)*.56;
   envelope.connect(pan).connect(this.bellTone);
  }else envelope.connect(this.bellTone);
  const fundamental=ctx.createOscillator();
  fundamental.type='sine';
  fundamental.frequency.value=frequency;
  fundamental.connect(envelope);
  const harmonic=ctx.createOscillator();
  harmonic.type='sine';
  harmonic.frequency.value=frequency*2;
  const harmonicLevel=ctx.createGain();
  harmonicLevel.gain.value=.10+mood.brightness*.24;
  harmonic.connect(harmonicLevel).connect(envelope);
  fundamental.onended=()=>{
   fundamental.disconnect();
   harmonic.disconnect();
   harmonicLevel.disconnect();
   envelope.disconnect();
   pan?.disconnect();
  };
  fundamental.start(when);
  harmonic.start(when);
  fundamental.stop(when+length+.08);
  harmonic.stop(when+length+.08);
 }
 async dispose(){
  if(!this.ctx)return;
  for(const bank of this.padBanks){
   for(const voice of bank.voices)voice.oscillator.stop();
  }
  this.noise?.stop();
  await this.ctx.close();
  this.ctx=null;this.master=null;this.music=null;
  this.wind=null;this.rain=null;this.noise=null;
  this.padTone=null;this.padHighpass=null;this.bellTone=null;
  this.windHighpass=null;this.windLowpass=null;this.rainHighpass=null;
  this.padBanks=[];this.harmonyId=null;
  this.enabled=false;this.lastAutomation=-Infinity;
 }
}
