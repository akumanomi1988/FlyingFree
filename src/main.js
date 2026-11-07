import * as THREE from 'three';
import {TAU,clamp,lerp,smooth,random,fbm,terrainHeight,BIRDS,WEATHER,chooseBird,chooseWeather,sunPosition,readOptions} from './core.js';
import {Soundscape} from './audio.js';
import {createBirdRig,animateBirdRig} from './flight.js';
import {createEcosystem} from './ecosystem.js';
import {createSky,createOcean,createPrecipitation} from './renderfx.js';
import {createBirdBrain} from './behaviour.js';
import {createGroundDetail} from './vegetation.js';
import {createWindField} from './worldMotion.js';
import {createTreeDetail} from './treeDetail.js';
import {createFrameTelemetry} from './frameTelemetry.js';
import {createAdaptiveResolution} from './adaptiveResolution.js';
import {createForestVisibility} from './forestVisibility.js';
import {createCloudField} from './cloudField.js';
import {createAtmospherics} from './atmospherics.js';
import {habitatAt} from './ecology.js';
import {createHabitatMonitor} from './habitatMonitor.js';
import {tropicalTerrainSample,tropicalLandscapeSeed,TROPICAL_WORLD} from './tropicalTerrain.js';
import {createTropicalRivers} from './tropicalRivers.js';
import {createCoastalCliffs} from './coastalCliffs.js';
import {createCameraDirector} from './cameraDirector.js';
import {createMinimap,sessionIslandSeed} from './minimap.js';
import {birdSensation} from './birdEcology.js';
import {createBirdForageVisuals} from './birdForageVisuals.js';
import {createBirdRestVisuals} from './birdRestVisuals.js';
import {createRegionalBirds} from './regionalBirds.js';
import {createRiverEcosystem} from './riverEcosystem.js';
import {createWildlifeObservatory} from './wildlifeObservatory.js';
import {birdCameraDistance,TREE_HEIGHT_M} from './worldScale.js';
import {createLiveClimate,approximateSolarCoordinates,WEATHER_REFRESH_MS} from './localClimate.js';
import {localHour,withLocalHour,seasonLocal,astronomicalPhase,localTimeLabel,localDateLabel} from './localTime.js';

const $=(id)=>document.getElementById(id), opts=readOptions(location.search);
const status={version:'0.5.0',ready:false,frames:0,fps:0,error:null,scene:null};
window.__FLYINGFREE_STATUS__=status;
let renderer,scene,camera,sunLight,moonLight,hemi,water,terrain,forest,forestVisibility,cloudField,birdModel,clouds=[],stars,starMat,sunOrb,moonOrb;
let ecosystem,skyFX,oceanFX,rainFX,birdBrain,groundDetail,sunHalo,moonHalo,atmospherics,treeDetail,rivers,cliffs,cameraDirector,forageVisuals,restVisuals,regionalBirds,riverHabitat,wildlifeObservatory,lastBirdAction=null;
const windField=createWindField();
const frameTelemetry=createFrameTelemetry(600);
let scaleFactor=1,adaptiveResolution,lastWeatherAutoAt=0,manuallySelected=!!opts.bird,
  pendingSnapshot=false,pendingRenderProbe=null;
const climate=createLiveClimate();
let solarCoordinates=approximateSolarCoordinates();
let timeOverride=opts.hour!=null||Boolean(opts.phase);
let weatherOverride=Boolean(opts.weather);
let simMs=opts.hour!=null?withLocalHour(new Date(),opts.hour).getTime():
 opts.phase?withLocalHour(new Date(),astronomicalPhase(new Date(),opts.phase,solarCoordinates.latitude,solarCoordinates.longitude)).getTime():Date.now();
const worldSeed=opts.seed??sessionIslandSeed();
const habitatMonitor=createHabitatMonitor(worldSeed);
const minimap=createMinimap($('map-canvas'),worldSeed);
$('mini-map').title='Isla · semilla '+worldSeed;
let climatePending=false,climateInitialRestore=false,climateAttempt=0,climateMessage='Clima simulado · activar datos reales',tvActive=false,controlsTimeout=null,wakeLock=null;

let currentBird=opts.bird||chooseBird(new Date(simMs));
let currentWeather=opts.weather||chooseWeather(new Date(simMs));
let speed=1,flapBoost=0,lastFrame=performance.now(),elapsed=0,cameraLook=new THREE.Vector3(0,150,0),sleepFactor=0;
const lastCameraBird=new THREE.Vector3();let cameraBirdTracked=false;
const framingProbe=new THREE.Vector3();
let weatherState={cloud:currentWeather.cloud,rain:currentWeather.rain,fog:currentWeather.fog},renderFrames=0,fpsTimer=0,lastClimatePoll=0;
const sound=new Soundscape();
const canvasParent=$('viewport');
const temp=new THREE.Object3D();
const skyDay=new THREE.Color('#78b2c7'),skyEvening=new THREE.Color('#c48c75'),skyNight=new THREE.Color('#142c46');
const waterDay=new THREE.Color('#286e7c'),waterNight=new THREE.Color('#102d47');
const createMaterial=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});

