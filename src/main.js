import * as THREE from 'three';
import {TAU,clamp,lerp,smooth,random,fbm,terrainHeight,BIRDS,WEATHER,chooseBird,chooseWeather,sunPosition,readOptions} from './core.js';
import {Soundscape} from './audio.js';
import {createBirdRig,animateBirdRig} from './flight.js';
import {createEcosystem} from './ecosystem.js';
import {createSky,createOcean,createPrecipitation} from './renderfx.js';
import {createBirdBrain} from './behaviour.js';
import {createGroundDetail} from './vegetation.js';
import {createWindField} from './worldMotion.js';
import {createFrameTelemetry} from './frameTelemetry.js';
import {createAtmospherics} from './atmospherics.js';
import {habitatAt} from './ecology.js';
import {birdCameraDistance,TREE_HEIGHT_M} from './worldScale.js';
import {createLiveClimate,approximateSolarCoordinates,WEATHER_REFRESH_MS} from './localClimate.js';
import {localHour,withLocalHour,seasonLocal,astronomicalPhase,localTimeLabel,localDateLabel} from './localTime.js';

const $=(id)=>document.getElementById(id), opts=readOptions(location.search);
const status={version:'0.5.0',ready:false,frames:0,fps:0,error:null,scene:null};
window.__FLYINGFREE_STATUS__=status;
let renderer,scene,camera,sunLight,hemi,water,terrain,forest,birdModel,clouds=[],stars,starMat,sunOrb,moonOrb;
let ecosystem,skyFX,oceanFX,rainFX,birdBrain,groundDetail,sunHalo,moonHalo,atmospherics;
const windField=createWindField();
const frameTelemetry=createFrameTelemetry(600);
let scaleFactor=1,lowFpsSeconds=0,lastWeatherAutoAt=0,manuallySelected=!!opts.bird;
const climate=createLiveClimate();
let solarCoordinates=approximateSolarCoordinates();
let timeOverride=opts.hour!=null||Boolean(opts.phase);
let weatherOverride=Boolean(opts.weather);
let simMs=opts.hour!=null?withLocalHour(new Date(),opts.hour).getTime():
 opts.phase?withLocalHour(new Date(),astronomicalPhase(new Date(),opts.phase,solarCoordinates.latitude,solarCoordinates.longitude)).getTime():Date.now();
let climatePending=false,climateInitialRestore=false,climateAttempt=0,climateMessage='Clima simulado · activar datos reales',tvActive=false,controlsTimeout=null,wakeLock=null;

