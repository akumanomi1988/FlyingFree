import * as THREE from 'three';
import {TAU,clamp,lerp,smooth,random,fbm,terrainHeight,BIRDS,WEATHER,chooseBird,chooseWeather,madridHour,withMadridHour,season,sunPosition,birdPosition,readOptions} from './core.js';
import {Soundscape} from './audio.js';

const $=(id)=>document.getElementById(id), opts=readOptions(location.search);
const status={version:'0.1.0',ready:false,frames:0,fps:0,error:null,scene:null};
window.__FLYINGFREE_STATUS__=status;
let renderer,scene,camera,sunLight,hemi,water,waterPositions,terrain,forest,birdModel,clouds=[],stars,starMat,sunOrb,moonOrb;
let simMs=opts.hour==null?Date.now():withMadridHour(new Date(),opts.hour).getTime();
let currentBird=opts.bird||chooseBird(new Date(simMs));
let currentWeather=opts.weather||chooseWeather(new Date(simMs));
let speed=1,flapBoost=0,lastFrame=performance.now(),elapsed=0,cameraLook=new THREE.Vector3(0,150,0),sleepFactor=0;
let weatherBlend=0,weatherPrevious=currentWeather,windLevel=0,renderFrames=0,fpsTimer=0,cloudDim=0;
const sound=new Soundscape();
const canvasParent=$('viewport');
const temp=new THREE.Object3D();
const skyDay=new THREE.Color('#78b2c7'),skyEvening=new THREE.Color('#c48c75'),skyNight=new THREE.Color('#081320');
const waterDay=new THREE.Color('#286e7c'),waterNight=new THREE.Color('#102d47');
const createMaterial=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});

