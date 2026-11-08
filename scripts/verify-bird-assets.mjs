import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=resolve('public/assets/birds');
const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
const loader=new GLTFLoader();
const checked=[];
for(const lod of manifest.lods){
  const binary=await readFile(resolve(directory,lod.file));
  assert.equal(binary.toString('ascii',0,4),'glTF','GLB magic');
  const object=await new Promise((resolve,reject)=>loader.parse(
    binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),
    '',gltf=>resolve(gltf.scene),reject));
  const names=new Set(),bones=[],surfaces=[];
  let triangles=0,skinned=0;
  object.traverse(node=>{
    if(node.name)names.add(node.name);
    if(node.isBone)bones.push(node);
    if(node.isSkinnedMesh)skinned++;
    if(node.isMesh){
      const g=node.geometry;
      triangles+=(g.index?.count??g.getAttribute('position').count)/3;
      if(node.name.startsWith('WingSurface_'))surfaces.push(node);
    }
  });
  for(const name of ['Body','Head','Tail','Wing_L','Wing_R','WingTip_L','WingTip_R',
    'Leg_L','Leg_R','Foot_L','Foot_R','Bill_upper','Bill_lower',
    'Breast_rufous','Eye_L','Eye_R'])assert.ok(names.has(name),lod.file+': '+name);
  assert.equal([...bones].filter(b=>/^Wing_[LR]$/.test(b.name)).length,2,
    'exactly two anatomical wing roots');
  assert.ok(skinned>=3,'glTF must include wing skins and complete anatomical keel skin');
  assert.ok(bones.length>=12,'Head, Tail, Wing, Leg and Foot must all import as real THREE.Bone nodes');
  assert.ok(surfaces.length>=2,'single wing surface for each side');
  assert.ok(triangles>150,'Anatomical geometry missing');
  const bounds=new THREE.Box3().setFromObject(object);
  const span=bounds.max.x-bounds.min.x;
  assert.ok(Math.abs(span-.26)<.015,'wingspan must match the 26 cm species profile: '+span);
  const length=bounds.max.z-bounds.min.z;
  assert.ok(length>=.135&&length<=.16,'kingfisher length must be ~14.5 cm, not 24 cm: '+length);
  assert.ok(Math.abs(triangles-lod.triangles)<5,'manifest geometry mismatch');
  checked.push({lod:lod.lod,triangles:Math.round(triangles),bytes:binary.byteLength,
    skinned,bones:bones.length,wingspanMetres:+span.toFixed(5),lengthMetres:+length.toFixed(5),wingSurfaces:surfaces.length});
}
assert.ok(checked[0].triangles>checked[1].triangles*1.7,'LOD1 must reduce geometry substantially');
const report={validated:true,species:manifest.species,checked,
  note:'Node CPU geometry validation; no physical GPU benchmark'};
await mkdir('artifacts/assets',{recursive:true});
await writeFile('artifacts/assets/geometry.json',JSON.stringify(report,null,2)+'\n');
console.log('VE-05 GLB verified:',JSON.stringify(report));
