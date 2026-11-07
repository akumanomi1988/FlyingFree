import {random,clamp,terrainHeight} from './core.js';
import {habitatAt} from './ecology.js';

// Wildlife fills the same world-space cells regardless of camera direction.
// The renderer draws all flock bodies and animated wings in three instanced
// draw calls, and no per-bird Object3D is ever attached to the scene.
export function createRegionalBirds(THREE,scene,seed=1988,quality=1){
 const root=new THREE.Group();root.name='regional-wild-bird-populations';
 scene.add(root);
 const max=Math.round(300*clamp(quality,.5,1.2)),spacing=95,range=4;
 const bodyGeo=new THREE.SphereGeometry(1,9,7);
 bodyGeo.scale(.13,.115,.36);
 const headGeo=new THREE.SphereGeometry(1,9,7);
 headGeo.scale(.108,.105,.13);headGeo.translate(0,.07,-.33);
 const wingGeo=new THREE.BufferGeometry();
 const wingPositions=[
    -.12,.06,-.12, -.82,.065,.18, -.64,.055,-.15,
    -.12,.06,-.12, -.64,.055,-.15, -.24,.06,-.24,
     .12,.06,-.12, .64,.055,-.15, .82,.065,.18,
     .12,.06,-.12, .24,.06,-.24, .64,.055,-.15,
    -.08,.03,.26,-.25,.03,.59,0,.03,.43,
     .08,.03,.26,0,.03,.43,.25,.03,.59
 ];
 wingGeo.setAttribute('position',new THREE.Float32BufferAttribute(wingPositions,3));
 wingGeo.computeVertexNormals();
 const mainMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94,side:THREE.DoubleSide});
 const wingMat=mainMat.clone();
 const flutter={value:0};
 wingMat.onBeforeCompile=shader=>{
  shader.uniforms.uRegionalFlight=flutter;
  shader.vertexShader=shader.vertexShader.replace('void main() {',
    'uniform float uRegionalFlight;\nvoid main() {');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n#ifdef USE_INSTANCING\n transformed.y += abs(position.x) * .40 * sin(uRegionalFlight*7.0 + instanceMatrix[3].x*.028 + instanceMatrix[3].z*.019);\n#endif');
 };
 wingMat.customProgramCacheKey=()=> 'instanced-regional-wingbeats-v1';
 const body=new THREE.InstancedMesh(bodyGeo,mainMat,max);
 const head=new THREE.InstancedMesh(headGeo,mainMat,max);
 const wings=new THREE.InstancedMesh(wingGeo,wingMat,max);
 const instances=[body,head,wings],dummy=new THREE.Object3D();
 for(const m of instances){m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled=false;root.add(m);}
 const records=[];
 const colors={ocean:[0xd6e1dc,0xa7bdc5,0xf0ebce],shore:[0xe4e0d0,0xb6a29b],
   wetland:[0x468d9b,0x74644f,0xe5d8bb],forest:[0x5f8f56,0x54758b,0xa98c5c],
   meadow:[0x8c6954,0x4b7d82,0x6f685b],rock:[0x987c5f,0x797d81],
   highland:[0x745f49,0x8f785f]};
 let lastCellX=NaN,lastCellZ=NaN,lastRebuild=0,lastPose=-Infinity;
 function seedCell(ix,iz){
  return random((Math.imul(ix+841,73856093)^Math.imul(iz-329,19349663)^seed^0x16b00b)>>>0);
 }
 function rebuild(ix,iz){
  records.length=0;
  for(let cz=iz-range;cz<=iz+range;cz++){
   for(let cx=ix-range;cx<=ix+range;cx++){
    const rng=seedCell(cx,cz);
    const patches=2+Math.floor(rng()*3);
    for(let j=0;j<patches&&records.length<max;j++){
     const x=(cx+.15+rng()*.70)*spacing,z=(cz+.15+rng()*.70)*spacing;
     const habitat=habitatAt(x,z,seed);
     const region=habitat.type,coastal=region==='ocean'||region==='shore';
     if(!coastal&&habitat.height<4)continue;
     const active=coastal?1:region==='forest'?.94:region==='rock'?.36:.82;
     if(rng()>active)continue;
     const large=coastal?rng()<.62:rng()<.12;
     const wingspan=large?.9+rng()*.7:.24+rng()*.22;
     const altitude=coastal?12+rng()*55:
       large?80+rng()*140:
       region==='forest'?12+rng()*35:12+rng()*75;
     const palette=colors[region]||colors.meadow;
     const color=palette[Math.floor(rng()*palette.length)];
     records.push({x,z,y:(coastal&&habitat.height<0?0:habitat.height)+altitude,
       wingScale:wingspan/1.64,color,tint:new THREE.Color(color),
       phase:rng()*6.283,speed:5+rng()*8,roam:7+rng()*28,heading:rng()*6.283});
    }
   }
  }
  for(let i=0;i<records.length;i++){
   const col=records[i].tint;
   for(const m of instances)m.setColorAt(i,col);
  }
  for(const m of instances){
   m.count=records.length;
   if(m.instanceColor)m.instanceColor.needsUpdate=true;
  }
  lastRebuild++;
 }
 function update(time,hero=null,observer=null,day=1,rain=0){
  flutter.value=time;
  if(!hero)return;
  const ix=Math.floor(hero.x/spacing),iz=Math.floor(hero.z/spacing);
  if(ix!==lastCellX||iz!==lastCellZ){
   lastCellX=ix;lastCellZ=iz;rebuild(ix,iz);
  }
  if(time-lastPose<.12)return;
  lastPose=time;
  let count=0;
  for(let i=0;i<records.length;i++){
   const b=records[i];
   const theta=b.heading+Math.sin(time*.037+b.phase)*.34;
   const px=b.x+Math.cos(time*.21+b.phase)*b.roam;
   const pz=b.z+Math.sin(time*.19+b.phase)*b.roam;
   const proximity=Math.hypot(px-hero.x,pz-hero.z);
   if(proximity>790)continue;
   const py=b.y+Math.sin(time*.65+b.phase)*2.2;
   const distance=observer?Math.hypot(px-observer.x,pz-observer.z):proximity;
   if(distance>920)continue;
   const fade=clamp((780-proximity)/80,0,1);
   // Away from the coast, birds are mostly diurnal; some birds remain active
   // at dusk, but storms naturally lower the count of visible flights.
   const weatherWeight=1-clamp(rain,0,1)*.38;
   if(fade*weatherWeight<.1)continue;
   dummy.position.set(px,py,pz);
   dummy.rotation.set(Math.sin(time*.5+b.phase)*.07,theta,Math.sin(time*.32+b.phase)*.10);
   dummy.scale.setScalar(b.wingScale);
   dummy.updateMatrix();
   // Color is indexed by the compacted visible position as well as geometry.
   const color=b.tint;
   for(const m of instances){
    m.setMatrixAt(count,dummy.matrix);
    m.setColorAt(count,color);
   }
   count++;
  }
  for(const m of instances){
   m.count=count;m.instanceMatrix.needsUpdate=true;
   if(m.instanceColor)m.instanceColor.needsUpdate=true;
  }
 }
 return {root,body,head,wings,update,
   get stats(){return {population:records.length,visible:body.count,
     cellUpdates:lastRebuild,drawCalls:3};},
   dispose(){
    scene.remove(root);bodyGeo.dispose();headGeo.dispose();wingGeo.dispose();
    mainMat.dispose();wingMat.dispose();
   }};
}
