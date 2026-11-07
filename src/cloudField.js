import {random,clamp,TAU} from './core.js';

// Atmospheric lobes share one geometry and material, yet retain the original
// cloud shapes, drifting groups and weather transitions. There are no
// individual cloud meshes in the scene; all lobes use ONE instanced draw call.
export function createCloudField(THREE,scene,{mobile=false}={}){
 const rng=random(2405),geometry=new THREE.SphereGeometry(1,10,7);
 const material=new THREE.MeshLambertMaterial({
  color:0xe2e5e0,transparent:true,opacity:.73,depthWrite:false
 });
 const count=mobile?17:27,clouds=[],lobes=[];
 for(let i=0;i<count;i++){
  const layers=5+Math.floor(rng()*4),height=.7+rng()*.55;
  const baseX=(rng()-.5)*11000,baseY=900+rng()*1500,baseZ=(rng()-.5)*10200,
   rotation=rng()*TAU,cs=Math.cos(rotation),sn=Math.sin(rotation);
  const cloud={baseX,baseY,baseZ,
   velocity:2+rng()*5,drift:rng()*TAU,weight:rng()};
  // The seeded position of each lobe is transformed once. Only translations
  // are updated when the entire cloud moves through the sky.
  for(let j=0;j<layers;j++){
   const u=(j/(layers-1)-.5)*260;
   const lx=u+(rng()-.5)*24,ly=(rng()-.5)*21,lz=(rng()-.5)*75;
   const sx=45+rng()*45,sy=20+rng()*24,sz=40+rng()*38;
   lobes.push({cloud,
    x:lx*cs+lz*sn,y:ly,z:-lx*sn+lz*cs,
    sx,sy,sz,rotation,tint:.84+rng()*.16});
  }
  clouds.push(cloud);
 }
 const mesh=new THREE.InstancedMesh(geometry,material,lobes.length);
 mesh.name='instanced-tropical-cloud-field';
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.frustumCulled=false;
 const dummy=new THREE.Object3D();
 for(let i=0;i<lobes.length;i++){
  const l=lobes[i];
  mesh.setColorAt(i,new THREE.Color().setScalar(l.tint));
 }
 mesh.instanceColor.needsUpdate=true;
 scene.add(mesh);
 let lastMatrixTime=-Infinity,updates=0;
 function update(t=0,cloudCover=.5,day=1,cloudTint=null){
  material.opacity=clamp(.14+cloudCover*.68,0,.89);
  if(cloudTint)material.color.copy(cloudTint).multiplyScalar(.72+day*.27);
  mesh.visible=cloudCover>.035;
  if(!mesh.visible||t-lastMatrixTime<.22)return false;
  lastMatrixTime=t;
  for(let i=0;i<lobes.length;i++){
   const l=lobes[i],c=l.cloud;
   const x=((c.baseX+t*c.velocity+6000)%12000)-6000;
   const z=c.baseZ+Math.sin(t*.02+c.drift)*110;
   dummy.position.set(x+l.x,c.baseY+l.y+Math.sin(t*.003+c.drift)*8,z+l.z);
   dummy.rotation.set(0,l.rotation,0);
   dummy.scale.set(l.sx,l.sy,l.sz);
   dummy.updateMatrix();
   mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
  updates++;
  return true;
 }
 // Establish valid GPU matrices even if the first weather frame is clear.
 update(0,.5,1);
 return {mesh,clouds,update,
  get stats(){return {clouds:clouds.length,lobes:lobes.length,drawCalls:1,updates};},
  dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}
 };
}
