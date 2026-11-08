// VE-05 presentation-only GLB cache. No ecological state, DOM or timestep dependency.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinnedScene} from 'three/addons/utils/SkeletonUtils.js';

export const REFERENCE_ASSETS=Object.freeze({
  kingfisher:Object.freeze({
    lod0:'kingfisher-lod0.glb',lod1:'kingfisher-lod1.glb',
    nominalWingspan:0.26,lowLodDistance:8
  })
});
function disposeScene(root,seen){
  root.traverse(node=>{
    if(!node.isMesh)return;
    const g=node.geometry;
    if(g&&!seen.has(g)){seen.add(g);g.dispose();}
    const mats=Array.isArray(node.material)?node.material:[node.material];
    for(const mat of mats){
      if(!mat||seen.has(mat))continue;
      seen.add(mat);
      for(const v of Object.values(mat))if(v?.isTexture&&!seen.has(v)){seen.add(v);v.dispose();}
      mat.dispose();
    }
  });
}
function meshStatistics(group){
  let meshes=0,triangles=0,vertices=0,bones=0;
  group.traverse(node=>{
    if(node.isBone)bones++;
    if(node.isMesh){
      meshes++;
      const geo=node.geometry;
      vertices+=geo.getAttribute('position')?.count??0;
      triangles+=(geo.index?.count??geo.getAttribute('position')?.count??0)/3;
    }
  });
  return {meshes,triangles:Math.round(triangles),vertices,bones};
}
export class BirdAssetLibrary {
  constructor({loader=new GLTFLoader(),basePath='/assets/birds/',maxIdle=2}={}){
    this.loader=loader;
    this.basePath=basePath.endsWith('/')?basePath:basePath+'/';
    this.maxIdle=maxIdle;
    this.entries=new Map();
    this.disposed=false;
  }
  load(url){
    if(this.disposed)throw Error('BirdAssetLibrary disposed');
    let entry=this.entries.get(url);
    if(!entry){
      entry={url,users:0,root:null,promise:null,lastAccess:0};
      entry.promise=Promise.resolve().then(()=>this.loader.loadAsync(url)).then(gltf=>{
        if(!gltf?.scene)throw Error('Invalid glTF: missing scene ('+url+')');
        entry.root=gltf.scene;
        if(this.disposed)throw Error('BirdAssetLibrary disposed while loading');
        return entry.root;
      }).catch(error=>{
        this.entries.delete(url);
        if(entry.root)disposeScene(entry.root,new Set());
        throw error;
      });
      this.entries.set(url,entry);
    }
    entry.users++;
    entry.lastAccess=Date.now();
    return {entry,promise:entry.promise};
  }
  async acquire(species){
    if(this.disposed)throw Error('BirdAssetLibrary disposed');
    const manifest=REFERENCE_ASSETS[species];
    if(!manifest)throw new RangeError('GLB bird unavailable: '+species);
    const requests=[manifest.lod0,manifest.lod1].map(file=>this.load(this.basePath+file));
    let released=false,instance=null;
    const release=()=>{
      if(released)return;
      released=true;
      // Clones share meshes/materials with templates, but each skin has its
      // own Skeleton and potential boneTexture allocated by WebGLRenderer.
      if(instance){
        instance.parent?.remove(instance);
        const skeletons=new Set();
        instance.traverse(node=>{
          if(node.isSkinnedMesh&&node.skeleton)skeletons.add(node.skeleton);
        });
        for(const skeleton of skeletons)skeleton.dispose();
        instance=null;
      }
      for(const {entry} of requests)entry.users=Math.max(0,entry.users-1);
      this.evictUnused();
    };
    try{
      const [near,far]=await Promise.all(requests.map(r=>r.promise));
      if(this.disposed)throw Error('BirdAssetLibrary disposed');
      const lod=new THREE.LOD();lod.name='BirdLOD.'+species;
      lod.addLevel(cloneSkinnedScene(near),0);
      lod.addLevel(cloneSkinnedScene(far),manifest.lowLodDistance);
      lod.autoUpdate=true;
      instance=lod;
      return {model:lod,release,statistics:{
        near:meshStatistics(near),far:meshStatistics(far),
        distance:manifest.lowLodDistance,nominalWingspan:manifest.nominalWingspan
      }};
    }catch(error){release();throw error;}
  }
  evictUnused(force=false){
    const idle=[...this.entries.values()].filter(e=>e.users===0&&e.root);
    idle.sort((a,b)=>a.lastAccess-b.lastAccess);
    const remove=force?idle:idle.slice(0,Math.max(0,idle.length-this.maxIdle));
    const seen=new Set();
    for(const entry of remove){
      this.entries.delete(entry.url);
      disposeScene(entry.root,seen);
    }
  }
  clearUnused(){this.evictUnused(true);}
  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    const seen=new Set();
    for(const entry of this.entries.values())if(entry.root)disposeScene(entry.root,seen);
    this.entries.clear();
  }
  get stats(){
    return {cached:this.entries.size,active:[...this.entries.values()].filter(e=>e.users>0).length,
      disposed:this.disposed};
  }
}
export function canUseBirdAssets({renderer,navigator,search=''}={}){
  const params=new URLSearchParams(search);
  if(params.get('assets')==='procedural')return false;
  if(!renderer?.capabilities?.isWebGL2)return false;
  if(Number.isFinite(navigator?.deviceMemory)&&navigator.deviceMemory<=2)return false;
  return true;
}
// Pose bridge reuses VE-04's existing procedural rig angles.
// It is NOT the VE-06 AnimationMixer/clip/blending system.
export function bridgeProceduralPose(assetLOD,procedural){
  if(!assetLOD||!procedural?.userData?.left)return;
  const rig=procedural.userData;
  for(const level of assetLOD.levels){
    const bones=new Map();
    level.object.traverse(node=>{if(node.isBone)bones.set(node.name,node);});
    for(const [name,angle] of [
      ['Wing_L',rig.left.pivot.rotation.z],['Wing_R',rig.right.pivot.rotation.z],
      ['WingTip_L',rig.left.tip.rotation.z],['WingTip_R',rig.right.tip.rotation.z]
    ])if(bones.has(name))bones.get(name).rotation.z=angle;
    if(bones.has('Head')){
      bones.get('Head').rotation.x=rig.head.rotation.x;
      bones.get('Head').rotation.y=rig.head.rotation.y;
    }
    if(bones.has('Tail')){
      bones.get('Tail').rotation.x=rig.tail.rotation.x;
      bones.get('Tail').rotation.y=rig.tail.rotation.y;
    }
  }
}
