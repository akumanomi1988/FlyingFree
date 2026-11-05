import {random,terrainHeight,clamp} from './core.js';

// Close-range airborne particles: dust in daylight, fireflies at dusk.
// A pair of small point-cloud buffers is updated at 10 Hz rather than per frame.
export function createAtmospherics(THREE,scene,quality=1){
 const rng=random(7722),count=Math.round(120*quality),lights=Math.round(55*quality);
 function cloud(n,color,size){
   const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));
   const m=new THREE.PointsMaterial({color,size,sizeAttenuation:true,transparent:true,
     opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending,fog:true});
   const p=new THREE.Points(g,m);p.frustumCulled=false;p.visible=false;
   scene.add(p);return p;
 }
 const pollen=cloud(count,0xe6d5a0,2.4),fireflies=cloud(lights,0xe3dd80,4);
 const seeds=Array.from({length:count},()=>({x:(rng()-.5)*180,z:(rng()-.5)*180,
   y:rng()*37,phase:rng()*6.283,rate:.4+rng()*.9}));
 const sparks=Array.from({length:lights},()=>({x:(rng()-.5)*190,z:(rng()-.5)*190,
   y:2+rng()*21,phase:rng()*6.283,rate:.35+rng()*.7}));
 let last=-Infinity,active=0;
 function populate(mesh,items,t,origin){
  const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<items.length;i++){
   const a=items[i],x=origin.x+a.x,z=origin.z+a.z;
   const ground=terrainHeight(x,z);
   p.setXYZ(i,x+Math.sin(t*a.rate+a.phase)*2,
    ground+a.y+Math.sin(t*.85+a.phase)*1.1,
    z+Math.cos(t*a.rate*.71+a.phase)*2);
  }
  p.needsUpdate=true;
 }
 function update(t,camera,bird,day,weather){
  if(t-last<.10)return;last=t;
  const altitude=bird.y-terrainHeight(bird.x,bird.z);
  if(altitude>155||Math.abs(bird.x)>2300||Math.abs(bird.z)>2150){
   pollen.visible=fireflies.visible=false;active=0;return;
  }
  const dry=clamp(1-(weather.rain||0)*2.2);
  const dusk=clamp(1-Math.abs(day-.10)*5.0);
  pollen.visible=day>.38&&dry>.2;
  fireflies.visible=day<.28&&dry>.3;
  pollen.material.opacity=.20+.18*dry;
  fireflies.material.opacity=.33+.4*dusk;
  if(pollen.visible)populate(pollen,seeds,t,bird);
  if(fireflies.visible)populate(fireflies,sparks,t,bird);
  active=(pollen.visible?count:0)+(fireflies.visible?lights:0);
 }
 return {update,get activeCount(){return active},pollen,fireflies};
}
