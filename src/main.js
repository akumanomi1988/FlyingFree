import * as THREE from 'three';
import {TAU,clamp,lerp,smooth,random,fbm,terrainHeight,BIRDS,WEATHER,chooseBird,chooseWeather,sunPosition,readOptions} from './core.js';
import {Soundscape} from './audio.js';
import {createBirdRig,animateBirdRig} from './flight.js';
import {createEcosystem} from './ecosystem.js';
import {createSky,createOcean,createPrecipitation} from './renderfx.js';
import {createBirdBrain} from './behaviour.js';
import {createGroundDetail} from './vegetation.js';
import {habitatAt} from './ecology.js';
import {createLiveClimate,approximateSolarCoordinates} from './localClimate.js';
import {localHour,withLocalHour,seasonLocal,astronomicalPhase,localTimeLabel,localDateLabel} from './localTime.js';

const $=(id)=>document.getElementById(id), opts=readOptions(location.search);
const status={version:'0.4.0',ready:false,frames:0,fps:0,error:null,scene:null};
window.__FLYINGFREE_STATUS__=status;
let renderer,scene,camera,sunLight,hemi,water,terrain,forest,birdModel,clouds=[],stars,starMat,sunOrb,moonOrb;
let ecosystem,skyFX,oceanFX,rainFX,birdBrain,groundDetail;
let scaleFactor=1,lowFpsSeconds=0,lastWeatherAutoAt=0,manuallySelected=!!opts.bird;
const climate=createLiveClimate();
let solarCoordinates=approximateSolarCoordinates();
let timeOverride=opts.hour!=null||Boolean(opts.phase);
let weatherOverride=Boolean(opts.weather);
let simMs=opts.hour!=null?withLocalHour(new Date(),opts.hour).getTime():
 opts.phase?withLocalHour(new Date(),astronomicalPhase(new Date(),opts.phase,solarCoordinates.latitude,solarCoordinates.longitude)).getTime():Date.now();
let climatePending=false,climateMessage='Clima simulado · activar datos reales',tvActive=false,controlsTimeout=null;

let currentBird=opts.bird||chooseBird(new Date(simMs));
let currentWeather=opts.weather||chooseWeather(new Date(simMs));
let speed=1,flapBoost=0,lastFrame=performance.now(),elapsed=0,cameraLook=new THREE.Vector3(0,150,0),sleepFactor=0;
let weatherState={cloud:currentWeather.cloud,rain:currentWeather.rain,fog:currentWeather.fog},renderFrames=0,fpsTimer=0,lastClimatePoll=0;
const sound=new Soundscape();
const canvasParent=$('viewport');
const temp=new THREE.Object3D();
const skyDay=new THREE.Color('#78b2c7'),skyEvening=new THREE.Color('#c48c75'),skyNight=new THREE.Color('#081320');
const waterDay=new THREE.Color('#286e7c'),waterNight=new THREE.Color('#102d47');
const createMaterial=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});

