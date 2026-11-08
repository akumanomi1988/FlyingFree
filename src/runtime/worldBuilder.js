import {TAU,random,smooth,terrainHeight} from '../core.js';
import {habitatAt} from '../ecology.js';
import {tropicalTerrainSample,TROPICAL_WORLD} from '../tropicalTerrain.js';
import {createOcean} from '../renderfx.js';
import {createTropicalRivers} from '../tropicalRivers.js';
import {createCoastalCliffs} from '../coastalCliffs.js';
import {createForestVisibility} from '../forestVisibility.js';
import {createTreeDetail} from '../treeDetail.js';
import {createCloudField} from '../cloudField.js';
import {TREE_HEIGHT_M} from '../worldScale.js';

// World composition is seed-driven; it receives a scene and returns explicit
// resource handles. The simulation owns their lifetime through sceneAdapter.
export function buildWorld({THREE,scene,worldSeed,width,windField,adaptiveResolution,scaleFactor}){
  let terrain,water,oceanFX,rivers,cliffs,forest,forestVisibility,treeDetail,
    cloudField,clouds=[],stars,starMat;
  const temp=new THREE.Object3D();
function createLandscape(){
  // The former 4.3 km radial patch was a small repeated pancake. A single
  // larger mesh now holds a deterministic volcanic island for each day/seed.
  const g=new THREE.PlaneGeometry(TROPICAL_WORLD.extent,TROPICAL_WORLD.extent,250,250);
  g.rotateX(-Math.PI/2);
  const p=g.getAttribute('position'),colors=new Float32Array(p.count*3);
  const tint=new THREE.Color(),rng=random(worldSeed^0x78eb21);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),land=tropicalTerrainSample(x,z,worldSeed);
    const y=land.height;
    p.setY(i,y);
    if(y<TROPICAL_WORLD.seaLevel)tint.set('#367b87');
    else if(y<23)tint.set('#d8c996');
    else if(land.river>.32||land.valley>.5)tint.set('#347c57');
    else if(y<160)tint.set('#397c51');
    else if(y<370)tint.set('#2f7950');
    else if(y<580)tint.set('#497c54');
    else if(y<760)tint.set('#66806a');
    else tint.set('#7f817c');
    const shade=.84+rng()*.21+land.mountain*.09;
    colors[i*3]=tint.r*shade;colors[i*3+1]=tint.g*shade;colors[i*3+2]=tint.b*shade;
  }
  p.needsUpdate=true;
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  g.computeVertexNormals();
  terrain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,flatShading:false
  }));
  terrain.name='seeded-tropical-volcanic-terrain';
  scene.add(terrain);
  oceanFX=createOcean(THREE,scene,worldSeed);water=oceanFX.mesh;
  rivers=createTropicalRivers(THREE,scene,worldSeed);
  cliffs=createCoastalCliffs(THREE,scene,worldSeed);
}
function createForest(){
  const rng=random(worldSeed);
  const n=width<720?2250:4400;
  const treeRecords=[];
  const foliage=(color,animate=false,amplitude=.8,height=19)=>{
    const material=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
    if(animate)windField.apply(material,{amplitude,height,frequency:.67});
    return material;
  };
  const lower=new THREE.InstancedMesh(new THREE.ConeGeometry(8,21,7),foliage('#609c70',true,.58,21),n);
  const upper=new THREE.InstancedMesh(new THREE.ConeGeometry(6,20,7),foliage('#729f70',true,.68,20),n);
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.05,1.55,16,6),foliage('#635c4b'),n);
  const broad=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(11,1),foliage('#7eac72',true,.45,20),n);
  const cypress=new THREE.InstancedMesh(new THREE.ConeGeometry(4.9,43,7),foliage('#3b7954',true,.46,43),n);
  const olive=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(8.5,1),foliage('#9aaa78',true,.39,17),n);
  const birch=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(9,1),foliage('#90b08c',true,.44,18),n);
  const greens=['#17643a','#287647','#397e4b','#1e6840','#3e8754'].map(c=>new THREE.Color(c));
  const broadGreens=['#17663e','#217a4a','#3b8953','#246d43','#397b49','#4a965a']
    .map(c=>new THREE.Color(c));
  // Palm crowns are seven fronds per trunk, instanced into ONE draw call.
  const frondPositions=[],frondIndices=[];
  for(let t=0;t<=8;t++){
    const u=t/8,width=Math.sin(u*Math.PI),droop=.38*Math.sin(Math.PI*u)-.52*u*u;
    for(const side of [-1,0,1])
      frondPositions.push(side*width,droop+(side===0?.07:0),u);
    if(t<8){
      const k=t*3;
      frondIndices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);
    }
  }
  const frondGeometry=new THREE.BufferGeometry();
  frondGeometry.setAttribute('position',new THREE.Float32BufferAttribute(frondPositions,3));
  frondGeometry.setIndex(frondIndices);frondGeometry.computeVertexNormals();
  const palmLeaves=new THREE.InstancedMesh(frondGeometry,
    new THREE.MeshStandardMaterial({color:0x397e43,roughness:1,side:THREE.DoubleSide}),
    n*7);
  windField.apply(palmLeaves.material,{amplitude:.17,height:1,frequency:.81});
  let palms=0;
  let pines=0,deciduous=0,cypresses=0,olives=0,birches=0,trees=0;
  for(let attempt=0;attempt<n*8&&trees<n;attempt++){
    const x=(rng()-.5)*9950,z=(rng()-.5)*8600;
    const candidate=tropicalTerrainSample(x,z,worldSeed),y=candidate.height;
    // No trees grow through the current; riparian woodland starts on dry banks.
    if(candidate.river>.23||y<12||y>730||rng()<smooth(430,700,y)*.48)continue;
    const habitat=habitatAt(x,z,worldSeed);
    if(habitat.type==='rock'||habitat.slope>1.02)continue;
    const s=.78+rng()*.50,a=rng()*TAU;
    // Tropical canopy dominates; palms concentrate on coastal plains and
    // mangrove-like crowns line the humid river corridors.
    const kind=y<135&&rng()<(habitat.type==='shore'?.80:.32)?'palm':
      habitat.type==='wetland'?'mangrove':
      y>515?(rng()<.38?'cypress':'pine'):
      habitat.type==='forest'||rng()<.76?'oak':'birch';
    const h=(kind==='palm'?18:kind==='mangrove'?14:TREE_HEIGHT_M[kind])*s;
    const trunkRatio=kind==='palm'?.82:kind==='mangrove'?.57:
      kind==='olive'?.43:kind==='birch'?.58:kind==='oak'?.44:kind==='cypress'?.34:.47;
    const trunkThickness=kind==='palm'?.12:kind==='mangrove'?.46:
      kind==='olive'?.26:kind==='birch'?.30:kind==='oak'?.58:kind==='cypress'?.43:.52;
    const trunkHeight=h*trunkRatio;
    temp.rotation.set(0,a,0);
    temp.position.set(x,y+trunkHeight*.5,z);
    temp.scale.set(s*trunkThickness,trunkHeight/16,s*trunkThickness);
    temp.updateMatrix();trunk.setMatrixAt(trees,temp.matrix);
    if(kind==='palm'){
      const leafColor=new THREE.Color().setHSL(.30+rng()*.08,.30+rng()*.18,.24+rng()*.14);
      for(let k=0;k<7;k++){
        temp.position.set(x,y+h*.85,z);
        temp.rotation.set(0,a+k*TAU/7,0);
        temp.scale.set(h*.11,h*.16,h*.37);
        temp.updateMatrix();
        const slot=palms*7+k;
        palmLeaves.setMatrixAt(slot,temp.matrix);
        palmLeaves.setColorAt(slot,leafColor);
      }
      palms++;
    }else if(kind==='cypress'){
      temp.position.set(x,y+h*.52,z);
      temp.scale.set(h*.16/4.9,h*.96/43,h*.16/4.9);
      temp.updateMatrix();cypress.setMatrixAt(cypresses++,temp.matrix);
    }else if(kind==='olive'){
      temp.position.set(x,y+h*.66,z);
      temp.scale.set(h*.45/8.5,h*.32/8.5,h*.45/8.5);
      temp.updateMatrix();olive.setMatrixAt(olives++,temp.matrix);
    }else if(kind==='birch'){
      temp.position.set(x,y+h*.72,z);
      temp.scale.set(h*.24/9,h*.28/9,h*.24/9);
      temp.updateMatrix();birch.setMatrixAt(birches++,temp.matrix);
    }else if(kind==='oak'||kind==='mangrove'){
      temp.position.set(x,y+h*.70,z);
      temp.scale.set(h*.40/11,h*.30/11,h*.40/11);
      temp.updateMatrix();broad.setMatrixAt(deciduous,temp.matrix);
      broad.setColorAt(deciduous,broadGreens[Math.floor(rng()*broadGreens.length)]);
      deciduous++;
    }else{
      temp.position.set(x,y+h*.49,z);
      temp.scale.set(s*.85,h*.70/21,s*.85);
      temp.updateMatrix();lower.setMatrixAt(pines,temp.matrix);
      lower.setColorAt(pines,greens[Math.floor(rng()*greens.length)]);
      temp.position.set(x,y+h*.74,z);
      temp.scale.set(s*.65,h*.52/20,s*.65);
      temp.updateMatrix();upper.setMatrixAt(pines,temp.matrix);
      upper.setColorAt(pines,greens[Math.floor(rng()*greens.length)]);
      pines++;
    }
    treeRecords.push({x,y,z,height:h,kind,angle:a});
    trees++;
  }
  trunk.count=trees;lower.count=upper.count=pines;broad.count=deciduous;cypress.count=cypresses;olive.count=olives;birch.count=birches;
  palmLeaves.count=palms*7;
  for(const inst of [trunk,lower,upper,broad,cypress,olive,birch,palmLeaves]){
    inst.instanceMatrix.needsUpdate=true;
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    inst.frustumCulled=false;
    scene.add(inst);
  }
  forest={leaves:lower,trunks:trunk,trees,count:trees,pines,deciduous,cypresses,olives,birches,palms,
    perches:treeRecords};
  forestVisibility=createForestVisibility(
    {trunk,lower,upper,broad,cypress,olive,birch,palmLeaves},
    treeRecords,worldSeed,{radius:width<720?2200:2600}
  );
  forestVisibility.setQuality(scaleFactor/adaptiveResolution.snapshot().maxScale);
  treeDetail=createTreeDetail(THREE,scene,treeRecords,width<720?.60:1,windField);
  const rockMaterial=foliage('#7c8679');
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rockMaterial,95);
  let j=0;
  for(let attempt=0;attempt<850&&j<95;attempt++){
    const x=(rng()-.5)*7700,z=(rng()-.5)*7000,y=terrainHeight(x,z,worldSeed);
    if(y<480)continue;
    const scale=6+rng()*13;
    temp.position.set(x,y-1,z);temp.rotation.set(rng(),rng()*TAU,rng());
    temp.scale.set(scale,scale*.45,scale*.82);temp.updateMatrix();
    rocks.setMatrixAt(j++,temp.matrix);
  }
  rocks.count=j;rocks.instanceMatrix.needsUpdate=true;scene.add(rocks);
}
function createClouds(){
  cloudField=createCloudField(THREE,scene,{mobile:width<720});
  clouds=cloudField.clouds;
}
function createStars(){
  const rand=random(773),pts=[];
  for(let i=0;i<2500;i++){
    const u=rand()*TAU,v=rand()*Math.PI*.48;
    const r=7900;pts.push(Math.sin(u)*Math.cos(v)*r,Math.sin(v)*r+370,Math.cos(u)*Math.cos(v)*r);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  starMat=new THREE.PointsMaterial({color:0xebf0f1,size:3.1,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false});
  stars=new THREE.Points(g,starMat);scene.add(stars);
}

  createLandscape();createForest();createClouds();createStars();
  return {terrain,water,oceanFX,rivers,cliffs,forest,forestVisibility,
    treeDetail,cloudField,clouds,stars,starMat};
}
