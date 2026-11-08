// VUELO VE-05 — Original, deterministic kingfisher reference mesh.
// Node 22 + Three.js 0.180.0. No network downloads or external asset licences.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const output=resolve(dirname(fileURLToPath(import.meta.url)),'../public/assets/birds');
const manifestPath=resolve(output,'manifest.json');
const materials=Object.fromEntries(Object.entries({
  cobalt:0x14658d, turquoise:0x18a8bc, midnight:0x12394f, belly:0xd98e45,
  throat:0xffe8bd, bill:0x1a2630, iris:0x241b19, foot:0x8b513d, highlight:0xeaf9ed
}).map(([name,color])=>[name,new THREE.MeshStandardMaterial({
  name:'MAT_'+name.toUpperCase(),color,roughness:name==='bill'?.63:.9,
  metalness:0,side:THREE.DoubleSide
})]));

if(!globalThis.FileReader)globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result='data:'+blob.type+';base64,'+Buffer.from(result).toString('base64');this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
};

function mesh(name,geometry,material){
  const m=new THREE.Mesh(geometry,materials[material]);m.name=name;return m;
}
function loft(stations,sides=20){
  const verts=[],indices=[];
  for(const [z,y,rx,ry] of stations)for(let j=0;j<sides;j++){
    const t=j/sides*Math.PI*2;
    verts.push(Math.cos(t)*rx,y+Math.sin(t)*ry,z);
  }
  for(let i=0;i<stations.length-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
    indices.push(a,b,c,b,d,c);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
function pathTube(name,start,end,radius,material,steps=7,sides=7){
  const points=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps,p=start.clone().lerp(end,t);
    const v=.18+.82*Math.sin((.12+.88*t)*Math.PI);
    points.push([p.z,p.y,p.x+Math.max(.00008,radius*v),Math.max(.00008,radius*v)]);
  }
  // Tube along Z for bills and toes whose paths also vary in Y.
  return mesh(name,loft(points,sides),material);
}
function feather(origin,tip,width,segments=10){
  const vertices=[],indices=[];
  const delta=tip.clone().sub(origin);
  const transverse=new THREE.Vector3(-delta.z,0,delta.x).normalize();
  for(let i=0;i<=segments;i++){
    const u=i/segments,p=origin.clone().lerp(tip,u);
    p.y+=.0025*Math.sin(u*Math.PI)-.002*u*u;
    const w=width*Math.pow(Math.sin(Math.PI*(.04+.92*u)),.7)*(1-.22*u);
    for(const s of [-1,0,1]){
      const pt=p.clone().addScaledVector(transverse,w*s);
      pt.y+=s===0?.0008*Math.sin(Math.PI*u):0;
      vertices.push(pt.x,pt.y,pt.z);
    }
    if(i<segments){const k=i*3;indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function wingMembrane(side,detail){
  const nx=detail?22:9,nz=detail?7:3,verts=[],indices=[];
  for(let i=0;i<=nx;i++){
    const u=i/nx,x=side*(.014+.110*u),lead=-.031+.024*u*u;
    const chord=(.056*(1-u)**.55+.006)*(1-.1*u);
    for(let j=0;j<=nz;j++){
      const v=j/nz;
      const z=lead+chord*v,y=.009+Math.sin(u*Math.PI)*.0032+Math.sin(v*Math.PI)*.003;
      verts.push(x,y,z);
      if(i<nx&&j<nz){const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);
  g.computeVertexNormals();return g;
}
function skin(geometry,side,bones){
  const positions=geometry.getAttribute('position'),indices=[],weights=[];
  for(let i=0;i<positions.count;i++){
    const t=Math.max(0,Math.min(1,(Math.abs(positions.getX(i))-.015)/.108));
    const tip=Math.max(0,Math.min(1,(t-.30)/.62));
    indices.push(0,1,0,0);weights.push(1-tip,tip,0,0);
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const model=new THREE.SkinnedMesh(geometry,materials.midnight);
  model.name='SKIN_Wing_'+(side<0?'L':'R');
  model.userData={side,rig:'WingRoot/WingTip'};
  model.bind(new THREE.Skeleton(bones));
  return model;
}
function wingWing(root,bodyBone,side,detail){
  const suffix=side<0?'L':'R';
  const shoulder=new THREE.Bone();shoulder.name='Wing_'+suffix;
  shoulder.position.set(side*.014,.009,-.012);
  bodyBone.add(shoulder);
  const wrist=new THREE.Bone();wrist.name='WingTip_'+suffix;
  wrist.position.set(side*.069,0,.007);
  shoulder.add(wrist);
  root.updateMatrixWorld(true);
  const skeletonBones=[shoulder,wrist];
  const membrane=wingMembrane(side,detail);
  const geometryGroups={cobalt:[membrane],turquoise:[],midnight:[]};
  const featherCount=detail?15:5;
  for(let j=0;j<featherCount;j++){
    const t=(j+.45)/featherCount,x=side*(.018+.101*t);
    const begin=new THREE.Vector3(x,.011,-.027+.029*t*t);
    const end=new THREE.Vector3(x+side*(.020*(.4+.6*t)),.006,
      .019+.017*(1-t)+.013*t*t);
    const color=j%5===0?'midnight':'cobalt';
    geometryGroups[color].push(feather(begin,end,detail?.0036:.005,detail?9:5));
  }
  if(detail){
    for(let row=0;row<2;row++)for(let j=0;j<14;j++){
      const t=(j+.35)/14,x=side*(.019+.087*t);
      const front=new THREE.Vector3(x,.013+.001*row,-.022+.023*t*t+row*.010);
      const back=new THREE.Vector3(x+side*.008,.012,.001+.024*(1-t)+row*.009);
      geometryGroups[row===0?'turquoise':'cobalt'].push(feather(front,back,.0033,7));
    }
    for(let j=0;j<9;j++){
      const t=(j+.5)/9;
      const from=new THREE.Vector3(side*(.091+t*.015),.010,-.006+t*.004);
      const to=new THREE.Vector3(side*(.121+t*.007),.002,.003+t*.024);
      geometryGroups.midnight.push(feather(from,to,.0031,8));
    }
  }
  for(const [name,geos] of Object.entries(geometryGroups)){
    if(!geos.length)continue;
    const merged=mergeGeometries(geos,false);
    if(!merged)throw Error('Unable to merge '+name+' wing surfaces');
    for(const g of geos)g.dispose();
    const part=skin(merged,side,skeletonBones);
    part.name='WingSurface_'+suffix+'.'+name;
    part.material=materials[name];
    root.add(part);
  }
}
function referenceBird(detail){
  const root=new THREE.Group();root.name='Kingfisher_AlcedoAtthis';
  root.userData={species:'kingfisher',authoringUnit:'metre',forward:'-Z',up:'+Y',wings:2,
    purpose:'VE-05 rigged static reference, no clips'};
  const armature=new THREE.Group();armature.name='Armature';root.add(armature);
  const rootBone=new THREE.Bone();rootBone.name='Root';armature.add(rootBone);
  const bodyBone=new THREE.Bone();bodyBone.name='Body';rootBone.add(bodyBone);
  const headBone=new THREE.Bone();headBone.name='Head';headBone.position.set(0,.025,-.048);bodyBone.add(headBone);
  const tailBone=new THREE.Bone();tailBone.name='Tail';tailBone.position.set(0,-.009,.054);bodyBone.add(tailBone);
  for(const side of [-1,1]){
    const suffix=side<0?'L':'R';
    const legBone=new THREE.Bone();legBone.name='Leg_'+suffix;
    legBone.position.set(side*.010,-.020,.024);bodyBone.add(legBone);
    const footBone=new THREE.Bone();footBone.name='Foot_'+suffix;
    footBone.position.set(0,-.023,-.002);legBone.add(footBone);
    legBone.add(pathTube('Tarsus.'+suffix,new THREE.Vector3(0,0,0),
      new THREE.Vector3(0,-.025,.002),.0016,'foot',5,7));
    for(let toe=-1;toe<=1;toe++){
      footBone.add(pathTube('Toe.'+suffix+'.'+toe,
        new THREE.Vector3(0,0,0),new THREE.Vector3(toe*.005,-.002,-.014+(toe===0?-.003:0)),
        .0011,'foot',5,6));
    }
  }
  bodyBone.add(mesh('Body_dorsal',loft([
    [-.053,.007,.001,.001],[-.043,.008,.016,.014],[-.018,.006,.020,.020],
    [.014,.003,.020,.018],[.043,0,.015,.013],[.064,-.003,.003,.003]
  ],detail?28:14),'cobalt'));
  bodyBone.add(mesh('Breast_rufous',loft([
    [-.047,-.005,.001,.001],[-.031,-.009,.014,.012],
    [-.009,-.012,.018,.014],[.018,-.014,.017,.012],
    [.037,-.010,.011,.008],[.053,-.005,.001,.001]
  ],detail?24:12),'belly'));
  headBone.add(mesh('Head.crown',loft([
    [-.028,0,.001,.001],[-.022,.003,.014,.013],
    [-.010,.006,.018,.016],[.007,.003,.018,.015],[.019,-.003,.010,.010],
    [.023,-.003,.001,.001]
  ],detail?24:12),'turquoise'));
  headBone.add(mesh('Throat.white',loft([
    [-.027,-.011,.001,.001],[-.017,-.012,.012,.006],
    [0,-.014,.014,.009],[.016,-.012,.006,.004]
  ],detail?18:10),'throat'));
  // Tapered spear bill, independently modelled upper and lower mandibles.
  headBone.add(mesh('Bill_upper',loft([
    [-.072,-.004,.0001,.0001],[-.062,-.004,.002,.0015],
    [-.046,-.002,.0043,.0031],[-.027,-.002,.0062,.0035]
  ],detail?8:6),'bill'));
  headBone.add(mesh('Bill_lower',loft([
    [-.070,-.006,.0001,.0001],[-.054,-.008,.003,.0008],
    [-.027,-.006,.005,.0017]
  ],detail?8:6),'bill'));
  for(const side of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.0036,detail?12:7,detail?9:6),materials.iris);
    eye.name='Eye_'+(side<0?'L':'R');eye.position.set(side*.016,.008,-.012);
    headBone.add(eye);
    if(detail){
      const glint=new THREE.Mesh(new THREE.SphereGeometry(.0009,6,5),materials.highlight);
      glint.position.set(side*.018,.0097,-.0138);glint.name='EyeHighlight.'+(side<0?'L':'R');
      headBone.add(glint);
    }
  }
  for(let i=-3;i<=3;i++){
    const tip=new THREE.Vector3(i*.003,-.013,.102- Math.abs(i)*.006);
    tailBone.add(mesh('Rectrix.'+i,feather(new THREE.Vector3(i*.002,0,0),
      tip,.0045,detail?11:6),i%2===0?'cobalt':'midnight'));
  }
  for(let side of [-1,1])wingWing(root,bodyBone,side,detail);
  if(detail){
    // Small head and scapular markings, not a duplicate wing silhouette.
    for(let side of [-1,1])for(let i=0;i<7;i++){
      const z=-.015+i*.006;
      bodyBone.add(mesh('Scapular.'+(side<0?'L':'R')+'.'+i,
        feather(new THREE.Vector3(side*.016,.017,z),new THREE.Vector3(side*.023,.005,z+.013),.0021,7),
        i%2?'cobalt':'turquoise'));
    }
  }
  root.updateMatrixWorld(true);
  return root;
}
async function exportGLB(scene){
  return await new Promise((ok,fail)=>new GLTFExporter().parse(scene,
    result=>ok(Buffer.from(result)),fail,{binary:true,onlyVisible:true,
      truncateDrawRange:true,maxTextureSize:1024,includeCustomExtensions:false}));
}
await mkdir(output,{recursive:true});
const entries=[];
for(const lod of [0,1]){
  const scene=referenceBird(lod===0);
  const content=await exportGLB(scene);
  const filename='kingfisher-lod'+lod+'.glb';
  await writeFile(resolve(output,filename),content);
  let vertices=0,triangles=0,meshes=0,bones=0;
  scene.traverse(node=>{
    if(node.isBone)bones++;
    if(node.isMesh){
      meshes++;
      const g=node.geometry;vertices+=g.getAttribute('position').count;
      triangles+=(g.index?.count??g.getAttribute('position').count)/3;
    }
  });
  entries.push({lod,file:filename,bytes:content.byteLength,vertices,triangles:Math.round(triangles),meshes,bones});
  console.log('VE-05',filename,content.byteLength,'bytes',Math.round(triangles),'tris',bones,'bones');
}
const manifest={species:'kingfisher',scientificName:'Alcedo atthis',
  revision:'VE-05',metersPerUnit:1,up:'Y',forward:'-Z',wings:2,
  authoredBy:'VUELO original deterministic mesh generator',source:'scripts/build-bird-assets.mjs',
  license:'Original asset: project owner must confirm redistribution terms',
  lods:entries};
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
