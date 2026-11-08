// VE-05: neutral GLB quality-inspection scene (never part of the ecology runtime).
import * as THREE from 'three';
import {BirdAssetLibrary} from './BirdAssetLibrary.js';
const params=new URLSearchParams(location.search);
const requested=params.get('view')||'threeQuarter';
const views={
  front:[0,.115,-.55],side:[.55,.075,0],top:[0,.55,-.00001],
  threeQuarter:[.42,.23,-.39],back:[0,.09,.55]
};
const view=Object.hasOwn(views,requested)?requested:'threeQuarter';
const lod=params.get('lod')==='1'?1:0;
const target=document.getElementById('asset-viewport');
const info=document.getElementById('qa-status');
for(const a of document.querySelectorAll('nav a[data-view]')){
  a.href='?view='+a.dataset.view+'&lod='+lod;
  if(a.dataset.view===view)a.setAttribute('aria-current','page');
}
for(const a of document.querySelectorAll('nav a[data-lod]')){
  a.href='?view='+view+'&lod='+a.dataset.lod;
  if(Number(a.dataset.lod)===lod)a.setAttribute('aria-current','page');
}
window.__VE05_PREVIEW__={ready:false,view,lod,error:null};
let renderer,handle,library;
async function init(){
  const width=Math.max(600,target.clientWidth);
  const height=Math.max(360,target.clientHeight);
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,
    powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
  renderer.setSize(width,height);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.14;
  target.append(renderer.domElement);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#d5dccc');
  scene.add(new THREE.HemisphereLight(0xeaf8ff,0x51645b,2.2));
  const main=new THREE.DirectionalLight(0xffffff,3);
  main.position.set(-.3,.7,-.35);scene.add(main);
  const rim=new THREE.DirectionalLight(0xffecd0,1.4);
  rim.position.set(.3,.25,.5);scene.add(rim);
  library=new BirdAssetLibrary({basePath:import.meta.env.BASE_URL+'assets/birds/',maxIdle:2});
  handle=await library.acquire('kingfisher');
  handle.model.autoUpdate=false;
  for(let i=0;i<handle.model.levels.length;i++)
    handle.model.levels[i].object.visible=(i===lod);
  scene.add(handle.model);
  const aspect=width/height,verticalSize=.31;
  const camera=new THREE.OrthographicCamera(
    -verticalSize*aspect/2,verticalSize*aspect/2,
    verticalSize/2,-verticalSize/2,.01,5);
  camera.position.set(...views[view]);
  if(view==='top')camera.up.set(0,0,-1);
  camera.lookAt(0,0,0);
  camera.updateProjectionMatrix();
  // Assets must match the source profile without "fit to view" scaling.
  const bounds=new THREE.Box3().setFromObject(handle.model);
  const size=bounds.getSize(new THREE.Vector3());
  renderer.render(scene,camera);
  const metrics=handle.statistics[lod?'far':'near'];
  const snapshot={
    ready:true,view,lod,error:null,
    sizeMetres:{x:size.x,y:size.y,z:size.z},
    drawCalls:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles,
    gpuGeometries:renderer.info.memory.geometries,
    gpuTextures:renderer.info.memory.textures,
    ...metrics
  };
  info.textContent='ALCEDO ATTHIS · '+(lod?'LOD1':'LOD0')+'\n'+view+
    '\n'+metrics.triangles+' tris · '+metrics.meshes+' mallas'+
    '\n'+metrics.bones+' huesos · '+size.x.toFixed(3)+' m de ala a ala'+
    '\n'+snapshot.drawCalls+' draw calls · '+snapshot.gpuGeometries+' geometrías GPU';
  window.__VE05_PREVIEW__=snapshot;
}
init().catch(error=>{
  window.__VE05_PREVIEW__={ready:false,view,lod,error:String(error)};
  info.textContent='ERROR: '+String(error);
  console.error('VE05 asset preview',error);
});
window.addEventListener('pagehide',()=>{
  if(handle)handle.release();
  library?.dispose();
  renderer?.dispose();
},{once:true});
