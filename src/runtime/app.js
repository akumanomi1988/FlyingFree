import * as THREE from 'three';
import {TAU,clamp,lerp,smooth,random,fbm,terrainHeight,BIRDS,WEATHER,chooseBird,chooseWeather,sunPosition,readOptions} from '../core.js';
import {Soundscape} from '../audio.js';
import {createBirdRig,animateBirdRig} from '../flight.js';
import {BirdAssetLibrary,REFERENCE_ASSETS,canUseBirdAssets} from '../assets/BirdAssetLibrary.js';
import {BirdAnimationController} from '../animation/BirdAnimationController.js';
import {createEcosystem} from '../ecosystem.js';
import {createSky,createPrecipitation} from '../renderfx.js';
import {createBirdBrain} from '../behaviour.js';
import {createGroundDetail} from '../vegetation.js';
import {createWindField} from '../worldMotion.js';
import {createFrameTelemetry} from '../frameTelemetry.js';
import {createAdaptiveResolution} from '../adaptiveResolution.js';
import {createAtmospherics,starOpacityAt} from '../atmospherics.js';
import {habitatAt} from '../ecology.js';
import {createHabitatMonitor} from '../habitatMonitor.js';
import {TROPICAL_WORLD} from '../tropicalTerrain.js';
import {createCameraDirector} from '../cameraDirector.js';
import {createMinimap,sessionIslandSeed} from '../minimap.js';
import {birdSensation} from '../birdEcology.js';
import {createBirdForageVisuals} from '../birdForageVisuals.js';
import {createBirdRestVisuals} from '../birdRestVisuals.js';
import {createRegionalBirds} from '../regionalBirds.js';
import {createRiverEcosystem} from '../riverEcosystem.js';
import {createWildlifeObservatory} from '../wildlifeObservatory.js';
import {birdCameraDistance} from '../worldScale.js';
import {createLiveClimate,approximateSolarCoordinates,WEATHER_REFRESH_MS} from '../localClimate.js';
import {localHour,withLocalHour,seasonLocal,astronomicalPhase,localTimeLabel,localDateLabel} from '../localTime.js';

import {createBrowserEnvironment} from './browserEnvironment.js';
import {createEventScope} from './eventScope.js';
import {createFrameLoop} from './frameLoop.js';
import {createFixedStepClock,FIXED_SIMULATION_DT} from './fixedClock.js';
import {captureSimulationSnapshot} from './simulationSnapshot.js';
import {createBrowserScene,disposeBrowserScene} from './sceneAdapter.js';
import {createBrowserUI} from './browserUI.js';
import {buildWorld} from './worldBuilder.js';
import {createPhysicsWorld} from '../physics/PhysicsWorld.js';