let currentBird=opts.bird||chooseBird(new Date(simMs));
let currentWeather=opts.weather||chooseWeather(new Date(simMs));
let speed=1,flapBoost=0,lastFrame=performance.now(),elapsed=0,cameraLook=new THREE.Vector3(0,150,0),sleepFactor=0;
const lastCameraBird=new THREE.Vector3();let cameraBirdTracked=false;
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
  scaleFactor=Math.min(window.devicePixelRatio||1,innerWidth<700?1.05:1.4,
    Math.sqrt(3700000/Math.max(1,innerWidth*innerHeight)));
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
  const startSun=sunPosition(new Date(simMs),solarCoordinates.latitude,solarCoordinates.longitude);
  const startPos=birdBrain.update(0,0,startSun.daylight,0);
  birdModel.position.set(startPos.x,startPos.y,startPos.z);
  const heading=new THREE.Vector3(-Math.sin(startPos.heading),0,-Math.cos(startPos.heading));
  const startDistance=birdCameraDistance(currentBird);
  camera.position.copy(birdModel.position).addScaledVector(heading,-startDistance).add(new THREE.Vector3(startDistance*.3,startDistance*.25,0));
  lastCameraBird.copy(birdModel.position);cameraBirdTracked=true;
  cameraLook.set(startPos.x,startPos.y,startPos.z);
  camera.lookAt(cameraLook);
  ecosystem=createEcosystem(THREE,scene,1988,innerWidth<720?.65:1);
  groundDetail=createGroundDetail(THREE,scene,innerWidth<720?.5:1,windField);
  atmospherics=createAtmospherics(THREE,scene,innerWidth<720?.56:1);
  skyFX=createSky(THREE,scene);
  rainFX=createPrecipitation(THREE,scene,innerWidth<720?.7:1);
  status.fauna=ecosystem.stats;
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
    const s=.78+rng()*.50,a=rng()*TAU;
    const kind=habitat.type==='shore'?'olive':
      y<125&&habitat.humidity<.50&&rng()<.35?'olive':
      habitat.type==='forest'&&rng()<.16?'birch':
      habitat.type==='forest'&&rng()<.22?'oak':
      y<195&&rng()<.13?'cypress':'pine';
    const h=TREE_HEIGHT_M[kind]*s;
    const trunkRatio=kind==='olive'?.43:kind==='birch'?.58:kind==='oak'?.44:kind==='cypress'?.34:.47;
    const trunkThickness=kind==='olive'?.26:kind==='birch'?.30:kind==='oak'?.58:kind==='cypress'?.43:.52;
    const trunkHeight=h*trunkRatio;
    temp.rotation.set(0,a,0);
    temp.position.set(x,y+trunkHeight*.5,z);
    temp.scale.set(s*trunkThickness,trunkHeight/16,s*trunkThickness);
    temp.updateMatrix();trunk.setMatrixAt(trees,temp.matrix);
    if(kind==='cypress'){
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
    }else if(kind==='oak'){
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
  const rng=random(2405),puff=new THREE.SphereGeometry(1,10,7);
  const count=innerWidth<720?17:27;
  for(let i=0;i<count;i++){
    const group=new THREE.Group();
    const material=new THREE.MeshLambertMaterial({color:0xe2e5e0,transparent:true,
      opacity:.73,depthWrite:false,roughness:1});
    const layers=5+Math.floor(rng()*4),height=.7+rng()*.55;
    for(let j=0;j<layers;j++){
      const lobe=new THREE.Mesh(puff,material);
      const u=(j/(layers-1)-.5)*260;
      lobe.position.set(u+(rng()-.5)*24,(rng()-.5)*21, (rng()-.5)*75);
      lobe.scale.set(45+rng()*45,20+rng()*24,40+rng()*38);
      group.add(lobe);
    }
    group.position.set((rng()-.5)*6500,570+rng()*830,(rng()-.5)*6100);
    group.rotation.y=rng()*TAU;
    clouds.push({group,mat:material,baseX:group.position.x,baseZ:group.position.z,
      velocity:2+rng()*5,drift:rng()*TAU,weight:rng()});
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
  const cloudTint=new THREE.Color(0xdde4e6).lerp(new THREE.Color(0xffc29a),sun.golden*.52*day);
  for(const c of clouds){
    c.mat.opacity=clamp(.16+cloud*.67+(c.weight-.4)*.09,0,.89);
    c.mat.color.copy(cloudTint).multiplyScalar(.72+day*.27);
    c.group.visible=cloud>.035;
    c.group.position.x=((c.baseX+elapsed*c.velocity+3500)%7000)-3500;
    c.group.position.z=c.baseZ+Math.sin(elapsed*.02+c.drift)*110;
    c.group.position.y+=Math.sin(elapsed*.003+c.drift)*.07;
  }
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
 birdModel.position.set(action.x,action.y+(action.grounded?0:Math.sin(elapsed*3.2)*currentBird.wingspan*.012),action.z);
 birdModel.rotation.y=action.heading;
 animateBirdRig(birdModel,elapsed,{energy:action.flapping?.89:.40,sleeping:action.wingsFolded,
  bank:action.bank,pitch:action.pitch,grounded:action.grounded,speed:action.speed,
  state:action.state},dt);
 status.behaviour=action.state;status.flightSpeed=Math.round(action.speed);
 status.hunger=+action.hunger.toFixed(2);status.energy=+action.energy.toFixed(2);
 status.landings=action.landings;status.feedings=action.feedings;
 return birdModel.position;
}
function directCamera(bird,dt){
  const shot=Math.floor(elapsed/31)%7;
  const yaw=birdModel.rotation.y,forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const side=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const span=currentBird.wingspan,near=birdCameraDistance(currentBird);
  const low=['approach','landing','feed','rest'].includes(status.behaviour);
  const tracking=low||![2,5,6].includes(shot);
  // Translate the observer along with the bird before easing. Without this,
  // a 60 m/s bird outruns an otherwise close cinematic chase camera.
  if(tracking&&cameraBirdTracked){
    const motion=bird.clone().sub(lastCameraBird);
    if(motion.lengthSq()<2500){camera.position.add(motion);cameraLook.add(motion);}
  }
  lastCameraBird.copy(bird);cameraBirdTracked=true;
  let target=bird.clone().add(new THREE.Vector3(0,span*.08,0)),desired;
  switch(shot){
    case 0:desired=bird.clone().addScaledVector(forward,-near).addScaledVector(side,near*.30).add(new THREE.Vector3(0,near*.24,0));break;
    case 1:desired=bird.clone().add(new THREE.Vector3(Math.cos(elapsed*.048)*near*1.18,near*.36,Math.sin(elapsed*.048)*near*1.18));break;
    case 2:desired=new THREE.Vector3(950,650,1320);target.lerp(new THREE.Vector3(0,210,0),.38);break;
    case 3:desired=bird.clone().addScaledVector(side,-near*1.2).addScaledVector(forward,-near*.25).add(new THREE.Vector3(0,near*.22,0));break;
    case 4:desired=bird.clone().addScaledVector(forward,near*1.15).addScaledVector(side,near*.24).add(new THREE.Vector3(0,near*.37,0));break;
    case 5:{
      const fauna=ecosystem.focus(elapsed);target=fauna.point;
      const d=fauna.kind==='ocean'?18:fauna.kind==='flowers'?.75:8;
      desired=target.clone().add(new THREE.Vector3(d*.42,d*.38,d));
      break;
    }
    default:desired=new THREE.Vector3(-1230,510,-900);target=new THREE.Vector3(90,170,10);break;
  }
  if(low){
    const d=Math.max(.55,span*2.8);
    desired=bird.clone().addScaledVector(side,d*.65).addScaledVector(forward,-d*.75).add(new THREE.Vector3(0,d*.35,0));
    target=bird.clone().add(new THREE.Vector3(0,span*.12,0));
  }
  const clearance=low?.35:shot===5?.45:tracking?Math.max(.65,span*.4):8;
  desired.y=Math.max(desired.y,terrainHeight(desired.x,desired.z)+clearance);
  const ease=1-Math.exp(-dt*2.2);
  camera.position.lerp(desired,ease);
  camera.position.y=Math.max(camera.position.y,terrainHeight(camera.position.x,camera.position.z)+clearance);
  cameraLook.lerp(target,1-Math.exp(-dt*1.8));
  camera.lookAt(cameraLook);
  const fov=low?48:[54,52,61,53,53,48,62][shot];
  camera.fov=lerp(camera.fov,fov,1-Math.exp(-dt*.8));
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
  directCamera(position,dt);
  groundDetail.update(elapsed,camera,position,sun.daylight,weatherState.rain,climate.weather?.temperature??18);
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
    status.performance={...frameTelemetry.snapshot(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,lines:renderer.info.render.lines};
    status.renderScale=scaleFactor;status.groundDetail=groundDetail.active;status.insectCount=groundDetail.insectCount;
    status.motion={wind:+windField.strength.toFixed(2),windMaterials:windField.materials,
      clouds:clouds.length,articulatedAnimals:ecosystem.actors.length,motes:atmospherics.activeCount};
    status.sunAccurate=Boolean(solarCoordinates.accurate);
    status.timeMode=timeOverride?'simulated':'live';
    updateWeatherUI(date);
    if(status.fps<23)lowFpsSeconds++;else lowFpsSeconds=Math.max(0,lowFpsSeconds-2);
    if(lowFpsSeconds>=8&&scaleFactor>.48){
      scaleFactor=Math.max(.48,scaleFactor*.87);
      renderer.setPixelRatio(scaleFactor);onResize();lowFpsSeconds=0;
    }
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
 $('close-help').addEventListener('click',()=>$('help').classList.add('hidden'));
 const picker=$('bird-picker');
 $('bird-btn').addEventListener('click',()=>picker.classList.toggle('hidden'));
 $('close-birds').addEventListener('click',()=>picker.classList.add('hidden'));
 window.addEventListener('pointermove',revealTVControls,{passive:true});
 window.addEventListener('focus',revealTVControls);
 document.addEventListener('visibilitychange',()=>{
   lastFrame=performance.now();
   frameTelemetry.reset();
   if(!document.hidden&&!timeOverride)simMs=Date.now();
   if(!document.hidden&&tvActive)void requestWakeLock();
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
