// All audio is synthesized in realtime using Web Audio; no recorded clips or external assets.
export class Soundscape {
 constructor(){this.ctx=null;this.master=null;this.noise=null;this.wind=null;this.rain=null;this.pads=[];this.enabled=false;}
 async start(){
   if(this.ctx){await this.ctx.resume();this.enabled=true;return;}
   const A=window.AudioContext||window.webkitAudioContext;
   if(!A)throw new Error('Web Audio no disponible');
   const ctx=this.ctx=new A();
   const master=this.master=ctx.createGain();master.gain.value=.0;
   const comp=ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=20;comp.ratio.value=3;comp.attack.value=.006;comp.release.value=.3;
   master.connect(comp).connect(ctx.destination);
   const notes=[73.42,110,146.83,220]; // D2 A2 D3 A3
   for(let i=0;i<notes.length;i++){
     const osc=ctx.createOscillator();osc.type=i<2?'sine':'triangle';osc.frequency.value=notes[i];
     const gain=ctx.createGain();gain.gain.value=i<2?.055:.025;
     const trem=ctx.createOscillator();trem.frequency.value=.012+i*.007;
     const tremGain=ctx.createGain();tremGain.gain.value=.009; trem.connect(tremGain).connect(gain.gain);
     osc.connect(gain).connect(master);osc.start();trem.start();
     this.pads.push({osc,gain,trem});
   }
   const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);
   const samples=buffer.getChannelData(0);let v=0;
   for(let i=0;i<samples.length;i++){v=(Math.random()*2-1)*.09+v*.91;samples[i]=v;}
   const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;this.noise=noise;
   const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=540;
   const wind=ctx.createGain();wind.gain.value=.025;
   noise.connect(low).connect(wind).connect(master);this.wind=wind;
   const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=1200;
   const rain=ctx.createGain();rain.gain.value=0;noise.connect(high).connect(rain).connect(master);this.rain=rain;
   noise.start();master.gain.setTargetAtTime(.66,ctx.currentTime,.7);this.enabled=true;
 }
 async toggle(){if(!this.ctx||!this.enabled){await this.start();this.enabled=true;}else{this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.28);this.enabled=false;}}
 update(weather,night,now){
   if(!this.ctx||!this.enabled)return;
   const t=this.ctx.currentTime;
   this.wind.gain.setTargetAtTime(.028+weather.cloud*.06,t,3);
   this.rain.gain.setTargetAtTime(weather.rain*.15,t,2);
   for(let i=0;i<this.pads.length;i++){
     const p=this.pads[i],target=(i<2?.052:.022)*(night?1.25:1)*(1-weather.rain*.22);
     p.gain.gain.setTargetAtTime(target,t,6);
   }
   this.master.gain.setTargetAtTime(.66,t,.6);
 }
}