function init(){
  if(!document.createElement('canvas').getContext('webgl2'))throw new Error('WebGL2 no disponible. Comprueba la aceleración gráfica en tu navegador.');
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.45));
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
  window.addEventListener('resize',onResize,{passive:true});
  bindUI();onResize();status.ready=true;status.scene={terrain:true,forest:true,bird:true,water:true,clouds:true,stars:true};
  if(opts.broadcast){$('intro').classList.add('off');document.body.classList.add('no-ui');}
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
    if(y< -9)col=new THREE.Color('#a1b6ab');
    else if(y<15)col=new THREE.Color('#bcaa7d');
    else if(y<95)col=new THREE.Color(month>=9||month<=1?'#687951':'#557f59');
    else if(y<225)col=new THREE.Color('#52715a');
    else if(y<350)col=new THREE.Color('#79837b');
    else col=new THREE.Color(month>=10||month<=2?'#dbe3db':'#8e9693');
    col.multiplyScalar(.86+detail*.2+(fbm(x*.07,z*.07)+1)*.025);
    cols.push(col.r,col.g,col.b);
  }
  p.needsUpdate=true;g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();
  terrain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,flatShading:false}));
  scene.add(terrain);
  const wg=new THREE.PlaneGeometry(12000,12000,90,90);wg.rotateX(-Math.PI/2);
  waterPositions=wg.getAttribute('position').array.slice();
  water=new THREE.Mesh(wg,new THREE.MeshPhongMaterial({color:waterDay,shininess:115,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,specular:0x73959c}));
  water.position.y=-9;scene.add(water);
  const beachMat=new THREE.MeshBasicMaterial({color:0xf1d6a0,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false});
  for(let j=0;j<4;j++){
    const ring=new THREE.Mesh(new THREE.RingGeometry(1490+j*16,1499+j*16,120),beachMat);
    ring.rotation.x=-Math.PI/2;ring.scale.y=.89;ring.position.y=-8.1+j*.12;
    scene.add(ring);
  }
}
function createForest(){
  const rand=random(1988),n=2500;
  const leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(7,27,5),createMaterial('#315d45'),n);
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.15,1.55,17,4),createMaterial('#625642'),n);
  leaves.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const colors=[new THREE.Color('#2c5e43'),new THREE.Color('#4c7952'),new THREE.Color('#6a8660')];
  let count=0;
  for(let i=0;i<n*7&&count<n;i++){
    const x=(rand()-.5)*3400,z=(rand()-.5)*3050,y=terrainHeight(x,z);
    if(y<22||y>286||rand()<smooth(150,290,y)*.65)continue;
    const s=.55+rand()*1.5;
    temp.position.set(x,y+15*s,z);temp.rotation.set(0,rand()*TAU,0);temp.scale.set(s,s,s);temp.updateMatrix();
    leaves.setMatrixAt(count,temp.matrix);leaves.setColorAt(count,colors[Math.floor(rand()*colors.length)]);
    temp.position.set(x,y+7*s,z);temp.scale.set(s,s,s);temp.updateMatrix();
    trunks.setMatrixAt(count,temp.matrix);count++;
  }
  leaves.count=trunks.count=count;leaves.instanceMatrix.needsUpdate=trunks.instanceMatrix.needsUpdate=true;
  if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;
  scene.add(leaves,trunks);forest={leaves,trunks,count};
  // Sparse rock outcrops on mountain ridges.
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),createMaterial('#77817a'),180);
  let j=0;
  for(let i=0;i<1500&&j<180;i++){
    const x=(rand()-.5)*2200,z=(rand()-.5)*2300,y=terrainHeight(x,z);
    if(y<140)continue;
    const scale=10+rand()*25;temp.position.set(x,y+3,z);temp.rotation.set(rand(),rand()*TAU,rand());temp.scale.set(scale,scale*.55,scale*1.25);temp.updateMatrix();rocks.setMatrixAt(j++,temp.matrix);
  }
  rocks.count=j;rocks.instanceMatrix.needsUpdate=true;scene.add(rocks);
}
function createClouds(){
  const rand=random(2405);
  for(let i=0;i<36;i++){
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
  for(let i=0;i<900;i++){
    const u=rand()*TAU,v=rand()*Math.PI*.48;
    const r=7900;pts.push(Math.sin(u)*Math.cos(v)*r,Math.sin(v)*r+370,Math.cos(u)*Math.cos(v)*r);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  starMat=new THREE.PointsMaterial({color:0xebf0f1,size:1.4,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false});
  stars=new THREE.Points(g,starMat);scene.add(stars);
}
function createBird(){
  if(birdModel)scene.remove(birdModel);
  const profile=currentBird,group=new THREE.Group(),bodyMat=createMaterial(profile.color,.86);
  const body=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),bodyMat);
  body.scale.set(.36,.3,1.09);group.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.29,10,8),bodyMat);head.position.z=-.78;head.position.y=.13;group.add(head);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.12,.47,6),createMaterial('#d3b282'));
  beak.rotation.x=-Math.PI/2;beak.position.z=-1.14;beak.position.y=.11;group.add(beak);
  const wingGeo=new THREE.BufferGeometry();
  const ws=profile.wings;
  const verts=new Float32Array([0,.02,0, .62*ws,.02,-.17, 1.9*ws,-.13,-.10, 0,.02,0, 1.9*ws,-.13,-.10, 1.63*ws,-.10,.42, 0,.02,0, 1.63*ws,-.10,.42, .55*ws,-.04,.55]);
  wingGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));wingGeo.computeVertexNormals();
  const wMat=new THREE.MeshStandardMaterial({color:profile.color,side:THREE.DoubleSide,roughness:.84});
  const right=new THREE.Group(),left=new THREE.Group();
  for(const [g,sign] of [[right,1],[left,-1]]){
    const plane=new THREE.Mesh(wingGeo,wMat);plane.scale.x=sign;g.add(plane);
    const edge=new THREE.Mesh(new THREE.SphereGeometry(.20,7,5),bodyMat);
    edge.scale.set(ws*4,.16,.4);edge.position.x=sign*.85*ws;edge.position.z=.18;g.add(edge);
    g.position.x=sign*.25;group.add(g);
  }
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.29,.86,4),bodyMat);
  tail.rotation.x=Math.PI/2;tail.position.z=.97;group.add(tail);
  const eyes=new THREE.Mesh(new THREE.SphereGeometry(.052,6,6),createMaterial('#172021'));
  eyes.position.set(.2,.20,-.87);group.add(eyes);
  const size=profile.id==='hummingbird'?5:profile.id==='albatross'?13:profile.id==='vulture'?11:8;
  group.scale.setScalar(size);group.userData={left,right,profile};
  birdModel=group;scene.add(group);
}
function ambient(date,dt){
  const sun=sunPosition(date),day=sun.daylight,alt=sun.altitude;
  const cloud=currentWeather.cloud,wet=currentWeather.rain,night=sun.night;
  const lightning=currentWeather.id==='storm'&&Math.sin(elapsed*1.79)*Math.sin(elapsed*.17)> .985?1.35:0;
  const color=skyNight.clone().lerp(skyEvening,clamp((day+.1)*sun.golden,.0,1)).lerp(skyDay,day*(1-sun.golden*.65));
  color.lerp(new THREE.Color('#344a58'),cloud*.35);
  scene.background.copy(color);scene.fog.color.copy(color);
  scene.fog.density=.000085+currentWeather.fog*.00038+cloud*.00005;
  const exposure=.74+day*.42-lightning*.06;
  renderer.toneMappingExposure=exposure;
  sunLight.intensity=Math.max(0,.1+day*(2.5-cloud*1.65)+lightning);
  hemi.intensity=.27+day*(1.65-cloud*.6)+lightning*.3;
  sunLight.color.setRGB(1,.73+sun.golden*.12+day*.13,.53+day*.38);
  const az=sun.azimuth;
  const sunVec=new THREE.Vector3(Math.sin(az)*Math.cos(alt),Math.sin(alt),-Math.cos(az)*Math.cos(alt));
  sunLight.position.copy(sunVec).multiplyScalar(2000);
  sunOrb.position.copy(sunVec).multiplyScalar(6600);sunOrb.visible=alt>-.07;
  moonOrb.position.copy(sunVec).multiplyScalar(-6600);moonOrb.visible=alt<.11;
  starMat.opacity=smooth(-.07,-.25,alt)*.78;
  water.material.color.copy(waterNight).lerp(waterDay,day*(1-wet*.35));
  for(const c of clouds){c.mat.opacity=clamp(.08+cloud*.76+(c.weight-.4)*.1,0,.91);c.group.visible=cloud>.05;c.group.position.x=c.baseX+Math.sin(elapsed*.007+c.weight*3)*55; }
  sound.update(currentWeather,night);
  return sun;
}
function fly(date,dt,sun){
  const day=smooth(-.14,.015,sun.altitude),targetSleep=1-day;
  sleepFactor=lerp(sleepFactor,targetSleep,1-Math.exp(-dt*.18));
  const target=birdPosition(elapsed,currentBird);
  const roostX=125,roostZ=60,roostY=terrainHeight(roostX,roostZ)+12;
  const p=new THREE.Vector3(lerp(target.x,roostX,sleepFactor),lerp(target.y,roostY,sleepFactor),lerp(target.z,roostZ,sleepFactor));
  const ahead=birdPosition(elapsed+.12,currentBird);
  const yaw=Math.atan2(-(ahead.x-target.x),-(ahead.z-target.z));
  birdModel.position.copy(p);
  const flutter=currentBird.id==='hummingbird'?20:currentBird.id==='swift'?8:currentBird.id==='albatross'?1.6:3.5;
  const amplitude=(currentBird.id==='hummingbird'?.38:.22)+flapBoost*.7;
  const flap=Math.sin(elapsed*flutter)*amplitude*(1-sleepFactor)+sleepFactor*1.15;
  birdModel.userData.left.rotation.z=-flap;
  birdModel.userData.right.rotation.z=flap;
  birdModel.rotation.set(Math.sin(elapsed*.11)*.06*(1-sleepFactor),lerp(yaw,0,sleepFactor),Math.sin(elapsed*.21)*.14*(1-sleepFactor));
  flapBoost=Math.max(0,flapBoost-dt*.65);
  return p;
}
function directCamera(bird,dt){
  const shot=Math.floor(elapsed/24)%5,phase=(elapsed%24)/24;
  const yaw=birdModel.rotation.y,forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  let target=bird.clone(),desired;
  switch(shot){
    case 0:desired=bird.clone().addScaledVector(forward,-140).add(new THREE.Vector3(74,52,0));break;
    case 1:desired=bird.clone().add(new THREE.Vector3(Math.cos(elapsed*.06)*250,85,Math.sin(elapsed*.06)*250));break;
    case 2:desired=new THREE.Vector3(1050,690,1540);target.lerp(new THREE.Vector3(0,220,0),.36);break;
    case 3:desired=bird.clone().add(new THREE.Vector3(-260,-Math.min(45,bird.y-48),120));break;
    default:desired=bird.clone().addScaledVector(forward,185).add(new THREE.Vector3(32,42,-15));break;
  }
  desired.y=Math.max(desired.y,terrainHeight(desired.x,desired.z)+24,-2);
  const ease=1-Math.exp(-dt*(phase<.08?.42:.58));
  camera.position.lerp(desired,ease);
  cameraLook.lerp(target,1-Math.exp(-dt*.75));
  camera.lookAt(cameraLook);
  const fov=shot===2?59:shot===4?50:shot===3?51:55;
  camera.fov=lerp(camera.fov,fov,1-Math.exp(-dt*.55));camera.updateProjectionMatrix();
}
function updateSea(t){
  const attr=water.geometry.attributes.position;
  // Update every other frame to keep the procedural ocean affordable.
  if(status.frames%2)return;
  for(let i=0;i<attr.count;i++){
    const k=i*3,x=waterPositions[k],z=waterPositions[k+2];
    attr.setY(i,Math.sin(x*.008+t*.65)*2.0+Math.cos(z*.006+t*.52)*1.7+Math.sin((x+z)*.012+t*.82)*.8);
  }
  attr.needsUpdate=true;water.geometry.computeVertexNormals();
}
function animate(now){
  requestAnimationFrame(animate);
  const deltaRaw=Math.max(0,(now-lastFrame)/1000),dt=Math.min(deltaRaw,.12);lastFrame=now;
  if(!Number.isFinite(dt))return;
  elapsed+=dt;simMs+=deltaRaw*1000*speed;
  const date=new Date(simMs),sun=ambient(date,dt);
  const position=fly(date,dt,sun);
  directCamera(position,dt);
  updateSea(elapsed);
  renderer.render(scene,camera);
  status.frames++;renderFrames++;fpsTimer+=dt;
  if(fpsTimer>=1){
    status.fps=Math.round(renderFrames/fpsTimer);$('fps').textContent=status.fps+' FPS';renderFrames=0;fpsTimer=0;
    const hour=madridHour(date), hh=Math.floor(hour),mm=Math.floor(hour%1*60);
    $('clock').textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    $('bird-name').textContent=currentBird.name;
    $('weather-name').textContent=currentWeather.name;
    $('season-name').textContent=season(date);
    $('speed-name').textContent='×'+speed;
    $('scene-caption').textContent= sun.night?'Silencio bajo las estrellas':hour<9?'La primera luz sobre el agua':hour>=18?'La calma del atardecer':'El cielo siempre cambia';
    $('phase').textContent=sun.night?'LA ISLA DESCANSA':currentBird.name.toUpperCase()+' EN LIBERTAD';
    status.time=date.toISOString();status.sunAltitude=sun.altitude;status.bird=currentBird.id;status.weather=currentWeather.id;
  }
}
function onResize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
async function audioToggle(){try{await sound.toggle();$('audio-btn').classList.toggle('active',sound.enabled)}catch(err){showError(err)}}
function png(){try{renderer.render(scene,camera);const a=document.createElement('a');a.download='vuelo-'+new Date(simMs).toISOString().replaceAll(':','-')+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click()}catch(err){showError(err)}}
function setHour(h){simMs=withMadridHour(new Date(simMs),h).getTime()}
function changeWeather(){const i=WEATHER.indexOf(currentWeather);currentWeather=WEATHER[(i+1)%WEATHER.length]}
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
  $('enter-btn').addEventListener('click',async()=>{$('intro').classList.add('off');await audioToggle()});
  $('audio-btn').addEventListener('click',audioToggle);
  $('photo-btn').addEventListener('click',png);
  $('help-btn').addEventListener('click',()=>$('help').classList.toggle('hidden'));
  $('close-help').addEventListener('click',()=>$('help').classList.add('hidden'));
  const picker=$('bird-picker');
  $('bird-btn').addEventListener('click',()=>picker.classList.toggle('hidden'));
  $('close-birds').addEventListener('click',()=>picker.classList.add('hidden'));
  window.addEventListener('keydown',(event)=>{
    if(event.ctrlKey||event.altKey||event.metaKey)return;
    const key=event.key.toLowerCase();
    if([' ','1','2','3','4','5','6','7','8','h','f','p','m','b','escape'].includes(key))event.preventDefault();
    switch(key){
      case '1':setHour(6.4);break;case '2':setHour(12.5);break;case '3':setHour(18.5);break;case '4':setHour(23);break;
      case '5':changeWeather();break;case '6':speed=1;break;case '7':speed=60;break;case '8':speed=600;break;
      case ' ':flapBoost=1;break;
      case 'h':document.body.classList.toggle('no-ui');break;
      case 'f':if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();break;
      case 'p':png();break;case 'm':audioToggle();break;
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
  ['Sol físico aproximado',Number.isFinite(sunPosition(new Date(simMs)).altitude)],
  ['Reloj Europe/Madrid',madridHour(new Date(simMs))>=0],
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
  ['Perfil de calidad',scaleFactor>=.7]
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
