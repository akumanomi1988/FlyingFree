import {terrainHeight,random} from './core.js';
export function createGroundDetail(THREE,scene,quality=1){
 const rng=random(8123),dummy=new THREE.Object3D();
 const spec=[['grass',new THREE.ConeGeometry(.25,3.2,3),0x78a65f,Math.round(2100*quality)],
 ['flowers',new THREE.IcosahedronGeometry(.6,0),0xdca8bf,Math.round(280*quality)],
 ['shrubs',new THREE.IcosahedronGeometry(2.8,1),0x5c9157,Math.round(110*quality)]];
 const meshes=spec.map(([name,geo,color,n])=>{const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}),n);mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);return {name,mesh,n};});
 let cellX=Infinity,cellZ=Infinity,last=-Infinity,active=false;
 function populate(item,cx,cz){
  let count=0;
  for(let i=0;i<item.n*5&&count<item.n;i++){
   const x=cx+(rng()-.5)*320,z=cz+(rng()-.5)*320,y=terrainHeight(x,z);
   if(y<12||y>(item.name==='shrubs'?235:170))continue;
   dummy.position.set(x,y+(item.name==='shrubs'?2.5:item.name==='flowers'?1.8:1.4),z);
   dummy.rotation.set(0,rng()*Math.PI*2,0);
   const s=.65+rng()*.85;dummy.scale.set(s,s,s);dummy.updateMatrix();
   item.mesh.setMatrixAt(count++,dummy.matrix);
  }
  item.mesh.count=count;item.mesh.instanceMatrix.needsUpdate=true;
 }
 return {update(t,camera,bird){
  if(t-last<.6)return;last=t;
  const focus=bird.y-terrainHeight(bird.x,bird.z)<110?bird:camera.position;
  const height=focus.y-terrainHeight(focus.x,focus.z);
  if(height>(active?185:135)){active=false;meshes.forEach(m=>m.mesh.visible=false);return;}
  const cx=Math.round(focus.x/140)*140,cz=Math.round(focus.z/140)*140;
  if(cx!==cellX||cz!==cellZ){cellX=cx;cellZ=cz;meshes.forEach(m=>populate(m,cx,cz));}
  active=true;meshes.forEach(m=>m.mesh.visible=true);
 },get active(){return active},counts:Object.fromEntries(spec.map(([name,, ,n])=>[name,n]))};
}
