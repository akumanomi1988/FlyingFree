import {terrainHeight,random,TAU} from './core.js';
import {TROPICAL_WORLD} from './tropicalTerrain.js';

// Coastal rock stacks use real seed-based shoreline crossings. Static
// instancing makes large silhouettes appear at all viewing distances instead
// of spawning meshes near the camera.
export function createCoastalCliffs(THREE,scene,seed=1988){
 const rng=random((seed^0x6acc0a5)|0);
 const geometry=new THREE.DodecahedronGeometry(1,1);
 const material=new THREE.MeshStandardMaterial({color:0x7c8177,
   roughness:.96,metalness:0,flatShading:false});
 const maxCount=96,rock=new THREE.InstancedMesh(geometry,material,maxCount);
 const dummy=new THREE.Object3D(),stone=new THREE.Color();
 let count=0,clusters=0;
 for(let sector=0;sector<32;sector++){
   const theta=(sector+.18+rng()*.6)/32*TAU;
   const dx=Math.cos(theta),dz=Math.sin(theta);
   let coast=null;
   // Find water from an inland ray; no fixed ellipse or preplaced cliff.
   for(let dist=2050;dist<5700;dist+=34){
     const y=terrainHeight(dx*dist,dz*dist,seed);
     const outside=terrainHeight(dx*(dist+64),dz*(dist+64),seed);
     if(y>=TROPICAL_WORLD.seaLevel&&outside<TROPICAL_WORLD.seaLevel){
       coast=dist;break;
     }
   }
   if(coast===null||rng()<.38)continue;
   const rise=terrainHeight(dx*(coast-85),dz*(coast-85),seed);
   const height=Math.max(14,Math.min(52,rise-TROPICAL_WORLD.seaLevel+10));
   for(let j=0;j<3&&count<maxCount;j++){
     const along=(j-1)*22+(rng()-.5)*7;
     const px=dx*(coast-16)-dz*along,pz=dz*(coast-16)+dx*along;
     const bottom=TROPICAL_WORLD.seaLevel-7;
     dummy.position.set(px,bottom+height*.5,pz);
     dummy.rotation.set((rng()-.5)*.10,rng()*TAU,(rng()-.5)*.12);
     dummy.scale.set(14+rng()*10,height*.51,13+rng()*8);
     dummy.updateMatrix();rock.setMatrixAt(count,dummy.matrix);
     stone.setHSL(.22+rng()*.06,.045+rng()*.08,.35+rng()*.16);
     rock.setColorAt(count,stone);
     count++;
   }
   clusters++;
 }
 rock.count=count;rock.instanceMatrix.needsUpdate=true;
 if(rock.instanceColor)rock.instanceColor.needsUpdate=true;
 rock.frustumCulled=false;rock.name='procedural-coastal-cliff-stacks';
 scene.add(rock);
 return {mesh:rock,clusters,count,dispose(){
   scene.remove(rock);geometry.dispose();material.dispose();
 }};
}
