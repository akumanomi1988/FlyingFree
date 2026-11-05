import {terrainHeight,clamp} from './core.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {habitatAt,foliageDensity,makeCellRandom,insectActivity} from './ecology.js';
import {GROUND_DETAIL_SCALE} from './worldScale.js';

// A bounded mesh pool, never individual thousands of Mesh objects.
// 3 detail levels: landscape canopy > local meadow vegetation > pollinating insects.
function grassBladeGeometry(THREE){
 const verts=[],colors=[];
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5,cx=Math.cos(a),cz=Math.sin(a),width=.23+(i%2)*.07,height=3.0+(i%3)*.4;
  const x1=-cz*width,z1=cx*width;
  const points=[[x1,0,z1],[-x1,0,-z1],[cx*.7,height,cz*.7]];
  for(const p of points){verts.push(...p);colors.push(.54,.84,.45);}
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 g.computeVertexNormals();return g;
}
function blossomGeometry(THREE){
 const components=[];
 // Visible slender stem and a cluster of five round petals, not a generic stone sphere.
 const stem=new THREE.CylinderGeometry(.10,.13,3.15,5);
 stem.translate(0,1.58,0);components.push(stem);
 for(let i=0;i<5;i++){
  const a=i*2*Math.PI/5;
  const petal=new THREE.SphereGeometry(.54,6,5);
  petal.scale(.8,.22,.55);petal.rotateY(a);
  petal.translate(Math.cos(a)*.47,3.18,Math.sin(a)*.47);
  components.push(petal);
 }
 const center=new THREE.SphereGeometry(.27,6,5);
 center.translate(0,3.30,0);components.push(center);
 const result=mergeGeometries(components);
 for(const geo of components)geo.dispose();
 return result;
}
function shrubGeometry(THREE){
 const clusters=[];
 for(const [x,y,z,sc] of [[0,2,0,1],[-1.6,2.4,.3,.69],[1.3,2.1,1.0,.72],[.5,2.55,-1.3,.70]]){
  const g=new THREE.IcosahedronGeometry(2.4,1);
  g.scale(sc,sc*.68,sc);g.translate(x,y,z);clusters.push(g);
 }
 const result=mergeGeometries(clusters);
 for(const g of clusters)g.dispose();
 return result;
}
export function createGroundDetail(THREE,scene,quality=1,windField=null){
 const dummy=new THREE.Object3D();
 const spec=[
  {name:'grass',geo:grassBladeGeometry(THREE),color:0x80aa69,n:Math.round(2800*quality),kind:11},
  {name:'flowers',geo:blossomGeometry(THREE),color:0xffffff,n:Math.round(520*quality),kind:22},
  {name:'shrubs',geo:shrubGeometry(THREE),color:0xffffff,n:Math.round(200*quality),kind:33}
 ];
 const green=[0x4d874e,0x75a956,0x92b572,0x5d9360,0x668e54].map(c=>new THREE.Color(c));
 const bloom=[0xe7d27a,0xd4a1b8,0xece7de,0xb1b1dc,0xe7aa88].map(c=>new THREE.Color(c));
 const brushes=[0x55845f,0x769e64,0x407c60,0x8eae6d].map(c=>new THREE.Color(c));
 const meshes=spec.map(s=>{
  const material=new THREE.MeshStandardMaterial({color:s.color,roughness:1,side:THREE.DoubleSide,flatShading:s.name==='shrubs'});
  if(windField)windField.apply(material,{amplitude:s.name==='grass'?.68:s.name==='flowers'?.27:.35,height:s.name==='shrubs'?6:3.8,frequency:s.name==='grass'?1.4:.78});
  const mesh=new THREE.InstancedMesh(s.geo,material,s.n);
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
   const scale=(.55+rng()*1.55)*GROUND_DETAIL_SCALE[item.name];
   dummy.position.set(x,h.height+.025,z);
   dummy.rotation.set(0,rng()*Math.PI*2,item.name==='grass'?(rng()-.5)*.17:0);
   dummy.scale.set(scale,scale*(item.name==='grass'?.7+rng()*.5:1),scale);
   dummy.updateMatrix();
   item.mesh.setMatrixAt(count,dummy.matrix);
   if(item.name==='flowers'){item.mesh.setColorAt(count,bloom[Math.floor(rng()*bloom.length)]);flowers.push({x,y:h.height+3.1*scale,z});}
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
   const x=flower?flower.x+(rng()-.5)*1.5:cx+(rng()-.5)*280;
   const z=flower?flower.z+(rng()-.5)*1.5:cz+(rng()-.5)*280;
   const biome=habitatAt(x,z);
   if(biome.type==='ocean'||biome.type==='rock')continue;
   bugs.push({x,z,y:flower?flower.y+.1+rng()*.35:biome.height+.25+rng()*.9,phase:rng()*6.283,speed:1+rng()*2.2});
  }
  insects.count=bugs.length;
 }
 function tickInsects(t,amount){
  const count=Math.floor(bugs.length*amount);
  for(let i=0;i<count;i++){
   const bug=bugs[i],dx=Math.sin(t*bug.speed+bug.phase)*.35,dz=Math.cos(t*bug.speed*.81+bug.phase)*.35;
   dummy.position.set(bug.x+dx,bug.y+Math.sin(t*bug.speed*1.3+bug.phase)*.13,bug.z+dz);
   dummy.rotation.set(0,t*bug.speed,0);
   const s=.033+.012*Math.cos(t*bug.speed);dummy.scale.set(s,s,s);dummy.updateMatrix();insects.setMatrixAt(i,dummy.matrix);
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