function init(){
  if(!document.createElement('canvas').getContext('webgl2'))throw new Error('WebGL2 no disponible. Comprueba la aceleración gráfica en tu navegador.');
  // The compositor must not retain the previous full-resolution framebuffer.
  // Snapshots are captured synchronously immediately after the next render.
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  const maxScale=Math.min(window.devicePixelRatio||1,innerWidth<700?1:1.15,
    Math.sqrt(3_000_000/Math.max(1,innerWidth*innerHeight)));
  const minScale=Math.min(.48,maxScale);
  // Start with a sane raster budget, then restore detail only on hardware
  // that actually proves it can maintain a smooth documentary framerate.
  scaleFactor=Math.max(minScale,Math.min(maxScale,innerWidth<700?.86:.84,
    Math.sqrt(1_450_000/Math.max(1,innerWidth*innerHeight))));
  adaptiveResolution=createAdaptiveResolution({
    maxScale,minScale,initialScale:scaleFactor,
    downFps:29,downP95Ms:44,upFps:38,upP95Ms:29,
    severeFps:22,severeFactor:.74,
    downHold:2,upHold:24,cooldownSeconds:3
  });
  renderer.setPixelRatio(scaleFactor);
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  canvasParent.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=skyDay.clone();scene.fog=new THREE.FogExp2(skyDay.clone(),.00013);
  camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.15,12500);
  camera.position.set(250,450,820);
  hemi=new THREE.HemisphereLight(0xd7efff,0x394337,1.7);scene.add(hemi);
  sunLight=new THREE.DirectionalLight('#ffead0',2.5);sunLight.position.set(500,950,-350);scene.add(sunLight);
  moonLight=new THREE.DirectionalLight(0x85b1dd,.65);scene.add(moonLight);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const glowCtx=glowCanvas.getContext('2d');
  const glow=glowCtx.createRadialGradient(64,64,3,64,64,64);
  glow.addColorStop(0,'rgba(255,241,202,0.88)');
  glow.addColorStop(.25,'rgba(255,211,141,0.32)');
  glow.addColorStop(.68,'rgba(255,173,93,0.10)');
  glow.addColorStop(1,'rgba(255,180,98,0)');
  glowCtx.fillStyle=glow;glowCtx.fillRect(0,0,128,128);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
  sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,
   blending:THREE.AdditiveBlending,fog:false}));sunHalo.scale.set(860,860,1);scene.add(sunHalo);
  moonHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,opacity:.18,depthWrite:false,
   blending:THREE.AdditiveBlending,fog:false,color:0x9dbce4}));moonHalo.scale.set(360,360,1);scene.add(moonHalo);
  const sunGeo=new THREE.SphereGeometry(73,16,12);
  sunOrb=new THREE.Mesh(sunGeo,new THREE.MeshBasicMaterial({color:0xffe5b7,fog:false}));scene.add(sunOrb);
  moonOrb=new THREE.Mesh(new THREE.SphereGeometry(42,16,12),new THREE.MeshBasicMaterial({color:0xc1d2df,fog:false}));scene.add(moonOrb);
  createLandscape();createForest();createClouds();createStars();createBird();
  riverHabitat=createRiverEcosystem(THREE,scene,worldSeed,innerWidth<720?.65:1);
  regionalBirds=createRegionalBirds(THREE,scene,worldSeed,innerWidth<720?.68:1);
  forageVisuals=createBirdForageVisuals(THREE,scene,worldSeed);
  restVisuals=createBirdRestVisuals(THREE,scene);
  const qaShot=opts.selftest?new URLSearchParams(location.search).get('qaShot'):null;
  cameraDirector=createCameraDirector(THREE,terrainHeight,worldSeed,{qaShot});
  const startSun=sunPosition(new Date(simMs),solarCoordinates.latitude,solarCoordinates.longitude);
  const startPos=birdBrain.update(0,0,startSun.daylight,0);
  birdModel.position.set(startPos.x,startPos.y,startPos.z);
  const heading=new THREE.Vector3(-Math.sin(startPos.heading),0,-Math.cos(startPos.heading));
  const startDistance=birdCameraDistance(currentBird);
  camera.position.copy(birdModel.position).addScaledVector(heading,-startDistance).add(new THREE.Vector3(startDistance*.3,startDistance*.25,0));
  lastCameraBird.copy(birdModel.position);cameraBirdTracked=true;
  cameraLook.set(startPos.x,startPos.y,startPos.z);
  camera.lookAt(cameraLook);
  ecosystem=createEcosystem(THREE,scene,worldSeed,innerWidth<720?.65:1,startPos);
  wildlifeObservatory=createWildlifeObservatory(THREE,{terrainHeight,seed:worldSeed});
  regionalBirds.update(0,startPos,camera.position,startSun.daylight,0);
  groundDetail=createGroundDetail(THREE,scene,innerWidth<720?.5:1,windField,worldSeed);
  atmospherics=createAtmospherics(THREE,scene,innerWidth<720?.56:1);
  skyFX=createSky(THREE,scene);
  rainFX=createPrecipitation(THREE,scene,innerWidth<720?.7:1);
  status.fauna={...ecosystem.stats,riverFish:riverHabitat.stats.fish,
    riverReeds:riverHabitat.stats.reeds,regionalBirds:regionalBirds.stats.population};
  status.world={seed:worldSeed,extent:TROPICAL_WORLD.extent,riverChannels:rivers.channels,riverSegments:rivers.segments,
    coastSeed:oceanFX.bathymetry.seed,coastResolution:oceanFX.bathymetry.resolution,
    cliffStacks:cliffs.count};
  status.faunaLOD=ecosystem.lodStats;
  status.habitatUse=habitatMonitor.snapshot();
  // Publish capabilities immediately; rolling metrics gain samples as frames arrive.
  status.treeDetail={active:treeDetail.active,capacity:treeDetail.poolCapacity,
    fadeDistance:treeDetail.fadeDistance,radius:680};
  status.performance={...frameTelemetry.snapshot(),drawCalls:0,triangles:0,points:0,lines:0};
  status.adaptiveQuality=adaptiveResolution.snapshot();
  window.addEventListener('resize',onResize,{passive:true});
  bindUI();onResize();status.ready=true;status.scene={terrain:true,forest:true,bird:true,water:true,clouds:true,stars:true,fauna:true,sky:true,rain:true};
  if(opts.broadcast){$('intro').classList.add('off');document.body.classList.add('no-ui');}
  if(opts.tv)setTVMode(true);
  // Normal visits wait for the explicit choice on the intro screen.
  // TV/broadcast may reuse a permission already granted, without prompting.
  if(opts.broadcast||opts.tv)void connectClimate(true);
  if(opts.selftest)window.setTimeout(selfTest,2500);
  requestAnimationFrame(animate);
}
function createLandscape(){
  // The former 4.3 km radial patch was a small repeated pancake. A single
  // larger mesh now holds a deterministic volcanic island for each day/seed.
  const g=new THREE.PlaneGeometry(TROPICAL_WORLD.extent,TROPICAL_WORLD.extent,250,250);
  g.rotateX(-Math.PI/2);
  const p=g.getAttribute('position'),colors=new Float32Array(p.count*3);
  const tint=new THREE.Color(),rng=random(worldSeed^0x78eb21);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),land=tropicalTerrainSample(x,z,worldSeed);
    const y=land.height;
    p.setY(i,y);
    if(y<TROPICAL_WORLD.seaLevel)tint.set('#367b87');
    else if(y<23)tint.set('#d8c996');
    else if(land.river>.32||land.valley>.5)tint.set('#347c57');
    else if(y<160)tint.set('#397c51');
    else if(y<370)tint.set('#2f7950');
    else if(y<580)tint.set('#497c54');
    else if(y<760)tint.set('#66806a');
    else tint.set('#7f817c');
    const shade=.84+rng()*.21+land.mountain*.09;
    colors[i*3]=tint.r*shade;colors[i*3+1]=tint.g*shade;colors[i*3+2]=tint.b*shade;
  }
  p.needsUpdate=true;
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  g.computeVertexNormals();
  terrain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,flatShading:false
  }));
  terrain.name='seeded-tropical-volcanic-terrain';
  scene.add(terrain);
  oceanFX=createOcean(THREE,scene,worldSeed);water=oceanFX.mesh;
  rivers=createTropicalRivers(THREE,scene,worldSeed);
  cliffs=createCoastalCliffs(THREE,scene,worldSeed);
}
function createForest(){
  const rng=random(worldSeed);
  const n=innerWidth<720?2250:4400;
  const treeRecords=[];
  const foliage=(color,animate=false,amplitude=.8,height=19)=>{
    const material=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
    if(animate)windField.apply(material,{amplitude,height,frequency:.67});
    return material;
  };
  const lower=new THREE.InstancedMesh(new THREE.ConeGeometry(8,21,7),foliage('#609c70',true,.58,21),n);
  const upper=new THREE.InstancedMesh(new THREE.ConeGeometry(6,20,7),foliage('#729f70',true,.68,20),n);
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.05,1.55,16,6),foliage('#635c4b'),n);
  const broad=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(11,1),foliage('#7eac72',true,.45,20),n);
  const cypress=new THREE.InstancedMesh(new THREE.ConeGeometry(4.9,43,7),foliage('#3b7954',true,.46,43),n);
  const olive=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(8.5,1),foliage('#9aaa78',true,.39,17),n);
  const birch=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(9,1),foliage('#90b08c',true,.44,18),n);
  const greens=['#17643a','#287647','#397e4b','#1e6840','#3e8754'].map(c=>new THREE.Color(c));
  const broadGreens=['#17663e','#217a4a','#3b8953','#246d43','#397b49','#4a965a']
    .map(c=>new THREE.Color(c));
  // Palm crowns are seven fronds per trunk, instanced into ONE draw call.
  const frondPositions=[],frondIndices=[];
  for(let t=0;t<=8;t++){
    const u=t/8,width=Math.sin(u*Math.PI),droop=.38*Math.sin(Math.PI*u)-.52*u*u;
    for(const side of [-1,0,1])
      frondPositions.push(side*width,droop+(side===0?.07:0),u);
    if(t<8){
      const k=t*3;
      frondIndices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);
    }
  }
  const frondGeometry=new THREE.BufferGeometry();
  frondGeometry.setAttribute('position',new THREE.Float32BufferAttribute(frondPositions,3));
  frondGeometry.setIndex(frondIndices);frondGeometry.computeVertexNormals();
  const palmLeaves=new THREE.InstancedMesh(frondGeometry,
    new THREE.MeshStandardMaterial({color:0x397e43,roughness:1,side:THREE.DoubleSide}),
    n*7);
  windField.apply(palmLeaves.material,{amplitude:.17,height:1,frequency:.81});
  let palms=0;
  let pines=0,deciduous=0,cypresses=0,olives=0,birches=0,trees=0;
  for(let attempt=0;attempt<n*8&&trees<n;attempt++){
    const x=(rng()-.5)*9950,z=(rng()-.5)*8600;
    const candidate=tropicalTerrainSample(x,z,worldSeed),y=candidate.height;
    // No trees grow through the current; riparian woodland starts on dry banks.
    if(candidate.river>.23||y<12||y>730||rng()<smooth(430,700,y)*.48)continue;
    const habitat=habitatAt(x,z,worldSeed);
    if(habitat.type==='rock'||habitat.slope>1.02)continue;
    const s=.78+rng()*.50,a=rng()*TAU;
    // Tropical canopy dominates; palms concentrate on coastal plains and
    // mangrove-like crowns line the humid river corridors.
    const kind=y<135&&rng()<(habitat.type==='shore'?.80:.32)?'palm':
      habitat.type==='wetland'?'mangrove':
      y>515?(rng()<.38?'cypress':'pine'):
      habitat.type==='forest'||rng()<.76?'oak':'birch';
    const h=(kind==='palm'?18:kind==='mangrove'?14:TREE_HEIGHT_M[kind])*s;
    const trunkRatio=kind==='palm'?.82:kind==='mangrove'?.57:
      kind==='olive'?.43:kind==='birch'?.58:kind==='oak'?.44:kind==='cypress'?.34:.47;
    const trunkThickness=kind==='palm'?.12:kind==='mangrove'?.46:
      kind==='olive'?.26:kind==='birch'?.30:kind==='oak'?.58:kind==='cypress'?.43:.52;
    const trunkHeight=h*trunkRatio;
    temp.rotation.set(0,a,0);
    temp.position.set(x,y+trunkHeight*.5,z);
    temp.scale.set(s*trunkThickness,trunkHeight/16,s*trunkThickness);
    temp.updateMatrix();trunk.setMatrixAt(trees,temp.matrix);
    if(kind==='palm'){
      const leafColor=new THREE.Color().setHSL(.30+rng()*.08,.30+rng()*.18,.24+rng()*.14);
      for(let k=0;k<7;k++){
        temp.position.set(x,y+h*.85,z);
        temp.rotation.set(0,a+k*TAU/7,0);
        temp.scale.set(h*.11,h*.16,h*.37);
        temp.updateMatrix();
        const slot=palms*7+k;
        palmLeaves.setMatrixAt(slot,temp.matrix);
        palmLeaves.setColorAt(slot,leafColor);
      }
      palms++;
    }else if(kind==='cypress'){
      temp.position.set(x,y+h*.52,z);
      temp.scale.set(h*.16/4.9,h*.96/43,h*.16/4.9);
      temp.updateMatrix();cypress.setMatrixAt(cypresses++,temp.matrix);
    }else if(kind==='olive'){
      temp.position.set(x,y+h*.66,z);
      temp.scale.set(h*.45/8.5,h*.32/8.5,h*.45/8.5);
      temp.updateMatrix();olive.setMatrixAt(olives++,temp.matrix);
    }else if(kind==='birch'){
      temp.position.set(x,y+h*.72,z);
      temp.scale.set(h*.24/9,h*.28/9,h*.24/9);
      temp.updateMatrix();birch.setMatrixAt(birches++,temp.matrix);
    }else if(kind==='oak'||kind==='mangrove'){
      temp.position.set(x,y+h*.70,z);
      temp.scale.set(h*.40/11,h*.30/11,h*.40/11);
      temp.updateMatrix();broad.setMatrixAt(deciduous,temp.matrix);
      broad.setColorAt(deciduous,broadGreens[Math.floor(rng()*broadGreens.length)]);
      deciduous++;
    }else{
      temp.position.set(x,y+h*.49,z);
      temp.scale.set(s*.85,h*.70/21,s*.85);
      temp.updateMatrix();lower.setMatrixAt(pines,temp.matrix);
      lower.setColorAt(pines,greens[Math.floor(rng()*greens.length)]);
      temp.position.set(x,y+h*.74,z);
      temp.scale.set(s*.65,h*.52/20,s*.65);
      temp.updateMatrix();upper.setMatrixAt(pines,temp.matrix);
      upper.setColorAt(pines,greens[Math.floor(rng()*greens.length)]);
      pines++;
    }
    treeRecords.push({x,y,z,height:h,kind,angle:a});
    trees++;
  }
  trunk.count=trees;lower.count=upper.count=pines;broad.count=deciduous;cypress.count=cypresses;olive.count=olives;birch.count=birches;
  palmLeaves.count=palms*7;
  for(const inst of [trunk,lower,upper,broad,cypress,olive,birch,palmLeaves]){
    inst.instanceMatrix.needsUpdate=true;
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    inst.frustumCulled=false;
    scene.add(inst);
  }
  forest={leaves:lower,trunks:trunk,trees,count:trees,pines,deciduous,cypresses,olives,birches,palms,
    perches:treeRecords};
  forestVisibility=createForestVisibility(
    {trunk,lower,upper,broad,cypress,olive,birch,palmLeaves},
    treeRecords,worldSeed,{radius:innerWidth<720?2200:2600}
  );
  forestVisibility.setQuality(scaleFactor/adaptiveResolution.snapshot().maxScale);
  treeDetail=createTreeDetail(THREE,scene,treeRecords,innerWidth<720?.60:1,windField);
  const rockMaterial=foliage('#7c8679');
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rockMaterial,95);
  let j=0;
  for(let attempt=0;attempt<850&&j<95;attempt++){
    const x=(rng()-.5)*7700,z=(rng()-.5)*7000,y=terrainHeight(x,z,worldSeed);
    if(y<480)continue;
    const scale=6+rng()*13;
    temp.position.set(x,y-1,z);temp.rotation.set(rng(),rng()*TAU,rng());
    temp.scale.set(scale,scale*.45,scale*.82);temp.updateMatrix();
    rocks.setMatrixAt(j++,temp.matrix);
  }
  rocks.count=j;rocks.instanceMatrix.needsUpdate=true;scene.add(rocks);
}
function createClouds(){
  cloudField=createCloudField(THREE,scene,{mobile:innerWidth<720});
  clouds=cloudField.clouds;
}
function createStars(){
  const rand=random(773),pts=[];
  for(let i=0;i<2500;i++){
    const u=rand()*TAU,v=rand()*Math.PI*.48;
    const r=7900;pts.push(Math.sin(u)*Math.cos(v)*r,Math.sin(v)*r+370,Math.cos(u)*Math.cos(v)*r);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  starMat=new THREE.PointsMaterial({color:0xebf0f1,size:3.1,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false});
  stars=new THREE.Points(g,starMat);scene.add(stars);
}
function createBird(){
  const previousPosition=birdModel?.position.clone();
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
  birdBrain=createBirdBrain(currentBird,worldSeed,null,{perches:forest?.perches});
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
  status.bird=currentBird.id;
  const initialBird=birdBrain.snapshot;
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
function ambient(date,dt){
  const sun=sunPosition(date,solarCoordinates.latitude,solarCoordinates.longitude),day=sun.daylight,alt=sun.altitude;
  const k=1-Math.exp(-dt/16);
  for(const prop of ['cloud','rain','fog'])weatherState[prop]=lerp(weatherState[prop],currentWeather[prop],k);
  const cloud=weatherState.cloud,wet=weatherState.rain,night=sun.night;
  const lightning=currentWeather.id==='storm'&&Math.sin(elapsed*.59)*Math.sin(elapsed*1.73)>.994?1.25:0;
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
  starMat.opacity=smooth(-.045,-.19,alt)*.97;
  const cloudTint=new THREE.Color(0xdde4e6).lerp(new THREE.Color(0xffc29a),sun.golden*.52*day);
  cloudField.update(elapsed,cloud,day,cloudTint);
  sunHalo.position.copy(sunOrb.position);sunHalo.visible=sunOrb.visible;
  sunHalo.material.opacity=clamp(day*(1-cloud*.7),0,1);
  moonHalo.position.copy(moonOrb.position);moonHalo.visible=moonOrb.visible;
  skyFX.update(camera,sun,weatherState);
  windField.update(elapsed,weatherState);
  sound.update(weatherState,sun,currentWeather.id);
  return sun;
}
function fly(date,dt,sun){
 const day=smooth(-.14,.045,sun.altitude);
 const action=birdBrain.update(elapsed,dt,day,weatherState.rain);
 lastBirdAction=action;
 birdModel.position.set(action.x,action.y+(action.grounded?0:Math.sin(elapsed*3.2)*currentBird.wingspan*.012),action.z);
 birdModel.rotation.y=action.heading;
 animateBirdRig(birdModel,elapsed,{energy:action.flapping?.89:.40,sleeping:action.wingsFolded,
  bank:action.bank,pitch:action.pitch,grounded:action.grounded,speed:action.speed,
  floating:action.floating,waterPitch:action.waterPitch,waterRoll:action.waterRoll,
  state:action.state,food:action.food,feedingProgress:action.feedingProgress},dt);
 const visibleResource=forageVisuals?.update({...action,wingspan:currentBird.wingspan,rain:weatherState.rain},elapsed);
 const visibleRest=restVisuals?.update(action,camera.position);
 status.perchVisible=Boolean(visibleRest?.visible);
 status.restSiteKind=action.restSite?.kind??null;
 status.rests=action.rests;
 status.grounded=action.grounded;
 status.foodVisible=Boolean(visibleResource?.visible);
 status.foodKind=visibleResource?.kind??null;
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
 return birdModel.position;
}
function directCamera(bird,dt,wildlifeFocus=null){
  const frame=cameraDirector.update(camera,bird,birdModel.rotation.y,
    birdBrain.snapshot.velocity,status.behaviour,currentBird.wingspan,elapsed,dt,
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
function animate(now){
  requestAnimationFrame(animate);
  const deltaRaw=Math.max(0,(now-lastFrame)/1000),dt=Math.min(deltaRaw,.10);
  lastFrame=now;
  if(!Number.isFinite(dt))return;
  if(!document.hidden)frameTelemetry.record(deltaRaw*1000);
  elapsed+=dt;
  if(timeOverride)simMs+=deltaRaw*1000*speed;
  else simMs=Date.now();
  const date=new Date(simMs);
  // Use wall-clock time so hidden tabs and long-running TV sessions still refresh.
  // The climate adapter coalesces requests and caches successful observations.
  if(climate.enabled&&!climatePending&&
     Date.now()-lastClimatePoll>=(climate.weather?WEATHER_REFRESH_MS:60_000)){
    void pollClimate();
  }
  // A week-scale cycle for the default bird; manual selections always persist.
  if(!manuallySelected&&status.frames%120===0){
    const dailyBird=chooseBird(date);
    if(dailyBird!==currentBird){currentBird=dailyBird;createBird();refreshPicker();}
  }
  if(!climate.weather&&elapsed>300&&elapsed-lastWeatherAutoAt>300){
    const rng=random(Math.floor(simMs/86400000) ^ Math.floor(elapsed/300)*117);
    currentWeather=WEATHER[Math.floor(rng()*WEATHER.length)];
    lastWeatherAutoAt=elapsed;
  }
  const sun=ambient(date,dt);
  const position=fly(date,dt,sun);
  ecosystem.update(elapsed,sun.daylight,weatherState.cloud,position,weatherState.rain,camera.position);
  atmospherics.update(elapsed,camera,position,sun.daylight,weatherState);
  const wildlifeFrame=wildlifeObservatory.update(elapsed,ecosystem.actors,camera,position,innerHeight);
  directCamera(position,dt,wildlifeFrame.focus);
  forestVisibility.update(camera.position,elapsed);
  regionalBirds.update(elapsed,position,camera.position,sun.daylight,weatherState.rain);
  riverHabitat.update(elapsed,camera.position);
  treeDetail.update(camera.position,elapsed);
  groundDetail.update(elapsed,camera,position,sun.daylight,weatherState.rain,climate.weather?.temperature??18);
  updateSea(elapsed,dt,sun);
  renderer.render(scene,camera);
  // One-shot real WebGL pixel probe, immediately after rendering.
  if(pendingRenderProbe){
    const resolve=pendingRenderProbe;
    pendingRenderProbe=null;
    resolve(sampleRenderedFrame());
  }
  if(pendingSnapshot)captureRenderedFrame();
  status.frames++;renderFrames++;fpsTimer+=Math.min(deltaRaw,.25);
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
      cameraClearance:+(camera.position.y-terrainHeight(camera.position.x,camera.position.z,worldSeed)).toFixed(2),
      birdClearance:+(birdModel.position.y-terrainHeight(birdModel.position.x,birdModel.position.z,worldSeed)).toFixed(2)};
    status.time=date.toISOString();status.sunAltitude=sun.altitude;
    status.bird=currentBird.id;status.weather=currentWeather.id;
    status.weatherBlend={...weatherState};
    status.performance={...frameTelemetry.snapshot(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,lines:renderer.info.render.lines};
    status.treeDetail={active:treeDetail.active,capacity:treeDetail.poolCapacity,
    fadeDistance:treeDetail.fadeDistance,radius:680};
    status.faunaLOD=ecosystem.lodStats;
    status.riverGeometry=rivers.stats;
    status.wildlifePopulation=ecosystem.populationStats;
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
function onResize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
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
  // QA-only synchronous readback of the exact WebGL framebuffer, not a
  // canvas-to-canvas copy that can be cleared by Chromium/SwiftShader.
  // Uniform 64x36 sampling covers the whole image, including small subjects,
  // without changing the production renderer or preserving its framebuffer.
  try{
    const gl=renderer.getContext(),width=gl.drawingBufferWidth,
      height=gl.drawingBufferHeight;
    if(width<1||height<1)throw new Error('WebGL framebuffer is empty');
    const rgba=new Uint8Array(width*height*4);
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    const error=gl.getError();
    if(error!==gl.NO_ERROR)throw new Error('WebGL readPixels error '+error);
    const distinct=new Set();
    let luminance=0,variability=0,nonBlack=0,samples=0;
    for(let sy=0;sy<36;sy++)for(let sx=0;sx<64;sx++){
      const x=Math.min(width-1,Math.floor((sx+.5)*width/64));
      const y=Math.min(height-1,Math.floor((sy+.5)*height/36));
      const i=(y*width+x)*4;
      const red=rgba[i],green=rgba[i+1],blue=rgba[i+2];
      distinct.add([red>>4,green>>4,blue>>4].join(':'));
      const light=(red+green+blue)/3;
      luminance+=light;variability+=Math.abs(red-blue);
      if(red+green+blue>60)nonBlack++;
      samples++;
    }
    return {colors:distinct.size,brightness:Math.round(luminance/samples),
      colorVar:Math.round(variability/samples),
      nonBlack:Math.round(nonBlack/samples*100)};
  }catch(error){return {colors:0,brightness:0,colorVar:0,nonBlack:0,
    error:String(error)};}
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
  if(controlsTimeout)clearTimeout(controlsTimeout);
  controlsTimeout=setTimeout(()=>$('tv-actions').classList.remove('active'),5500);
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
 lastClimatePoll=Date.now();
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
 const movement=Math.floor(Date.now()/480000)%4;
 const shifts=[[0,0],[22,-14],[-18,-8],[16,12]];
 $('tv-overlay').style.setProperty('--tv-shift-x',shifts[movement][0]+'px');
 $('tv-overlay').style.setProperty('--tv-shift-y',shifts[movement][1]+'px');
}
function refreshPicker(){
  const picker=$('bird-options');
  if(!picker)return;
  picker.replaceChildren();
  for(const bird of BIRDS){
    const button=document.createElement('button');
    button.className='species-option'+(bird.id===currentBird.id?' selected':'');
    button.type='button';button.dataset.bird=bird.id;
    button.setAttribute('aria-pressed',String(bird.id===currentBird.id));
    const name=document.createElement('span');name.className='species-title';name.textContent=bird.name;
    const tag=document.createElement('span');tag.className='species-habitat';tag.textContent=bird.habitat;
    button.append(name,tag);
    button.addEventListener('click',()=>selectBird(bird.id));
    picker.append(button);
  }
  $('bird-habitat').textContent=currentBird.habitat;
  $('bird-description').textContent=currentBird.detail;
  $('species-total').textContent=BIRDS.length+' ESPECIES';
}
function bindUI(){
 refreshPicker();
 const enterExperience=(withLocation)=>{
   $('intro').classList.add('off');
   void audioToggle();
   if(withLocation)void connectClimate(false);
 };
 $('enter-btn').addEventListener('click',()=>enterExperience(true));
 $('skip-location-btn').addEventListener('click',()=>enterExperience(false));
 $('audio-btn').addEventListener('click',audioToggle);
 $('tv-audio').addEventListener('click',audioToggle);
 $('photo-btn').addEventListener('click',png);
 $('tv-btn').addEventListener('click',()=>setTVMode(!tvActive));
 $('tv-exit').addEventListener('click',()=>setTVMode(false));
 $('weather-btn').addEventListener('click',()=>void connectClimate(false));
 $('tv-consent').addEventListener('click',()=>void connectClimate(false));
 $('help-btn').addEventListener('click',()=>$('help').classList.toggle('hidden'));
 $('new-island').addEventListener('click',()=>{
   // New session geography, explicitly shareable in the URL. Fixed-seed QA
   // still works unchanged and no geolocation data goes into the address.
   let next=sessionIslandSeed();
   if(next===worldSeed)next=(next%2147483647)+1;
   const url=new URL(location.href);
   url.searchParams.set('seed',String(next));
   location.assign(url.href);
 });
 const toggleMap=()=>{
   const hidden=$('mini-map').classList.toggle('hidden');
   $('map-btn').setAttribute('aria-pressed',String(!hidden));
 };
 const toggleVitals=()=>{
   const hidden=document.body.classList.toggle('hide-bird-hud');
   $('hud-btn').setAttribute('aria-pressed',String(!hidden));
 };
 $('map-btn').addEventListener('click',toggleMap);
 $('hud-btn').addEventListener('click',toggleVitals);
 $('close-help').addEventListener('click',()=>$('help').classList.add('hidden'));
 const picker=$('bird-picker');
 $('bird-btn').addEventListener('click',()=>picker.classList.toggle('hidden'));
 $('close-birds').addEventListener('click',()=>picker.classList.add('hidden'));
 window.addEventListener('pointermove',revealTVControls,{passive:true});
 window.addEventListener('focus',revealTVControls);
 document.addEventListener('visibilitychange',()=>{
   lastFrame=performance.now();
   frameTelemetry.reset();
   adaptiveResolution?.pause();
   if(!document.hidden&&!timeOverride)simMs=Date.now();
   if(!document.hidden&&tvActive)void requestWakeLock();
 });
 window.addEventListener('keydown',(event)=>{
  if(event.ctrlKey||event.altKey||event.metaKey)return;
  const key=event.key.toLowerCase();
  if([' ','1','2','3','4','5','6','7','8','h','f','p','m','b','t','r','n','i','escape'].includes(key))event.preventDefault();
  revealTVControls();
  switch(key){
   case '1':setHour(astronomicalPhase(new Date(simMs),'dawn',solarCoordinates.latitude,solarCoordinates.longitude));break;
   case '2':setHour(astronomicalPhase(new Date(simMs),'noon',solarCoordinates.latitude,solarCoordinates.longitude));break;
   case '3':setHour(astronomicalPhase(new Date(simMs),'sunset',solarCoordinates.latitude,solarCoordinates.longitude));break;
   case '4':setHour(23);break;
   case '5':changeWeather();break;
   case '6':timeOverride=true;speed=1;break;
   case '7':timeOverride=true;speed=60;break;
   case '8':timeOverride=true;speed=600;break;
   case 'r':timeOverride=false;weatherOverride=false;speed=1;simMs=Date.now();if(climate.weather)currentWeather=climate.weather.descriptor;break;
   case ' ':flapBoost=1;break;
   case 'h':document.body.classList.toggle('no-ui');break;
   case 'n':toggleMap();break;
   case 'i':toggleVitals();break;
   case 't':setTVMode(!tvActive);break;
   case 'f':if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();break;
   case 'p':png();break;
   case 'm':void audioToggle();break;
   case 'b':picker.classList.toggle('hidden');break;
   case 'escape':picker.classList.add('hidden');$('help').classList.add('hidden');break;
  }
 });
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
window.addEventListener('error',e=>showError(e.error||e.message));
window.addEventListener('unhandledrejection',e=>showError(e.reason));
try{init()}catch(error){showError(error)}
