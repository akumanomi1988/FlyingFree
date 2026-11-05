import {terrainHeight,clamp} from './core.js';
import {habitatAt,foliageDensity,makeCellRandom,insectActivity} from './ecology.js';

// A bounded mesh pool, never individual thousands of Mesh objects.
// 3 detail levels: landscape canopy > local meadow vegetation > pollinating insects.
export function createGroundDetail(THREE,scene,quality=1){
 const dummy=new THREE.Object3D();
 const spec=[
  {name:'grass',geo:new THREE.ConeGeometry(.26,3.8,3),color:0x80aa69,n:Math.round(2800*quality),kind:11},
  {name:'flowers',geo:new THREE.IcosahedronGeometry(.78,0),color:0xffffff,n:Math.round(520*quality),kind:22},
  {name:'shrubs',geo:new THREE.IcosahedronGeometry(3.1,1),color:0xffffff,n:Math.round(200*quality),kind:33}
 ];
 const green=[0x4d874e,0x75a956,0x92b572,0x5d9360,0x668e54].map(c=>new THREE.Color(c));
 const bloom=[0xe7d27a,0xd4a1b8,0xece7de,0xb1b1dc,0xe7aa88].map(c=>new THREE.Color(c));
 const brushes=[0x55845f,0x769e64,0x407c60,0x8eae6d].map(c=>new THREE.Color(c));
 const meshes=spec.map(s=>{
  const mesh=new THREE.InstancedMesh(s.geo,new THREE.MeshStandardMaterial({color:s.color,roughness:1,side:THREE.DoubleSide,flatShading:true}),s.n);
  mesh.visible=false;mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);
  return {...s,mesh};
 });
 const nBugs=Math.round(145*quality);
 const insects=new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.55,0),
  new THREE.MeshBasicMaterial({color:0xf0d58a,transparent:true,opacity:.86}),nBugs);
 insects.visible=false;insects.frustumCulled=false;scene.add(insects);
 let cellX=Infinity,cellZ=Infinity,last=-Infinity,lastInsect=-Infinity,active=false;
 const bugs=[],flowers=[];
 const scratch=new THREE.Vector3();
 function populate(item,cx,cz){
  const rng=makeCellRandom(cx,cz,item.kind);
  let count=0;
  for(let i=0;i<item.n*7&&count<item.n;i++){
   const x=cx+(rng()-.5)*350,z=cz+(rng()-.5)*350;
   const h=habitatAt(x,z),density=foliageDensity(h,item.name);
   if(rng()>density)continue;
   const scale=.55+rng()*1.55;
   dummy.position.set(x,h.height+(item.name==='shrubs'?2.45:item.name==='flowers'?2.2:1.7)*scale,z);
   dummy.rotation.set(0,rng()*Math.PI*2,item.name==='grass'?(rng()-.5)*.17:0);
   dummy.scale.set(scale,scale*(item.name==='grass'?.7+rng()*.5:1),scale);
   dummy.updateMatrix();
   item.mesh.setMatrixAt(count,dummy.matrix);
   if(item.name==='flowers'){item.mesh.setColorAt(count,bloom[Math.floor(rng()*bloom.length)]);flowers.push({x,y:h.height+3.1,z});}
   if(item.name==='grass')item.mesh.setColorAt(count,green[Math.floor(rng()*green.length)]);
   if(item.name==='shrubs')item.mesh.setColorAt(count,brushes[Math.floor(rng()*brushes.length)]);
   count++;
  }
  item.mesh.count=count;item.mesh.instanceMatrix.needsUpdate=true;
  if(item.mesh.instanceColor)item.mesh.instanceColor.needsUpdate=true;
 }
 function populateInsects(cx,cz){
  bugs.length=0;const rng=makeCellRandom(cx,cz,44);
  for(let i=0;i<nBugs;i++){
   const flower=flowers.length?flowers[Math.floor(rng()*flowers.length)]:null;
   const x=flower?flower.x+(rng()-.5)*15:cx+(rng()-.5)*280;
   const z=flower?flower.z+(rng()-.5)*15:cz+(rng()-.5)*280;
   const biome=habitatAt(x,z);
   if(biome.type==='ocean'||biome.type==='rock')continue;
   bugs.push({x,z,y:biome.height+3+rng()*6,phase:rng()*6.283,speed:1+rng()*2.2});
  }
  insects.count=bugs.length;
 }
 function tickInsects(t,amount){
  const count=Math.floor(bugs.length*amount);
  for(let i=0;i<count;i++){
   const bug=bugs[i],dx=Math.sin(t*bug.speed+bug.phase)*2.8,dz=Math.cos(t*bug.speed*.81+bug.phase)*2.8;
   dummy.position.set(bug.x+dx,bug.y+Math.sin(t*bug.speed*1.3+bug.phase)*1.25,bug.z+dz);
   dummy.rotation.set(0,t*bug.speed,0);
   const s=.36+.25*Math.cos(t*bug.speed);dummy.scale.set(s,s,s);dummy.updateMatrix();insects.setMatrixAt(i,dummy.matrix);
  }
  insects.count=count;insects.instanceMatrix.needsUpdate=true;
 }
 function update(t,camera,bird,day=1,rain=0,temperature=18){
  if(t-last<.24)return;
  last=t;
  const birdAltitude=bird.y-terrainHeight(bird.x,bird.z);
  const focus=birdAltitude<120?bird:camera.position;
  const altitude=focus.y-terrainHeight(focus.x,focus.z);
  if(altitude>(active?190:135)){active=false;meshes.forEach(m=>m.mesh.visible=false);insects.visible=false;return;}
  const cx=Math.round(focus.x/140)*140,cz=Math.round(focus.z/140)*140;
  if(cx!==cellX||cz!==cellZ){
   cellX=cx;cellZ=cz;flowers.length=0;
   for(const item of meshes)populate(item,cx,cz);
   populateInsects(cx,cz);
  }
  active=true;meshes.forEach(m=>m.mesh.visible=true);
  const activity=insectActivity(day,rain,temperature);
  insects.visible=activity>.08&&bugs.length>0;
  if(insects.visible&&t-lastInsect>.35){lastInsect=t;tickInsects(t,activity);}
 }
 return {update,get active(){return active},
  get insectCount(){return insects.visible?insects.count:0},
  counts:Object.fromEntries(spec.map(s=>[s.name,s.n])),insects};
}
