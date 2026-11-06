import {habitatAt} from './ecology.js';

const KINDS=['ocean','shore','wetland','forest','meadow','highland','rock'];
const groundStates=new Set(['feed','rest']);

// Lightweight independent observer: diagnostics do NOT steer the simulation.
// It samples actual positions instead of inferring ecology from destination
// weights. Call at frame rate; expensive terrain queries run only ~every 4s.
export function createHabitatMonitor(seed=1988,interval=4){
  if(!Number.isFinite(interval)||interval<=0)throw new RangeError('Invalid sampling interval');
  let species=null,lastTime=-Infinity,samples=0,flightSamples=0;
  let oceanSamples=0,oceanFlightSamples=0,transitions=0,previous=null;
  let counts=Object.fromEntries(KINDS.map(k=>[k,0]));
  function reset(nextSpecies=null){
    species=nextSpecies;lastTime=-Infinity;samples=0;flightSamples=0;
    oceanSamples=0;oceanFlightSamples=0;transitions=0;previous=null;
    counts=Object.fromEntries(KINDS.map(k=>[k,0]));
  }
  function snapshot(){
    return {species,samples,flightSamples,oceanSamples,oceanFlightSamples,
      oceanPct:samples?Math.round(oceanSamples/samples*1000)/10:null,
      oceanFlightPct:flightSamples?Math.round(oceanFlightSamples/flightSamples*1000)/10:null,
      sampleSeconds:interval,transitions,counts:{...counts}};
  }
  function observe(time,id,x,z,state='patrol'){
    if(!Number.isFinite(time)||!Number.isFinite(x)||!Number.isFinite(z)||typeof id!=='string')return null;
    if(id!==species||time<lastTime)reset(id);
    if(time-lastTime<interval)return null;
    const type=habitatAt(x,z,seed).type;
    counts[type]=(counts[type]??0)+1;
    if(previous!==null&&previous!==type)transitions++;
    previous=type;
    samples++;
    if(type==='ocean')oceanSamples++;
    if(!groundStates.has(state)){
      flightSamples++;
      if(type==='ocean')oceanFlightSamples++;
    }
    lastTime=time;
    return snapshot();
  }
  return {observe,snapshot,reset};
}