function init(){
  if(!document.createElement('canvas').getContext('webgl2'))throw new Error('WebGL2 no disponible. Comprueba la aceleración gráfica en tu navegador.');
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  scaleFactor=Math.min(window.devicePixelRatio||1,innerWidth<700?1.05:1.4);renderer.setPixelRatio(scaleFactor);
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  canvasParent.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=skyDay.clone();scene.fog=new THREE.FogExp2(skyDay.clone(),.00013);
  camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,1,12500);
  camera.position.set(250,450,820);
  hemi=new THREE.HemisphereLight(0xd7efff,0x394337,1.7);scene.add(hemi);
  sunLight=new THREE.DirectionalLight('#ffead0',2.5);sunLight.position.set(500,950,-350);scene.add(sunLight);
  const sunGeo=new THREE.SphereGeometry(73,16,12);
  sunOrb=new THREE.Mesh(sunGeo,new THREE.MeshBasicMaterial({color:0xffe5b7,fog:false}));scene.add(sunOrb);
  moonOrb=new THREE.Mesh(new THREE.SphereGeometry(42,16,12),new THREE.MeshBasicMaterial({color:0xc1d2df,fog:false}));scene.add(moonOrb);
  createLandscape();createForest();createClouds();createStars();createBird();
  const startSun=sunPosition(new Date(simMs),solarCoordinates.latitude,solarCoordinates.longitude);
  const startPos=birdBrain.update(0,0,startSun.daylight,0);
  birdModel.position.set(startPos.x,startPos.y,startPos.z);
  const heading=new THREE.Vector3(-Math.sin(startPos.heading),0,-Math.cos(startPos.heading));
  camera.position.copy(birdModel.position).addScaledVector(heading,-185).add(new THREE.Vector3(38,26,14));
  cameraLook.set(startPos.x,startPos.y,startPos.z);
  camera.lookAt(cameraLook);
  ecosystem=createEcosystem(THREE,scene,1988,innerWidth<720?.65:1);
  groundDetail=createGroundDetail(THREE,scene,innerWidth<720?.5:1);
  skyFX=createSky(THREE,scene);
  rainFX=createPrecipitation(THREE,scene,innerWidth<720?.7:1);
  status.fauna=ecosystem.stats;
  window.addEventListener('resize',onResize,{passive:true});
  bindUI();onResize();status.ready=true;status.scene={terrain:true,forest:true,bird:true,water:true,clouds:true,stars:true,fauna:true,sky:true,rain:true};
  if(opts.broadcast){$('intro').classList.add('off');document.body.classList.add('no-ui');}
  if(opts.tv)setTVMode(true);
  void connectClimate(true);
  if(opts.selftest)window.setTimeout(selfTest,2500);
  requestAnimationFrame(animate);
}
function createLandscape(){
  const g=new THREE.PlaneGeometry(4300,4300,180,180);g.rotateX(-Math.PI/2);
  const p=g.getAttribute('position'),cols=[];
  const month=new Date(simMs).getUTCMonth();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=terrainHeight(x,z),detail=fbm(x*.003,z*.003);
    p.setY(i,y);
    let col;
    if(y< -9)col=new THREE.Color('#5f9e9b');
    else if(y<16)col=new THREE.Color('#d1bf93');
    else if(y<95)col=new THREE.Color(month>=9||month<=1?'#739f64':'#70a86c');
    else if(y<235)col=new THREE.Color('#618c5e');
    else if(y<325)col=new THREE.Color('#76946d');
    else if(y<402)col=new THREE.Color('#8b9982');
    else col=new THREE.Color(month>=10||month<=2?'#d4dcd2':'#87938b');
    col.multiplyScalar(.96+detail*.13+(fbm(x*.07,z*.07)+1)*.04);
    cols.push(col.r,col.g,col.b);
  }
  p.needsUpdate=true;g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();
  terrain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,flatShading:false}));
  scene.add(terrain);
  oceanFX=createOcean(THREE,scene);water=oceanFX.mesh;
  const beachMat=new THREE.MeshBasicMaterial({color:0xf1d6a0,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false});
  for(let j=0;j<4;j++){
    const ring=new THREE.Mesh(new THREE.RingGeometry(1490+j*16,1499+j*16,120),beachMat);
    ring.rotation.x=-Math.PI/2;ring.scale.y=.89;ring.position.y=-8.1+j*.12;
    scene.add(ring);
  }
}
function createForest(){
  const rng=random(1988);
  const n=innerWidth<720?1500:2450;
  const foliage=(color)=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
  const lower=new THREE.InstancedMesh(new THREE.ConeGeometry(8,21,7),foliage('#609c70'),n);
  const upper=new THREE.InstancedMesh(new THREE.ConeGeometry(6,20,7),foliage('#729f70'),n);
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.05,1.55,16,6),foliage('#635c4b'),n);
  const broad=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(11,1),foliage('#7eac72'),n);
  const cypress=new THREE.InstancedMesh(new THREE.ConeGeometry(4.9,43,7),foliage('#3b7954'),n);
  const olive=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(8.5,1),foliage('#9aaa78'),n);
  const birch=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(9,1),foliage('#90b08c'),n);
  const greens=['#447755','#5a9161','#699f68','#4f8060','#87ac72'].map(c=>new THREE.Color(c));
  const currentMonth=new Date(simMs).getMonth();
  const broadGreens=(currentMonth>=8&&currentMonth<=10?
    ['#dfac50','#c78047','#b86d49','#d3b365']:
    currentMonth<=1?['#8b9c78','#a3ad86','#87976c']:
    currentMonth<=4?['#a6c875','#8ab86f','#b7d17d']:
    ['#90b771','#74a36a','#a4bf7c','#719563']).map(c=>new THREE.Color(c));
  let pines=0,deciduous=0,cypresses=0,olives=0,birches=0,trees=0;
  for(let attempt=0;attempt<n*8&&trees<n;attempt++){
    const x=(rng()-.5)*3450,z=(rng()-.5)*3060,y=terrainHeight(x,z);
    if(y<14||y>340||rng()<smooth(190,335,y)*.56)continue;
    const habitat=habitatAt(x,z);
    if(habitat.type==='rock'||habitat.slope>.85)continue;
    const s=.55+rng()*1.25,a=rng()*TAU;
    const kind=habitat.type==='shore'?'olive':
      y<125&&habitat.humidity<.50&&rng()<.35?'olive':
      habitat.type==='forest'&&rng()<.16?'birch':
      habitat.type==='forest'&&rng()<.22?'oak':
      y<195&&rng()<.13?'cypress':'pine';
    const oak=kind==='oak';
    temp.rotation.set(0,a,0);
    temp.position.set(x,y+7*s,z);temp.scale.set(s,s,s);temp.updateMatrix();
    trunk.setMatrixAt(trees,temp.matrix);
    if(kind==='cypress'){
      temp.position.set(x,y+25*s,z);temp.scale.set(s*.73,s*.95,s*.73);temp.updateMatrix();
      cypress.setMatrixAt(cypresses++,temp.matrix);
    }else if(kind==='olive'){
      temp.position.set(x,y+20*s,z);temp.scale.set(s*1.05,s*.66,s*1.05);temp.updateMatrix();
      olive.setMatrixAt(olives++,temp.matrix);
    }else if(kind==='birch'){
      temp.position.set(x,y+26*s,z);temp.scale.set(s*.82,s*.96,s*.88);temp.updateMatrix();
      birch.setMatrixAt(birches++,temp.matrix);
    }else if(oak){
      temp.position.set(x,y+25*s,z);
      temp.scale.set(s*(.92+rng()*.4),s*(.65+rng()*.2),s);
      temp.updateMatrix();broad.setMatrixAt(deciduous,temp.matrix);
      broad.setColorAt(deciduous,broadGreens[Math.floor(rng()*broadGreens.length)]);
      deciduous++;
    }else{
      temp.position.set(x,y+19*s,z);temp.scale.set(s,s,s);temp.updateMatrix();lower.setMatrixAt(pines,temp.matrix);
      lower.setColorAt(pines,greens[Math.floor(rng()*greens.length)]);
      temp.position.set(x,y+31*s,z);temp.scale.set(s*.88,s*.83,s*.88);temp.updateMatrix();upper.setMatrixAt(pines,temp.matrix);
      upper.setColorAt(pines,greens[Math.floor(rng()*greens.length)]);
      pines++;
    }
    trees++;
  }
  trunk.count=trees;lower.count=upper.count=pines;broad.count=deciduous;cypress.count=cypresses;olive.count=olives;birch.count=birches;
  for(const inst of [trunk,lower,upper,broad,cypress,olive,birch]){
    inst.instanceMatrix.needsUpdate=true;
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    inst.frustumCulled=false;
    scene.add(inst);
  }
  forest={leaves:lower,trunks:trunk,trees,count:trees,pines,deciduous,cypresses,olives,birches};
  const rockMaterial=foliage('#7c8679');
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rockMaterial,95);
  let j=0;
  for(let attempt=0;attempt<850&&j<95;attempt++){
    const x=(rng()-.5)*1900,z=(rng()-.5)*1800,y=terrainHeight(x,z);
    if(y<240)continue;
    const scale=6+rng()*13;
    temp.position.set(x,y-1,z);temp.rotation.set(rng(),rng()*TAU,rng());
    temp.scale.set(scale,scale*.45,scale*.82);temp.updateMatrix();
    rocks.setMatrixAt(j++,temp.matrix);
  }
  rocks.count=j;rocks.instanceMatrix.needsUpdate=true;scene.add(rocks);
}
function createClouds(){
  const rand=random(2405);
  for(let i=0;i<(innerWidth<720?22:34);i++){
    const group=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:0xe5e8dd,transparent:true,opacity:.75,depthWrite:false});
    for(let k=0;k<4;k++){
      const ellipsoid=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),mat);
      ellipsoid.position.set((k-1.5)*45+rand()*14,(rand()-.5)*14,(rand()-.5)*28);
      ellipsoid.scale.set(56+rand()*46,16+rand()*12,33+rand()*24);
      group.add(ellipsoid);
    }
    group.position.set((rand()-.5)*6500,630+rand()*750,(rand()-.5)*6200);
    group.rotation.y=rand()*TAU;
    clouds.push({group,mat,baseX:group.position.x,weight:rand()});
    scene.add(group);
  }
}
function createStars(){
  const rand=random(773),pts=[];
  for(let i=0;i<1800;i++){
    const u=rand()*TAU,v=rand()*Math.PI*.48;
    const r=7900;pts.push(Math.sin(u)*Math.cos(v)*r,Math.sin(v)*r+370,Math.cos(u)*Math.cos(v)*r);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  starMat=new THREE.PointsMaterial({color:0xebf0f1,size:2.5,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false});
  stars=new THREE.Points(g,starMat);scene.add(stars);
}
function createBird(){
  if(birdModel)scene.remove(birdModel);
  birdModel=createBirdRig(THREE,currentBird);birdBrain=createBirdBrain(currentBird);
  scene.add(birdModel);
  status.bird=currentBird.id;
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
  hemi.intensity=.87+day*(1.45-cloud*.50)+lightning*.2;
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
  for(const c of clouds){
    c.mat.opacity=clamp(.12+cloud*.74+(c.weight-.4)*.09,0,.92);
    c.group.visible=cloud>.035;
    c.group.position.x=c.baseX+Math.sin(elapsed*.006+c.weight*3)*58;
  }
  skyFX.update(camera,sun,weatherState);
  sound.update(weatherState,night);
  return sun;
}
function fly(date,dt,sun){
 const day=smooth(-.14,.045,sun.altitude);
 const action=birdBrain.update(elapsed,dt,day,weatherState.rain);
 birdModel.position.set(action.x,action.y,action.z);
 birdModel.rotation.y=action.heading;
 animateBirdRig(birdModel,elapsed,{energy:action.flapping?.89:.40,sleeping:action.wingsFolded,bank:action.bank,pitch:action.pitch},dt);
 status.behaviour=action.state;status.flightSpeed=Math.round(action.speed);
 status.hunger=+action.hunger.toFixed(2);status.energy=+action.energy.toFixed(2);
 status.landings=action.landings;status.feedings=action.feedings;
 return birdModel.position;
}
function directCamera(bird,dt){
  const shot=Math.floor(elapsed/31)%7;
  const yaw=birdModel.rotation.y,forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  let target=bird.clone(),desired;
  switch(shot){
    case 0:desired=bird.clone().addScaledVector(forward,-180).add(new THREE.Vector3(42,24,14));break;
    case 1:desired=bird.clone().add(new THREE.Vector3(Math.cos(elapsed*.048)*225,52,Math.sin(elapsed*.048)*225));break;
    case 2:desired=new THREE.Vector3(950,650,1320);target.lerp(new THREE.Vector3(0,210,0),.38);break;
    case 3:desired=bird.clone().add(new THREE.Vector3(-205,-Math.min(35,bird.y-30),135));break;
    case 4:desired=bird.clone().addScaledVector(forward,165).add(new THREE.Vector3(35,42,0));break;
    case 5:{
      const fauna=ecosystem.focus(elapsed);target=fauna.point;
      desired=target.clone().add(new THREE.Vector3(fauna.kind==='ocean'?165:70,fauna.kind==='ocean'?56:45,fauna.kind==='ocean'?215:112));
      break;
    }
    default:desired=new THREE.Vector3(-1230,510,-900);target=new THREE.Vector3(90,170,10);break;
  }
  desired.y=Math.max(desired.y,terrainHeight(desired.x,desired.z)+28,-1);
  const ease=1-Math.exp(-dt*.62);
  camera.position.lerp(desired,ease);
  // Never let interpolation push the observer below the terrain.
  camera.position.y=Math.max(camera.position.y,terrainHeight(camera.position.x,camera.position.z)+20,-1);
  cameraLook.lerp(target,1-Math.exp(-dt*.86));
  camera.lookAt(cameraLook);
  const fov=[52,51,61,50,49,47,62][shot];
  camera.fov=lerp(camera.fov,fov,1-Math.exp(-dt*.48));
  camera.updateProjectionMatrix();
}
function updateSea(t,dt,sun){
  oceanFX.update(t,sun,weatherState,scene.fog.color);
  rainFX.update(t,dt,camera,weatherState.rain,Math.sin(t*.1)*30+weatherState.cloud*22);
}
function animate(now){
  requestAnimationFrame(animate);
  const deltaRaw=Math.max(0,(now-lastFrame)/1000),dt=Math.min(deltaRaw,.10);
  lastFrame=now;
  if(!Number.isFinite(dt))return;
  elapsed+=dt;
  if(timeOverride)simMs+=deltaRaw*1000*speed;
  else simMs=Date.now();
  const date=new Date(simMs);
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
  ecosystem.update(elapsed,sun.daylight,weatherState.cloud);
  const position=fly(date,dt,sun);
  directCamera(position,dt);
  updateSea(elapsed,dt,sun);
  renderer.render(scene,camera);
  status.frames++;renderFrames++;fpsTimer+=dt;
  if(fpsTimer>=1){
    status.fps=Math.round(renderFrames/fpsTimer);
    $('fps').textContent=status.fps+' FPS';renderFrames=0;fpsTimer=0;
    const hour=localHour(date);
    $('clock').textContent=localTimeLabel(date);
    $('bird-name').textContent=currentBird.name;
    $('weather-name').textContent=currentWeather.name;
    $('season-name').textContent=seasonLocal(date);
    $('speed-name').textContent='×'+speed;
    $('scene-caption').textContent=sun.night?'Un cielo lleno de caminos':hour<9?'La primera luz sobre el agua':hour>=18?'La calma del atardecer':'Cada instante es irrepetible';
    $('phase').textContent=sun.night?'EL MUNDO BAJA EL RITMO':currentBird.name.toUpperCase()+' EN LIBERTAD';
    status.time=date.toISOString();status.sunAltitude=sun.altitude;
    status.bird=currentBird.id;status.weather=currentWeather.id;
    status.weatherBlend={...weatherState};
    status.renderScale=scaleFactor;status.groundDetail=groundDetail.active;status.insectCount=groundDetail.insectCount;
    status.sunAccurate=Boolean(solarCoordinates.accurate);
    status.timeMode=timeOverride?'simulated':'live';
    updateWeatherUI(date);
    if(status.fps<23)lowFpsSeconds++;else lowFpsSeconds=Math.max(0,lowFpsSeconds-2);
    if(lowFpsSeconds>=8&&scaleFactor>.72){
      scaleFactor=Math.max(.72,scaleFactor*.85);
      renderer.setPixelRatio(scaleFactor);onResize();lowFpsSeconds=0;
    }
  }
}
function onResize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
async function audioToggle(){try{await sound.toggle();$('audio-btn').classList.toggle('active',sound.enabled)}catch(err){showError(err)}}
function png(){try{renderer.render(scene,camera);const a=document.createElement('a');a.download='vuelo-'+new Date(simMs).toISOString().replaceAll(':','-')+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click()}catch(err){showError(err)}}
function setHour(h){
  timeOverride=true;
  simMs=withLocalHour(new Date(simMs),h).getTime();
  $('clock').textContent=localTimeLabel(new Date(simMs));
}
function changeWeather(){
  const i=WEATHER.findIndex(w=>w.id===currentWeather.id);
  currentWeather=WEATHER[(i+1+WEATHER.length)%WEATHER.length];
  weatherOverride=true;
  $('weather-name').textContent=currentWeather.name;
}
function setTVMode(enabled){
  tvActive=Boolean(enabled);
  document.body.classList.toggle('tv-mode',tvActive);
  $('tv-overlay').classList.toggle('hidden',!tvActive);
  $('tv-actions').classList.toggle('hidden',!tvActive);
  if(tvActive){$('intro').classList.add('off');revealTVControls();}
}
function revealTVControls(){
  if(!tvActive)return;
  $('tv-actions').classList.add('active');
  if(controlsTimeout)clearTimeout(controlsTimeout);
  controlsTimeout=setTimeout(()=>$('tv-actions').classList.remove('active'),5500);
}
async function connectClimate(onlyPreviouslyGranted=false){
 if(climatePending)return;climatePending=true;
 try{
   const allowed=await climate.requestLocation({onlyPreviouslyGranted});
   if(!allowed){climateMessage='Clima simulado · activar datos reales';return;}
   solarCoordinates=climate.coordinates;
   weatherOverride=false;
   await pollClimate(true);
 }catch(err){
   climateMessage=err?.message==='Ubicación no autorizada'?'Ubicación no autorizada · clima simulado':'Datos no disponibles · clima simulado';
 }finally{climatePending=false;updateWeatherUI(new Date(simMs));}
}
async function pollClimate(force=false){
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
 $('tv-date').textContent=localDateLabel(date);
 $('tv-clock').textContent=localTimeLabel(date);
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
 $('enter-btn').addEventListener('click',()=>{
   $('intro').classList.add('off');
   void audioToggle();
   void connectClimate(false);
 });
 $('audio-btn').addEventListener('click',audioToggle);
 $('tv-audio').addEventListener('click',audioToggle);
 $('photo-btn').addEventListener('click',png);
 $('tv-btn').addEventListener('click',()=>setTVMode(!tvActive));
 $('tv-exit').addEventListener('click',()=>setTVMode(false));
 $('weather-btn').addEventListener('click',()=>void connectClimate(false));
 $('tv-consent').addEventListener('click',()=>void connectClimate(false));
 $('help-btn').addEventListener('click',()=>$('help').classList.toggle('hidden'));
 $('close-help').addEventListener('click',()=>$('help').classList.add('hidden'));
 const picker=$('bird-picker');
 $('bird-btn').addEventListener('click',()=>picker.classList.toggle('hidden'));
 $('close-birds').addEventListener('click',()=>picker.classList.add('hidden'));
 window.addEventListener('pointermove',revealTVControls,{passive:true});
 window.addEventListener('focus',revealTVControls);
 document.addEventListener('visibilitychange',()=>{
   lastFrame=performance.now();
   if(!document.hidden&&!timeOverride)simMs=Date.now();
 });
 window.addEventListener('keydown',(event)=>{
  if(event.ctrlKey||event.altKey||event.metaKey)return;
  const key=event.key.toLowerCase();
  if([' ','1','2','3','4','5','6','7','8','h','f','p','m','b','t','r','escape'].includes(key))event.preventDefault();
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
  ['Terreno con geometría',terrain?.geometry.attributes.position.count>10000],
  ['Relieve reproducible',terrainHeight(0,0)>0&&terrainHeight(3000,3000)<0],
  ['Vegetación instanciada',forest?.count>1000],
  ['Océano GPU',!!oceanFX?.mesh?.material.isShaderMaterial],
  ['Cielo procedural GPU',!!skyFX?.mesh?.material.isShaderMaterial],
  ['Sol astronómico',Number.isFinite(sunPosition(new Date(simMs),solarCoordinates.latitude,solarCoordinates.longitude).altitude)],
  ['Reloj del dispositivo',localHour(new Date(simMs))>=0],
  ['Aves disponibles',BIRDS.length>=12],
  ['Selección de aves',document.querySelectorAll('[data-bird]').length===BIRDS.length],
  ['Ave con alas articuladas',!!birdModel?.userData?.left?.pivot],
  ['Siete tipos de clima',WEATHER.length===7],
  ['Fauna terrestre',ecosystem.stats.deer>=4&&ecosystem.stats.fox>=2],
  ['Fauna marina',ecosystem.stats.dolphins>=4],
  ['Aves secundarias',ecosystem.stats.gulls>=10],
  ['Polinizadores',ecosystem.stats.butterflies>=12],
  ['Precipitación dinámica',!!rainFX?.mesh],
  ['Cámara cinematográfica',camera?.position.length()>0],
  ['Audio procedural',!!(window.AudioContext||window.webkitAudioContext)],
  ['Fotogramas suficientes',status.frames>6],
  ['Sin errores graves',status.error===null],
  ['Perfil de calidad',scaleFactor>=.7],
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
