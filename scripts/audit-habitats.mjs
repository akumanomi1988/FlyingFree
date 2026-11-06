import {mkdir,writeFile} from 'node:fs/promises';
import {BIRDS} from '../src/core.js';
import {createBirdBrain} from '../src/behaviour.js';
import {createHabitatMonitor} from '../src/habitatMonitor.js';

// Offline deterministic documentary-ecology audit. Use:
// npm run audit:habitats -- --seconds=1800 --seed=1988 --strict
// Defaults to five simulated minutes per species; 30 minutes for release QA.
const args=process.argv.slice(2);
const readNumber=(name,fallback)=>{
  const arg=args.find(s=>s.startsWith('--'+name+'='));
  return arg?Number(arg.split('=')[1]):fallback;
};
const duration=readNumber('seconds',300),seed=readNumber('seed',1988),strict=args.includes('--strict');
if(!Number.isInteger(seed)||!Number.isFinite(duration)||duration<10||duration>7200)
  throw new RangeError('Use --seconds=10..7200 and --seed=<integer>');
const step=.1,results=[];
for(const profile of BIRDS){
  const brain=createBirdBrain(profile,seed),monitor=createHabitatMonitor(seed,4);
  for(let frame=0;frame<=Math.floor(duration/step);frame++){
    const t=frame*step;
    // Nocturnal birds are awake in lower daylight; otherwise many samples
    // would describe roosting rather than ecological flight occupancy.
    const daylight=profile.id==='owl'?.24:.90;
    const state=brain.update(t,step,daylight,0);
    monitor.observe(t,profile.id,state.x,state.z,state.state);
  }
  const data=monitor.snapshot();
  const expectedOpenOcean=profile.id==='albatross'||profile.id==='gull';
  const minSamples=Math.floor(duration/4*.80);
  const viable=data.samples>=minSamples&&data.flightSamples>0;
  const landSpecies=!expectedOpenOcean;
  const warning=landSpecies&&data.oceanFlightPct!==null&&data.oceanFlightPct>20;
  results.push({...data,species:profile.id,expectedOpenOcean,
    sampleCoverageOK:viable,warnExcessOcean:warning});
  console.log(profile.id.padEnd(13),
    'ocean in flight:',String(data.oceanFlightPct??'n/a').padStart(5)+'%',
    'samples:',data.samples,'states:',data.transitions,
    warning?'WARNING: TOO MUCH OPEN OCEAN':'');
}
const report={generatedAt:new Date().toISOString(),seed,durationSeconds:duration,
  method:'deterministic 100 ms simulation, habitat samples every 4 s, no GPU',
  warnings:results.filter(r=>r.warnExcessOcean).map(r=>r.species),
  allSampled:results.every(r=>r.sampleCoverageOK),results};
await mkdir('artifacts/quality',{recursive:true});
const path=`artifacts/quality/habitats-${seed}.json`;
await writeFile(path,JSON.stringify(report,null,2));
console.log('\nReport saved:',path,'Warnings:',report.warnings.join(', ')||'none');
if(strict&&(!report.allSampled||report.warnings.length))process.exitCode=1;
