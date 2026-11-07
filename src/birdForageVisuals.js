import {terrainHeight,clamp} from './core.js';
import {oceanSurfaceHeight} from './oceanMotion.js';

// One reusable, scene-linked food cue for the currently filmed bird.
// No per-frame geometry allocations, particles or new meshes.
export function createBirdForageVisuals(THREE,scene,seed=1988){
 const root=new THREE.Group();root.name='observable-foraging-site';scene.add(root);
 const sphere=new THREE.SphereGeometry(1,12,9);
 const cone=new THREE.ConeGeometry(1,1,9);
 const cylinder=new THREE.CylinderGeometry(1,1,1,9);
 const mats={
  fish:new THREE.MeshStandardMaterial({color:0x91bbc0,metalness:.22,roughness:.5}),
  fin:new THREE.MeshStandardMaterial({color:0x547d88,roughness:.8}),
  flower:new THREE.MeshStandardMaterial({color:0xef8dba,roughness:.9,side:THREE.DoubleSide}),
  pollen:new THREE.MeshStandardMaterial({color:0xffd36b,roughness:1}),
  stem:new THREE.MeshStandardMaterial({color:0x327d43,roughness:1}),
  insect:new THREE.MeshStandardMaterial({color:0x38301d,roughness:1}),
  wing:new THREE.MeshStandardMaterial({color:0xd6e6d1,roughness:.8,transparent:true,opacity:.77}),
  prey:new THREE.MeshStandardMaterial({color:0x8a7154,roughness:1}),
  carrion:new THREE.MeshStandardMaterial({color:0x665543,roughness:1})
 };
 function part(group,geometry,mat,pos,scale,rotation){
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.position.set(...pos);mesh.scale.set(...scale);
  if(rotation)mesh.rotation.set(...rotation);
  group.add(mesh);return mesh;
 }
 const models={};
 models.fish=new THREE.Group();
 part(models.fish,sphere,mats.fish,[0,0,0],[.68,.22,.29]);
 part(models.fish,cone,mats.fin,[.67,0,0],[.30,.15,.29],[0,0,-Math.PI/2]);
 part(models.fish,cone,mats.fin,[-.09,.24,0],[.17,.20,.22],[Math.PI/2,0,0]);
 models.nectar=new THREE.Group();
 part(models.nectar,cylinder,mats.stem,[0,-.52,0],[.045,.96,.045]);
 for(let j=0;j<6;j++){
  const a=j*Math.PI/3;
  part(models.nectar,sphere,mats.flower,[Math.cos(a)*.26,0,Math.sin(a)*.26],[.28,.11,.17],[0,a,0]);
 }
 part(models.nectar,sphere,mats.pollen,[0,.03,0],[.19,.16,.19]);
 models.insect=new THREE.Group();
 part(models.insect,sphere,mats.insect,[0,0,0],[.13,.13,.27]);
 const insectWings=[];
 for(const side of [-1,1])insectWings.push(part(models.insect,sphere,mats.wing,[side*.17,.09,-.02],[.20,.025,.15]));
 models['small-prey']=new THREE.Group();
 part(models['small-prey'],sphere,mats.prey,[0,0,0],[.40,.20,.23]);
 part(models['small-prey'],sphere,mats.prey,[-.34,.05,0],[.16,.16,.15]);
 for(const side of [-1,1])part(models['small-prey'],sphere,mats.prey,[-.39,.23,side*.10],[.07,.19,.06]);
 part(models['small-prey'],cylinder,mats.prey,[.43,-.02,0],[.024,.54,.024],[0,0,Math.PI/2]);
 models.carrion=new THREE.Group();
 part(models.carrion,sphere,mats.carrion,[0,0,0],[.64,.22,.39],[0,.35,0]);
 part(models.carrion,sphere,mats.prey,[-.40,.10,.20],[.20,.13,.15]);
 for(const group of Object.values(models)){root.add(group);group.visible=false;}
 let currentKind=null;
 function update(action,t=0){
  const target=action?.foodTarget;
  const approaching=['approach','landing','feed'].includes(action?.state);
  const distance=target?Math.hypot(action.x-target.x,action.z-target.z):Infinity;
  const visible=Boolean(target&&approaching&&distance<95&&
    (action.state!=='feed'||(action.feedingProgress??0)<.88));
  root.visible=visible;
  if(!visible)return {visible:false,kind:null};
  const kind=target.kind;
  const model=models[kind];
  if(!model){root.visible=false;return {visible:false,kind:null};}
  if(currentKind!==kind){
   for(const [name,group] of Object.entries(models))group.visible=name===kind;
   currentKind=kind;
  }
  const ground=terrainHeight(target.x,target.z,seed);
  let height=ground+.23;
  if(kind==='fish')height=target.biome==='ocean'?
    oceanSurfaceHeight(target.x,target.z,t,0)+.12:ground+.42;
  if(kind==='nectar')height=ground+1.15;
  if(kind==='insect')height=target.contactY??ground+7;
  root.position.set(target.x,height,target.z);
  const scale=kind==='nectar'?.82:kind==='insect'?.63:
    clamp((action.wingspan??1.2)*.45,.42,1.5);
  root.scale.setScalar(scale);
  model.rotation.y=t*.22;
  model.position.y=kind==='insect'?.23*Math.sin(t*10):
    kind==='fish'?.13*Math.sin(t*5.3):0;
  if(kind==='insect')for(let i=0;i<insectWings.length;i++)
    insectWings[i].rotation.z=(i?1:-1)*(.33+.27*Math.sin(t*35));
  // A caught resource becomes invisible after the capture, not at arbitrary
  // intervals while the bird is still looking for it.
  const captured=action.state==='feed'?clamp(((action.feedingProgress??0)-.55)/.30):0;
  model.scale.setScalar(Math.max(.001,1-captured));
  return {visible:true,kind,distance};
 }
 return {root,update,dispose(){
  scene.remove(root);
  for(const group of Object.values(models))group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  for(const material of Object.values(mats))material.dispose();
 }};
}
