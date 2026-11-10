// VE-06: observational evidence only. Never changes BirdBrain or forces a pose.
// Playwright video has NO audio; SwiftShader timing is NOT physical GPU timing.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const secondsArg=process.argv.find(arg=>arg.startsWith('--seconds='));
const durationSeconds=secondsArg?Number(secondsArg.slice('--seconds='.length)):240;
if(!Number.isFinite(durationSeconds)||durationSeconds<5||durationSeconds>3600)
  throw new RangeError('--seconds must be in [5, 3600]');
const readNumber=(flag,fallback)=>{
  const arg=process.argv.find(x=>x.startsWith('--'+flag+'='));
  return arg?Number(arg.slice(flag.length+3)):fallback;
};
const worldSeed=readNumber('seed',1988);
const width=readNumber('width',960),height=readNumber('height',540);
const hardwareRequested=process.argv.includes('--hardware');
if(!Number.isInteger(worldSeed)||worldSeed<0||worldSeed>2147483647)
  throw new RangeError('--seed must be a 32-bit non-negative integer');
if(!Number.isInteger(width)||width<320||width>3840||
   !Number.isInteger(height)||height<240||height>2160)
  throw new RangeError('Resolution must be 320..3840 by 240..2160');
const directory='artifacts/ve06-continuous';
const base='http://127.0.0.1:4174/FlyingFree/';
await fs.mkdir(directory,{recursive:true});
const server=spawn(process.execPath,
  ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1',
    '--port','4174','--strictPort'],{stdio:['ignore','pipe','pipe']});
let serverLog='';
for(const stream of [server.stdout,server.stderr])
  stream.on('data',chunk=>{serverLog+=String(chunk).slice(0,10000);});