export function createFlyingFreeApplication({environment=createBrowserEnvironment(),seed=null,services={}}={}){
  const {window,document,location,navigator}=environment;
const $=(id)=>document.getElementById(id), opts=readOptions(location.search);
const status={version:'0.5.0',ready:false,frames:0,fps:0,error:null,scene:null};
window.__FLYINGFREE_STATUS__=status;
let renderer,scene,camera,sunLight,moonLight,hemi,water,terrain,worldQuery,forest,forestVisibility,cloudField,birdModel,clouds=[],stars,starMat,sunOrb,moonOrb;
let ecosystem,skyFX,oceanFX,rainFX,birdBrain,groundDetail,sunHalo,moonHalo,atmospherics,treeDetail,rivers,cliffs,cameraDirector,forageVisuals,restVisuals,regionalBirds,riverHabitat,wildlifeObservatory,lastBirdAction=null;
const windField=services.windField??createWindField();
const frameTelemetry=createFrameTelemetry(600);
const simulationClock=createFixedStepClock();
let previousPose=null,currentPose=null,userPaused=false;
let physicsWorld=null,physicsPending=null;
const assetLibrary=services.birdAssets??new BirdAssetLibrary({
  basePath:(import.meta.env?.BASE_URL??'/')+'assets/birds/',maxIdle:2
});
let activeBirdAsset=null,activeBirdAnimation=null,assetGeneration=0;
function releaseBirdAsset(){
  assetGeneration++;
  activeBirdAnimation?.dispose();
  activeBirdAnimation=null;
  status.animation=null;
  if(!activeBirdAsset)return;
  activeBirdAsset.model.parent?.remove(activeBirdAsset.model);
  activeBirdAsset.release();
  activeBirdAsset=null;
}
function requestBirdAsset(rig,profile){
  const revision=++assetGeneration;
  const deviceEligible=canUseBirdAssets({
    renderer,navigator,search:location.search
  });
  if(!REFERENCE_ASSETS[profile.id]||!deviceEligible){
    status.asset={state:'procedural',species:profile.id};
    // Keep the reference GLB warm when selecting a different procedural bird:
    // maxIdle=2 caps the cache at one LOD pair. Only flush proactively when
    // GLB rendering has been disabled by device constraints or user opt-out.
    if(!deviceEligible)assetLibrary.clearUnused?.();
    return;
  }
  status.asset={state:'loading',species:profile.id};
  void assetLibrary.acquire(profile.id).then(handle=>{
    if(disposed||revision!==assetGeneration||birdModel!==rig){
      handle.release();return;
    }
    // Build and validate both anatomical LODs BEFORE hiding the fallback.
    // A failed or incompatible GLB must never leave the bird invisible.
    let animation;
    try{
      animation=new BirdAnimationController(handle.model,{query:worldQuery});
      animation.sync(lastBirdAction??{state:'patrol'},elapsed);
      // The procedural parent rig is scaled; GLB geometry is authored in metres.
      handle.model.scale.setScalar(1/rig.scale.x);
      // Capture the procedural meshes BEFORE attaching the GLB. Traversing
      // rig afterwards hides the skinned asset as well, despite a live mixer.
      const proceduralMeshes=[];
      rig.traverse(obj=>{if(obj.isMesh)proceduralMeshes.push(obj);});
      if(!proceduralMeshes.length)throw new Error('Missing procedural fallback');
      rig.add(handle.model);
      for(const mesh of proceduralMeshes)mesh.visible=false;
      let visibleMeshes=0;
      handle.model.levels[0].object.traverse(obj=>{
        if(obj.isMesh&&obj.visible)visibleMeshes++;
      });
      if(!visibleMeshes){
        for(const mesh of proceduralMeshes)mesh.visible=true;
        rig.remove(handle.model);
        throw new Error('VE-06 GLB has no visible LOD0 meshes');
      }
      activeBirdAsset=handle;
      activeBirdAnimation=animation;
      status.animation=animation.snapshot;
      status.asset={state:'ready',species:profile.id,
        visibleMeshes,...handle.statistics,cache:assetLibrary.stats};
    }catch(error){
      animation?.dispose();
      handle.release();
      throw error;
    }
  }).catch(error=>{
    if(!disposed&&revision===assetGeneration){
      status.asset={state:'fallback',species:profile.id,reason:String(error)};
    }
  });
}
let scaleFactor=1,adaptiveResolution,lastWeatherAutoAt=0,manuallySelected=!!opts.bird,
  pendingSnapshot=false,pendingRenderProbe=null;
const climate=services.climate??createLiveClimate({clock:environment.epoch});
let solarCoordinates=approximateSolarCoordinates();
let timeOverride=opts.hour!=null||Boolean(opts.phase);
let weatherOverride=Boolean(opts.weather);
let simMs=opts.hour!=null?withLocalHour(new Date(environment.epoch()),opts.hour).getTime():
 opts.phase?withLocalHour(new Date(environment.epoch()),astronomicalPhase(new Date(environment.epoch()),opts.phase,solarCoordinates.latitude,solarCoordinates.longitude)).getTime():environment.epoch();
const worldSeed=opts.seed??seed??sessionIslandSeed();
const habitatMonitor=createHabitatMonitor(worldSeed);
const minimap=createMinimap($('map-canvas'),worldSeed);
$('mini-map').title='Isla · semilla '+worldSeed;
let climatePending=false,climateInitialRestore=false,climateAttempt=0,climateMessage='Clima simulado · activar datos reales',tvActive=false,controlsTimeout=null,wakeLock=null;

let currentBird=opts.bird||chooseBird(new Date(simMs));
let currentWeather=opts.weather||chooseWeather(new Date(simMs));
let speed=1,flapBoost=0,lastFrame=environment.now(),elapsed=0,cameraLook=new THREE.Vector3(0,150,0),sleepFactor=0;
const lastCameraBird=new THREE.Vector3();let cameraBirdTracked=false;
const framingProbe=new THREE.Vector3();
let weatherState={cloud:currentWeather.cloud,rain:currentWeather.rain,fog:currentWeather.fog},renderFrames=0,fpsTimer=0,lastClimatePoll=0;
const sound=services.sound??new Soundscape();
const canvasParent=$('viewport');
const skyDay=new THREE.Color('#78b2c7'),skyEvening=new THREE.Color('#c48c75'),skyNight=new THREE.Color('#142c46');
const waterDay=new THREE.Color('#286e7c'),waterNight=new THREE.Color('#102d47');

function init(){
  const maxScale=Math.min(window.devicePixelRatio||1,environment.width()<700?1:1.15,
    Math.sqrt(3_000_000/Math.max(1,environment.width()*environment.height())));
  const minScale=Math.min(.48,maxScale);
  // Start with a sane raster budget, then restore detail only on hardware
  // that actually proves it can maintain a smooth documentary framerate.
  scaleFactor=Math.max(minScale,Math.min(maxScale,environment.width()<700?.86:.84,
    Math.sqrt(1_450_000/Math.max(1,environment.width()*environment.height()))));
  adaptiveResolution=createAdaptiveResolution({
    maxScale,minScale,initialScale:scaleFactor,
    downFps:29,downP95Ms:44,upFps:38,upP95Ms:29,
    severeFps:22,severeFactor:.74,
    downHold:2,upHold:24,cooldownSeconds:3
  });
  ({renderer,scene,camera,hemi,sunLight,moonLight,sunHalo,moonHalo,sunOrb,moonOrb}=
    (services.createScene??createBrowserScene)({THREE,document,parent:canvasParent,
      width:environment.width(),height:environment.height(),pixelRatio:scaleFactor,skyDay}));
  ({terrain,water,oceanFX,rivers,cliffs,worldQuery,forest,forestVisibility,treeDetail,
    cloudField,clouds,stars,starMat}=(services.buildWorld??buildWorld)({
      THREE,scene,worldSeed,width:environment.width(),windField,adaptiveResolution,scaleFactor
    }));
  createBird();
  riverHabitat=createRiverEcosystem(THREE,scene,worldSeed,environment.width()<720?.65:1);
  regionalBirds=createRegionalBirds(THREE,scene,worldSeed,environment.width()<720?.68:1);
  forageVisuals=createBirdForageVisuals(THREE,scene,worldSeed);
  restVisuals=createBirdRestVisuals(THREE,scene);
  const qaShot=opts.selftest?new URLSearchParams(location.search).get('qaShot'):null;
  cameraDirector=createCameraDirector(THREE,terrainHeight,worldSeed,{qaShot,worldQuery});
  const startSun=sunPosition(new Date(simMs),solarCoordinates.latitude,solarCoordinates.longitude);
  const startPos=birdBrain.update(0,0,startSun.daylight,0);
  lastBirdAction=startPos;previousPose={...startPos};currentPose={...startPos};
  birdModel.position.set(startPos.x,startPos.y,startPos.z);
  const heading=new THREE.Vector3(-Math.sin(startPos.heading),0,-Math.cos(startPos.heading));
  const startDistance=birdCameraDistance(currentBird);
  camera.position.copy(birdModel.position).addScaledVector(heading,-startDistance).add(new THREE.Vector3(startDistance*.3,startDistance*.25,0));
  lastCameraBird.copy(birdModel.position);cameraBirdTracked=true;
  cameraLook.set(startPos.x,startPos.y,startPos.z);
  camera.lookAt(cameraLook);
  ecosystem=createEcosystem(THREE,scene,worldSeed,environment.width()<720?.65:1,startPos,worldQuery);
  wildlifeObservatory=createWildlifeObservatory(THREE,{terrainHeight:(x,z)=>worldQuery?.heightAt(x,z)??terrainHeight(x,z,worldSeed),seed:worldSeed});
  regionalBirds.update(0,startPos,camera.position,startSun.daylight,0);
  groundDetail=createGroundDetail(THREE,scene,environment.width()<720?.5:1,windField,worldSeed);
  atmospherics=createAtmospherics(THREE,scene,environment.width()<720?.56:1);
  skyFX=createSky(THREE,scene);
  rainFX=createPrecipitation(THREE,scene,environment.width()<720?.7:1);
  status.fauna={...ecosystem.stats,riverFish:riverHabitat.stats.fish,
    riverReeds:riverHabitat.stats.reeds,regionalBirds:regionalBirds.stats.population};
  status.world={seed:worldSeed,extent:TROPICAL_WORLD.extent,riverChannels:rivers.channels,riverSegments:rivers.segments,
    coastSeed:oceanFX.bathymetry.seed,coastResolution:oceanFX.bathymetry.resolution,
    cliffStacks:cliffs.count};
  status.worldQuery=worldQuery?.stats??null;
  status.faunaLOD=ecosystem.lodStats;
  status.simulationClock=simulationClock.snapshot();
  status.habitatUse=habitatMonitor.snapshot();
  // Publish capabilities immediately; rolling metrics gain samples as frames arrive.
  status.treeDetail={active:treeDetail.active,capacity:treeDetail.poolCapacity,
    fadeDistance:treeDetail.fadeDistance,radius:680};
  status.performance={...frameTelemetry.snapshot(),drawCalls:0,triangles:0,points:0,lines:0};
  status.adaptiveQuality=adaptiveResolution.snapshot();
  events.on(window,'resize',onResize,{passive:true});
  ui.bind();onResize();status.ready=true;status.scene={terrain:true,forest:true,bird:true,water:true,clouds:true,stars:true,fauna:true,sky:true,rain:true};
  if(opts.broadcast){$('intro').classList.add('off');document.body.classList.add('no-ui');}
  if(opts.tv)setTVMode(true);
  // Normal visits wait for the explicit choice on the intro screen.
  // TV/broadcast may reuse a permission already granted, without prompting.
  if(opts.broadcast||opts.tv)void connectClimate(true);
  // Prevent WASM timing from changing which simulation ticks use Rapier.
  // Both success and explicit fallback start the first tick from zero.
  const startSimulation=()=>{
    if(disposed)return;
    lastFrame=environment.now();
    simulationClock.resync(lastFrame);
    loop.start();
    if(opts.selftest)selfTestTimeout=environment.setTimeout(selfTestWhenReady,2500);
  };
  if(worldQuery?.sources?.length){
    status.physics={state:'loading',activeBodies:0};
    physicsPending=createPhysicsWorld({query:worldQuery,limits:{maxBodies:environment.width()<720?4:8}}).then(world=>{
      if(disposed){world.dispose();return;}
      physicsWorld=world;status.physics={state:'active',...world.stats};
    }).catch(error=>{
      status.physics={state:'fallback',activeBodies:0,reason:String(error)};
    }).finally(startSimulation);
  }else{
    status.physics={state:'fallback',activeBodies:0,reason:'WorldQuery unavailable'};
    startSimulation();
  }
}
function createBird(){
  const previousPosition=birdModel?.position.clone();
  releaseBirdAsset();
  if(birdModel){
    scene.remove(birdModel);
    // Repeated species changes must not leak GPU buffers and materials.
    const geometries=new Set(),materials=new Set();
    birdModel.traverse(obj=>{
      if(obj.isMesh){geometries.add(obj.geometry);
        for(const material of Array.isArray(obj.material)?obj.material:[obj.material])materials.add(material);
      }
    });
    for(const geo of geometries)geo.dispose();
    for(const mat of materials)mat.dispose();
  }
  birdModel=createBirdRig(THREE,currentBird);
  // Species start in their own suitable biome, never inherit the previous
  // bird's coordinates or its energy/hunger. This is a new wildlife subject.
  birdBrain=createBirdBrain(currentBird,worldSeed,null,{perches:forest?.perches,query:worldQuery});
  habitatMonitor.reset(currentBird.id);
  cameraDirector?.reset();
  if(previousPosition){
    const start=birdBrain.snapshot;
    birdModel.position.set(start.x,start.y,start.z);
    const span=birdCameraDistance(currentBird);
    camera.position.set(start.x+span*.38,start.y+span*.29,start.z+span*1.65);
    camera.quaternion.setFromEuler(new THREE.Euler(0,0,0));
  }
  scene.add(birdModel);
  requestBirdAsset(birdModel,currentBird);
  status.bird=currentBird.id;
  const initialBird=birdBrain.snapshot;
  previousPose={...initialBird};currentPose={...initialBird};lastBirdAction=null;
  status.birdPosition={x:initialBird.x,z:initialBird.z,heading:initialBird.heading};
  status.energy=initialBird.energy;status.hunger=initialBird.hunger;
  status.sensation=birdSensation({energy:initialBird.energy,hunger:initialBird.hunger,state:'patrol'});
  minimap.update(initialBird.x,initialBird.z,initialBird.heading);
  $('bird-energy').value=initialBird.energy;
  $('bird-energy-pct').textContent=Math.round(initialBird.energy*100)+'%';
  $('bird-hunger').value=1-initialBird.hunger;
  $('bird-hunger-pct').textContent=Math.round((1-initialBird.hunger)*100)+'%';
  $('bird-mood').textContent=status.sensation;
  status.birdDrawCallsSaved=birdModel.userData.plumageDrawCallsSaved;
}
function selectBird(id){
  const bird=BIRDS.find(b=>b.id===id);
  if(!bird)return;
  currentBird=bird;manuallySelected=true;sleepFactor=0;
  createBird();$('bird-name').textContent=bird.name;
  $('bird-habitat').textContent=bird.habitat;
  $('bird-description').textContent=bird.detail;
  for(const button of document.querySelectorAll('[data-bird]')){
    button.classList.toggle('selected',button.dataset.bird===id);
    button.setAttribute('aria-pressed',String(button.dataset.bird===id));
  }
  $('bird-picker').classList.add('hidden');
}
function ambient(date,dt,renderTime=elapsed){
  const sun=sunPosition(date,solarCoordinates.latitude,solarCoordinates.longitude),day=sun.daylight,alt=sun.altitude;
  // Weather transitions update only on ecological ticks.
  const cloud=weatherState.cloud,wet=weatherState.rain,night=sun.night;
  const lightning=currentWeather.id==='storm'&&Math.sin(renderTime*.59)*Math.sin(renderTime*1.73)>.994?1.25:0;
  const color=skyNight.clone().lerp(skyEvening,clamp((day+.1)*sun.golden,0,1)).lerp(skyDay,day*(1-sun.golden*.65));
  color.lerp(new THREE.Color('#344a58'),cloud*.31);
  scene.background.copy(color);scene.fog.color.copy(color);
  scene.fog.density=.00008+weatherState.fog*.00036+cloud*.000038;
  renderer.toneMappingExposure=1.14+day*.28;
  sunLight.intensity=Math.max(0,.68+day*(2.30-cloud*1.35)+lightning);
  hemi.intensity=1.05+day*(1.27-cloud*.50)+lightning*.2;
  moonLight.intensity=(1-day)*(.65-cloud*.30);
  moonLight.position.set(-Math.sin(sun.azimuth)*2000,Math.max(350,-Math.sin(alt)*2000),Math.cos(sun.azimuth)*2000);
  const warm=sun.golden*day;
  sunLight.color.setRGB(.69+day*.31,.77+day*.16-warm*.18,.89+day*.03-warm*.33);
  const sunVec=new THREE.Vector3(Math.sin(sun.azimuth)*Math.cos(alt),Math.sin(alt),-Math.cos(sun.azimuth)*Math.cos(alt));
  sunLight.position.copy(sunVec).multiplyScalar(2000);
  sunOrb.position.copy(camera.position).addScaledVector(sunVec,6800);
  sunOrb.visible=alt>-.07;
  moonOrb.position.copy(camera.position).addScaledVector(sunVec,-6750);
  moonOrb.visible=alt<.11;
  stars.position.copy(camera.position);
  starMat.opacity=starOpacityAt(alt,Math.max(cloud,currentWeather.cloud),Math.max(wet,currentWeather.rain));
  status.starOpacity=starMat.opacity;
  const cloudTint=new THREE.Color(0xdde4e6).lerp(new THREE.Color(0xffc29a),sun.golden*.52*day);
  cloudField.update(renderTime,cloud,day,cloudTint);
  sunHalo.position.copy(sunOrb.position);sunHalo.visible=sunOrb.visible;
  sunHalo.material.opacity=clamp(day*(1-cloud*.7),0,1);
  moonHalo.position.copy(moonOrb.position);moonHalo.visible=moonOrb.visible;
  skyFX.update(camera,sun,weatherState);
  windField.update(renderTime,weatherState);
  sound.update(weatherState,sun,currentWeather.id);
  return sun;
}
function stepBird(dt,sun){
  const day=smooth(-.14,.045,sun.altitude);
  const action=birdBrain.update(elapsed,dt,day,weatherState.rain);
  previousPose=currentPose??action;currentPose={...action};lastBirdAction=action;
  activeBirdAnimation?.sync(action,elapsed);
  status.restSiteKind=action.restSite?.kind??null;
  status.rests=action.rests;status.grounded=action.grounded;
  status.feedingProgress=+action.feedingProgress.toFixed(2);
  status.behaviour=action.state;status.flightSpeed=Math.round(action.speed*3.6);
  status.hunger=+action.hunger.toFixed(2);status.energy=+action.energy.toFixed(2);
  status.landings=action.landings;status.feedings=action.feedings;
  status.floating=Boolean(action.floating);
  status.sensation=birdSensation({energy:action.energy,hunger:action.hunger,state:action.state,
    floating:action.floating,weather:weatherState.rain});
  status.birdPosition={x:action.x,z:action.z,heading:action.heading};
  const occupancy=habitatMonitor.observe(elapsed,currentBird.id,action.x,action.z,action.state);
  if(occupancy)status.habitatUse=occupancy;
  return action;
}
function renderBird(time,frameDt,alpha){
  const action=lastBirdAction??birdBrain.snapshot;
  const from=previousPose??action,to=currentPose??action;
  const blend=clamp(alpha,0,1);
  const headingDiff=Math.atan2(Math.sin(to.heading-from.heading),Math.cos(to.heading-from.heading));
  birdModel.position.set(lerp(from.x,to.x,blend),
    lerp(from.y,to.y,blend)+(action.grounded?0:Math.sin(time*3.2)*currentBird.wingspan*.012),
    lerp(from.z,to.z,blend));
  birdModel.rotation.y=from.heading+headingDiff*blend;
  animateBirdRig(birdModel,time,{energy:action.flapping?.89:.40,sleeping:action.wingsFolded,
    bank:action.bank,pitch:action.pitch,grounded:action.grounded,speed:action.speed,
    floating:action.floating,waterPitch:action.waterPitch,waterRoll:action.waterRoll,
    state:action.state,food:action.food,feedingProgress:action.feedingProgress},frameDt);
  // GLB skeleton takes its intent from the *fixed-tick* BirdBrain state.
  // The mixer seeks an absolute simulation time: no render-delta drift.
  if(activeBirdAnimation){
    status.animation=activeBirdAnimation.render(time,{
      position:birdModel.position,heading:birdModel.rotation.y,
      brain:action,query:worldQuery,scale:birdModel.scale.x
    });
  }
  const visibleResource=forageVisuals?.update({...action,wingspan:currentBird.wingspan,rain:weatherState.rain},time);
  const visibleRest=restVisuals?.update(action,camera.position);
  status.perchVisible=Boolean(visibleRest?.visible);
  status.foodVisible=Boolean(visibleResource?.visible);
  status.foodKind=visibleResource?.kind??null;
  return birdModel.position;
}
function directCamera(bird,dt,wildlifeFocus=null,renderTime=elapsed){
  const frame=cameraDirector.update(camera,bird,birdModel.rotation.y,
    birdBrain.snapshot.velocity,status.behaviour,currentBird.wingspan,renderTime,dt,
    lastBirdAction?.foodTarget,wildlifeFocus);
  status.cameraShot=frame.shot;
  status.camera={shot:frame.shot,reason:frame.reason,transitions:frame.transitions,
    terrainRelief:Math.round(frame.relief),altitudeAGL:Math.round(frame.groundClearance),
    turnSpeed:Math.round(frame.turnSpeed*1000)/1000};
}
function updateSea(t,dt,sun){
  oceanFX.update(t,sun,weatherState,scene.fog.color);
  rivers.update(t);
  rainFX.update(t,dt,camera,weatherState.rain,Math.sin(t*.1)*30+weatherState.cloud*22);
}
// All ecological state advances at 30 Hz, independently from render FPS.
function simulateStep(dt,tick,simTime){
  elapsed=simTime;
  if(timeOverride)simMs+=dt*1000*speed;
  else simMs=environment.epoch();
  const date=new Date(simMs);
  if(!manuallySelected){
    const dailyBird=chooseBird(date);
    if(dailyBird!==currentBird){currentBird=dailyBird;createBird();ui.refreshPicker();}
  }
  if(!climate.weather&&elapsed>300&&elapsed-lastWeatherAutoAt>300){
    const rng=random(Math.floor(simMs/86400000) ^ Math.floor(elapsed/300)*117);
    currentWeather=WEATHER[Math.floor(rng()*WEATHER.length)];
    lastWeatherAutoAt=elapsed;
  }
  const weatherEase=1-Math.exp(-dt/16);
  for(const prop of ['cloud','rain','fog'])
    weatherState[prop]=lerp(weatherState[prop],currentWeather[prop],weatherEase);
  const sun=sunPosition(date,solarCoordinates.latitude,solarCoordinates.longitude);
  const action=stepBird(dt,sun);
  // Render observer controls visual LOD; identity/assignment uses the stable bird state.
  ecosystem.update(simTime,sun.daylight,weatherState.cloud,action,weatherState.rain,camera.position,action);
  if(physicsWorld){
    const physics=physicsWorld.step(ecosystem.actors,action,dt,
      {bird:action,profile:currentBird,time:simTime,rain:weatherState.rain});
    currentPose={...action};
    status.physics={state:'active',...physics};
  }
}
function animate(now){
  const deltaRaw=Math.max(0,(now-lastFrame)/1000);
  const frameDt=Math.min(deltaRaw,.10);
  lastFrame=now;
  if(!Number.isFinite(frameDt))return;
  if(!document.hidden)frameTelemetry.record(deltaRaw*1000);
  const clock=simulationClock.advance(now,simulateStep);
  status.simulationClock=clock;
  const date=new Date(timeOverride?simMs:environment.epoch());
  // Weather polling uses wall-clock time even while ecological ticks are paused.
  if(climate.enabled&&!climatePending&&
     environment.epoch()-lastClimatePoll>=(climate.weather?WEATHER_REFRESH_MS:60_000))
    void pollClimate();
  const visualTime=clock.paused?clock.seconds:
    Math.max(0,clock.seconds-FIXED_SIMULATION_DT*(1-clock.alpha));
  const sun=ambient(date,frameDt,visualTime);
  const position=renderBird(visualTime,frameDt,clock.alpha);
  atmospherics.update(visualTime,camera,position,sun.daylight,weatherState);
  const wildlifeFrame=wildlifeObservatory.update(visualTime,ecosystem.observableAnimals,camera,position,environment.height());
  // Camera must use actual visual wall delta, not capped animation delta,
  // so portrait composition recovers after slow software-rendered frames.
  directCamera(position,Math.min(deltaRaw,.25),wildlifeFrame.focus,visualTime);
  forestVisibility.update(camera.position,visualTime);
  regionalBirds.update(visualTime,position,camera.position,sun.daylight,weatherState.rain);
  riverHabitat.update(visualTime,camera.position);
  treeDetail.update(camera.position,visualTime);
  groundDetail.update(visualTime,camera,position,sun.daylight,weatherState.rain,climate.weather?.temperature??18);
  updateSea(visualTime,frameDt,sun);
  renderer.render(scene,camera);
  // One-shot real WebGL pixel probe, immediately after rendering.
  if(pendingRenderProbe){
    const resolve=pendingRenderProbe;
    pendingRenderProbe=null;
    resolve(sampleRenderedFrame());
  }
  if(pendingSnapshot)captureRenderedFrame();
  // Count the full observed wall interval for FPS. Capping at 250 ms
  // falsely reports >=4 FPS on slow/software-rendered GPUs (VE-06 QA).
  status.frames++;renderFrames++;fpsTimer+=deltaRaw;
  if(fpsTimer>=1){
    const measuredSeconds=fpsTimer;
    status.fps=Math.round(renderFrames/measuredSeconds);
    $('fps').textContent=status.fps+' FPS';renderFrames=0;fpsTimer=0;
    const hour=localHour(date,climate.weather?.timeZone);
    $('clock').textContent=localTimeLabel(date,climate.weather?.timeZone);
    $('bird-name').textContent=currentBird.name;
    $('weather-name').textContent=currentWeather.name;
    $('season-name').textContent=seasonLocal(date,solarCoordinates.latitude);
    $('speed-name').textContent='×'+speed;
    const habitat=habitatAt(position.x,position.z,worldSeed);
    const biomeName={ocean:'Mar',shore:'Costa',wetland:'Humedal',forest:'Bosque',
      meadow:'Pradera',highland:'Montaña',rock:'Cumbre'}[habitat.type]||habitat.type;
    $('scene-caption').textContent=biomeName;
    $('phase').textContent=currentBird.name.toUpperCase()+' · '+status.sensation.toUpperCase();
    $('bird-mood').textContent=status.sensation;
    $('bird-activity').textContent=Math.round(status.flightSpeed)+' km/h';
    $('bird-energy').value=status.energy;
    $('bird-energy-pct').textContent=Math.round(status.energy*100)+'%';
    $('bird-hunger').value=1-status.hunger;
    $('bird-hunger-pct').textContent=Math.round((1-status.hunger)*100)+'%';
    minimap.update(position.x,position.z,birdModel.rotation.y);
    // Real camera-space framing, not an inferred "bird is nearby" proxy.
    // Available to deterministic WebGL QA and runtime diagnostics.
    framingProbe.copy(birdModel.position).project(camera);
    status.framing={x:+framingProbe.x.toFixed(3),y:+framingProbe.y.toFixed(3),
      depth:+framingProbe.z.toFixed(3),distance:+camera.position.distanceTo(birdModel.position).toFixed(2),
      cameraY:+camera.position.y.toFixed(2),birdY:+birdModel.position.y.toFixed(2),fov:+camera.fov.toFixed(1),
      cameraClearance:+(camera.position.y-(worldQuery?.heightAt(camera.position.x,camera.position.z)??terrainHeight(camera.position.x,camera.position.z,worldSeed))).toFixed(2),
      birdClearance:+(birdModel.position.y-(worldQuery?.heightAt(birdModel.position.x,birdModel.position.z)??terrainHeight(birdModel.position.x,birdModel.position.z,worldSeed))).toFixed(2)};
    status.time=date.toISOString();status.sunAltitude=sun.altitude;
    status.bird=currentBird.id;status.weather=currentWeather.id;
    status.weatherBlend={...weatherState};
    status.performance={...frameTelemetry.snapshot(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,lines:renderer.info.render.lines,gpuGeometries:renderer.info.memory.geometries,gpuTextures:renderer.info.memory.textures};
    status.treeDetail={active:treeDetail.active,capacity:treeDetail.poolCapacity,
    fadeDistance:treeDetail.fadeDistance,radius:680};
    status.faunaLOD=ecosystem.lodStats;
    status.riverGeometry=rivers.stats;
     status.worldQuery=worldQuery?.stats??null;
    status.wildlifePopulation=ecosystem.populationStats;
    status.marinePopulation=ecosystem.marinePopulationStats;
    status.wildlifeVisibility=wildlifeObservatory.stats;
    status.forestVisibility=forestVisibility.stats;
    status.performanceTarget={fps:30,frameBudgetMs:33.33,
      p95Ms:status.performance.p95,withinBudget:status.performance.p95<=33.33};
    status.regionalBirds=regionalBirds.stats;
    status.riverLife={...riverHabitat.stats,visibleFish:riverHabitat.visibleFish};
    status.renderScale=scaleFactor;status.groundDetail=groundDetail.active;status.insectCount=groundDetail.insectCount;
    status.cloudDrawCalls=cloudField.stats.drawCalls;
    status.motion={wind:+windField.strength.toFixed(2),windMaterials:windField.materials,
      clouds:clouds.length,articulatedAnimals:ecosystem.actors.length,motes:atmospherics.activeCount};
    status.sunAccurate=Boolean(solarCoordinates.accurate);
    status.timeMode=timeOverride?'simulated':'live';
    updateWeatherUI(date);
    const quality=adaptiveResolution.observe({
      fps:status.fps,p95Ms:status.performance.p95,seconds:measuredSeconds,hidden:document.hidden
    });
    if(quality.changed){
      scaleFactor=quality.scale;
      forestVisibility.setQuality(scaleFactor/adaptiveResolution.snapshot().maxScale);
      renderer.setPixelRatio(scaleFactor);onResize();
    }
    status.adaptiveQuality=quality;
    status.renderScale=scaleFactor;
  }
}
function onResize(){if(!renderer)return;renderer.setSize(environment.width(),environment.height());camera.aspect=environment.width()/environment.height();camera.updateProjectionMatrix()}
async function audioToggle(){
 try{
  await sound.toggle();
  for(const id of ['audio-btn','tv-audio']){
   const button=$(id);
   button.classList.toggle('active',sound.enabled);
   button.setAttribute('aria-pressed',String(sound.enabled));
   button.title=sound.enabled?'Silenciar música y ambiente':'Activar música y ambiente';
  }
 }catch(err){showError(err);}
}
function sampleRenderedFrame(){
  // WebGL default buffers may be discarded before a Canvas2D drawImage,
  // particularly in software-rendered Chromium. Read the actual framebuffer
  // synchronously in the same task directly after renderer.render(), then
  // subsample. This is a QA-only probe; no per-frame readbacks in production.
  try{
    const gl=renderer.getContext();
    const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
    if(width<4||height<4)throw Error('Zero-size WebGL drawing buffer');
    const rgba=new Uint8Array(width*height*4);
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    const error=gl.getError();
    if(error!==gl.NO_ERROR)throw Error('WebGL readPixels error '+error);
    const distinct=new Set();
    let luminance=0,variability=0,nonBlack=0;
    for(let y=0;y<36;y++)for(let x=0;x<64;x++){
      const i=4*(Math.floor(y*height/36)*width+Math.floor(x*width/64));
      const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
      distinct.add([r>>4,g>>4,b>>4].join(':'));
      const v=(r+g+b)/3;
      luminance+=v;variability+=Math.abs(r-b);
      if(r+g+b>60)nonBlack++;
    }
    const count=64*36;
    return {colors:distinct.size,brightness:Math.round(luminance/count),
      colorVar:Math.round(variability/count),
      nonBlack:Math.round(nonBlack/count*100)};
  }catch(error){
    return {colors:0,brightness:0,colorVar:0,nonBlack:0,error:String(error)};
  }
}
window.__FLYINGFREE_RENDER_PROBE__=()=>new Promise(resolve=>{
  // One-shot readback. Displaced probes are resolved explicitly rather
  // than left pending when a caller races with another inspection.
  if(pendingRenderProbe)pendingRenderProbe({error:'superseded'});
  pendingRenderProbe=resolve;
});
function captureRenderedFrame(){
  pendingSnapshot=false;
  try{
    const a=document.createElement('a');
    a.download='vuelo-'+new Date(simMs).toISOString().replaceAll(':','-')+'.png';
    a.href=renderer.domElement.toDataURL('image/png');
    a.click();
  }catch(err){showError(err);}
}
function png(){pendingSnapshot=true;}
function setHour(h){
  timeOverride=true;
  simMs=withLocalHour(new Date(simMs),h).getTime();
  $('clock').textContent=localTimeLabel(new Date(simMs),climate.weather?.timeZone);
}
function changeWeather(){
  const i=WEATHER.findIndex(w=>w.id===currentWeather.id);
  currentWeather=WEATHER[(i+1+WEATHER.length)%WEATHER.length];
  weatherOverride=true;
  $('weather-name').textContent=currentWeather.name;
}
async function requestWakeLock(){
  if(!tvActive||!navigator.wakeLock?.request||wakeLock)return;
  try{wakeLock=await navigator.wakeLock.request('screen');
    wakeLock.addEventListener?.('release',()=>{wakeLock=null;});
  }catch{/* Device does not support wake lock or requires further user gesture. */}
}
function setTVMode(enabled){
  tvActive=Boolean(enabled);
  document.body.classList.toggle('tv-mode',tvActive);
  $('tv-overlay').classList.toggle('hidden',!tvActive);
  $('tv-actions').classList.toggle('hidden',!tvActive);
  if(tvActive){$('intro').classList.add('off');revealTVControls();void requestWakeLock();}
  else if(wakeLock){void wakeLock.release().catch(()=>{});wakeLock=null;}
}
function revealTVControls(){
  if(!tvActive)return;
  $('tv-actions').classList.add('active');
  if(controlsTimeout)environment.clearTimeout(controlsTimeout);
  controlsTimeout=environment.setTimeout(()=>$('tv-actions').classList.remove('active'),5500);
}
async function connectClimate(onlyPreviouslyGranted=false){
 // A visible user click must never be swallowed by the silent permission restore.
 // The explicit attempt supersedes an in-flight silent restore.
 if(climatePending&&(!climateInitialRestore||onlyPreviouslyGranted))return;
 const attempt=++climateAttempt;
 climatePending=true;climateInitialRestore=onlyPreviouslyGranted;
 try{
   const allowed=await climate.requestLocation({onlyPreviouslyGranted});
   if(attempt!==climateAttempt)return;
   if(!allowed){
     let blocked=false;
     try{blocked=(await navigator.permissions?.query({name:'geolocation'}))?.state==='denied';}catch{}
     if(attempt!==climateAttempt)return;
     climateMessage=blocked?'Ubicación bloqueada · permite Ubicación en los ajustes del sitio junto a la dirección web':'Clima simulado · activar datos reales';
     return;
   }
   solarCoordinates=climate.coordinates;
   weatherOverride=false;
   await pollClimate(true);
 }catch(err){
   if(attempt!==climateAttempt)return;
   const denied=err?.message==='Ubicación no autorizada';
   climateMessage=denied?'Ubicación bloqueada · permite Ubicación en los ajustes del sitio junto a la dirección web':
     err?.message==='Geolocalización no disponible'?'El navegador no permite acceder a la ubicación · clima simulado':
     'Datos no disponibles · clima simulado';
 }finally{
   if(attempt===climateAttempt){
     climatePending=false;climateInitialRestore=false;
     updateWeatherUI(new Date(simMs));
   }
 }
}
async function pollClimate(force=false){
 lastClimatePoll=environment.epoch();
 try{
  const observed=await climate.refresh(force);
  if(observed&&!weatherOverride){
   currentWeather=observed.descriptor;
   climateMessage='Datos meteorológicos actuales';
  }
 }catch{
  climateMessage=climate.weather?'Última medición disponible':'Servicio no disponible · clima simulado';
 }
}
function updateWeatherUI(date){
 const observed=!weatherOverride?climate.weather:null;
 const real=Boolean(observed);
 const source=real?'DATOS ACTUALES · OPEN-METEO':timeOverride?'AMBIENTE SIMULADO · MODO DEMO':climateMessage;
 const temperature=real?observed.temperature+' °C':'-- °C';
 const wind=real&&observed.windKmh!=null?observed.windKmh+' km/h':'-- km/h';
 $('weather-source').textContent=source;
 $('temperature').textContent=temperature;
 $('wind').textContent=wind;
 $('tv-date').textContent=localDateLabel(date,climate.weather?.timeZone);
 $('tv-clock').textContent=localTimeLabel(date,climate.weather?.timeZone);
 $('tv-temp').textContent=temperature;
 $('tv-weather').textContent=currentWeather.name.toUpperCase();
 $('tv-wind').textContent='VIENTO '+wind;
 $('tv-humidity').textContent=real&&observed.humidity!=null?'HUMEDAD '+observed.humidity+' %':'';
 $('tv-source').textContent=source;
 $('tv-attribution').classList.toggle('hidden',!real);
 $('tv-consent').classList.toggle('hidden',real);
 status.climate={live:real,stale:climate.stale,source:real?'open-meteo':'simulated',temperature:real?observed.temperature:null};
 const movement=Math.floor(environment.epoch()/480000)%4;
 const shifts=[[0,0],[22,-14],[-18,-8],[16,12]];
 $('tv-overlay').style.setProperty('--tv-shift-x',shifts[movement][0]+'px');
 $('tv-overlay').style.setProperty('--tv-shift-y',shifts[movement][1]+'px');
}
function selfTestWhenReady(){
 if(disposed)return;
 // SwiftShader and first-time WASM compilation can delay the first frames.
 // Do not weaken the >=7-frame gate: run the same test once its precondition is true.
 if(status.frames<=6){
   selfTestTimeout=environment.setTimeout(selfTestWhenReady,500);
   return;
 }
 selfTestTimeout=null;
 selfTest();
}
function selfTest(){
 const tests=[
  ['WebGL2 disponible',!!renderer?.capabilities.isWebGL2],
  ['Escena 3D renderizando',scene?.children.length>20],
  ['Terreno con geometría',terrain?.geometry.attributes.position.count>50000],
  ['Isla tropical procedural',terrainHeight(0,0,worldSeed)>100&&terrainHeight(5500,5500,worldSeed)<0],
  ['Ríos fluviales',rivers?.channels===3&&rivers.segments>100],
  ['Relieve reproducible',terrainHeight(0,0)>0&&terrainHeight(3000,3000)<0],
  ['Vegetación instanciada',forest?.count>1000],
  ['Océano GPU',!!oceanFX?.mesh?.material.isShaderMaterial],
  ['Cielo procedural GPU',!!skyFX?.mesh?.material.isShaderMaterial],
  ['Sol astronómico',Number.isFinite(sunPosition(new Date(simMs),solarCoordinates.latitude,solarCoordinates.longitude).altitude)],
  ['Reloj del dispositivo',localHour(new Date(simMs))>=0],
  ['Aves disponibles',BIRDS.length>=12],
  ['Selección de aves',document.querySelectorAll('[data-bird]').length===BIRDS.length],
  ['Ave con alas articuladas',!!birdModel?.userData?.left?.pivot&&birdModel.userData.wingSilhouette==='single-continuous'],
  ['Siete tipos de clima',WEATHER.length===7],
  ['Fauna terrestre',ecosystem.stats.deer>=4&&ecosystem.stats.fox>=2],
  ['Fauna marina',ecosystem.stats.dolphins>=4],
  ['Aves secundarias',ecosystem.stats.gulls>=10],
  ['Polinizadores',ecosystem.stats.butterflies>=12],
  ['Precipitación dinámica',!!rainFX?.mesh],
  ['Cámara cinematográfica',camera?.position.length()>0&&!!cameraDirector?.shot],
  ['Audio procedural',!!(window.AudioContext||window.webkitAudioContext)],
  ['Fotogramas suficientes',status.frames>6],
  ['Sin errores graves',status.error===null],
  ['Perfil de calidad',scaleFactor>=.48],
  ['Capa de vegetación cercana',!!groundDetail],
  ['Meteorología con origen visible',!!$('weather-source')?.textContent],
  ['Modo TV disponible',!!$('tv-overlay')]
 ];
 const failures=tests.filter(t=>!t[1]).length,el=$('selftest');
 el.classList.remove('hidden');
 el.innerHTML='<strong>DIAGNÓSTICO · '+(failures?'FALLOS '+failures:'OK')+'</strong>'+tests.map(([n,ok])=>'<div class="'+(ok?'ok':'bad')+'">'+(ok?'✓ ':'✕ ')+n+'</div>').join('');
 status.selftest={passed:tests.length-failures,total:tests.length,success:failures===0};
 console.info('FlyingFree selftest',status.selftest);
}
function showError(err){
 const text=String(err?.stack||err?.message||err);
 status.error=text;const el=$('error');el.classList.remove('hidden');el.textContent='No se pudo iniciar VUELO.\n'+text;console.error(err);
}

const events=createEventScope();
let selfTestTimeout=null,started=false,disposed=false;
const loop=createFrameLoop({
  request:environment.raf,cancel:environment.caf,frame:animate,
  onError:error=>showError(error)
});
const ui=services.ui??createBrowserUI({
  document,window,location,events,birds:BIRDS,getBird:()=>currentBird,
  worldSeed,newSeed:sessionIslandSeed,
  actions:{
    selectBird,audioToggle,connectClimate,photo:png,setTVMode,
    tvActive:()=>tvActive,revealTVControls,setHour,changeWeather,
    phase:name=>astronomicalPhase(new Date(simMs),name,solarCoordinates.latitude,solarCoordinates.longitude),
    setTimeSpeed:factor=>{timeOverride=true;speed=factor;},
    resetTime:()=>{timeOverride=false;weatherOverride=false;speed=1;simMs=environment.epoch();
      if(climate.weather)currentWeather=climate.weather.descriptor;},
    flap:()=>{flapBoost=1;},
    togglePause:()=>setSimulationPaused(!userPaused),
    visibilityChange:()=>{
      lastFrame=environment.now();
      simulationClock.setPaused(userPaused||document.hidden,lastFrame);
      simulationClock.resync(lastFrame);
      frameTelemetry.reset();
      adaptiveResolution?.pause();
      if(!document.hidden&&!timeOverride)simMs=environment.epoch();
      if(!document.hidden&&tvActive)void requestWakeLock();
    }
  }
});
function setSimulationPaused(paused){
  userPaused=Boolean(paused);
  simulationClock.setPaused(userPaused||document.hidden,environment.now());
  status.simulationClock=simulationClock.snapshot();
  return userPaused;
}
function start(){
  if(disposed)throw new Error('VUELO runtime disposed');
  if(started)return false;
  started=true;
  try{
    init();
    status.runtime=loop.snapshot();
    return true;
  }catch(error){showError(error);dispose();return false;}
}
function dispose(){
  if(disposed)return;
  disposed=true;
  loop.dispose();
  events.dispose();
  climateAttempt++;
  if(selfTestTimeout!==null)environment.clearTimeout(selfTestTimeout);
  if(controlsTimeout!==null)environment.clearTimeout(controlsTimeout);
  if(wakeLock)void wakeLock.release().catch(()=>{});
  if(pendingRenderProbe){pendingRenderProbe({error:'disposed'});pendingRenderProbe=null;}
  if(sound?.dispose)void Promise.resolve(sound.dispose()).catch(error=>console.error(error));
  physicsWorld?.dispose();
  worldQuery?.dispose();
  releaseBirdAsset();
  assetLibrary.dispose?.();
   disposeBrowserScene(scene,renderer);
  status.ready=false;
  status.runtime=loop.snapshot();
  if(window.__FLYINGFREE_RENDER_PROBE__)delete window.__FLYINGFREE_RENDER_PROBE__;
}
events.on(window,'error',event=>showError(event.error||event.message));
events.on(window,'unhandledrejection',event=>showError(event.reason));
const api={start,dispose,status,
  pause:()=>setSimulationPaused(true),resume:()=>setSimulationPaused(false),
  simulationSnapshot:()=>captureSimulationSnapshot({
    seed:worldSeed,clock:simulationClock.snapshot(),birdId:currentBird.id,
    bird:lastBirdAction??birdBrain?.snapshot,weather:{id:currentWeather.id,...weatherState},
    animals:ecosystem?.actors.map(actor=>({
      species:actor.userData.state.type,state:actor.userData.behaviour,
      x:actor.position.x,y:actor.position.y,z:actor.position.z,heading:actor.rotation.y,
      velocity:0
    }))??[]
  }),
  snapshot:()=>({
    ...loop.snapshot(),seed:worldSeed,ready:status.ready,
    simulation:simulationClock.snapshot(),
    events:events.size,rendererAttached:Boolean(renderer?.domElement?.isConnected)
  })
};
return api;
}
