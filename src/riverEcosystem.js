import {random,terrainHeight,clamp} from './core.js';
import {tropicalRiverPoint,TROPICAL_WORLD} from './tropicalTerrain.js';

// River wildlife and banks are deterministic world objects. Large populations
// share just four instanced draw calls; the fish CPU pose is updated at 6 Hz,
// while wind sway is calculated per vertex on the GPU.
export function createRiverEcosystem(THREE,scene,seed=1988,quality=1){
 const root=new THREE.Group();root.name='river-banks-and-life';scene.add(root);
 const rng=random(seed^0x47ae381),dummy=new THREE.Object3D();
 const up=new THREE.Vector3(0,1,0),vector=new THREE.Vector3();
 const slots=Math.max(68,Math.round(125*quality));
 const maxRocks=Math.round(2100*quality),maxReeds=Math.round(3000*quality),
   maxShrubs=Math.round(700*quality),maxFish=Math.round(320*quality);
 const rockGeometry=new THREE.IcosahedronGeometry(1,1);
 const reedGeometry=new THREE.ConeGeometry(1,1,5,2);
 reedGeometry.translate(0,.5,0);
 const shrubGeometry=new THREE.IcosahedronGeometry(1,1);
 const fishGeometry=new THREE.BufferGeometry();
 // A tapered three-dimensional fish with symmetrical tail and dorsal fin.
 const vertices=[
  -.22,0,-.40, .22,0,-.40, 0,.20,-.15,
  -.22,0,-.40, 0,.20,-.15, 0,0,.55,
  .22,0,-.40, 0,0,.55, 0,.20,-.15,
  -.22,0,-.40, 0,0,.55, 0,-.15,-.05,
  .22,0,-.40, 0,-.15,-.05, 0,0,.55,
  0,0,.5, -.34,.06,.92, .34,.06,.92,
  0,.19,-.18, 0,.36,.22, 0,.05,.40
 ];
 fishGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 fishGeometry.computeVertexNormals();
 const rocks=new THREE.InstancedMesh(rockGeometry,
  new THREE.MeshStandardMaterial({color:0xb3b2a4,roughness:1,flatShading:false}),maxRocks);
 const reedsMaterial=new THREE.MeshStandardMaterial({
  color:0x6fa16d,roughness:1,side:THREE.DoubleSide
 });
 const windTime={value:0};
 reedsMaterial.onBeforeCompile=shader=>{
  shader.uniforms.uReedTime=windTime;
  shader.vertexShader=shader.vertexShader.replace('void main() {',
   'uniform float uReedTime;\nvoid main() {');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\n#ifdef USE_INSTANCING\n transformed.x += .16 * position.y * sin(uReedTime*1.1 + instanceMatrix[3].x*.031 + instanceMatrix[3].z*.018 + position.y);\n#endif');
 };
 reedsMaterial.customProgramCacheKey=()=> 'riparian-reeds-v1';
 const reeds=new THREE.InstancedMesh(reedGeometry,reedsMaterial,maxReeds);
 const shrubs=new THREE.InstancedMesh(shrubGeometry,
  new THREE.MeshStandardMaterial({color:0x629764,roughness:1}),maxShrubs);
 const fish=new THREE.InstancedMesh(fishGeometry,
  new THREE.MeshStandardMaterial({color:0xb9c4a9,metalness:.18,roughness:.58,
   side:THREE.DoubleSide}),maxFish);
 const records=[],upstream={},downstream={},center={};
 let nRocks=0,nReeds=0,nShrubs=0,nFish=0;
 const smallPalette=[0x91a088,0x857d6e,0x9fa89c,0x776f61];
 const foliagePalette=[0x4e8659,0x6ba174,0x83a76f,0x436b50];
 function place(mesh,index,x,y,z,sx,sy,sz,angle=0,lean=0){
  dummy.position.set(x,y,z);dummy.rotation.set(lean,angle,0);
  dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
  mesh.setMatrixAt(index,dummy.matrix);
 }
 // Rocks follow the actual relief on both banks; no arbitrary grid or
 // placement over open sea. Gravel, shrubs, roots and reeds cluster differently.
 for(let c=0;c<TROPICAL_WORLD.riverCount;c++){
  for(let i=0;i<slots;i++){
   const t=.115+(i+rng()*.70)/slots*.80;
   tropicalRiverPoint(c,t,seed,center);
   const cy=terrainHeight(center.x,center.z,seed);
   if(cy<=TROPICAL_WORLD.seaLevel+2)continue;
   tropicalRiverPoint(c,Math.max(.08,t-.0017),seed,upstream);
   tropicalRiverPoint(c,Math.min(.995,t+.0017),seed,downstream);
   const dx=downstream.x-upstream.x,dz=downstream.z-upstream.z;
   const length=Math.hypot(dx,dz)||1;
   const normalX=-dz/length,normalZ=dx/length;
   const currentX=dx/length,currentZ=dz/length;
   const waterWidth=9+20*t+Math.sin(t*19+c)*2;
   const streamY=cy+.45;
   for(const side of [-1,1]){
    for(let k=0;k<4;k++){
     const offset=waterWidth+1+rng()*(k===0?5:k===1?13:k===2?23:37);
     const xx=center.x+normalX*side*offset+
       currentX*(rng()-.5)*10;
     const zz=center.z+normalZ*side*offset+
       currentZ*(rng()-.5)*10;
     const gy=terrainHeight(xx,zz,seed);
     if(gy<=TROPICAL_WORLD.seaLevel||gy>900)continue;
     if(nRocks<maxRocks&&(k<=1||rng()<.65)){
      const size=k===0?.35+rng()*.55:.6+rng()*1.6;
      place(rocks,nRocks,xx,gy+size*.18,zz,
       size*(1+rng()*.45),size*(.36+rng()*.20),size*(.75+rng()*.55),
       rng()*Math.PI*2,(rng()-.5)*.2);
      rocks.setColorAt(nRocks,new THREE.Color(smallPalette[Math.floor(rng()*4)]));
      nRocks++;
     }
     if(nReeds<maxReeds&&(k===1||k===2)&&rng()<.92){
      for(let tuft=0;tuft<3&&nReeds<maxReeds;tuft++){
       const height=.7+rng()*2.9;
       const px=xx+(rng()-.5)*3,pz=zz+(rng()-.5)*3;
       const py=terrainHeight(px,pz,seed);
       place(reeds,nReeds,px,py+.03,pz,.08+rng()*.13,height,.07+rng()*.11,
        rng()*Math.PI*2,(rng()-.5)*.16);
       reeds.setColorAt(nReeds,new THREE.Color(foliagePalette[Math.floor(rng()*4)]));
       nReeds++;
      }
     }
     if(nShrubs<maxShrubs&&k>=2&&rng()<.65){
      const size=.8+rng()*2.3;
      place(shrubs,nShrubs,xx,gy+size*.55,zz,size,size*.68,size,rng()*6.28);
      shrubs.setColorAt(nShrubs,new THREE.Color(foliagePalette[Math.floor(rng()*4)]));
      nShrubs++;
     }
    }
   }
   // Small shoals remain inside the same seeded water channel. The fish do
   // not materialize on a dry meadow or jump across distant parts of the map.
   if(nFish<maxFish&&rng()<.64){
    for(let j=0;j<4&&nFish<maxFish;j++){
     const lateral=(rng()-.5)*waterWidth*.68;
     const longitudinal=(rng()-.5)*7;
     const px=center.x+normalX*lateral+currentX*longitudinal;
     const pz=center.z+normalZ*lateral+currentZ*longitudinal;
     const tint=new THREE.Color([0x86b2ac,0xa6a26d,0x7fa69b][Math.floor(rng()*3)]);
     records.push({x:px,z:pz,y:streamY-.17,
      alongX:currentX,alongZ:currentZ,sideX:normalX,sideZ:normalZ,
      phase:rng()*Math.PI*2,scale:.26+rng()*.32,channel:c,tint});
     fish.setColorAt(nFish,tint);
     nFish++;
    }
   }
  }
 }
 for(const [mesh,count] of [[rocks,nRocks],[reeds,nReeds],[shrubs,nShrubs],[fish,nFish]]){
  mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.frustumCulled=false;root.add(mesh);
 }
 const stats={rocks:nRocks,reeds:nReeds,shrubs:nShrubs,fish:nFish,drawCalls:4};
 let lastFrame=-Infinity,lastVisible=-1;
 function update(t,observer=null){
  windTime.value=t;
  if(t-lastFrame<.16)return;
  lastFrame=t;
  let count=0;
  for(let i=0;i<records.length;i++){
   const f=records[i];
   // Water life is expensive to perceive at altitude; near-view-only fish
   // matrices are updated six times/second, with no new scene objects.
   if(observer){
    const dx=f.x-observer.x,dz=f.z-observer.z;
    if(dx*dx+dz*dz>600*600||Math.abs(f.y-observer.y)>340)continue;
   }
   const travel=Math.sin(t*.62+f.phase)*3.6;
   const weave=Math.sin(t*1.3+f.phase)*.82;
   const fx=f.x+f.alongX*travel+f.sideX*weave;
   const fz=f.z+f.alongZ*travel+f.sideZ*weave;
   const swimY=f.y+Math.sin(t*2.2+f.phase)*.065;
   const heading=Math.atan2(-f.alongX,-f.alongZ)+Math.sin(t*1.7+f.phase)*.20;
   place(fish,count,fx,swimY,fz,f.scale,f.scale,f.scale,heading);
   fish.setColorAt(count,f.tint);
   count++;
  }
  fish.count=count;
  fish.visible=count>0;
  if(count>0||lastVisible!==count){
   fish.instanceMatrix.needsUpdate=true;
   if(fish.instanceColor)fish.instanceColor.needsUpdate=true;
  }
  lastVisible=count;
 }
 update(0,null);
 return {root,rocks,reeds,shrubs,fish,stats,update,
  get visibleFish(){return fish.count;},
  dispose(){
   scene.remove(root);
   for(const m of [rocks,reeds,shrubs,fish]){
    m.geometry.dispose();m.material.dispose();
   }
  }};
}