const report={
  evidence:'VE-06 real-time, unforced BirdBrain / GLB observation',
  startedAt:new Date().toISOString(),requestedWallSeconds:durationSeconds,
  seed:worldSeed,species:'kingfisher',width,height,
  renderer:hardwareRequested?'Playwright Chromium (hardware requested)':
    'Playwright Chromium SwiftShader (NOT hardware GPU)',
  audio:'not recorded: Playwright recordVideo is video-only',
  outcome:'pending',errors:[],samples:[],behaviourTransitions:[],
  animationTransitions:[],acceptance:{humanVisualReview:false,physicalGpu:false,
    tvDevice:false,completeNaturalBehaviourSequence:false}
};
let browser=null,context=null,page=null,video=null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const percentile=(values,p)=>{
  if(!values.length)return null;
  const ordered=[...values].sort((a,b)=>a-b);
  return +ordered[Math.min(ordered.length-1,Math.max(0,Math.ceil(ordered.length*p)-1))].toFixed(2);
};
async function waitForServer(){
  for(let n=0;n<100;n++){
    try{if((await fetch(base)).ok)return;}catch{}
    if(server.exitCode!==null)break;
    await sleep(250);
  }
  throw new Error('Vite preview unavailable: '+serverLog.slice(-1500));
}
async function observe(){
  await waitForServer();
  const browserArgs=[
    '--no-sandbox','--enable-webgl','--ignore-gpu-blocklist',
    '--enable-precise-memory-info','--autoplay-policy=no-user-gesture-required'
  ];
  if(!hardwareRequested)browserArgs.push('--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader');
  browser=await chromium.launch({headless:true,args:browserArgs});
  context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,
    recordVideo:{dir:directory,size:{width,height}}
  });
  page=await context.newPage();
  video=page.video();
  page.on('pageerror',error=>report.errors.push('pageerror: '+error.message));
  page.on('crash',()=>report.errors.push('Chromium page crash'));
  page.on('console',message=>{
    if(message.type()==='error')
      report.errors.push('console: '+message.text().slice(0,300));
  });
  const response=await page.goto(base+
    '?seed='+worldSeed+'&bird=kingfisher&h=12.5&weather=clear&broadcast=1',
    {waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.asset?.state==='ready' &&
    window.__FLYINGFREE_STATUS__?.animation?.mixers===2 &&
    window.__FLYINGFREE_STATUS__?.frames>=6,null,{timeout:90000});
  if(await page.locator('#skip-location-btn').isVisible())
    await page.locator('#skip-location-btn').click();

  // Verify the actual WebGL implementation; disabling forced SwiftShader
  // alone does not guarantee Chromium is using a physical GPU.
  report.webgl=await page.evaluate(()=>{
    const gl=document.querySelector('#viewport canvas')?.getContext('webgl2');
    const info=gl?.getExtension('WEBGL_debug_renderer_info');
    return {version:gl?.getParameter(gl.VERSION)??null,
      renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):null,
      vendor:info?gl.getParameter(info.UNMASKED_VENDOR_WEBGL):null};
  });
  report.hardwareBackendVerified=Boolean(report.webgl.renderer&&
    !/swiftshader|llvmpipe|software renderer/i.test(report.webgl.renderer));
  if(hardwareRequested)
    assert.ok(report.hardwareBackendVerified,
      'Physical GPU not verified; renderer: '+JSON.stringify(report.webgl));

  // Monitor browser RAF intervals and every actual state transition, including
  // takeoffs that are too brief to appear in a one-second telemetry sample.
  await page.evaluate(()=>{
    const m={intervals:[],behaviourTransitions:[],animationTransitions:[],lastTime:null,
      lastBehaviour:null,lastMode:null,stop:false};
    window.__VE06_EVIDENCE_MONITOR__=m;
    const sample=(t)=>{
      if(m.stop)return;
      if(m.lastTime!==null&&m.intervals.length<50000)
        m.intervals.push(t-m.lastTime);
      m.lastTime=t;
      const s=window.__FLYINGFREE_STATUS__;
      const mode=s?.animation?.mode,behaviour=s?.behaviour;
      if(mode&&mode!==m.lastMode){
        m.animationTransitions.push({wallMs:Math.round(t),
          simulationSeconds:s.animation.simulatedSeconds,mode});
        m.lastMode=mode;
      }
      if(behaviour&&behaviour!==m.lastBehaviour){
        m.behaviourTransitions.push({wallMs:Math.round(t),
          simulationSeconds:s.simulationClock?.seconds,behaviour});
        m.lastBehaviour=behaviour;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  const begun=performance.now();
  let nextSample=begun;
  while(performance.now()-begun<durationSeconds*1000){
    nextSample+=1000;
    await sleep(Math.max(100,Math.min(1000,nextSample-performance.now())));
    const s=await page.evaluate(()=>{
      const v=window.__FLYINGFREE_STATUS__??{};
      const p=v.performance??{},a=v.animation??{},c=v.simulationClock??{};
      return {
        frames:v.frames,simulationSeconds:c.seconds,
        simulationTicks:c.tick,animationSeconds:a.simulatedSeconds,
        fps:v.fps,behaviour:v.behaviour,mode:a.mode,weights:a.weights,
        contact:a.contact,assetState:v.asset?.state,
        visibleMeshes:v.asset?.visibleMeshes,
        glbMixers:a.mixers,drawCalls:p.drawCalls,triangles:p.triangles,
        p95FrameMs:p.p95,p99FrameMs:p.p99,webglGeometries:p.gpuGeometries,
        webglTextures:p.gpuTextures,usedJsHeapBytes:performance.memory?.usedJSHeapSize??null,
        framing:v.framing,error:v.error
      };
    });
    s.wallSeconds=+(performance.now()-begun).toFixed(1)/1000;
    report.samples.push(s);
    if(s.error)report.errors.push('engine: '+String(s.error));
    if(s.assetState!=='ready'||!(s.visibleMeshes>0)||s.glbMixers!==2)
      report.errors.push('GLB dropped out of active animation at '+s.wallSeconds+'s');
    if(report.errors.length)break;
  }
  report.actualWallSeconds=+(performance.now()-begun).toFixed(2)/1000;
  const monitor=await page.evaluate(()=>{
    const m=window.__VE06_EVIDENCE_MONITOR__;
    m.stop=true;
    return {intervals:m.intervals,behaviourTransitions:m.behaviourTransitions,
      animationTransitions:m.animationTransitions};
  });
  report.behaviourTransitions=monitor.behaviourTransitions;
  report.animationTransitions=monitor.animationTransitions;
  const intervals=monitor.intervals.filter(x=>Number.isFinite(x)&&x>0);
  report.rafTiming={
    samples:intervals.length,p50Ms:percentile(intervals,.5),
    p95Ms:percentile(intervals,.95),p99Ms:percentile(intervals,.99),
    slowerThan30FpsFraction:intervals.length?
      +(intervals.filter(x=>x>1000/30).length/intervals.length).toFixed(4):null,
    note:hardwareRequested?'Browser RAF on verified WebGL hardware; not GPU timing queries':
      'Browser RAF / software renderer, not physical GPU'
  };
  // End-to-end accounting catches telemetry that hides long frames by
  // clamping the denominator (previously reported 4 vs ~2.8 real FPS).
  const a=report.samples[10]??report.samples[0];
  const b=report.samples.at(-10)??report.samples.at(-1);
  const actualFps=(b.frames-a.frames)/(b.wallSeconds-a.wallSeconds);
  const reportedFps=percentile(report.samples.map(s=>s.fps)
    .filter(Number.isFinite),.5);
  report.fpsAccuracy={
    measuredFromFrames:+actualFps.toFixed(2),
    medianRuntimeReported:reportedFps,
    tolerance:'max(0.6 FPS, 30% of observed FPS)'
  };
  assert.ok(Math.abs(reportedFps-actualFps)<=Math.max(.6,actualFps*.3),
    'Runtime FPS telemetry disagrees with frame count and real wall time: '+
    JSON.stringify(report.fpsAccuracy));
  const clips=['flap','glide','takeoff','landing','perch','rest'];
  const modes=new Set(monitor.animationTransitions.map(x=>x.mode));
  report.acceptance.observedAnimationModes=[...modes];
  report.acceptance.missingNaturalModes=clips.filter(mode=>!modes.has(mode));
  report.acceptance.completeNaturalBehaviourSequence=
    report.acceptance.missingNaturalModes.length===0;
  report.acceptance.humanVisualReview=false;
  report.acceptance.physicalGpu=false;
  report.acceptance.tvDevice=false;
  assert.ok(report.samples.length>=Math.floor(durationSeconds*.7),
    'Not enough continuous telemetry samples');
  assert.ok(report.actualWallSeconds>=durationSeconds-1,
    'Recording stopped before requested wall time');
  assert.ok(report.samples.at(-1).frames>report.samples[0].frames,
    'World froze during recording');
  assert.deepEqual(report.errors,[],'Browser errors or GLB fallback during capture');
  report.outcome='captured; human and hardware acceptance pending';
}

try{
  await observe();
}catch(error){
  report.outcome='failed';
  report.failure=String(error?.stack??error);
  console.error(error);
  process.exitCode=1;
}finally{
  try{
    if(page&&!page.isClosed())await page.close();
    if(context)await context.close();
    if(video){
      const output=directory+'/kingfisher-natural-'+durationSeconds+'s.webm';
      const originalPath=await video.path();
      await video.saveAs(output);
      if(originalPath!==output)await fs.rm(originalPath,{force:true});
      report.videoPath=output;
      report.videoBytes=(await fs.stat(output)).size;
    }
  }catch(error){
    report.errors.push('video artifact: '+String(error));
    report.outcome='failed';process.exitCode=1;
  }
  report.finishedAt=new Date().toISOString();
  await fs.writeFile(directory+'/report.json',JSON.stringify(report,null,2));
  if(browser)await browser.close();
  server.kill('SIGTERM');
  console.log(JSON.stringify({outcome:report.outcome,wall:report.actualWallSeconds,
    videoBytes:report.videoBytes,raf:report.rafTiming,acceptance:report.acceptance,
    errors:report.errors},null,2));
}